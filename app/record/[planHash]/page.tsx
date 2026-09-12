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
import type { ReactNode } from "react";
import { RecordEmptyState } from "@/components/console-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { readPlanRecord } from "@/lib/anchor";
import { hashscanToken } from "@/lib/hashscan";
import { PLAN_ANCHOR_ADDRESS } from "@/lib/public-config";
import { planHashSchema } from "@/lib/schemas";

/** Matches app/page.tsx: one relay read is not a cost to pay per navigation. */
export const revalidate = 30;

export const metadata: Metadata = {
  title: "On chain plan record",
  description:
    "The anchored plan hash read back off PlanAnchor on Hedera testnet, with its status, its timestamps and its HashScan links.",
};

/** ISO to the form a register prints: seconds, no T, named as UTC. */
function utc(value: string | undefined): string {
  if (!value) return "not set";
  return `${value.slice(0, 19).replace("T", " ")} UTC`;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-border pb-3 last:border-b-0">
      <dt className="detent-label">{label}</dt>
      <dd className="pt-1 text-sm leading-relaxed break-all">{children}</dd>
    </div>
  );
}

export default async function PlanRecordPage({
  params,
}: {
  params: Promise<{ planHash: string }>;
}) {
  const { planHash } = await params;
  const parsed = planHashSchema.safeParse(planHash);
  if (!parsed.success) notFound();

  const record = await readPlanRecord(parsed.data);

  // Narrowed rather than cast, so adding a state to PlanRecordState forces a
  // decision here instead of falling into the wrong branch.
  const emptyKind =
    record.state === "unwired" ||
    record.state === "unknown" ||
    record.state === "unreadable"
      ? record.state
      : null;

  const border =
    record.state === "settled"
      ? "border-ok"
      : record.state === "abandoned"
        ? "border-bad"
        : "border-border";

  return (
    <div className="max-w-[76ch] space-y-8">
      <div className="space-y-4">
        <p className="detent-label">PlanAnchor, Hedera testnet</p>
        <h1 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">
          On chain plan record
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          This is the durable half of the audit record. The console holds a
          session; the chain holds the plan hash, who anchored it and when it
          closed.
        </p>
        <p className="text-sm leading-relaxed break-all" title={parsed.data}>
          <span className="detent-label block pb-1">Plan hash</span>
          {parsed.data}
        </p>
      </div>

      {emptyKind ? (
        <RecordEmptyState kind={emptyKind} note={record.note} />
      ) : (
        <Card className="detent-enter">
          <CardHeader className="border-b border-border">
            <CardTitle className="font-display text-xl">
              What the contract holds
            </CardTitle>
            <CardDescription className="leading-relaxed">
              {record.note}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <dl className="space-y-4">
              <Row label="State">
                <Badge variant="outline" className={border}>
                  {record.state}
                </Badge>
              </Row>
              <Row label="Token">{record.token ?? "not set"}</Row>
              <Row label="Selector">{record.selector ?? "not set"}</Row>
              <Row label="Anchored by">{record.anchoredBy ?? "not set"}</Row>
              <Row label="Anchored at">{utc(record.anchoredAt)}</Row>
              <Row label="Settled at">{utc(record.settledAt)}</Row>
            </dl>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-6">
        <Button variant="outline" asChild>
          <Link href="/#ledger">Back to the audit record</Link>
        </Button>
        {PLAN_ANCHOR_ADDRESS ? (
          <a
            href={hashscanToken(PLAN_ANCHOR_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            title={PLAN_ANCHOR_ADDRESS}
            className="text-sm underline decoration-hairline underline-offset-4 hover:text-foreground"
          >
            Open PlanAnchor on HashScan
          </a>
        ) : null}
      </div>
    </div>
  );
}
