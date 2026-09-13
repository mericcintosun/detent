"use client";

import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import {
  AddressText,
  Callout,
  EmptyState,
  KeyValue,
  KeyValueList,
  Section,
  Stat,
  StatGroup,
  StaleBanner,
  StatusPill,
} from "@/components/design";
import { Button } from "@/components/ui/button";
import { formatMicros, formatTokens } from "@/lib/plan";
import { ADAPTER_MODE } from "@/lib/public-config";
import { StepBadge } from "./step-badge";
import { describeAge, useStaleMinutes } from "./use-browser";
import type { ConsoleController } from "./use-console";

/** lib/hedera.ts prefixes a holder it could not read with this sentence. */
const UNREAD_PREFIX = "Not read on chain in this snapshot";

export function RegisterSection({
  c,
  readAt,
  staleAfterMs,
}: {
  c: ConsoleController;
  readAt: string;
  staleAfterMs: number;
}) {
  const { snapshot } = c;
  const staleMinutes = useStaleMinutes(readAt, staleAfterMs);
  const live = snapshot.source === "hedera-testnet";
  const unread = snapshot.holders.filter((holder) =>
    holder.complianceNote.startsWith(UNREAD_PREFIX),
  ).length;
  // Real mode asked for the chain and got the seed: the live read failed or was
  // not configured, and the note says which.
  const fellBack = ADAPTER_MODE === "real" && !live;

  return (
    <Section
      id="register"
      eyebrow="Step 1 of 5"
      heading="Register"
      description="Who holds the security and whom the compliance module is holding, read before anything is signed."
      actions={<StepBadge status="done" />}
    >
      <div className="flex flex-col gap-6">
        {staleMinutes !== null ? (
          <StaleBanner
            readAt={readAt}
            age={describeAge(staleMinutes)}
            subject="The register snapshot"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                <ArrowClockwiseIcon aria-hidden="true" />
                Reload the register
              </Button>
            }
          />
        ) : null}

        {fellBack ? (
          <Callout tone="warning" title="The live register read did not run">
            {snapshot.note}
          </Callout>
        ) : unread > 0 ? (
          <Callout tone="warning" title="Part of the register is cached">
            {unread} of {snapshot.holders.length} holders could not be read on
            chain in this snapshot and show their cached values.
          </Callout>
        ) : null}

        {snapshot.holders.length === 0 ? (
          <EmptyState
            title="No holders in this register"
            description={`The register returned no holders for partition ${snapshot.token.partition}, so there is nothing to preview and nothing to sign. Reload once the register has been written.`}
            action={
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Reload the register
              </Button>
            }
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
            <div className="flex min-w-0 flex-col gap-4">
              <p className="detent-label">{snapshot.token.name}</p>
              <p className="max-w-measure-lg text-body text-foreground">
                {formatTokens(snapshot.token.totalSupply)} tokens across{" "}
                {snapshot.holders.length} holders on partition{" "}
                {snapshot.token.partition}. {c.heldCount} of them are currently
                held by the compliance module, which is the sort of thing you
                want to read before you sign, not after.
              </p>
              <StatGroup className="md:grid-cols-2 xl:grid-cols-4">
                <Stat label="Holders" value={snapshot.holders.length} />
                <Stat
                  label="Held"
                  value={c.heldCount}
                  tone={c.heldCount > 0 ? "warning" : "default"}
                  hint="by compliance"
                />
                <Stat
                  label="Supply"
                  value={formatTokens(snapshot.token.totalSupply)}
                  hint={snapshot.token.symbol}
                />
                <Stat
                  label="Treasury"
                  value={formatMicros(snapshot.treasury.balanceMicros)}
                  hint={snapshot.treasury.settlementAsset}
                />
              </StatGroup>
            </div>

            <div className="flex min-w-0 flex-col gap-3 border border-border bg-card p-4">
              <p className="detent-label">Register note</p>
              <KeyValueList>
                <KeyValue label="Token">
                  <span className="inline-flex flex-wrap items-center justify-end gap-2">
                    <AddressText
                      address={snapshot.token.address}
                      label="token contract"
                      href={c.registerTokenHref}
                    />
                    {c.registerTokenHref && snapshot.token.verified ? (
                      <StatusPill kind="receipt" value="on-chain">
                        Verified on HashScan
                      </StatusPill>
                    ) : null}
                  </span>
                </KeyValue>
                <KeyValue label="Source">
                  {live ? "Read on chain" : "Cached seed register"}
                  {c.registerTokenHref ? null : (
                    <span className="block text-caption text-muted-foreground">
                      Seed register address, not on chain
                    </span>
                  )}
                </KeyValue>
                <KeyValue label="Snapshot" mono>
                  <time dateTime={readAt}>
                    {readAt.slice(0, 19).replace("T", " ")} UTC
                  </time>
                </KeyValue>
                <KeyValue label="Partition">
                  {snapshot.token.partition}
                </KeyValue>
                <KeyValue label="Settles in">
                  {snapshot.treasury.settlementAsset}
                </KeyValue>
              </KeyValueList>
              <p className="text-caption text-muted-foreground">
                {snapshot.note}
              </p>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
