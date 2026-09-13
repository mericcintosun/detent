"use client";

import Link from "next/link";
import { PageHeader } from "@/components/design";
import { Reveal } from "@/components/motion";
import { buttonVariants } from "@/components/ui/button-variants";
import { couponWindow } from "@/lib/data";
import type { ConsoleController } from "./use-console";

/**
 * The compact top of the console: the run mode status line, the product name,
 * one sentence and the way to the explanation. The status line is a polite live
 * region because the policy id joins it the moment a plan is locked.
 *
 * The status line is the hero's only statement of the run mode. It already names
 * the register source and the signer, which two pills under the description
 * used to repeat, and the shell's rail or top bar carries the mode pill.
 */
export function ConsoleHero({ c }: { c: ConsoleController }) {
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
            className={buttonVariants({ variant: "outline" })}
          >
            How it works
          </Link>
        }
        meta={
          <span className="text-caption text-muted-foreground">
            {c.snapshot.token.standard}, {couponWindow.reference} window
          </span>
        }
      />
    </Reveal>
  );
}
