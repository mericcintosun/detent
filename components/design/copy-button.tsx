"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CopyButtonProps {
  value: string;
  /** What is copied, read as "Copy the {label}". */
  label: string;
  className?: string;
}

/**
 * Copies a value and says so twice: the icon turns into a check for two seconds
 * and a polite live region announces it. A failed copy, such as a browser that
 * blocks the clipboard, is announced too, never swallowed.
 */
export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={copy}
        aria-label={`Copy the ${label}`}
        className={cn("text-muted-foreground hover:text-foreground", className)}
      >
        {state === "copied" ? (
          <CheckIcon aria-hidden="true" className="text-success" />
        ) : (
          <CopyIcon aria-hidden="true" />
        )}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied"
          ? `Copied the ${label}`
          : state === "failed"
            ? `Could not copy the ${label}`
            : ""}
      </span>
    </>
  );
}
