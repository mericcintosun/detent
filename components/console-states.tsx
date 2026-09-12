"use client";

// Every non-happy surface the console can show, in one file.
//
// The treasury key banner has a named branch per member of TreasuryKeyState, so
// the compiler proves the set is covered: add a state to lib/wallet-state.ts and
// this switch stops building until it is rendered. The empty states carry the
// markup that used to sit inline in components/operations-console.tsx, each one
// ending in the next click rather than a shrug, and app/loading.tsx renders the
// same skeleton the console would, so there is one skeleton in the repo.
//
// Tokens only, per IDENTITY.md: oxide-red is spent on the refused row and
// nowhere else, infrastructure trouble is muted.

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
}

function Frame({
  tone,
  label,
  children,
}: {
  tone: "neutral" | "bad" | "ok";
  label: string;
  children: ReactNode;
}) {
  const border =
    tone === "bad" ? "border-bad" : tone === "ok" ? "border-ok" : "border-border";
  return (
    <div className={`detent-enter space-y-2 border px-4 py-4 ${border}`}>
      <p className="detent-label">{label}</p>
      {children}
    </div>
  );
}

export function TreasuryKeyBanner({
  state,
  reason,
  note,
  onSignAndRelay,
  onRetry,
  busy,
}: TreasuryKeyBannerProps) {
  switch (state) {
    case "disconnected":
      return (
        <Frame tone="neutral" label="Treasury key, compiled locally">
          <p className="max-w-[72ch] text-sm leading-relaxed text-muted-foreground">
            No Privy credentials are configured on the server, so the policy is
            compiled and evaluated here and the receipt is a stub. The refusal is
            the same one the wallet returns, which is why this path is the
            rehearsal path.
          </p>
        </Frame>
      );

    case "connecting":
      return (
        <Frame tone="neutral" label="Treasury key, opening the policy">
          <p className="max-w-[72ch] text-sm leading-relaxed text-muted-foreground">
            Installing the compiled policy on the treasury wallet under the key
            quorum. Nothing can be signed until it lands.
          </p>
        </Frame>
      );

    case "wrong-network":
      return (
        <Frame tone="neutral" label="Treasury key, chain refused">
          <p className="max-w-[72ch] text-sm leading-relaxed text-muted-foreground">
            The wallet would not broadcast to Hedera testnet, chain 296. The
            policy still governs the signing request, so take the signature from
            the same wallet and put the transaction on chain through the Hedera
            relay instead.
          </p>
          <Button variant="outline" disabled={busy} onClick={onSignAndRelay}>
            Sign and relay through Hedera instead
          </Button>
        </Frame>
      );

    case "idle":
      return (
        <Frame tone="neutral" label="Treasury key, live and idle">
          <p className="max-w-[72ch] text-sm leading-relaxed text-muted-foreground">
            The treasury server wallet is reachable and nothing is in flight.
            Lock a plan to give the key a limit, then send it.
          </p>
        </Frame>
      );

    case "tx-pending":
      return (
        <Frame tone="neutral" label="Treasury key, asking the wallet">
          <p className="max-w-[72ch] text-sm leading-relaxed text-muted-foreground">
            The payload is with the wallet. The policy is evaluated before any
            signature is produced, so this either comes back signed or comes back
            refused.
          </p>
        </Frame>
      );

    case "tx-confirmed":
      return (
        <Frame tone="ok" label="Treasury key, signed">
          <p className="max-w-[72ch] text-sm leading-relaxed">
            The payload matched the approved calldata byte for byte, the wallet
            signed it, and the policy is revoked.
          </p>
          {note ? (
            <p className="max-w-[72ch] text-sm leading-relaxed text-muted-foreground">
              {note}
            </p>
          ) : null}
        </Frame>
      );

    case "tx-rejected":
      return (
        <Frame tone="bad" label="Treasury key, refused">
          <p className="max-w-[72ch] text-sm leading-relaxed text-bad">
            {reason ??
              "The policy refused this payload, so nothing was signed and nothing was broadcast."}
          </p>
          <p className="max-w-[72ch] text-sm leading-relaxed text-muted-foreground">
            This is the key doing its job. Restore the approved amount and send
            the plan again with the same wallet under the same policy.
          </p>
        </Frame>
      );

    case "tx-failed":
      return (
        <Frame tone="neutral" label="Treasury key, no answer">
          <p className="max-w-[72ch] text-sm leading-relaxed text-muted-foreground">
            {note ??
              "The provider did not return a usable answer. The plan is untouched and nothing was signed."}
          </p>
          <Button variant="outline" disabled={busy} onClick={onRetry}>
            Send the approved plan again
          </Button>
        </Frame>
      );
  }
}

/* --- The send error surface ----------------------------------------------- */

export interface SendErrorStateProps {
  hint: string;
  blockers?: string[];
  onRetry: () => void;
  busy: boolean;
}

/** A failed call, with the retry as a control rather than a sentence. */
export function SendErrorState({
  hint,
  blockers,
  onRetry,
  busy,
}: SendErrorStateProps) {
  return (
    <div className="space-y-3">
      <p className="border border-bad px-4 py-3 text-sm leading-relaxed text-bad">
        {hint}
      </p>
      {blockers && blockers.length > 0 ? (
        <ul className="space-y-1 px-4">
          {blockers.map((blocker) => (
            <li key={blocker} className="text-sm leading-relaxed text-bad">
              {blocker}
            </li>
          ))}
        </ul>
      ) : null}
      <Button variant="outline" disabled={busy} onClick={onRetry}>
        Try the send again
      </Button>
    </div>
  );
}

/* --- Empty states, each ending in the next click -------------------------- */

export function PlanEmptyState({ partition }: { partition: string }) {
  return (
    <div className="px-6 py-6">
      <div className="border border-dashed border-border px-6 py-10 text-center">
        <p className="detent-label">No rows in this register</p>
        <p className="mx-auto max-w-[48ch] pt-2 text-sm leading-relaxed text-muted-foreground">
          The register returned no holders for partition {partition}, so there is
          nothing to preview and nothing to sign. Pick the coupon run to rebuild
          the plan against the current snapshot.
        </p>
      </div>
    </div>
  );
}

export function PolicyEmptyState() {
  return (
    <div className="space-y-3 border border-dashed border-border p-6">
      <p className="detent-label">No policy installed</p>
      <p className="max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
        Until the plan is locked, the treasury key can sign anything the contract
        exposes. That is the state this product exists to end. Collect both
        approvals to install the policy.
      </p>
    </div>
  );
}

export function LedgerEmptyState() {
  return (
    <div className="border border-dashed border-border px-6 py-10 text-center">
      <p className="detent-label">Nothing recorded yet</p>
      <p className="mx-auto max-w-[48ch] pt-2 text-sm leading-relaxed text-muted-foreground">
        Entries land here as the wallet answers. Lock a plan, then send it.
      </p>
    </div>
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
    <div className="space-y-3 border border-dashed border-border p-6">
      <p className="detent-label">{label}</p>
      <p className="max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
        {sentence}
      </p>
      {note ? (
        <p className="max-w-[62ch] text-xs leading-relaxed text-muted-foreground">
          {note}
        </p>
      ) : null}
    </div>
  );
}

/* --- The skeletons, one per server read ----------------------------------- */

/**
 * The register is read on the server, so this stands in while it arrives. Same
 * rhythm as the console, same tokens, no spinner: ruled blocks on the ground
 * colour, the way the page will look once the rows land.
 */
export function RegisterSkeleton() {
  return (
    <div className="space-y-12">
      <section className="space-y-6">
        <p className="detent-label">Reading the register</p>
        <div className="h-12 w-full max-w-[16ch] border-b border-border bg-card sm:h-14" />
        <div className="space-y-3">
          <div className="h-4 w-full max-w-[52ch] bg-card" />
          <div className="h-4 w-full max-w-[44ch] bg-card" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="h-6 w-32 border border-border bg-card" />
          <div className="h-6 w-40 border border-border bg-card" />
        </div>
      </section>

      <Card>
        <CardHeader className="border-b border-border">
          <p className="detent-label">Plan</p>
          <div className="h-7 w-full max-w-[28ch] bg-secondary" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-b border-border px-6 py-3">
            <div className="h-3 w-full max-w-[40ch] bg-secondary" />
          </div>
          <ul className="divide-y divide-border">
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <li
                key={row}
                className="grid gap-4 px-6 py-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"
              >
                <div className="h-4 w-full max-w-[24ch] bg-secondary" />
                <div className="h-4 w-full max-w-[14ch] bg-secondary" />
                <div className="h-4 w-full max-w-[10ch] bg-secondary" />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * The record route reads planOf over the relay, which can take a second on a
 * busy Hashio. Same ruled-block idiom as RegisterSkeleton: the heading rule, the
 * hash line, then the six rows of the record's own dl.
 */
export function RecordSkeleton() {
  return (
    <div className="max-w-[72ch] space-y-8">
      <div className="space-y-4">
        <p className="detent-label">Reading the plan record</p>
        <div className="h-9 w-full max-w-[24ch] border-b border-border bg-card sm:h-10" />
        <div className="h-4 w-full max-w-[60ch] bg-card" />
      </div>

      <Card>
        <CardHeader className="border-b border-border">
          <div className="h-6 w-32 border border-border bg-card" />
        </CardHeader>
        <CardContent className="pt-6">
          <dl className="space-y-4">
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <div
                key={row}
                className="space-y-2 border-b border-border pb-3 last:border-b-0"
              >
                <div className="h-3 w-full max-w-[12ch] bg-secondary" />
                <div className="h-4 w-full max-w-[38ch] bg-secondary" />
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
