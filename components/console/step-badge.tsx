"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { Badge } from "@/components/ui/badge";
import { spring, transition } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type StepStatus = "done" | "current" | "next";

const STEP: Record<StepStatus, { label: string; className: string }> = {
  done: { label: "Done", className: "border-success/40 text-success" },
  current: {
    label: "Current step",
    className: "border-hairline text-foreground",
  },
  next: { label: "Up next", className: "border-border text-muted-foreground" },
};

/**
 * Where one of the five console steps stands. The word carries the state, the
 * rule colour only repeats it.
 *
 * Step progress moves: when a step changes state the old word drops out, then
 * the new one settles in on the snappy spring, and the badge's width follows
 * the word on the layout spring instead of jumping. `mode="wait"` keeps both
 * words in the badge's flow: `popLayout` would take the leaving word out as an
 * absolute element, which at a phone width reached past the viewport for the
 * length of its exit. The first render does not animate, so the server HTML is
 * final. Reduced motion keeps only the fade.
 */
export function StepBadge({ status }: { status: StepStatus }) {
  const { label, className } = STEP[status];
  return (
    <m.span
      layout
      transition={{ layout: spring.layout }}
      className="inline-flex"
    >
      <Badge
        variant="outline"
        className={cn("relative min-h-6 overflow-hidden", className)}
      >
        <AnimatePresence initial={false} mode="wait">
          <m.span
            key={status}
            className="inline-block"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: spring.snappy }}
            exit={{ opacity: 0, y: -6, transition: transition.exit }}
          >
            {label}
          </m.span>
        </AnimatePresence>
      </Badge>
    </m.span>
  );
}
