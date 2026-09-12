import type * as React from "react";
import { cn } from "@/lib/utils";

export interface SectionProps {
  /** The anchor id. The heading gets `${id}-heading` and labels the region. */
  id: string;
  heading: React.ReactNode;
  /** h2 by default; use 3 for a section nested inside another. */
  level?: 2 | 3;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** A labelled page region with an anchor, a heading and optional actions. */
export function Section({
  id,
  heading,
  level = 2,
  eyebrow,
  description,
  actions,
  children,
  className,
}: SectionProps) {
  const Heading = level === 2 ? "h2" : "h3";
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      data-slot="section"
      className={cn("scroll-mt-24 py-section first:pt-0", className)}
    >
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          {eyebrow ? <p className="detent-label">{eyebrow}</p> : null}
          <Heading
            id={headingId}
            className={cn(
              "font-display text-foreground",
              level === 2 ? "text-title" : "text-heading",
            )}
          >
            {heading}
          </Heading>
          {description ? (
            <p className="max-w-measure-md text-body-sm text-muted-foreground">
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
      {children}
    </section>
  );
}
