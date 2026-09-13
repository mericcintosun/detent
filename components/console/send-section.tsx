"use client";

import { SendErrorState, TreasuryKeyBanner } from "@/components/console-states";
import {
  AddressText,
  ExternalLink,
  KeyValue,
  KeyValueList,
  LoadingState,
  OfflineNotice,
  Section,
  StatusPill,
} from "@/components/design";
import * as m from "motion/react-m";
import { Presence, pressable } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { knock, lockRule } from "@/lib/motion";
import { formatMicros, shortHex } from "@/lib/plan";
import { cn } from "@/lib/utils";
import { StepBadge } from "./step-badge";
import type { ConsoleController } from "./use-console";

/** The network fee row: a sentence on the mirror, a read in real mode. */
function FeeValue({ c }: { c: ConsoleController }) {
  const { fee } = c;
  switch (fee.kind) {
    case "mirror":
      return <span>{fee.sentence}</span>;
    case "idle":
      return (
        <span className="text-muted-foreground">
          Estimated from the relay once the plan is locked.
        </span>
      );
    case "loading":
      return (
        <LoadingState
          label="Reading the fee estimate"
          rows={1}
          className="w-40 sm:ml-auto"
        />
      );
    case "estimate":
      return (
        <span className="inline-flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="amount font-mono">{fee.hbar} HBAR</span>
          <Badge variant="outline">estimate</Badge>
        </span>
      );
    case "unavailable":
      return (
        <span className="flex flex-col gap-2 sm:items-end">
          <span className="text-warning">Fee estimate unavailable.</span>
          <span className="text-caption text-muted-foreground">
            {fee.reason}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void c.loadFee()}
            disabled={!c.online}
          >
            Read the fee again
          </Button>
        </span>
      );
  }
}

export function SendSection({ c }: { c: ConsoleController }) {
  const { plan, settlement, receipt, failure, failureView, failureControl } = c;
  const sendFailure = failure?.stage === "send" && failureView ? failure : null;
  const controlsOff =
    !c.locked || c.lockSpent || c.pending !== null || !c.online;
  const asset = c.snapshot.treasury.settlementAsset;
  const refused = settlement !== null && !settlement.verdict.allowed;
  // The refusal knock plays once per refusal: every send writes one audit
  // entry, so the entry count flips the label between two identical knocks.
  const knockState = refused
    ? c.log.length % 2 === 0
      ? "knockA"
      : "knockB"
    : "rest";

  return (
    <Section
      id="send"
      eyebrow="Step 4 of 5"
      heading="Send"
      description="Two ways out of here. Send the plan as approved, or edit a number first and watch the key refuse it. Same wallet, same policy."
      actions={
        <StepBadge
          status={c.lockSpent ? "done" : c.locked ? "current" : "next"}
        />
      }
      className="border-t border-border"
    >
      {/* The refusal moment: the card knocks sideways once. The lock moment:
          a gold rule draws across its top when the plan is locked. Both are
          transforms, so reduced motion keeps the oxide ring, the rule and the
          alert without the movement. */}
      <m.div
        data-slot="send-knock"
        variants={knock}
        initial={false}
        animate={knockState}
      >
        <Card className={cn("relative", refused && "ring-destructive")}>
          <m.div
            aria-hidden="true"
            data-slot="lock-rule"
            className="absolute inset-x-0 top-0 h-0.5 origin-left bg-hairline"
            variants={lockRule}
            initial={false}
            animate={c.locked && !refused ? "locked" : "open"}
          />
          <CardContent className="flex flex-col gap-6">
            <div
              id="send-status"
              tabIndex={-1}
              className="outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <TreasuryKeyBanner
                state={c.treasuryKeyState}
                reason={settlement?.verdict.reason}
                note={failure?.hint ?? settlement?.note}
                busy={c.pending !== null}
                engineLive={c.decidedByWallet}
                receiptKind={receipt.kind}
                onSignAndRelay={() =>
                  c.send(c.lastSend?.tampered ?? false, "signature")
                }
                onRetry={() => c.send(c.lastSend?.tampered ?? false)}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              <div className="flex min-w-0 flex-col gap-3">
                <p className="detent-label">What this send does</p>
                <p className="max-w-measure-lg text-body-sm text-foreground">
                  This asks the treasury wallet to call {plan.signature} on{" "}
                  {c.snapshot.token.name} for {c.includedRows.length} rows,
                  drawing {formatMicros(plan.drawMicros)} {asset}, on Hedera
                  testnet chain {plan.chainId}. Nothing is asked of a browser
                  wallet: Detent installs no wallet connector, and the key that
                  signs is a Privy server wallet held to the policy above.
                </p>
                <KeyValueList>
                  <KeyValue label="Destination contract">
                    <span className="inline-flex flex-wrap items-center gap-2 sm:justify-end">
                      <AddressText
                        address={plan.target}
                        label="destination contract"
                        href={c.targetHref}
                      />
                      {c.targetHref ? null : (
                        <span className="text-caption text-muted-foreground">
                          seed address, not on chain
                        </span>
                      )}
                    </span>
                  </KeyValue>
                  <KeyValue label="Rows">{c.includedRows.length}</KeyValue>
                  <KeyValue label="Draw">
                    <span className="amount">
                      {formatMicros(plan.drawMicros)}
                    </span>{" "}
                    {asset}
                  </KeyValue>
                  <KeyValue label="Chain">
                    Hedera testnet, {plan.chainId}
                  </KeyValue>
                  <KeyValue label="Network fee">
                    <FeeValue c={c} />
                  </KeyValue>
                </KeyValueList>
              </div>

              <div className="flex min-w-0 flex-col gap-4 border border-border bg-background p-4">
                {!c.online ? <OfflineNotice /> : null}
                <div className="flex flex-col gap-2">
                  <label htmlFor="tamper" className="detent-label block">
                    Amount for {c.firstRow?.legalName ?? "the first row"}
                  </label>
                  <Input
                    id="tamper"
                    inputMode="decimal"
                    className="amount font-mono"
                    value={c.tamperValue}
                    disabled={controlsOff}
                    aria-invalid={
                      c.tamperNotice?.kind === "invalid" || undefined
                    }
                    aria-describedby="tamper-help tamper-notice"
                    onChange={(event) => c.editTamper(event.target.value)}
                  />
                  <p
                    id="tamper-help"
                    className="text-caption text-muted-foreground"
                  >
                    Change one digit and send. The policy pins the whole
                    calldata payload, so a single altered byte falls through to
                    the default.
                  </p>
                  {/* Always in the tree so the announcement is heard when it
                    fills; empty until the field is refused before sending. */}
                  <p
                    id="tamper-notice"
                    role="status"
                    aria-live="polite"
                    className={cn(
                      "text-body-sm",
                      c.tamperNotice?.kind === "invalid" && "text-destructive",
                    )}
                  >
                    {c.tamperNotice?.message}
                  </p>
                </div>
                <Button
                  render={pressable}
                  variant="destructive"
                  size="lg"
                  disabled={controlsOff}
                  onClick={() => c.send(true)}
                >
                  {c.pending === "send"
                    ? "Asking the wallet…"
                    : "Send edited plan"}
                </Button>
                <Button
                  render={pressable}
                  size="lg"
                  disabled={controlsOff}
                  onClick={() => c.send(false)}
                >
                  {c.pending === "send"
                    ? "Asking the wallet…"
                    : c.lockSpent
                      ? "Executed, the lock is spent"
                      : "Execute the approved plan"}
                </Button>
              </div>
            </div>

            {sendFailure && failureView ? (
              <div
                id="send-failure"
                tabIndex={-1}
                className="outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <SendErrorState
                  title={failureView.title}
                  hint={failureView.sentence}
                  code={sendFailure.code}
                  blockers={sendFailure.blockers}
                  actionLabel={failureControl?.label}
                  onRetry={
                    failureControl
                      ? () => c.runFailure(failureControl.run)
                      : undefined
                  }
                  busy={c.pending !== null || !c.locked || c.lockSpent}
                />
              </div>
            ) : null}

            <Presence
              show={settlement !== null}
              presenceKey={
                settlement
                  ? settlement.verdict.allowed
                    ? "signed"
                    : "refused"
                  : "none"
              }
              variant="rise"
            >
              {settlement ? (
                <div
                  className={cn(
                    "flex flex-col gap-3 border-l-2 px-4 py-4",
                    settlement.verdict.allowed
                      ? "border-success bg-success-muted"
                      : "border-destructive bg-destructive-muted",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {settlement.verdict.allowed ? (
                      <StatusPill kind="receipt" value={receipt.kind}>
                        {receipt.kind === "on-chain"
                          ? "Signed"
                          : "Signed, nothing broadcast"}
                      </StatusPill>
                    ) : (
                      <StatusPill kind="hold" value="compliance-refused">
                        Refused
                      </StatusPill>
                    )}
                    {settlement.policyRevoked ? (
                      <Badge variant="outline" className="border-hairline">
                        Policy revoked
                      </Badge>
                    ) : null}
                    {/* A refusal nobody can attribute proves nothing, so the row
                      names the engine that produced this one. */}
                    {settlement.verdict.allowed ? null : (
                      <Badge
                        variant="outline"
                        className="text-muted-foreground"
                      >
                        {`refused by: ${c.decidedByWallet ? "privy wallet" : "local policy mirror"}`}
                      </Badge>
                    )}
                  </div>
                  {/* A refusal's reason is already the treasury key banner's
                    alert at the top of this card, so it is printed once. */}
                  {settlement.verdict.allowed ? (
                    <p className="text-body-sm text-foreground">
                      {settlement.verdict.reason}
                    </p>
                  ) : null}
                  {receipt.kind === "on-chain" && receipt.href ? (
                    <ExternalLink href={receipt.href} className="text-body-sm">
                      View {shortHex(receipt.transactionHash ?? "")} on HashScan
                    </ExternalLink>
                  ) : receipt.kind === "synthetic" ? (
                    <div className="flex flex-col gap-2">
                      <p className="detent-label text-mirror">
                        Synthetic receipt, nothing on chain
                      </p>
                      <p className="max-w-measure-xl text-body-sm text-muted-foreground">
                        No key signed and no transaction was broadcast. The
                        reference below is derived from the plan hash and the
                        calldata so the run has something to quote. It is not a
                        transaction hash, Hedera testnet has never seen it, and
                        that is why there is no HashScan link under it.
                        Configure the Privy credentials and the same send
                        returns a real receipt.
                      </p>
                      <p className="amount font-mono text-caption break-all text-foreground">
                        <span className="detent-label block pb-1">
                          Reference
                        </span>
                        {receipt.reference}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </Presence>
          </CardContent>
        </Card>
      </m.div>
    </Section>
  );
}
