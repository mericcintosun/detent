// The three states with no chain row to show. Each names exactly what is
// missing and the one thing that would fix it, so a reader (or a judge)
// lands on an explanation rather than a blank card. Replaces the
// console-owned RecordEmptyState: this route no longer imports from
// components/console-states.tsx.

import { Callout } from "@/components/design";
import { PLAN_ANCHOR_ENV_HINT } from "./record-view";

/** The hash is well formed but PlanAnchor has never anchored it. */
export function UnknownRecordState() {
  return (
    <Callout tone="neutral" title="Nothing anchored under this hash">
      PlanAnchor has never seen this plan hash. Lock a plan on the console
      first: the lock step anchors the hash, and this page fills in from that
      moment on.
    </Callout>
  );
}

/** No PlanAnchor address is configured for this deployment. */
export function AnchorNotConfiguredState() {
  return (
    <Callout tone="warning" title="No anchor contract configured">
      This deployment has no PlanAnchor address, so there is nothing on chain to
      read back. Set{" "}
      <code className="font-mono text-caption">{PLAN_ANCHOR_ENV_HINT}</code> to
      the deployed contract and reload this page.
    </Callout>
  );
}

/** The relay would not answer the planOf call. */
export function ReadFailedState({ planHash }: { planHash: string }) {
  return (
    <Callout tone="destructive" title="The chain could not be read">
      The Hedera relay did not answer the planOf call, so the record could not
      be read this time. The record itself is unaffected, it is permanent on
      chain.{" "}
      <a
        href={`/record/${planHash}`}
        className="underline decoration-hairline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Try this page again
      </a>
      .
    </Callout>
  );
}
