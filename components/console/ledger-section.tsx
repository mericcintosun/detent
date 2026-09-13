"use client";

import { DownloadSimpleIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { LedgerEmptyState } from "@/components/console-states";
import { ExternalLink, Section } from "@/components/design";
import { Stagger, StaggerItem } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { StepBadge } from "./step-badge";
import type { ConsoleController } from "./use-console";

const TONE = {
  ok: "text-success",
  bad: "text-destructive",
  neutral: "text-foreground",
} as const;

export function LedgerSection({ c }: { c: ConsoleController }) {
  return (
    <Section
      id="ledger"
      eyebrow="Step 5 of 5"
      heading="Audit record"
      description="Every plan hash, refusal and receipt from this session, newest first, in UTC."
      actions={
        <>
          <StepBadge
            status={
              c.lockSpent ? "done" : c.log.length > 0 ? "current" : "next"
            }
          />
          <Button variant="outline" onClick={c.downloadAudit}>
            <DownloadSimpleIcon aria-hidden="true" />
            Download the record
          </Button>
          {/* A new tab, so reading the record never unloads this session: the
              lock, the approvals and the entries below live only here. */}
          <Link
            href={`/record/${c.plan.planHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            Open the permanent record
            <span className="sr-only"> (opens in a new tab)</span>
          </Link>
        </>
      }
      className="border-t border-border"
    >
      {c.log.length === 0 ? (
        <LedgerEmptyState />
      ) : (
        <Stagger
          as="ul"
          trigger="mount"
          className="flex flex-col divide-y divide-border border-y border-border"
        >
          {c.log.map((entry) => (
            <StaggerItem
              as="li"
              key={entry.id}
              className="grid gap-2 py-4 sm:grid-cols-[6rem_minmax(0,1fr)]"
            >
              <time className="amount pt-0.5 font-mono text-caption text-muted-foreground">
                {entry.at} UTC
              </time>
              <div className="flex min-w-0 flex-col gap-1">
                <p
                  className={cn("text-body-sm font-semibold", TONE[entry.tone])}
                >
                  {entry.event}
                </p>
                <p className="max-w-measure-xl text-body-sm break-words text-muted-foreground">
                  {entry.detail}
                </p>
                {entry.href || entry.anchorHref ? (
                  <div className="flex flex-wrap items-center gap-x-4">
                    {entry.href ? (
                      <ExternalLink href={entry.href} className="text-body-sm">
                        Open the payout on HashScan
                      </ExternalLink>
                    ) : null}
                    {entry.anchorHref ? (
                      <ExternalLink
                        href={entry.anchorHref}
                        className="text-body-sm"
                      >
                        Open the plan anchor on HashScan
                      </ExternalLink>
                    ) : null}
                  </div>
                ) : null}
                {entry.anchorNote ? (
                  <p className="max-w-measure-xl text-caption text-muted-foreground">
                    {entry.anchorNote}
                  </p>
                ) : null}
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </Section>
  );
}
