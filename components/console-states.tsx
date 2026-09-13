"use client";

// Every non-happy surface the console can show, in one file.
//
// The treasury key banner has a named branch per member of TreasuryKeyState, so
// the compiler proves the set is covered: add a state to lib/wallet-state.ts and
// this switch stops building until it is rendered. The empty and error states
// are built on the design system's EmptyState and ErrorState, each one ending in
// the next click rather than a shrug.
//
// Destructive colour is spent on the refusal and on failed calls; infrastructure
// trouble and resting states stay neutral.

import type { ReactNode } from "react";
import { EmptyState, ErrorState } from "@/components/design";
import { Presence } from "@/components/motion";
import { Plate } from "@/components/plates";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TreasuryKeyState } from "@/lib/wallet-state";

/* --- The treasury key banner ---------------------------------------------- */

export interface TreasuryKeyBannerProps {
  state: TreasuryKeyState;
  /** The policy's own words on the last refusal: condition and byte offset. */
  reason?: string;
  /** Whatever the provider said about the last answer. */
  note?: string;
  /** Re-send the last payload through the sign and relay path. */
  onSignAndRelay: () => void;
  /** Re-fire the last send unchanged. */
  onRetry: () => void;
  /** True while a call is in flight, so no branch offers a second one. */
  busy: boolean;
  /**
   * Whether the answer on screen came back from the Privy server wallet or from
   * the local mirror of the same evaluator. The refusal branch names the engine,
   * because a refusal nobody can attribute proves nothing.
   */
  engineLive?: boolean;
  /**
   * Whether the receipt behind a confirmed send is a broadcast transaction or a
   * hash derived from the calldata. The signed branch does not get to say the
   * wallet put anything on chain until this says on-chain.
   */
  receiptKind?: "on-chain" | "synthetic" | "none";
}

const FRAME_TONE = {
  neutral: "border-border bg-background",
  bad: "border-destructive bg-destructive-muted",
  ok: "border-success bg-success-muted",
} as const;

/**
 * Every branch of the banner replaces the one before it in place. The frame is
 * the console's live region and stays mounted across branches, polite for the
 * states that report progress and an assertive alert for the refusal; only its
 * content is swapped, with a short fade, so an announcement is never lost to a
 * remount.
 */
function Frame({
  tone,
  label,
  children,
}: {
  tone: keyof typeof FRAME_TONE;
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "bad" ? "alert" : "status"}
      aria-live={tone === "bad" ? "assertive" : "polite"}
      aria-atomic="true"
      className={cn("border-l-2 px-4 py-4", FRAME_TONE[tone])}
    >
      <Presence show presenceKey={label} variant="fade">
        <div className="flex flex-col gap-2">
          <p
            className={cn(
              "detent-label",
              tone === "bad" && "text-destructive",
              tone === "ok" && "text-success",
            )}
          >
            {label}
          </p>
          {children}
        </div>
      </Presence>
    </div>
  );
}

const PROSE = "max-w-measure-lg text-body-sm";

export function TreasuryKeyBanner({
  state,
  reason,
  note,
  onSignAndRelay,
  onRetry,
  busy,
  engineLive = false,
  receiptKind = "none",
}: TreasuryKeyBannerProps) {
  switch (state) {
    case "disconnected":
      return (
        <Frame tone="neutral" label="Treasury key, compiled locally">
          <p className={cn(PROSE, "text-muted-foreground")}>
            No Privy credentials are configured on the server, so the policy is
            compiled and evaluated here and the receipt is a stub. The refusal
            is the same one the wallet returns, which is why this path is the
            rehearsal path.
          </p>
        </Frame>
      );

    case "connecting":
      return (
        <Frame tone="neutral" label="Treasury key, opening the policy">
          <p className={cn(PROSE, "text-muted-foreground")}>
            Installing the compiled policy on the treasury wallet under the key
            quorum. Nothing can be signed until it lands.
          </p>
        </Frame>
      );

    case "wrong-network":
      return (
        <Frame tone="neutral" label="Treasury key, chain refused">
          <p className={cn(PROSE, "text-muted-foreground")}>
            The wallet would not broadcast to Hedera testnet, chain 296. The
            policy still governs the signing request, so take the signature from
            the same wallet and put the transaction on chain through the Hedera
            relay instead.
          </p>
          <Button
            variant="outline"
            className="w-fit"
            disabled={busy}
            onClick={onSignAndRelay}
          >
            Sign and relay through Hedera instead
          </Button>
        </Frame>
      );

    case "idle":
      return (
        <Frame tone="neutral" label="Treasury key, live and idle">
          <p className={cn(PROSE, "text-muted-foreground")}>
            The treasury server wallet is reachable and nothing is in flight.
            Lock a plan to give the key a limit, then send it.
          </p>
        </Frame>
      );

    case "tx-pending":
      return (
        <Frame tone="neutral" label="Treasury key, asking the wallet">
          <p className={cn(PROSE, "text-muted-foreground")}>
            The payload is with the wallet. The policy is evaluated before any
            signature is produced, so this either comes back signed or comes
            back refused.
          </p>
        </Frame>
      );

    case "tx-confirmed":
      return (
        <Frame
          tone="ok"
          label={
            receiptKind === "on-chain"
              ? "Treasury key, signed"
              : "Treasury key, signed, nothing broadcast"
          }
        >
          <p className={cn(PROSE, "text-foreground")}>
            {receiptKind === "on-chain"
              ? "The payload matched the approved calldata byte for byte, the wallet signed it, and the policy is revoked."
              : "The payload matched the approved calldata byte for byte and the policy allowed it. No key signed and nothing went to Hedera testnet: the receipt is synthetic, so there is nothing to open on HashScan."}
          </p>
          {note ? (
            <p className={cn(PROSE, "text-muted-foreground")}>{note}</p>
          ) : null}
        </Frame>
      );

    case "tx-rejected":
      return (
        <Frame tone="bad" label="Treasury key, refused">
          <p className={cn(PROSE, "font-mono text-destructive")}>
            {reason ??
              "The policy refused this payload, so nothing was signed and nothing was broadcast."}
          </p>
          <p className={cn(PROSE, "text-foreground")}>
            {engineLive
              ? "Refused by the Privy server wallet under the installed policy."
              : "Refused by the local mirror of the same policy evaluator, before any wallet was asked. This check stays on the server even with a live Privy wallet, because the wallet policy cannot compare the coupon's holder and amount arrays."}
          </p>
          <p className={cn(PROSE, "text-muted-foreground")}>
            This is the key doing its job. Restore the approved amount and send
            the plan again with the same wallet under the same policy.
          </p>
        </Frame>
      );

    case "tx-failed":
      return (
        <Frame tone="neutral" label="Treasury key, no answer">
          <p className={cn(PROSE, "text-muted-foreground")}>
            {note ??
              "The provider did not return a usable answer. The plan is untouched and nothing was signed."}
          </p>
          <Button
            variant="outline"
            className="w-fit"
            disabled={busy}
            onClick={onRetry}
          >
            Send the approved plan again
          </Button>
        </Frame>
      );
  }
}

/* --- The send error surface ----------------------------------------------- */

export interface SendErrorStateProps {
  /** A short label naming what went wrong, from describeFailure. */
  title?: string;
  hint: string;
  /** The API error code, printed under the sentence. */
  code?: string;
  blockers?: string[];
  /** The control under the sentence. Omit onRetry and no control is drawn. */
  actionLabel?: string;
  onRetry?: () => void;
  busy: boolean;
}

/**
 * A failed call, with the way out as a control rather than a sentence. Used by
 * both the lock step and the send step, so the same answer from the server reads
 * the same in either place. Announced as an alert: nothing else on screen moves
 * when a call fails, so this is the one thing a reader could miss.
 */
export function SendErrorState({
  title,
  hint,
  code,
  blockers,
  actionLabel = "Try the send again",
  onRetry,
  busy,
}: SendErrorStateProps) {
  return (
    <ErrorState
      live
      title={title ?? "The call did not go through"}
      code={code}
      description={
        <>
          {hint}
          {blockers && blockers.length > 0 ? (
            <span className="mt-2 flex flex-col gap-1">
              {blockers.map((blocker) => (
                <span key={blocker} className="block">
                  {blocker}
                </span>
              ))}
            </span>
          ) : null}
        </>
      }
      action={
        onRetry ? (
          <Button variant="outline" disabled={busy} onClick={onRetry}>
            {actionLabel}
          </Button>
        ) : undefined
      }
    />
  );
}

/* --- Empty states, each ending in the next click -------------------------- */

export function PlanEmptyState({ partition }: { partition: string }) {
  return (
    <EmptyState
      className="border-y-0"
      icon={<Plate name="register" className="h-20 w-auto" />}
      title="No rows in this register"
      description={`The register returned no holders for partition ${partition}, so there is nothing to preview and nothing to sign. Pick the coupon run to rebuild the plan against the current snapshot.`}
    />
  );
}

export function PolicyEmptyState() {
  return (
    <EmptyState
      className="border-y-0 bg-background"
      icon={<Plate name="policy" className="h-20 w-auto" />}
      title="No policy installed"
      description="Until the plan is locked, the treasury key can sign anything the contract exposes. That is the state this product exists to end. Collect both approvals to install the policy."
    />
  );
}

export function LedgerEmptyState() {
  return (
    <EmptyState
      icon={<Plate name="record" className="h-20 w-auto" />}
      title="Nothing recorded yet"
      description="Entries land here as the wallet answers. Lock a plan, then send it."
    />
  );
}

/**
 * The three states in which /record/[planHash] has nothing to print. Each one
 * names the next action rather than reporting an absence: wire the contract, lock
 * a plan, or try again.
 */
export type RecordEmptyKind = "unwired" | "unknown" | "unreadable";

export function RecordEmptyState({
  kind,
  note,
}: {
  kind: RecordEmptyKind;
  note?: string;
}) {
  const label =
    kind === "unwired"
      ? "No anchor contract configured"
      : kind === "unknown"
        ? "Nothing anchored under this hash"
        : "The chain could not be read";

  const sentence =
    kind === "unwired"
      ? "This deployment has no PlanAnchor address, so there is nothing on chain to read back. Set NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS to the deployed contract and reload this URL."
      : kind === "unknown"
        ? "PlanAnchor has never seen this plan hash. Lock a plan on the console first: the lock step anchors the hash, and this page fills in from that moment on."
        : "The Hedera relay was busy, so the planOf call came back with nothing. The record itself is unaffected, it is permanent on chain. Reload to read it again.";

  return (
    <div className="space-y-3 border border-border bg-card p-6">
      <p className="detent-label">{label}</p>
      <p className="max-w-measure-md text-body-sm text-muted-foreground">
        {sentence}
      </p>
      {/* The unwired note repeats the sentence above word for word, so it is
          printed only for the states where it adds a detail. */}
      {note && kind !== "unwired" ? (
        <p className="max-w-measure-md text-caption text-muted-foreground">
          {note}
        </p>
      ) : null}
    </div>
  );
}
