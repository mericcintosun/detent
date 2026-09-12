"use client";

// The L6 rail's section awareness, split out of components/rail.tsx so the rail
// itself stays a server component.
//
// Everything structural is server HTML: the six anchors, the scrolling row below
// lg and the stacked column at lg, exactly as Phase 8 left them. The only thing
// the client adds is which one you are currently reading, which is what turns a
// list of links into a rail that reports position. With JavaScript off every
// link still renders and still navigates; nothing is gated behind the effect.

import { useEffect, useState } from "react";

export interface SectionLink {
  href: string;
  label: string;
}

/**
 * The five DEMO.md sections, in document order. `#brief` is deliberately not
 * observed: it is the essay under the console, not a step, and /record/[planHash]
 * carries none of these ids at all, in which case nothing is marked and the rail
 * reads exactly as it did before.
 */
const OBSERVED = ["register", "plan", "policy", "send", "ledger"] as const;

export function SectionProgress({ sections }: { sections: SectionLink[] }) {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const nodes = OBSERVED.map((id) => document.getElementById(id)).filter(
      (node): node is HTMLElement => node !== null,
    );
    if (nodes.length === 0) return;

    // The reading line is the upper fifth of the viewport. Whichever observed
    // section is first in document order inside that band is the one being read,
    // which is stable while a long section like #plan scrolls past.
    const inBand = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        }
        setCurrent(OBSERVED.find((id) => inBand.has(id)) ?? null);
      },
      { rootMargin: "-12% 0px -68% 0px", threshold: 0 },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    // The scroll lives in this wrapper, never on the page: the negative margin
    // lets the row bleed to the edges so a half-cut label reads as "there is
    // more", and it is undone at lg where the links stack.
    <nav
      aria-label="Console sections"
      className="-mx-5 overflow-x-auto border-t border-border px-5 pt-3 lg:mx-0 lg:overflow-x-visible lg:px-0 lg:pt-6"
    >
      <div className="flex w-max gap-x-6 lg:w-auto lg:flex-col lg:gap-y-3">
        {sections.map((section) => {
          const active = current !== null && section.href === `#${current}`;
          return (
            <a
              key={section.href}
              href={section.href}
              aria-current={active ? "location" : undefined}
              // A wide-tracked small-caps label is three pixels of ink, so the
              // hit area has to be its own thing on the scrolling mobile bar.
              // The gold rule is spent on the current section and nowhere else,
              // and it is held behind lg because a left border on a horizontal
              // row would read as a divider rather than as a marker.
              className={`detent-label inline-flex min-h-11 items-center whitespace-nowrap transition-colors hover:text-foreground lg:border-l-2 lg:pl-3 ${
                active
                  ? "text-foreground lg:border-hairline"
                  : "lg:border-transparent"
              }`}
            >
              {section.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
