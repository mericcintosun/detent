import type * as React from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: React.ReactNode;
  /** A detent-label line above the title, such as the run mode status line. */
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  /** Buttons or links aligned to the end of the title row from md up. */
  actions?: React.ReactNode;
  /** Badges or pills under the description. */
  meta?: React.ReactNode;
  className?: string;
}

/** The top of a page: the one h1, its promise, and the primary actions. */
export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "flex flex-col gap-4 border-b border-border pb-8",
        className,
      )}
    >
      {eyebrow ? <p className="detent-label">{eyebrow}</p> : null}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="font-display text-headline text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="max-w-measure-md text-lead text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {actions}
          </div>
        ) : null}
      </div>
      {meta ? (
        <div className="flex flex-wrap items-center gap-2">{meta}</div>
      ) : null}
    </header>
  );
}
