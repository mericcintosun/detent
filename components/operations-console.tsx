"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { hashscanToken, hashscanTransaction } from "@/lib/hashscan";
import {
  buildCalldata,
  buildPlan,
  formatMicros,
  formatTokens,
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
import { deriveTreasuryKeyState } from "@/lib/wallet-state";

/** What the console keeps from a failed call: the code it switches on, the
 *  sentence it prints, and the blockers that belong under it. */
interface ConsoleFailure {
  code: DetentErrorCode;
  hint: string;
  blockers?: string[];
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

/** The anchor's two halves, split for the audit entry that carries them. */
function anchorParts(anchor: AnchorReceipt | undefined): {
  anchorHref?: string;
  anchorNote?: string;
} {
  if (!anchor) return {};
  if (anchor.transactionHash) {
    return { anchorHref: hashscanTransaction(anchor.transactionHash) };
  }
  return { anchorNote: anchor.note };
}

function microsToInput(micros: string): string {
  const value = BigInt(micros);
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function inputToMicros(input: string): string | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{0,6})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  return (BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0") || "0")).toString();
}

function stamp(): string {
  return new Date().toISOString().slice(11, 19);
}

export function OperationsConsole({ snapshot }: { snapshot: RegisterSnapshot }) {
  const [kind, setKind] = useState<ActionKind>("coupon");
  const [deferred, setDeferred] = useState<string[]>([]);
  const [forced, setForced] = useState<string[]>([]);
  const [approvals, setApprovals] = useState<string[]>([]);
  const [installation, setInstallation] = useState<PolicyInstallation | null>(
    null
  );
  const [settlement, setSettlement] = useState<SubmitResult | null>(null);
  const [pending, setPending] = useState<"lock" | "send" | null>(null);
  const [failure, setFailure] = useState<ConsoleFailure | null>(null);
  const [tamperInput, setTamperInput] = useState<string | null>(null);
  const [log, setLog] = useState<AuditEntry[]>([]);
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
    [kind, deferred, forced, snapshot.holders, snapshot.treasury.balanceMicros]
  );

  const action = actions.find((entry) => entry.kind === kind) ?? actions[0];
  const includedRows = plan.rows.filter((row) => row.included);
  const heldCount = plan.rows.filter((row) => row.held).length;
  const firstRow = includedRows[0];
  const tamperValue =
    tamperInput ?? (firstRow ? microsToInput(firstRow.amountMicros) : "");
  const locked = installation !== null;
  const quorumMet = approvals.length >= 2;

  // Privy was live, the policy had to be recompiled rather than recalled, the
  // payload was allowed and nothing landed: that is a refused chain, not a
  // refused payload.
  const chainRefused =
    settlement !== null &&
    settlement.live &&
    settlement.policySource === "recompiled-from-approved-plan" &&
    settlement.verdict.allowed &&
    !settlement.transactionHash;

  const treasuryKeyState = deriveTreasuryKeyState({
    privyLive: installation?.live ?? false,
    pending,
    locked,
    settlement: settlement
      ? {
          allowed: settlement.verdict.allowed,
          transactionHash: settlement.transactionHash,
          policySource: settlement.policySource,
          chainRefused,
        }
      : null,
    failure: failure ? { code: failure.code, hint: failure.hint } : null,
  });

  function record(entry: Omit<AuditEntry, "id" | "at">) {
    setLog((previous) => [
      { ...entry, id: `${previous.length}-${entry.event}`, at: stamp() },
      ...previous,
    ]);
  }

  function resetRun(next: ActionKind) {
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
          : [...previous, row.holderId]
      );
      return;
    }
    setDeferred((previous) =>
      previous.includes(row.holderId)
        ? previous.filter((id) => id !== row.holderId)
        : [...previous, row.holderId]
    );
  }

  function toggleApproval(id: string) {
    if (locked) return;
    setApprovals((previous) =>
      previous.includes(id)
        ? previous.filter((entry) => entry !== id)
        : [...previous, id]
    );
  }

  async function lockPlan() {
    setPending("lock");
    setFailure(null);
    try {
      const response = await fetch("/api/detent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "lock", plan, approvals }),
      });
      const payload = (await response.json()) as ApiResponse<PolicyInstallation>;
      if (!payload.ok) {
        setFailure({
          code: payload.error,
          hint: payload.hint,
          blockers: payload.blockers,
        });
        return;
      }
      setInstallation(payload.data);
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
      });
    } finally {
      setPending(null);
    }
  }

  async function send(tampered: boolean, preference?: "auto" | "signature") {
    if (!installation) return;
    setPending("send");
    setFailure(null);
    setLastSend({ tampered, preference });

    let submittedRows = includedRows.map((row) => ({
      address: row.address,
      amountMicros: row.amountMicros,
    }));

    if (tampered && firstRow) {
      const micros = inputToMicros(tamperValue);
      if (micros === null) {
        setFailure({
          code: "invalid_input",
          hint: "Enter an amount with at most six decimal places.",
        });
        setPending(null);
        return;
      }
      submittedRows = submittedRows.map((row, index) =>
        index === 0 ? { ...row, amountMicros: micros } : row
      );
    }

    // One key per distinct submission. The calldata is in it, so a second
    // tampered amount is a different send, and the broadcast preference is in
    // it, so the sign and relay retry is not answered from the ledger. Two
    // clicks on the same button are the same key and broadcast once.
    const submittedCalldata =
      submittedRows.length > 0
        ? buildCalldata(plan.kind, submittedRows)
        : "0x";
    const submissionKey = `${installation.policyId}:${plan.planHash}:${
      tampered ? "tampered" : "approved"
    }:${submittedCalldata}:${preference ?? "auto"}`;

    try {
      const response = await fetch("/api/detent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "submit",
          policyId: installation.policyId,
          approvedPlan: plan,
          submittedRows,
          tampered,
          submissionKey,
          ...(preference ? { broadcastPreference: preference } : {}),
        }),
      });
      const payload = (await response.json()) as ApiResponse<SubmitResult>;
      if (!payload.ok) {
        setFailure({
          code: payload.error,
          hint: payload.hint,
          blockers: payload.blockers,
        });
        return;
      }
      const result = payload.data;
      setSettlement(result);
      if (result.verdict.allowed) {
        record({
          event: "Signed and broadcast",
          detail: `${includedRows.length} rows, ${formatMicros(plan.drawMicros)} ${snapshot.treasury.settlementAsset}. Policy ${installation.policyId} revoked.${result.anchor?.anchored ? " The plan is closed as settled on chain." : ""}`,
          tone: "ok",
          href: result.transactionHash
            ? hashscanTransaction(result.transactionHash)
            : undefined,
          ...anchorParts(result.anchor),
        });
      } else {
        record({
          event: "Signature refused",
          detail: `${result.verdict.reason}${result.anchor?.anchored ? " The plan is closed as abandoned on chain rather than left open." : ""}`,
          tone: "bad",
          ...anchorParts(result.anchor),
        });
      }
    } catch {
      setFailure({
        code: "upstream_error",
        hint: "The console could not reach the wallet endpoint.",
      });
    } finally {
      setPending(null);
    }
  }

  /** The destination contract, to the clipboard. A browser that refuses the
   *  permission changes nothing: the address is on screen with a title and an
   *  explorer link beside it. */
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

  return (
    <div className="space-y-12">
      <section id="register" className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-end">
          {/* The fold is the first thing the video shows, so it arrives the way
              the product is read: the window, then the name of the security,
              then what it holds, then its provenance. One M4 wipe per child on
              the existing nth-child stagger, no inline delay anywhere. */}
          <div className="detent-stagger space-y-4">
            <p className="detent-enter detent-label">
              {snapshot.token.standard} · {couponWindow.reference} window
            </p>
            <h1 className="detent-enter max-w-[16ch] text-4xl leading-[1.05] tracking-tight sm:text-5xl">
              {snapshot.token.name}
            </h1>
            <p className="detent-enter max-w-[68ch] text-base leading-relaxed text-muted-foreground">
              {formatTokens(snapshot.token.totalSupply)} tokens across{" "}
              {snapshot.holders.length} holders on partition{" "}
              {snapshot.token.partition}. {heldCount} of them are currently held
              by the compliance module, which is the sort of thing you want to
              read before you sign, not after.
            </p>
            <div className="detent-enter flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-hairline text-foreground">
                {snapshot.source === "hedera-testnet"
                  ? "Live read from Hedera testnet"
                  : "Cached register"}
              </Badge>
              {snapshot.token.verified ? (
                <Badge variant="outline" className="border-ok text-ok">
                  Verified on HashScan
                </Badge>
              ) : null}
              <a
                href={hashscanToken(snapshot.token.address)}
                target="_blank"
                rel="noopener noreferrer"
                title={snapshot.token.address}
                className="text-sm underline decoration-hairline underline-offset-4 hover:text-foreground"
              >
                {shortHex(snapshot.token.address, 12, 8)}
              </a>
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
                  variant={selected ? "default" : "outline"}
                  size="sm"
                  aria-pressed={selected}
                  onClick={() => resetRun(entry.kind)}
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
        </div>

        <Card className="detent-enter">
          {/* No ledger rule under running text: the rule is a surface, and a
              surface under a sentence reads as a strikethrough. */}
          <CardHeader className="border-b border-border">
            <p className="detent-label">Plan, as it will be signed</p>
            <CardTitle className="font-display text-2xl">{plan.label}</CardTitle>
            <CardDescription className="max-w-[70ch] leading-relaxed">
              {action.summary} Authority: {plan.authority}. Record date{" "}
              {couponWindow.recordDate}, payment date {couponWindow.paymentDate}.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            {plan.rows.length === 0 ? (
              <PlanEmptyState partition={snapshot.token.partition} />
            ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[46rem]">
                <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,7rem)] gap-4 border-b border-border px-6 py-3">
                  <span className="detent-label">Holder</span>
                  <span className="detent-label">Account</span>
                  <span className="detent-label text-right">Position</span>
                  <span className="detent-label text-right">
                    {kind === "coupon" ? "Coupon due" : "Units moved"}
                  </span>
                  <span className="detent-label text-right">Status</span>
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
                          row.included ? "" : "text-muted-foreground line-through"
                        }`}
                      >
                        {formatMicros(row.amountMicros)}
                      </span>
                      <div className="flex justify-end">
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
            )}

            <div className="grid gap-6 border-t border-border px-6 py-5 sm:grid-cols-3">
              <p className="text-sm leading-relaxed">
                <span className="detent-label block pb-1">In the plan</span>
                {includedRows.length} of {plan.rows.length} rows, drawing{" "}
                {formatMicros(plan.drawMicros)} {snapshot.treasury.settlementAsset}.
              </p>
              <p className="text-sm leading-relaxed">
                <span className="detent-label block pb-1">Treasury cover</span>
                {formatMicros(plan.treasuryMicros)}{" "}
                {snapshot.treasury.settlementAsset} on {snapshot.treasury.accountId}.
              </p>
              <p
                className={`text-sm leading-relaxed ${headroomNegative ? "text-bad" : "text-ok"}`}
              >
                <span className="detent-label block pb-1">Headroom</span>
                {headroomNegative ? "Short by " : ""}
                {formatMicros(
                  headroomNegative
                    ? String(-BigInt(plan.headroomMicros))
                    : plan.headroomMicros
                )}{" "}
                {snapshot.treasury.settlementAsset}
              </p>
            </div>

            {plan.blockers.length > 0 ? (
              <ul className="space-y-2 border-t border-bad px-6 py-4">
                {plan.blockers.map((blocker) => (
                  <li key={blocker} className="text-sm leading-relaxed text-bad">
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
                locked || pending !== null || plan.blockers.length > 0 || !quorumMet
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="font-display text-xl">
              Compiled wallet policy
            </CardTitle>
            <CardDescription className="leading-relaxed">
              One ALLOW rule, generated from the plan you just read. Everything
              else stays on default DENY, and the rule dies with the transaction.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {installation ? (
              <div className="detent-enter space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-hairline">
                    {installation.policy.name}
                  </Badge>
                  <Badge variant="outline" className="border-border text-muted-foreground">
                    {installation.live ? "Installed on Privy" : "Compiled locally"}
                  </Badge>
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
        <Card className={settlement && !settlement.verdict.allowed ? "border-bad" : ""}>
          <CardHeader className="border-b border-border">
            <CardTitle className="font-display text-xl">Send it</CardTitle>
            <CardDescription className="max-w-[70ch] leading-relaxed">
              Two ways out of here. Send the plan as approved, or edit a number
              first and watch the key refuse it. Same wallet, same policy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <TreasuryKeyBanner
              state={treasuryKeyState}
              reason={settlement?.verdict.reason}
              note={failure?.hint ?? settlement?.note}
              busy={pending !== null}
              onSignAndRelay={() => send(lastSend?.tampered ?? false, "signature")}
              onRetry={() => send(lastSend?.tampered ?? false)}
            />

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
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3">
                <span className="detent-label">Destination contract</span>
                <a
                  href={hashscanToken(plan.target)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={plan.target}
                  className="text-sm underline decoration-hairline underline-offset-4 hover:text-foreground"
                >
                  {shortHex(plan.target, 12, 8)}
                </a>
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
                  disabled={!locked || pending !== null}
                  onChange={(event) => setTamperInput(event.target.value)}
                />
                <p className="max-w-[56ch] text-xs leading-relaxed text-muted-foreground">
                  Change one digit and send. The policy pins the whole calldata
                  payload, so a single altered byte falls through to DENY.
                </p>
              </div>
              <Button
                variant="destructive"
                size="lg"
                disabled={!locked || pending !== null}
                onClick={() => send(true)}
              >
                {pending === "send" ? "Asking the wallet…" : "Send edited plan"}
              </Button>
            </div>

            <Button
              size="lg"
              className="w-full"
              disabled={!locked || pending !== null}
              onClick={() => send(false)}
            >
              {pending === "send"
                ? "Asking the wallet…"
                : "Execute the approved plan"}
            </Button>

            {failure ? (
              <SendErrorState
                hint={failure.hint}
                blockers={
                  failure.code === "plan_blocked" ? failure.blockers : undefined
                }
                busy={pending !== null || !locked}
                onRetry={() => send(lastSend?.tampered ?? false, lastSend?.preference)}
              />
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
                    {settlement.verdict.allowed ? "Signed" : "Refused"}
                  </Badge>
                  {settlement.policyRevoked ? (
                    <Badge variant="outline" className="border-hairline">
                      Policy revoked
                    </Badge>
                  ) : null}
                  <Badge variant="outline" className="border-border text-muted-foreground">
                    policy source: {settlement.policySource}
                  </Badge>
                </div>
                <p
                  className={`max-w-[76ch] text-sm leading-relaxed ${
                    settlement.verdict.allowed ? "" : "text-bad"
                  }`}
                >
                  {settlement.verdict.reason}
                </p>
                {settlement.transactionHash ? (
                  <a
                    href={hashscanTransaction(settlement.transactionHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={settlement.transactionHash}
                    className="inline-block text-sm underline decoration-hairline underline-offset-4"
                  >
                    View {shortHex(settlement.transactionHash)} on HashScan
                  </a>
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
              Every plan hash, refusal and receipt from this session, in the order
              they happened.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={downloadAudit}>
              Download the record
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/record/${plan.planHash}`}>
                Open the permanent record
              </Link>
            </Button>
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
                        className="inline-block text-sm underline decoration-hairline underline-offset-4"
                      >
                        Open the payout on HashScan
                      </a>
                    ) : null}
                    {entry.anchorHref ? (
                      <a
                        href={entry.anchorHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-sm underline decoration-hairline underline-offset-4"
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
