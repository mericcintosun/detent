"use client";

import { Button } from "@/components/ui/button";

/**
 * Nothing from the error object reaches the page: an operator console should not
 * print a stack trace over a register.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-[62ch] space-y-6 py-20">
      <p className="detent-label">Detent</p>
      <h1 className="text-4xl leading-[1.05] tracking-tight">
        This page did not finish loading
      </h1>
      <p className="leading-relaxed text-muted-foreground">
        The register read failed on the way out. Nothing was signed and no policy
        was installed, so it is safe to run it again.
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
