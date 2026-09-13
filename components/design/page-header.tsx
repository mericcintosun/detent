import type * as React from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: React.ReactNode;
  /** A detent-label line above the title, such as the run mode status line. */
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  /**
   * Buttons or links. They lead the row under the description, on the same
   * left edge as the title, so no width and no entrance wipe can clip them at
   * the far end of the column.
   */
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
      <div className="flex min-w-0 flex-col gap-3">
        <h1 className="font-display text-headline text-foreground">{title}</h1>
        {description ? (
          <p className="max-w-measure-md text-lead text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions || meta ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          {actions ? (
            <div className="flex flex-wrap items-center gap-3">{actions}</div>
          ) : null}
          {meta ? (
            <div className="flex flex-wrap items-center gap-2">{meta}</div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
