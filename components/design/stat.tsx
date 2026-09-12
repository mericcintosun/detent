import type * as React from "react";
import { cn } from "@/lib/utils";

export interface StatGroupProps {
  children: React.ReactNode;
  className?: string;
}

/** A description list of Stat entries, in a hairline grid. */
export function StatGroup({ children, className }: StatGroupProps) {
  return (
    <dl
      data-slot="stat-group"
      className={cn(
        "grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-4",
        className,
      )}
    >
      {children}
    </dl>
  );
}

export type StatTone =
  "default" | "success" | "warning" | "destructive" | "mirror";

const TONE: Record<StatTone, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  mirror: "text-mirror",
};

export interface StatProps {
  label: React.ReactNode;
  /** The figure. Pass a formatted string or a NumberTicker. */
  value: React.ReactNode;
  unit?: React.ReactNode;
  hint?: React.ReactNode;
  tone?: StatTone;
  className?: string;
}

/** One figure with its label. Must sit inside StatGroup or another dl. */
export function Stat({
  label,
  value,
  unit,
  hint,
  tone = "default",
  className,
}: StatProps) {
  return (
    <div
      data-slot="stat"
      className={cn("flex flex-col gap-2 bg-background p-4", className)}
    >
      <dt className="detent-label">{label}</dt>
      <dd className="flex flex-col gap-1">
        <span className={cn("amount font-display text-title", TONE[tone])}>
          {value}
          {unit ? (
            <span className="ml-1.5 font-sans text-body-sm text-muted-foreground">
              {unit}
            </span>
          ) : null}
        </span>
        {hint ? (
          <span className="text-caption text-muted-foreground">{hint}</span>
        ) : null}
      </dd>
    </div>
  );
}
