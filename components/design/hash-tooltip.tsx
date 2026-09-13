"use client";

import type * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface HashTooltipProps {
  value: string;
  /** The trigger element, rendered by HashText with its classes and ref. */
  trigger: React.ReactElement;
  children: React.ReactNode;
}

/**
 * The Base UI tooltip around a HashText trigger. Base UI exposes the tooltip
 * only as one namespace, so importing any part of it brings the positioner,
 * the popup and floating-ui; this module keeps all of that out of the first
 * load. components/design/hash-text.tsx loads it after hydration.
 */
export default function HashTooltip({
  value,
  trigger,
  children,
}: HashTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={trigger}>{children}</TooltipTrigger>
      <TooltipContent className="max-w-[min(90vw,42rem)] font-mono break-all">
        {value}
      </TooltipContent>
    </Tooltip>
  );
}
