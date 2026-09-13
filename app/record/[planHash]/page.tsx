// The permanent settlement record, read back off PlanAnchor.
//
// Everything else in this product lives for one session: the compiled policy, the
// audit log, the download. This route does not. A plan hash is deterministic and
// the anchor is on chain, so a judge can reload this URL tomorrow and Hedera will
// still say that this exact plan was anchored, then settled.
//
// Server component on purpose: planOf is a view call, so no key, no client
// bundle, no state. The only data source is readPlanRecord.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HashScanLink, PageHeader, Section } from "@/components/design";
import { Reveal } from "@/components/motion";
import { PlanHash } from "@/components/record/plan-hash";
import { RecordChainDetail } from "@/components/record/record-chain-detail";
import {
  AnchorNotConfiguredState,
  ReadFailedState,
  UnknownRecordState,
} from "@/components/record/record-empty-states";
import { RecordStatusPill } from "@/components/record/record-status-pill";
import { selectRecordView } from "@/components/record/record-view";
import { WhatThisProves } from "@/components/record/what-this-proves";
import { buttonVariants } from "@/components/ui/button-variants";
import { readPlanRecord } from "@/lib/anchor";
import { tokenExplorerHref } from "@/lib/hashscan";
import { PLAN_ANCHOR_ADDRESS } from "@/lib/public-config";
import { planHashSchema } from "@/lib/schemas";

/** Matches app/page.tsx: one relay read is not a cost to pay per navigation. */
export const revalidate = 30;

const DESCRIPTION =
  "The anchored plan hash read back off PlanAnchor on Hedera testnet, with its status, its timestamps and its HashScan links.";

// generateMetadata rather than a static export, so a valid hash gets a
// canonical built from the parsed segment. planHashSchema is the same parse
// the page body runs below, so the two can never disagree about what counts
// as a valid plan hash, and nothing here reads the chain.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ planHash: string }>;
}): Promise<Metadata> {
  const { planHash } = await params;
  const parsed = planHashSchema.safeParse(planHash);
  if (!parsed.success) {
    return { title: "On chain plan record", description: DESCRIPTION };
  }
  return {
    title: "On chain plan record",
    description: DESCRIPTION,
    alternates: { canonical: `/record/${parsed.data}` },
  };
}

export default async function PlanRecordPage({
  params,
}: {
  params: Promise<{ planHash: string }>;
}) {
  const { planHash } = await params;
  // No loading.tsx sits above this route on purpose. A streamed loading boundary
  // commits the 200 status before this line runs, so notFound() could only swap
  // the body and the malformed hash answered 200. Without the boundary this is a
  // real 404, decided before any read.
  const parsed = planHashSchema.safeParse(planHash);
  if (!parsed.success) notFound();

  const record = await readPlanRecord(parsed.data);
  const view = selectRecordView(record);

  /**
   * PlanAnchor itself is the only address on this page that has provably been
   * deployed: it is the contract the read above just answered from. The link
   * is gated on the address alone, not on this hash having a row, so a relay
   * hiccup on `unreadable` does not hide a link to a contract that is, in
   * fact, real.
   */
  const anchorHref = tokenExplorerHref(PLAN_ANCHOR_ADDRESS, "on-chain");

  return (
    <div className="max-w-measure-xl">
      <Reveal as="div" variant="wipe" trigger="mount">
        <PageHeader
          eyebrow="PlanAnchor, Hedera testnet 296"
          title="On chain plan record"
          description="This is the permanent half of the audit record. The console holds a session; the chain holds the plan hash, who anchored it and when it closed."
          meta={
            <>
              <PlanHash value={parsed.data} />
              <RecordStatusPill label={view.pillLabel} tone={view.pillTone} />
            </>
          }
          actions={
            anchorHref && PLAN_ANCHOR_ADDRESS ? (
              <HashScanLink kind="token" value={PLAN_ANCHOR_ADDRESS}>
                Open PlanAnchor on HashScan
              </HashScanLink>
            ) : null
          }
        />
      </Reveal>

      <Section
        id="record"
        heading="What the contract holds"
        description="One row in the PlanAnchor register, read with no operator key."
      >
        {view.kind === "unknown" ? <UnknownRecordState /> : null}
        {view.kind === "unwired" ? <AnchorNotConfiguredState /> : null}
        {view.kind === "unreadable" ? (
          <ReadFailedState planHash={parsed.data} />
        ) : null}
        {view.hasChainData ? <RecordChainDetail record={record} /> : null}
      </Section>

      <Section id="proof" heading="What this record proves">
        <WhatThisProves />
      </Section>

      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-6">
        {/* The generic console link belongs to the not-found page
            (app/not-found.tsx, app-shell). This route's own back link keeps its
            established name and destination: the console opened this record in
            a tab of its own, and the audit ledger section is where that
            session's approvals, lock and audit record still live. */}
        <Link
          href="/#ledger"
          className={buttonVariants({ variant: "outline" })}
        >
          Back to the audit record
        </Link>
      </div>
    </div>
  );
}
