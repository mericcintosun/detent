"use client";

// The console's state and every call it makes, in one hook.
//
// Behaviour and wire calls are the ones components/operations-console.tsx made
// before the split: the same two POST /api/detent bodies, the same focus hand
// offs, the same audit entries. What is new is the fee read after a lock in
// real mode, the offline gate on both network actions, and the failure control
// as plain data (lib/wallet-state.ts failureControlFor) so no render reaches a
// ref.

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/ui/toast-manager";
import { actions, type ActionKind } from "@/lib/data";
import { MIRROR_FEE_SENTENCE, readFeeQuote, type FeeQuote } from "@/lib/fees";
import {
  callTargetProvenance,
  readReceipt,
  registerProvenance,
  tokenExplorerHref,
} from "@/lib/hashscan";
import {
  CHAIN_ID,
  buildPlan,
  decideTamperedSend,
  formatMicros,
  microsToInput,
  registerHeldCount,
  shortHex,
  type PlanRow,
} from "@/lib/plan";
import { ADAPTER_MODE } from "@/lib/public-config";
import type {
  PolicyInstallation,
  RegisterSnapshot,
  SubmitResult,
} from "@/lib/types";
import {
  deriveTreasuryKeyState,
  describeFailure,
  describePolicyRelease,
  failureControlFor,
  type FailureRun,
} from "@/lib/wallet-state";
import {
  anchorParts,
  readApiResponse,
  retryAfterOf,
  stamp,
  type AuditEntry,
  type ConsoleFailure,
} from "./api";
import { useOnline } from "./use-browser";

/** The fee line: nothing asked yet, a read in flight, or a quote. */
export type FeeState = { kind: "idle" } | { kind: "loading" } | FeeQuote;

export function useConsole({
  snapshot,
  signerLive,
}: {
  snapshot: RegisterSnapshot;
  signerLive: boolean;
}) {
  const [kind, setKind] = useState<ActionKind>("coupon");
  const [deferred, setDeferred] = useState<string[]>([]);
  const [forced, setForced] = useState<string[]>([]);
  const [approvals, setApprovals] = useState<string[]>([]);
  const [installation, setInstallation] = useState<PolicyInstallation | null>(
    null,
  );
  const [settlement, setSettlement] = useState<SubmitResult | null>(null);
  const [pending, setPending] = useState<"lock" | "send" | null>(null);
  const [failure, setFailure] = useState<ConsoleFailure | null>(null);
  const [tamperInput, setTamperInput] = useState<string | null>(null);
  const [log, setLog] = useState<AuditEntry[]>([]);
  /** Why the amount field was not sent: unreadable, or the approved amount. */
  const [tamperNotice, setTamperNotice] = useState<{
    kind: "invalid" | "unchanged";
    message: string;
  } | null>(null);
  /** A corporate action picked while a plan is locked, awaiting confirmation. */
  const [pendingSwitch, setPendingSwitch] = useState<ActionKind | null>(null);
  /** What the last send was, so the retry and the relay action can re-fire it. */
  const [lastSend, setLastSend] = useState<{
    tampered: boolean;
    preference?: "auto" | "signature";
  } | null>(null);
  /** Real mode only. The mirror's fee line is a sentence, not a read. */
  const [feeRead, setFeeRead] = useState<FeeState>({ kind: "idle" });

  const online = useOnline();

  /**
   * The element that should take focus once the next render lands. A control
   * that disables itself while a call is in flight drops focus to the body, so
   * every answer hands focus to the place that reports it.
   */
  const focusNext = useRef<string | null>(null);
  useEffect(() => {
    const id = focusNext.current;
    if (!id) return;
    const element = document.getElementById(id);
    if (!element) return;
    focusNext.current = null;
    element.focus();
  });

  const plan = useMemo(
    () =>
      buildPlan({
        kind,
        deferred,
        forced,
        holders: snapshot.holders,
        treasuryMicros: snapshot.treasury.balanceMicros,
      }),
    [kind, deferred, forced, snapshot.holders, snapshot.treasury.balanceMicros],
  );

  const action = actions.find((entry) => entry.kind === kind) ?? actions[0];
  const includedRows = plan.rows.filter((row) => row.included);
  const heldCount = registerHeldCount(snapshot.holders);
  const firstRow = includedRows[0];
  const tamperValue =
    tamperInput ?? (firstRow ? microsToInput(firstRow.amountMicros) : "");
  const locked = installation !== null;
  const quorumMet = approvals.length >= 2;

  /**
   * What came back from the last send, and whether it may be linked. Defaults
   * to synthetic for anything that does not name itself, so this console never
   * puts a HashScan link under something that was not mined.
   */
  const receipt = readReceipt(settlement);

  /**
   * An allowed send spends the lock on the server. A refusal leaves it open,
   * which is what lets the demo send the approved plan straight after the
   * tampered one.
   */
  const lockSpent = settlement !== null && settlement.verdict.allowed;

  /** Which engine answered. `live` only says credentials exist. */
  const decidedByWallet = settlement?.decidedBy === "privy-wallet";

  const failureView = failure
    ? describeFailure(failure.code, failure.hint, failure.retryAfterSeconds)
    : null;
  const failureControl =
    failure && failureView
      ? failureControlFor(failureView.action, failure.stage)
      : null;

  /**
   * The two addresses this console can link, each gated on having actually been
   * read off chain. callTargetProvenance makes the plan target and the register
   * token agree before the target counts as on chain.
   */
  const registerTokenHref = tokenExplorerHref(
    snapshot.token.address,
    registerProvenance(snapshot.source),
  );
  const targetHref = tokenExplorerHref(
    plan.target,
    callTargetProvenance(plan.target, snapshot.token.address, snapshot.source),
  );

  const treasuryKeyState = deriveTreasuryKeyState({
    privyLive: installation?.live ?? false,
    pending,
    locked,
    settlement: settlement
      ? { allowed: settlement.verdict.allowed, receiptKind: receipt.kind }
      : null,
    failure: failure ? { code: failure.code, hint: failure.hint } : null,
  });

  const fee: FeeState =
    ADAPTER_MODE === "real"
      ? feeRead
      : { kind: "mirror", sentence: MIRROR_FEE_SENTENCE };

  /**
   * The one line that states which of the two modes a reader is looking at:
   * where the register came from, which key would sign, the chain, and the
   * policy slot. The id is only called a Privy policy id when Privy issued it.
   */
  const modeLine = [
    snapshot.source === "hedera-testnet"
      ? "Live read from Hedera testnet"
      : "Cached register",
    signerLive
      ? "Privy server wallet"
      : "Treasury key, policy evaluated locally",
    `Hedera testnet ${CHAIN_ID}`,
    installation
      ? installation.live
        ? `Privy policy ${installation.policyId}`
        : `Policy ${installation.policyId}, compiled locally`
      : "No policy locked yet",
  ].join(" · ");

  function record(entry: Omit<AuditEntry, "id" | "at">) {
    setLog((previous) => [
      { ...entry, id: `${previous.length}-${entry.event}`, at: stamp() },
      ...previous,
    ]);
  }

  function resetRun(next: ActionKind) {
    setPendingSwitch(null);
    setTamperNotice(null);
    setKind(next);
    setDeferred([]);
    setForced([]);
    setApprovals([]);
    setInstallation(null);
    setSettlement(null);
    setTamperInput(null);
    setFailure(null);
    setLastSend(null);
    setFeeRead({ kind: "idle" });
  }

  /**
   * Picking a corporate action rebuilds the plan from scratch. While a plan is
   * locked and not yet sent that would drop the lock, so the switch waits for
   * the operator to confirm it and the release is written to the audit record.
   */
  function selectAction(next: ActionKind) {
    if (locked && !lockSpent) {
      if (next === kind) return;
      setPendingSwitch(next);
      focusNext.current = "action-switch-confirm";
      return;
    }
    resetRun(next);
  }

  function confirmSwitch() {
    if (!pendingSwitch) return;
    const next = actions.find((entry) => entry.kind === pendingSwitch);
    if (installation) {
      record({
        event: "Lock released",
        detail: `Switched from ${plan.label} to ${next?.label ?? pendingSwitch} before sending. This console dropped lock ${installation.lockId} and policy ${installation.policyId}; nothing was signed under it, and the server lets the unused lock expire within 15 minutes.`,
        tone: "bad",
      });
    }
    focusNext.current = `action-${pendingSwitch}`;
    resetRun(pendingSwitch);
  }

  function keepLockedPlan() {
    focusNext.current = `action-${pendingSwitch ?? kind}`;
    setPendingSwitch(null);
  }

  function toggleRow(row: PlanRow) {
    if (locked) return;
    setSettlement(null);
    setTamperInput(null);
    if (row.held) {
      setForced((previous) =>
        previous.includes(row.holderId)
          ? previous.filter((id) => id !== row.holderId)
          : [...previous, row.holderId],
      );
      return;
    }
    setDeferred((previous) =>
      previous.includes(row.holderId)
        ? previous.filter((id) => id !== row.holderId)
        : [...previous, row.holderId],
    );
  }

  function toggleApproval(id: string) {
    if (locked) return;
    setApprovals((previous) =>
      previous.includes(id)
        ? previous.filter((entry) => entry !== id)
        : [...previous, id],
    );
  }

  /** Real mode: ask the fee route for the plan that was just locked. */
  async function loadFee() {
    if (ADAPTER_MODE !== "real") return;
    setFeeRead({ kind: "loading" });
    try {
      const response = await fetch("/api/fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selection: { kind, deferred, forced } }),
      });
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      setFeeRead(readFeeQuote(body));
    } catch {
      setFeeRead({
        kind: "unavailable",
        reason: "The console could not reach the fee endpoint.",
      });
    }
  }

  async function lockPlan() {
    if (!online) return;
    setPending("lock");
    setFailure(null);
    try {
      const response = await fetch("/api/detent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The selection is the only part of the plan the operator chooses, and
        // the server rebuilds everything else from its own register read. The
        // approvals are registry ids (approver.id), never display names.
        body: JSON.stringify({
          intent: "lock",
          plan,
          selection: { kind, deferred, forced },
          approvals,
        }),
      });
      const payload = await readApiResponse<PolicyInstallation>(response);
      if (!payload.ok) {
        setFailure({
          code: payload.error,
          hint: payload.hint,
          blockers: payload.blockers,
          stage: "lock",
          retryAfterSeconds: retryAfterOf(response),
        });
        focusNext.current = "lock-failure";
        return;
      }
      setInstallation(payload.data);
      setSettlement(null);
      focusNext.current = "policy-compiled";
      record({
        event: "Policy compiled and installed",
        detail: `${payload.data.policy.name} pins ${plan.target} and one selector, plan hash ${shortHex(plan.planHash)}. ${payload.data.anchor?.anchored ? "The plan hash is anchored on chain." : "The plan hash was not anchored on chain."}`,
        tone: "neutral",
        ...anchorParts(payload.data.anchor),
      });
      toast.add({
        title: "Policy compiled",
        description: `${payload.data.policy.name} now bounds the treasury key.`,
        type: "success",
      });
      void loadFee();
    } catch {
      setFailure({
        code: "upstream_error",
        hint: "The console could not reach the policy endpoint.",
        stage: "lock",
      });
      focusNext.current = "lock-failure";
    } finally {
      setPending(null);
    }
  }

  async function send(tampered: boolean, preference?: "auto" | "signature") {
    if (!installation || lockSpent || !online) return;

    let submittedRows = includedRows.map((row) => ({
      address: row.address,
      amountMicros: row.amountMicros,
    }));

    if (tampered && firstRow) {
      // Checked before anything is sent: an unreadable amount is the field's
      // problem, and an unchanged amount is the approved calldata, which would
      // sign and spend the lock from the refusal control.
      const decision = decideTamperedSend(tamperValue, firstRow.amountMicros);
      if (decision.kind !== "edited") {
        setTamperNotice({ kind: decision.kind, message: decision.message });
        return;
      }
      submittedRows = submittedRows.map((row, index) =>
        index === 0 ? { ...row, amountMicros: decision.micros } : row,
      );
    }

    setTamperNotice(null);
    setPending("send");
    setFailure(null);
    setLastSend({ tampered, preference });

    try {
      const response = await fetch("/api/detent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The lock id is the whole authority. The server holds the approved
        // calldata and the policy under it and reads nothing else from here.
        body: JSON.stringify({
          intent: "submit",
          lockId: installation.lockId,
          submittedRows,
          ...(preference ? { broadcastPreference: preference } : {}),
        }),
      });
      const payload = await readApiResponse<SubmitResult>(response);
      if (!payload.ok) {
        if (payload.error === "lock_unknown") {
          // The server holds no lock under this id. The console goes back to
          // the lock step, keeps the approvals and says so there.
          setInstallation(null);
          setSettlement(null);
          setFailure({
            code: payload.error,
            hint: payload.hint,
            stage: "lock",
          });
          focusNext.current = "lock-failure";
          record({
            event: "Lock no longer held",
            detail: `The server holds no lock for ${installation.lockId}. Lock the plan again before sending.`,
            tone: "bad",
          });
          document
            .getElementById("policy")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        setFailure({
          code: payload.error,
          hint: payload.hint,
          blockers: payload.blockers,
          stage: "send",
          retryAfterSeconds: retryAfterOf(response),
        });
        focusNext.current = "send-failure";
        return;
      }
      const result = payload.data;
      setSettlement(result);
      focusNext.current = "send-status";
      if (result.verdict.allowed) {
        // A synthetic receipt says so in the entry it writes and carries no
        // explorer link at all.
        const sent = readReceipt(result);
        record({
          event:
            sent.kind === "on-chain"
              ? "Signed and broadcast"
              : "Signed, nothing broadcast",
          detail: `${includedRows.length} rows, ${formatMicros(plan.drawMicros)} ${snapshot.treasury.settlementAsset}. ${describePolicyRelease({ installedOnWallet: installation.live, policyDetached: result.policyDetached, policyRevoked: result.policyRevoked, policyId: installation.policyId, lockId: installation.lockId })}${result.anchor?.anchored ? " The plan is closed as settled on chain." : ""}${sent.kind === "synthetic" ? " The receipt is synthetic: its reference is derived from the plan hash and the calldata, no transaction was broadcast and there is nothing to open on HashScan." : ""}`,
          tone: "ok",
          href: sent.href ?? undefined,
          ...anchorParts(result.anchor),
        });
      } else {
        record({
          event: "Signature refused",
          detail: `${result.verdict.reason} Refused by the ${result.decidedBy === "privy-wallet" ? "Privy wallet" : "local policy mirror"}; lock ${installation.lockId} stays open for the approved plan.${result.anchor?.anchored ? " The plan is closed as abandoned on chain rather than left open." : ""}`,
          tone: "bad",
          ...anchorParts(result.anchor),
        });
      }
    } catch {
      setFailure({
        code: "upstream_error",
        hint: "The console could not reach the wallet endpoint.",
        stage: "send",
      });
      focusNext.current = "send-failure";
    } finally {
      setPending(null);
    }
  }

  /** The handler behind the control describeFailure chose. */
  function runFailure(run: FailureRun) {
    switch (run) {
      case "relock":
      case "retry-lock":
        void lockPlan();
        return;
      case "reload":
        window.location.reload();
        return;
      case "retry-send":
        void send(lastSend?.tampered ?? false, lastSend?.preference);
        return;
    }
  }

  function editTamper(value: string) {
    setTamperInput(value);
    setTamperNotice(null);
  }

  function downloadAudit() {
    const auditDocument = {
      product: "Detent",
      generatedAt: new Date().toISOString(),
      security: {
        symbol: snapshot.token.symbol,
        address: snapshot.token.address,
        hederaId: snapshot.token.hederaId,
        registerSource: snapshot.source,
      },
      action: { kind: plan.kind, label: plan.label, authority: plan.authority },
      planHash: plan.planHash,
      selector: plan.selector,
      calldata: plan.calldata,
      rows: plan.rows,
      treasury: {
        walletId: installation?.walletId ?? snapshot.treasury.walletId,
        coverMicros: plan.treasuryMicros,
        drawMicros: plan.drawMicros,
      },
      policy: installation?.policy ?? null,
      anchors: {
        onLock: installation?.anchor ?? null,
        onSend: settlement?.anchor ?? null,
      },
      approvals,
      settlement,
      entries: log,
    };
    const blob = new Blob([JSON.stringify(auditDocument, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `detent-${plan.kind}-${plan.planHash.slice(2, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.add({
      title: "Audit record saved",
      description: anchor.download,
      type: "success",
    });
  }

  return {
    snapshot,
    kind,
    plan,
    action,
    includedRows,
    heldCount,
    firstRow,
    approvals,
    installation,
    settlement,
    pending,
    failure,
    failureView,
    failureControl,
    tamperValue,
    tamperNotice,
    pendingSwitch,
    log,
    locked,
    lockSpent,
    quorumMet,
    receipt,
    decidedByWallet,
    registerTokenHref,
    targetHref,
    treasuryKeyState,
    modeLine,
    fee,
    online,
    lastSend,
    selectAction,
    confirmSwitch,
    keepLockedPlan,
    toggleRow,
    toggleApproval,
    lockPlan,
    send,
    runFailure,
    editTamper,
    downloadAudit,
    loadFee,
  };
}

export type ConsoleController = ReturnType<typeof useConsole>;
