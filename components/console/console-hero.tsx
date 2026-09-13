"use client";

import Link from "next/link";
import { PageHeader, StatusPill } from "@/components/design";
import { Reveal } from "@/components/motion";
import { buttonVariants } from "@/components/ui/button-variants";
import { couponWindow } from "@/lib/data";
import type { ConsoleController } from "./use-console";

/**
 * The compact top of the console: the run mode status line, the product name,
 * one sentence and the way to the explanation. The status line is a polite live
 * region because the policy id joins it the moment a plan is locked.
 */
export function ConsoleHero({
  c,
  signerLive,
}: {
  c: ConsoleController;
  signerLive: boolean;
}) {
  const registerLive = c.snapshot.source === "hedera-testnet";
  return (
    <Reveal variant="wipe" trigger="mount">
      <PageHeader
        eyebrow={
          <span
            id="console-status"
            role="status"
            aria-live="polite"
            className="break-words"
          >
            {c.modeLine}
          </span>
        }
        title="Detent"
        description="Preview a corporate action line by line, then lock the treasury key to exactly that transaction."
        actions={
          // prefetch off: the explanation is a separate static page, and a
          // prefetch on first paint would spend a request the operator did not
          // ask for.
          <Link
            href="/how-it-works"
            prefetch={false}
            className={buttonVariants({
              variant: "outline",
              className: "border-input",
            })}
          >
            How it works
          </Link>
        }
        meta={
          <>
            <StatusPill kind="mode" value={registerLive ? "live" : "mirror"}>
              {registerLive ? "Register read on chain" : "Seed register"}
            </StatusPill>
            <StatusPill kind="mode" value={signerLive ? "live" : "mirror"}>
              {signerLive ? "Privy signer" : "Local mirror signer"}
            </StatusPill>
            <span className="text-caption text-muted-foreground">
              {c.snapshot.token.standard}, {couponWindow.reference} window
            </span>
          </>
        }
      />
    </Reveal>
  );
}
