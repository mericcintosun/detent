import type * as React from "react";
import { cn } from "@/lib/utils";

export interface KeyValueListProps {
  children: React.ReactNode;
  className?: string;
}

/** A ledger style description list: one hairline between rows. */
export function KeyValueList({ children, className }: KeyValueListProps) {
  return (
    <dl
      data-slot="key-value-list"
      className={cn("divide-y divide-border border-y border-border", className)}
    >
      {children}
    </dl>
  );
}

export interface KeyValueProps {
  label: React.ReactNode;
  children: React.ReactNode;
  /** Set the value in the mono face with tabular digits. */
  mono?: boolean;
  /** Stack the label above the value at every width. */
  stacked?: boolean;
  className?: string;
}

/**
 * One term and its value. Side by side from sm up, stacked on a phone. Long
 * values break anywhere rather than widening the page.
 */
export function KeyValue({
  label,
  children,
  mono,
  stacked,
  className,
}: KeyValueProps) {
  return (
    <div
      data-slot="key-value"
      className={cn(
        "flex flex-col gap-1 py-3",
        !stacked && "sm:flex-row sm:items-baseline sm:justify-between sm:gap-6",
        className,
      )}
    >
      <dt className="detent-label shrink-0">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-body-sm break-words text-foreground",
          !stacked && "sm:text-right",
          mono && "amount font-mono text-caption break-all",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

/** The same row under the name the plan table uses. */
export const DataRow = KeyValue;
export type DataRowProps = KeyValueProps;
