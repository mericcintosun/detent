"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";
import { truncateMiddle } from "./format";

export interface HashTextProps {
  value: string;
  /** Names the value for assistive technology: "transaction hash", "plan hash". */
  label?: string;
  lead?: number;
  tail?: number;
  /** Show a copy control after the text. */
  copyable?: boolean;
  className?: string;
}

/**
 * A long hex value shown truncated in the mono face. The full value is in a
 * tooltip on hover and keyboard focus, and in the accessible name, so nothing
 * is hidden from a screen reader. Truncation never changes the stored value.
 */
export function HashText({
  value,
  label = "hash",
  lead = 10,
  tail = 6,
  copyable = true,
  className,
}: HashTextProps) {
  const short = truncateMiddle(value, lead, tail);
  return (
    <span
      data-slot="hash-text"
      className={cn(
        "inline-flex max-w-full items-center gap-1 align-middle",
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              tabIndex={0}
              className="amount min-w-0 truncate font-mono text-caption text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          }
        >
          <span aria-hidden="true">{short}</span>
          <span className="sr-only">
            {label} {value}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[min(90vw,42rem)] font-mono break-all">
          {value}
        </TooltipContent>
      </Tooltip>
      {copyable ? <CopyButton value={value} label={label} /> : null}
    </span>
  );
}
