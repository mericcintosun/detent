"use client";

import Image from "next/image";
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
import { actions, approvers, couponWindow, type ActionKind } from "@/lib/data";
import type { RegisterSnapshot } from "@/lib/hedera";
import { hashscanToken, hashscanTransaction } from "@/lib/hedera";
import {
  buildPlan,
  formatMicros,
  formatTokens,
  shortHex,
  type PlanRow,
} from "@/lib/plan";

interface PolicyCondition {
  field: string;
  operator: string;
  value: string;
}

interface Installation {
  policyId: string;
  walletId: string;
  quorumThreshold: number;
  live: boolean;
  note: string;
  policy: {
    name: string;
    default_action: string;
    rules: Array<{ name: string; method: string; conditions: PolicyCondition[] }>;
  };
}

interface Verdict {
  allowed: boolean;
  reason: string;
  ruleName: string;
}

interface Settlement {
  verdict: Verdict;
  transactionHash?: string;
  policyRevoked: boolean;
  live: boolean;
  calldata: string;
  tampered: boolean;
  policySource: string;
  planHash: string;
}

interface AuditEntry {
  id: string;
  at: string;
  event: string;
  detail: string;
  tone: "ok" | "bad" | "neutral";
  href?: string;
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
  const [installation, setInstallation] = useState<Installation | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [pending, setPending] = useState<"lock" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tamperInput, setTamperInput] = useState<string | null>(null);
  const [log, setLog] = useState<AuditEntry[]>([]);

  const plan = useMemo(
    () => buildPlan({ kind, deferred, forced, holders: snapshot.holders }),
    [kind, deferred, forced, snapshot.holders]
  );

  const action = actions.find((entry) => entry.kind === kind) ?? actions[0];
  const includedRows = plan.rows.filter((row) => row.included);
  const heldCount = plan.rows.filter((row) => row.held).length;
  const firstRow = includedRows[0];
  const tamperValue =
    tamperInput ?? (firstRow ? microsToInput(firstRow.amountMicros) : "");
  const locked = installation !== null;
  const quorumMet = approvals.length >= 2;

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
    setError(null);
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
    setError(null);
    try {
      const response = await fetch("/api/detent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "lock", plan, approvals }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "The policy could not be installed.");
        return;
      }
      setInstallation(payload as Installation);
      record({
        event: "Policy compiled and installed",
        detail: `${payload.policy.name} pins ${plan.target} and one selector, plan hash ${shortHex(plan.planHash)}.`,
        tone: "neutral",
      });
    } catch {
      setError("The console could not reach the policy endpoint.");
    } finally {
      setPending(null);
    }
  }

  async function send(tampered: boolean) {
    if (!installation) return;
    setPending("send");
    setError(null);

    let submittedRows = includedRows.map((row) => ({
      address: row.address,
      amountMicros: row.amountMicros,
    }));

    if (tampered && firstRow) {
      const micros = inputToMicros(tamperValue);
      if (micros === null) {
        setError("Enter an amount with at most six decimal places.");
        setPending(null);
        return;
      }
      submittedRows = submittedRows.map((row, index) =>
        index === 0 ? { ...row, amountMicros: micros } : row
      );
    }

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
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "The wallet endpoint failed.");
        return;
      }
      const result = payload as Settlement;
      setSettlement(result);
      if (result.verdict.allowed) {
        record({
          event: "Signed and broadcast",
          detail: `${includedRows.length} rows, ${formatMicros(plan.drawMicros)} ${snapshot.treasury.settlementAsset}. Policy ${installation.policyId} revoked.`,
          tone: "ok",
          href: result.transactionHash
            ? hashscanTransaction(result.transactionHash)
            : undefined,
        });
      } else {
        record({
          event: "Signature refused",
          detail: result.verdict.reason,
          tone: "bad",
        });
      }
    } catch {
      setError("The console could not reach the wallet endpoint.");
    } finally {
      setPending(null);
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
          <div className="space-y-4">
            <p className="detent-label">
              {snapshot.token.standard} · {couponWindow.reference} window
            </p>
            <h1 className="max-w-[16ch] text-4xl leading-[1.05] tracking-tight sm:text-5xl">
              {snapshot.token.name}
            </h1>
            <p className="max-w-[68ch] text-base leading-relaxed text-muted-foreground">
              {formatTokens(snapshot.token.totalSupply)} tokens across{" "}
              {snapshot.holders.length} holders on partition{" "}
              {snapshot.token.partition}. {heldCount} of them are currently held
              by the compliance module, which is the sort of thing you want to
              read before you sign, not after.
            </p>
            <div className="flex flex-wrap items-center gap-2">
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
                rel="noreferrer"
                className="text-sm underline decoration-hairline underline-offset-4 hover:text-foreground"
              >
                {shortHex(snapshot.token.address, 12, 8)}
              </a>
            </div>
          </div>
          <figure className="detent-enter border border-border bg-card p-3">
            <Image
              src="/brand/og.png"
              alt="A ruled register sheet closed with a wax seal"
              width={1200}
              height={630}
              className="h-auto w-full"
              priority
            />
            <figcaption className="pt-3 text-xs leading-relaxed text-muted-foreground">
              Register snapshot taken {snapshot.fetchedAt.slice(0, 19).replace("T", " ")} UTC.
              {" "}
              {snapshot.note}
            </figcaption>
          </figure>
        </div>
      </section>

      <section id="plan" className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-8">
          <span className="detent-label">Corporate action</span>
          {actions.map((entry) => (
            <Button
              key={entry.kind}
              variant={entry.kind === kind ? "default" : "outline"}
              size="sm"
              onClick={() => resetRun(entry.kind)}
            >
              {entry.label}
            </Button>
          ))}
        </div>

        <Card className="detent-enter">
          <CardHeader className="detent-ruled border-b border-border">
            <CardTitle className="font-display text-2xl">{plan.label}</CardTitle>
            <CardDescription className="max-w-[70ch] leading-relaxed">
              {action.summary} Authority: {plan.authority}. Record date{" "}
              {couponWindow.recordDate}, payment date {couponWindow.paymentDate}.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
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
                          {row.jurisdiction} · {shortHex(row.address, 10, 4)}
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
                <dd className="pt-1 text-sm tabular-nums break-all">
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

      <section className="grid gap-6 lg:grid-cols-2">
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
                <dl className="space-y-3">
                  {installation.policy.rules[0].conditions.map((condition) => (
                    <div
                      key={`${condition.field}-${condition.operator}`}
                      className="border-b border-border pb-3 last:border-b-0"
                    >
                      <dt className="detent-label">
                        {condition.field} {condition.operator}
                      </dt>
                      <dd className="pt-1 text-sm break-all">
                        {condition.value.length > 66
                          ? shortHex(condition.value, 34, 12)
                          : condition.value}
                      </dd>
                    </div>
                  ))}
                  <div>
                    <dt className="detent-label">default action</dt>
                    <dd className="pt-1 text-sm text-bad">
                      {installation.policy.default_action}
                    </dd>
                  </div>
                </dl>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {installation.note}
                </p>
              </div>
            ) : (
              <div className="space-y-3 border border-dashed border-border p-6">
                <p className="detent-label">No policy installed</p>
                <p className="max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
                  Until the plan is locked, the treasury key can sign anything the
                  contract exposes. That is the state this product exists to end.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-6">
        <Card className={settlement && !settlement.verdict.allowed ? "border-bad" : ""}>
          <CardHeader className="border-b border-border">
            <CardTitle className="font-display text-xl">Send it</CardTitle>
            <CardDescription className="max-w-[70ch] leading-relaxed">
              Two ways out of here. Send the plan as approved, or edit a number
              first and watch the key refuse it. Same wallet, same policy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
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

            {error ? (
              <p className="border border-bad px-4 py-3 text-sm leading-relaxed text-bad">
                {error}
              </p>
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
                    rel="noreferrer"
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
          <Button variant="outline" onClick={downloadAudit}>
            Download the record
          </Button>
        </div>

        {log.length === 0 ? (
          <div className="border border-dashed border-border px-6 py-10 text-center">
            <p className="detent-label">Nothing recorded yet</p>
            <p className="mx-auto max-w-[48ch] pt-2 text-sm leading-relaxed text-muted-foreground">
              Lock a plan, then send it. Entries land here as the wallet answers.
            </p>
          </div>
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
                  {entry.href ? (
                    <a
                      href={entry.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-sm underline decoration-hairline underline-offset-4"
                    >
                      Open on HashScan
                    </a>
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
