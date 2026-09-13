"use client";

import Link from "next/link";
import { PageHeader } from "@/components/design/page-header";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

/**
 * A route failed to render. Nothing from the error object reaches the page but
 * its digest, the opaque reference the server log carries: an operator console
 * never prints a message or a stack trace over a register.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex max-w-measure-xl flex-col gap-8 py-8 lg:py-16">
      <PageHeader
        eyebrow="Something failed"
        title="This page did not finish loading"
        description="Rendering a page never signs or sends anything, so trying again is safe. If it fails the same way twice, the register or the relay is likely unreachable."
        meta={
          <>
            <Button type="button" onClick={() => reset()}>
              Try again
            </Button>
            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "border-input",
              )}
            >
              Back to the console
            </Link>
          </>
        }
      />
      {error.digest ? (
        <p className="text-caption text-muted-foreground">
          Reference{" "}
          <code className="font-mono text-foreground">{error.digest}</code>.
          Quote it when you report the failure; it matches the server log.
        </p>
      ) : null}
    </div>
  );
}
