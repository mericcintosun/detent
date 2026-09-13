"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PolicyExplorer } from "@/components/policy-explorer";
import {
  LedgerEmptyState,
  PlanEmptyState,
  PolicyEmptyState,
  SendErrorState,
  TreasuryKeyBanner,
} from "@/components/console-states";
import { actions, approvers, couponWindow, type ActionKind } from "@/lib/data";
import type { DetentErrorCode } from "@/lib/errors";
import {
  anchorExplorerHref,
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
  formatTokens,
  microsToInput,
  registerHeldCount,
  shortHex,
  type PlanRow,
} from "@/lib/plan";
import type {
  AnchorReceipt,
  ApiResponse,
  PolicyInstallation,
  RegisterSnapshot,
  SubmitResult,
} from "@/lib/types";
import {
  deriveTreasuryKeyState,
  describeFailure,
  describePolicyRelease,
  type FailureView,
} from "@/lib/wallet-state";

/** What the console keeps from a failed call: the code it switches on, the
 *  sentence it prints, and the blockers that belong under it. */
interface ConsoleFailure {
  code: DetentErrorCode;
  hint: string;
  blockers?: string[];
  /**
   * Which step the failure belongs to, so it is printed next to the control
   * that can act on it: a lock refusal under the lock button, a send refusal in
   * the send card. lock_unknown from a send is filed under the lock, because
   * locking again is the only way out of it.
   */
  stage: "lock" | "send";
  /** From a 429's Retry-After header, in seconds. */
  retryAfterSeconds?: number;
}

/** Retry-After as seconds, or undefined when absent or not a number. */
function retryAfterOf(response: Response): number | undefined {
  const raw = response.headers.get("Retry-After");
  if (raw === null) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0
    ? Math.ceil(seconds)
    : undefined;
}

interface AuditEntry {
  id: string;
  at: string;
  event: string;
  detail: string;
  tone: "ok" | "bad" | "neutral";
  /** The payout transaction on HashScan. */
  href?: string;
  /** The PlanAnchor transaction on HashScan, when one was sent. */
  anchorHref?: string;
  /** What the anchor said when it did not send anything. */
  anchorNote?: string;
}

/**
 * The anchor's two halves, split for the audit entry that carries them.
 *
 * anchorExplorerHref is what decides whether there is a link: lib/anchor.ts only
 * fills transactionHash after a real writeContract, and a run that found the
 * hash already anchored reports anchored without a hash of its own. Anything
 * that does not clear that bar prints the anchor's sentence instead.
 */
function anchorParts(anchor: AnchorReceipt | undefined): {
  anchorHref?: string;
  anchorNote?: string;
} {
  if (!anchor) return {};
  const href = anchorExplorerHref(anchor);
  if (href !== null) return { anchorHref: href };
  return { anchorNote: anchor.note };
}

function stamp(): string {
  return new Date().toISOString().slice(11, 19);
}

/**
 * Read one /api/detent answer without asserting its shape.
 *
 * `(await response.json()) as ApiResponse<T>` is a lie to the compiler: a 500
 * from a proxy, an HTML error page or a route mid-refactor all satisfy it and
 * then blow up on the first property read. This narrows the envelope for real
 * and turns anything else into the typed parse failure the console already
 * knows how to render. `data` stays a single, documented boundary cast: the
 * route owns that half of the contract and there is no runtime schema for it on
 * the client.
 */
async function readApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const unreadable: ApiResponse<T> = {
    ok: false,
    error: "parse_failure",
    hint: "The endpoint answered with something this build could not read. Nothing was signed.",
  };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return unreadable;
  }

  if (typeof body !== "object" || body === null) return unreadable;
  const envelope = body as Record<string, unknown>;

  if (envelope.ok === true) {
    return { ok: true, data: envelope.data as T };
  }

  if (envelope.ok === false && typeof envelope.error === "string") {
    const blockers = Array.isArray(envelope.blockers)
      ? envelope.blockers.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : undefined;
    return {
      ok: false,
      error: envelope.error as DetentErrorCode,
      hint:
        typeof envelope.hint === "string"
          ? envelope.hint
          : "The endpoint refused the call without saying why.",
      ...(blockers && blockers.length > 0 ? { blockers } : {}),
    };
  }

  return unreadable;
}

interface OperationsConsoleProps {
  snapshot: RegisterSnapshot;
  /**
   * Whether the treasury key on the server is a real Privy server wallet or the
   * local evaluator standing in for one. Read in app/page.tsx through
   * lib/register.ts, because lib/privy.ts is server only and this file is not.
   */
  signerLive: boolean;
}

export function OperationsConsole({
  snapshot,
  signerLive,
}: OperationsConsoleProps) {
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
  /** Why the amount field was not sent: unreadable, or equal to the approved amount. */
  const [tamperNotice, setTamperNotice] = useState<{
    kind: "invalid" | "unchanged";
    message: string;
  } | null>(null);
  /** A corporate action the operator picked while a plan is locked, awaiting confirmation. */
  const [pendingSwitch, setPendingSwitch] = useState<ActionKind | null>(null);
  /** Whether the plan table is wider than its wrapper, so the scroll hint shows. */
  const [tableOverflows, setTableOverflows] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
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
  /** What the last send was, so the retry and the relay action can re-fire it. */
  const [lastSend, setLastSend] = useState<{
    tampered: boolean;
    preference?: "auto" | "signature";
  } | null>(null);

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
  const rowCount = plan.rows.length;

  useEffect(() => {
    const element = tableRef.current;
    if (!element) return;
    const measure = () =>
      setTableOverflows(element.scrollWidth > element.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [rowCount]);

  /**
   * What came back from the last send, and whether it may be linked.
   * readReceipt reads the typed `receipt` the route returns, `on-chain` with a
   * transaction hash or `synthetic` with a reference, and defaults to synthetic
   * for anything that does not name itself, so this console never puts a
   * HashScan link under something that was not mined.
   */
  const receipt = readReceipt(settlement);

  /**
   * An allowed send spends the lock on the server: on a live wallet the policy
   * is detached and revoked, and a second submit under the same lock id is lock_unknown. A
   * refusal leaves it open, which is what lets the demo send the approved plan
   * straight after the tampered one.
   */
  const lockSpent = settlement !== null && settlement.verdict.allowed;

  /** Which engine answered. `live` only says credentials exist; this says who decided. */
  const decidedByWallet = settlement?.decidedBy === "privy-wallet";

  const failureView: FailureView | null = failure
    ? describeFailure(failure.code, failure.hint, failure.retryAfterSeconds)
    : null;

  /** The control under a failure, chosen by describeFailure's action. */
  function failureControl(
    view: FailureView,
  ): { label: string; onClick: () => void } | undefined {
    switch (view.action) {
      case "relock":
        return { label: "Lock the plan again", onClick: () => void lockPlan() };
      case "reload":
        return {
          label: "Reload the page",
          onClick: () => window.location.reload(),
        };
      case "retry":
      case "wait":
        return failure?.stage === "lock"
          ? { label: "Try the lock again", onClick: () => void lockPlan() }
          : {
              label: "Try the send again",
              onClick: () =>
                void send(lastSend?.tampered ?? false, lastSend?.preference),
            };
      case "none":
        return undefined;
    }
  }

  /**
   * The two addresses this console can link, each one gated on having actually
   * been read off chain. The register's token address is the live read's own
   * value; the call target is not, because lib/plan.ts builds it from the seed
   * constant, so callTargetProvenance makes the two agree before it counts as
   * on chain.
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

  function record(entry: Omit<AuditEntry, "id" | "at">) {
    setLog((previous) => [
      { ...entry, id: `${previous.length}-${entry.event}`, at: stamp() },
      ...previous,
    ]);
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

  async function lockPlan() {
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
    if (!installation || lockSpent) return;

    let submittedRows = includedRows.map((row) => ({
      address: row.address,
      amountMicros: row.amountMicros,
    }));

    if (tampered && firstRow) {
      // Checked before anything is sent: an unreadable amount is the field's
      // problem, not the server's, and an unchanged amount is the approved
      // calldata, which would sign and spend the lock from the refusal control.
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
        // calldata and the policy under it, derives the tampered flag and the
        // idempotency key itself, and reads nothing else from this body.
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
          // The server holds no lock under this id: the instance was recycled
          // or the lock expired. Nothing can be sent until the plan is locked
          // again, so the console goes back to that step, keeps the approvals
          // the operator already collected, and says so there.
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
        // The receipt decides both the headline and the link. A stub hash under
        // "Signed and broadcast" is the one claim in this product a judge can
        // disprove in a second, so a synthetic receipt says so in the entry it
        // writes and carries no explorer link at all.
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

  /** The destination contract, to the clipboard. A browser that refuses the
   *  permission changes nothing: the address is on screen in full in the title
   *  attribute beside it, linked or not. */
  function copyTarget() {
    try {
      navigator.clipboard?.writeText(plan.target).catch(() => undefined);
    } catch {
      // Clipboard access is blocked in some contexts. Nothing to recover.
    }
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
  }

  const headroomNegative = BigInt(plan.headroomMicros) < 0n;

  /**
   * The first line on the fold, and the only place the page states which of its
   * two modes a reader is looking at: where the register came from, which key
   * would sign, and the chain. Once a plan is locked the policy id joins it, so
   * the id the documentation tells a reader to look for is on screen rather than
   * buried in an audit entry. The id is only called a Privy policy id when Privy
   * actually issued it; the local branch says whose id it is instead, because a
   * `pol_local_…` string presented as a Privy id is a claim the run cannot back.
   * Before a plan is locked the line still names the slot, so a reader landing
   * cold learns the term and where its value will appear.
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

  return (
    <div className="space-y-12">
      <section id="register" className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-end">
          {/* The fold is the first thing the video shows, so it arrives the way
              the product is read: which mode this screen is running in, the
              window, the product and its promise, then the name of the security,
              then what it holds, then its provenance. One M4 wipe per child on
              the existing nth-child stagger, no inline delay anywhere. */}
          <div className="detent-stagger space-y-4">
            {/* The one line that states which mode the page is in, and the
                only place the policy id appears before the audit entry. It
                changes under the reader when a plan is locked, so it is a live
                region: a screen reader hears the new policy id rather than
                having to go looking for it. */}
            <p
              role="status"
              aria-live="polite"
              className="detent-enter detent-label break-words"
            >
              {modeLine}
            </p>
            <p className="detent-enter detent-label">
              {snapshot.token.standard} · {couponWindow.reference} window
            </p>
            <h1 className="detent-enter font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
              Detent
            </h1>
            <p className="detent-enter max-w-[68ch] text-lg leading-relaxed">
              Preview the coupon run line by line, then lock the treasury wallet
              to exactly that transaction.
            </p>
            <p className="detent-enter detent-label">{snapshot.token.name}</p>
            <p className="detent-enter max-w-[68ch] text-base leading-relaxed text-muted-foreground">
              {formatTokens(snapshot.token.totalSupply)} tokens across{" "}
              {snapshot.holders.length} holders on partition{" "}
              {snapshot.token.partition}. {heldCount} of them are currently held
              by the compliance module, which is the sort of thing you want to
              read before you sign, not after.
            </p>
            <div className="detent-enter flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-hairline text-foreground"
              >
                {snapshot.source === "hedera-testnet"
                  ? "Live read from Hedera testnet"
                  : "Cached register"}
              </Badge>
              {/* The verified badge and the explorer link belong to the live
                  read and to nothing else. On the cached register the address
                  is a seed literal HashScan has never heard of, and a link to
                  an empty explorer page is worse than no link, so the seed
                  branch says what the address is and prints it as plain text.
                  The branch is the href itself rather than the source, so an
                  address that is not 20 bytes of hex lands on the honest side
                  too instead of producing an anchor with no destination. */}
              {registerTokenHref ? (
                <>
                  {snapshot.token.verified ? (
                    <Badge variant="outline" className="border-ok text-ok">
                      Verified on HashScan
                    </Badge>
                  ) : null}
                  <a
                    href={registerTokenHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={snapshot.token.address}
                    className="inline-flex min-h-11 items-center text-sm underline decoration-hairline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {shortHex(snapshot.token.address, 12, 8)}
                  </a>
                </>
              ) : (
                <>
                  <Badge
                    variant="outline"
                    className="border-border text-muted-foreground"
                  >
                    Seed register address, not on chain
                  </Badge>
                  <span
                    title={snapshot.token.address}
                    className="text-sm text-muted-foreground"
                  >
                    {shortHex(snapshot.token.address, 12, 8)}
                  </span>
                </>
              )}
            </div>
          </div>
          {/* One mark per page, and the rail already carries it. What the
              masthead needs here is the provenance of the numbers beside it, so
              this is the register note rather than a second raster. */}
          <div className="detent-enter border-t border-border pt-3">
            <p className="detent-label">Register note</p>
            <dl className="divide-y divide-border pt-2 text-xs leading-relaxed">
              <div className="flex items-baseline justify-between gap-3 py-1.5">
                <dt className="detent-label">Snapshot</dt>
                <dd className="text-right tabular-nums">
                  {snapshot.fetchedAt.slice(0, 19).replace("T", " ")} UTC
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 py-1.5">
                <dt className="detent-label">Source</dt>
                <dd className="text-right">
                  {snapshot.source === "hedera-testnet"
                    ? "Read on chain"
                    : "Cached seed register"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 py-1.5">
                <dt className="detent-label">Partition</dt>
                <dd className="text-right">{snapshot.token.partition}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 py-1.5">
                <dt className="detent-label">Settles in</dt>
                <dd className="text-right">
                  {snapshot.treasury.settlementAsset}
                </dd>
              </div>
            </dl>
            <p className="max-w-[52ch] pt-2 text-xs leading-relaxed text-muted-foreground">
              {snapshot.note}
            </p>
          </div>
        </div>
      </section>

      <section id="plan" className="space-y-6">
        {/* One control with two states, not two loose buttons: the wide-tracked
            term sits over the pair, the pair sits on one rule, and the option
            that is not running carries the gold hairline so it reads as an
            available alternative rather than as a disabled card. */}
        <div className="space-y-3 border-t border-border pt-8">
          <p className="detent-label">Corporate action</p>
          <div
            role="group"
            aria-label="Corporate action"
            className="flex flex-col gap-2 sm:inline-flex sm:flex-row sm:gap-3"
          >
            {actions.map((entry) => {
              const selected = entry.kind === kind;
              return (
                <Button
                  key={entry.kind}
                  id={`action-${entry.kind}`}
                  variant={selected ? "default" : "outline"}
                  size="sm"
                  aria-pressed={selected}
                  onClick={() => selectAction(entry.kind)}
                  className={
                    selected
                      ? "px-5"
                      : "border-hairline bg-background px-5 text-foreground hover:bg-card"
                  }
                >
                  {entry.label}
                </Button>
              );
            })}
          </div>
          {locked && !lockSpent && !pendingSwitch ? (
            <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
              A plan is locked to the treasury key. Switching the corporate
              action releases that lock before anything is sent.
            </p>
          ) : null}
          {pendingSwitch && installation ? (
            <div
              id="action-switch-confirm"
              role="group"
              aria-labelledby="action-switch-title"
              tabIndex={-1}
              className="max-w-[76ch] space-y-3 border border-bad bg-card p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p id="action-switch-title" className="detent-label text-bad">
                Release the lock to switch
              </p>
              <p className="text-sm leading-relaxed">
                {plan.label} is locked under {installation.lockId}. Switching to{" "}
                {actions.find((entry) => entry.kind === pendingSwitch)?.label}{" "}
                drops that lock and its policy in this console, clears the
                approvals and writes the release to the audit record. Nothing is
                signed.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={confirmSwitch}>
                  Release the lock and switch
                </Button>
                <Button variant="ghost" onClick={keepLockedPlan}>
                  Keep the locked plan
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <Card className="detent-enter">
          {/* No ledger rule under running text: the rule is a surface, and a
              surface under a sentence reads as a strikethrough. */}
          <CardHeader className="border-b border-border">
            <p className="detent-label">Plan, as it will be signed</p>
            <CardTitle className="font-display text-2xl">
              {plan.label}
            </CardTitle>
            <CardDescription className="max-w-[70ch] leading-relaxed">
              {action.summary} Authority: {plan.authority}. Record date{" "}
              {couponWindow.recordDate}, payment date {couponWindow.paymentDate}
              .
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            {plan.rows.length === 0 ? (
              <PlanEmptyState partition={snapshot.token.partition} />
            ) : (
              <>
                {tableOverflows ? (
                  <p className="detent-label px-6 pt-4">
                    Scroll the table sideways for every column. The row controls
                    stay pinned on the right.
                  </p>
                ) : null}
                <div
                  ref={tableRef}
                  role="region"
                  aria-label={`${plan.label}, ${plan.rows.length} rows`}
                  tabIndex={0}
                  className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <div className="min-w-[46rem]">
                    <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,7rem)] gap-4 border-b border-border px-6 py-3">
                      <span className="detent-label">Holder</span>
                      <span className="detent-label">Account</span>
                      <span className="detent-label text-right">Position</span>
                      <span className="detent-label text-right">
                        {kind === "coupon" ? "Coupon due" : "Units moved"}
                      </span>
                      <span className="detent-label sticky right-0 -mr-6 bg-card pr-6 pl-3 text-right">
                        Status
                      </span>
                    </div>

                    <ul className="detent-stagger divide-y divide-border">
                      {plan.rows.map((row) => (
                        <li
                          key={row.holderId}
                          className={`detent-enter grid grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,7rem)] items-start gap-4 px-6 py-4 ${
                            row.held ? "bg-secondary" : ""
                          }`}
                        >
                          <div className="space-y-1">
                            <p
                              className={`text-sm font-medium ${row.held ? "text-bad" : ""}`}
                            >
                              {row.legalName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {row.jurisdiction} ·{" "}
                              <span title={row.address}>
                                {shortHex(row.address, 10, 4)}
                              </span>
                            </p>
                            {row.held ? (
                              <p className="max-w-[46ch] text-xs leading-relaxed text-bad">
                                {row.holdReason}
                              </p>
                            ) : null}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {row.accountId}
                          </span>
                          <span className="text-right text-sm tabular-nums">
                            {formatTokens(row.balance)}
                          </span>
                          <span
                            className={`text-right text-sm tabular-nums ${
                              row.included
                                ? ""
                                : "text-muted-foreground line-through"
                            }`}
                          >
                            {formatMicros(row.amountMicros)}
                          </span>
                          {/* Pinned to the wrapper's right edge, so the row
                            control is on screen at any width. */}
                          <div
                            className={`sticky right-0 -mr-6 flex justify-end pr-6 pl-3 ${
                              row.held ? "bg-secondary" : "bg-card"
                            }`}
                          >
                            <Button
                              variant={row.included ? "outline" : "ghost"}
                              size="sm"
                              disabled={locked}
                              onClick={() => toggleRow(row)}
                            >
                              {row.held
                                ? row.included
                                  ? "Hold again"
                                  : "Force in"
                                : row.included
                                  ? "Defer"
                                  : "Restore"}
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}

            <div className="grid gap-6 border-t border-border px-6 py-5 sm:grid-cols-3">
              <p className="text-sm leading-relaxed">
                <span className="detent-label block pb-1">In the plan</span>
                {includedRows.length} of {plan.rows.length} rows, drawing{" "}
                {formatMicros(plan.drawMicros)}{" "}
                {snapshot.treasury.settlementAsset}.
              </p>
              <p className="text-sm leading-relaxed">
                <span className="detent-label block pb-1">Treasury cover</span>
                {formatMicros(plan.treasuryMicros)}{" "}
                {snapshot.treasury.settlementAsset} on{" "}
                {snapshot.treasury.accountId}.
              </p>
              <p
                className={`text-sm leading-relaxed ${headroomNegative ? "text-bad" : "text-ok"}`}
              >
                <span className="detent-label block pb-1">Headroom</span>
                {headroomNegative ? "Short by " : ""}
                {formatMicros(
                  headroomNegative
                    ? String(-BigInt(plan.headroomMicros))
                    : plan.headroomMicros,
                )}{" "}
                {snapshot.treasury.settlementAsset}
              </p>
            </div>

            {plan.blockers.length > 0 ? (
              <ul className="space-y-2 border-t border-bad px-6 py-4">
                {plan.blockers.map((blocker) => (
                  <li
                    key={blocker}
                    className="text-sm leading-relaxed text-bad"
                  >
                    {blocker}
                  </li>
                ))}
              </ul>
            ) : null}

            <dl className="grid gap-4 border-t border-border px-6 py-5 sm:grid-cols-2">
              <div>
                <dt className="detent-label">Plan hash</dt>
                <dd
                  className="pt-1 text-sm tabular-nums break-all"
                  title={plan.planHash}
                >
                  {plan.planHash}
                </dd>
              </div>
              <div>
                <dt className="detent-label">Call</dt>
                <dd className="pt-1 text-sm break-all">
                  {plan.signature}{" "}
                  <span className="text-muted-foreground">
                    selector {plan.selector}
                  </span>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </section>

      <section id="policy" className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="font-display text-xl">
              Key quorum, threshold two
            </CardTitle>
            <CardDescription className="leading-relaxed">
              The policy is not installed by one person. Two distinct signers on
              the treasury wallet open it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <ul className="space-y-3">
              {approvers.map((approver) => {
                const signed = approvals.includes(approver.id);
                return (
                  <li
                    key={approver.id}
                    className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-b-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{approver.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {approver.role} · {approver.keyId}
                      </p>
                    </div>
                    <Button
                      variant={signed ? "secondary" : "outline"}
                      size="sm"
                      disabled={locked}
                      onClick={() => toggleApproval(approver.id)}
                    >
                      {signed ? "Approved" : "Approve"}
                    </Button>
                  </li>
                );
              })}
            </ul>
            <p className="text-sm text-muted-foreground">
              {approvals.length} of 2 signatures collected.
            </p>
            <Button
              size="lg"
              className="w-full"
              disabled={
                locked ||
                pending !== null ||
                plan.blockers.length > 0 ||
                !quorumMet
              }
              onClick={lockPlan}
            >
              {pending === "lock"
                ? "Compiling policy…"
                : locked
                  ? "Plan locked to the treasury key"
                  : "Lock this plan to the treasury key"}
            </Button>
            {!quorumMet && plan.blockers.length === 0 && !locked ? (
              <p className="text-sm text-muted-foreground">
                Collect both approvals to install the policy.
              </p>
            ) : null}
            {/* A refused lock is printed where it can be acted on, including a
                send that came back lock_unknown: the console has already
                returned to this step, so the way out is the button above. */}
            {failure?.stage === "lock" && failureView ? (
              <div
                id="lock-failure"
                tabIndex={-1}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <SendErrorState
                  title={failureView.title}
                  hint={failureView.sentence}
                  blockers={failure.blockers}
                  actionLabel={failureControl(failureView)?.label}
                  onRetry={failureControl(failureView)?.onClick}
                  busy={
                    pending !== null ||
                    (failureView.action === "relock" && !quorumMet)
                  }
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="font-display text-xl">
              Compiled wallet policy
            </CardTitle>
            <CardDescription className="leading-relaxed">
              One ALLOW rule, generated from the plan you just read. Everything
              else stays on default DENY, and the rule dies with the
              transaction.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {installation ? (
              <div
                id="policy-compiled"
                tabIndex={-1}
                aria-label={`Compiled wallet policy ${installation.policy.name}`}
                className="detent-enter space-y-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-card"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-hairline">
                    {installation.policy.name}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-border text-muted-foreground"
                  >
                    {installation.live
                      ? "Installed on Privy"
                      : "Compiled locally"}
                  </Badge>
                </div>
                {/* The id the status line above the fold and the audit entry both
                    quote. Printed as its own row so it can be read off the
                    screen instead of out of a log sentence. */}
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="detent-label">Policy id</span>
                  <span className="break-all text-sm">
                    {installation.policyId}
                  </span>
                </div>
                {/* The third interactive moment: the conditions stop being a
                    list and become a diagram of the call they pin, explorable
                    with the pointer and with the keyboard alike. */}
                <PolicyExplorer
                  conditions={installation.policy.rules[0].conditions}
                  target={plan.target}
                  selector={plan.selector}
                  calldata={plan.calldata}
                  defaultAction={installation.policy.default_action}
                />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {installation.note}
                </p>
              </div>
            ) : (
              <PolicyEmptyState />
            )}
          </CardContent>
        </Card>
      </section>

      <section id="send" className="space-y-6">
        <Card
          className={
            settlement && !settlement.verdict.allowed ? "border-bad" : ""
          }
        >
          <CardHeader className="border-b border-border">
            <CardTitle className="font-display text-xl">Send it</CardTitle>
            <CardDescription className="max-w-[70ch] leading-relaxed">
              Two ways out of here. Send the plan as approved, or edit a number
              first and watch the key refuse it. Same wallet, same policy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div
              id="send-status"
              tabIndex={-1}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <TreasuryKeyBanner
                state={treasuryKeyState}
                reason={settlement?.verdict.reason}
                note={failure?.hint ?? settlement?.note}
                busy={pending !== null}
                engineLive={decidedByWallet}
                receiptKind={receipt.kind}
                onSignAndRelay={() =>
                  send(lastSend?.tampered ?? false, "signature")
                }
                onRetry={() => send(lastSend?.tampered ?? false)}
              />
            </div>

            {/* Nobody should have to read calldata to learn what a button is
                about to do. Same treatment as the register note block, so this
                adds no colour, radius or motion value. */}
            <div className="border border-border bg-card p-4">
              <p className="detent-label">What this send does</p>
              <p className="max-w-[76ch] pt-3 text-sm leading-relaxed">
                This asks the treasury wallet to call {plan.signature} on{" "}
                {snapshot.token.name} for {includedRows.length} rows, drawing{" "}
                {formatMicros(plan.drawMicros)}{" "}
                {snapshot.treasury.settlementAsset}, on Hedera testnet chain{" "}
                {plan.chainId}. Nothing is asked of a browser wallet: Detent
                installs no wallet connector, and the key that signs is a Privy
                server wallet held to the policy above.
              </p>
              {/* Same rule as the masthead: the address is a link only when
                  the register was read on chain and the call target is that
                  same contract. Otherwise it is the seed literal, and the note
                  under it says so rather than sending a judge to a 404. */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3">
                <span className="detent-label">Destination contract</span>
                {targetHref ? (
                  <a
                    href={targetHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={plan.target}
                    className="inline-flex min-h-11 items-center text-sm underline decoration-hairline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {shortHex(plan.target, 12, 8)}
                  </a>
                ) : (
                  <span
                    title={plan.target}
                    className="text-sm text-muted-foreground"
                  >
                    {shortHex(plan.target, 12, 8)}, seed address not on chain
                  </span>
                )}
                <Button variant="ghost" size="sm" onClick={copyTarget}>
                  Copy the address
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="space-y-2">
                <label htmlFor="tamper" className="detent-label block">
                  Amount for {firstRow?.legalName ?? "the first row"}
                </label>
                <Input
                  id="tamper"
                  inputMode="decimal"
                  value={tamperValue}
                  disabled={!locked || lockSpent || pending !== null}
                  aria-invalid={tamperNotice?.kind === "invalid" || undefined}
                  aria-describedby="tamper-help tamper-notice"
                  onChange={(event) => {
                    setTamperInput(event.target.value);
                    setTamperNotice(null);
                  }}
                />
                <p
                  id="tamper-help"
                  className="max-w-[56ch] text-xs leading-relaxed text-muted-foreground"
                >
                  Change one digit and send. The policy pins the whole calldata
                  payload, so a single altered byte falls through to DENY.
                </p>
                {/* Always in the tree so the announcement is heard when it
                    fills; empty until the field is refused before sending. */}
                <p
                  id="tamper-notice"
                  role="status"
                  aria-live="polite"
                  className={`max-w-[56ch] text-sm leading-relaxed ${
                    tamperNotice?.kind === "invalid" ? "text-bad" : ""
                  }`}
                >
                  {tamperNotice?.message}
                </p>
              </div>
              <Button
                variant="destructive"
                size="lg"
                disabled={!locked || lockSpent || pending !== null}
                onClick={() => send(true)}
              >
                {pending === "send" ? "Asking the wallet…" : "Send edited plan"}
              </Button>
            </div>

            <Button
              size="lg"
              className="w-full"
              disabled={!locked || lockSpent || pending !== null}
              onClick={() => send(false)}
            >
              {pending === "send"
                ? "Asking the wallet…"
                : lockSpent
                  ? "Executed, the lock is spent"
                  : "Execute the approved plan"}
            </Button>

            {failure?.stage === "send" && failureView ? (
              <div
                id="send-failure"
                tabIndex={-1}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <SendErrorState
                  title={failureView.title}
                  hint={failureView.sentence}
                  blockers={failure.blockers}
                  actionLabel={failureControl(failureView)?.label}
                  onRetry={failureControl(failureView)?.onClick}
                  busy={pending !== null || !locked || lockSpent}
                />
              </div>
            ) : null}

            {settlement ? (
              <div
                className={`detent-enter space-y-3 border px-4 py-4 ${
                  settlement.verdict.allowed ? "border-ok" : "border-bad"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      settlement.verdict.allowed
                        ? "border-ok text-ok"
                        : "border-bad text-bad"
                    }
                  >
                    {settlement.verdict.allowed
                      ? receipt.kind === "on-chain"
                        ? "Signed"
                        : "Signed, nothing broadcast"
                      : "Refused"}
                  </Badge>
                  {settlement.policyRevoked ? (
                    <Badge variant="outline" className="border-hairline">
                      Policy revoked
                    </Badge>
                  ) : null}
                  {/* A refusal nobody can attribute proves nothing, so the badge
                      row names the engine that produced this one. decidedBy is
                      the answer; live only says credentials are configured,
                      and the local mirror can refuse on a live deployment. */}
                  {settlement.verdict.allowed ? null : (
                    <Badge
                      variant="outline"
                      className="border-border text-muted-foreground"
                    >
                      refused by:{" "}
                      {decidedByWallet ? "privy wallet" : "local policy mirror"}
                    </Badge>
                  )}
                </div>
                {/* A refusal's reason is already the treasury key banner's
                    alert at the top of this card, so it is printed once. */}
                {settlement.verdict.allowed ? (
                  <p className="max-w-[76ch] text-sm leading-relaxed">
                    {settlement.verdict.reason}
                  </p>
                ) : null}
                {/* The receipt, told apart. A hash the wallet broadcast gets
                    the explorer link. A hash this build derived from the
                    calldata gets the same prominence and none of the claim:
                    nothing was mined, so there is nothing to open, and saying
                    that is the difference between a demo and a dressed up
                    one. */}
                {receipt.kind === "on-chain" && receipt.href ? (
                  <a
                    href={receipt.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={receipt.transactionHash ?? undefined}
                    className="inline-flex min-h-11 items-center text-sm underline decoration-hairline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    View {shortHex(receipt.transactionHash ?? "")} on HashScan
                  </a>
                ) : receipt.kind === "synthetic" ? (
                  <div className="space-y-2">
                    <Badge
                      variant="outline"
                      className="border-border text-muted-foreground"
                    >
                      Synthetic receipt, nothing on chain
                    </Badge>
                    <p className="max-w-[76ch] text-sm leading-relaxed text-muted-foreground">
                      No key signed and no transaction was broadcast. The
                      reference below is derived from the plan hash and the
                      calldata so the run has something to quote. It is not a
                      transaction hash, Hedera testnet has never seen it, and
                      that is why there is no HashScan link under it. Configure
                      the Privy credentials and the same send returns a real
                      receipt.
                    </p>
                    <p className="text-sm break-all text-muted-foreground tabular-nums">
                      <span className="detent-label block pb-1">Reference</span>
                      {receipt.reference}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section id="ledger" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-8">
          <div>
            <h2 className="text-2xl tracking-tight">Audit record</h2>
            <p className="max-w-[62ch] pt-2 text-sm leading-relaxed text-muted-foreground">
              Every plan hash, refusal and receipt from this session, in the
              order they happened.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={downloadAudit}>
              Download the record
            </Button>
            {/* A new tab, so reading the record never unloads this session:
                the lock, the approvals and the entries below live only here. */}
            <Link
              href={`/record/${plan.planHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              Open the permanent record
              <span className="sr-only"> (opens in a new tab)</span>
            </Link>
          </div>
        </div>

        {log.length === 0 ? (
          <LedgerEmptyState />
        ) : (
          <ul className="detent-stagger divide-y divide-border border-y border-border">
            {log.map((entry) => (
              <li
                key={entry.id}
                className="detent-enter grid gap-2 py-4 sm:grid-cols-[7rem_minmax(0,1fr)]"
              >
                <span className="detent-label pt-1">{entry.at}</span>
                <div className="space-y-1">
                  <p
                    className={`text-sm font-medium ${
                      entry.tone === "bad"
                        ? "text-bad"
                        : entry.tone === "ok"
                          ? "text-ok"
                          : ""
                    }`}
                  >
                    {entry.event}
                  </p>
                  <p className="max-w-[78ch] text-sm leading-relaxed text-muted-foreground">
                    {entry.detail}
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    {entry.href ? (
                      <a
                        href={entry.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center text-sm underline decoration-hairline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Open the payout on HashScan
                      </a>
                    ) : null}
                    {entry.anchorHref ? (
                      <a
                        href={entry.anchorHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center text-sm underline decoration-hairline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Open the plan anchor on HashScan
                      </a>
                    ) : null}
                  </div>
                  {entry.anchorNote ? (
                    <p className="max-w-[78ch] text-xs leading-relaxed text-muted-foreground">
                      {entry.anchorNote}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
