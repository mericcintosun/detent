"use client";

import { AnimatePresence, m } from "motion/react";
import type * as React from "react";
import { variants, type VariantName } from "@/lib/motion";

export interface PresenceProps {
  /** Whether the content is mounted. Unmounting plays the exit variant. */
  show: boolean;
  children: React.ReactNode;
  variant?: VariantName;
  /**
   * Changing the key swaps the content with an exit then an entrance, which is
   * how a status line moves from one state to the next.
   */
  presenceKey?: string;
  mode?: "sync" | "wait" | "popLayout";
  className?: string;
}

/**
 * Mounts and unmounts content with an entrance and an exit. The first render
 * does not animate, so server rendered content is visible immediately.
 */
export function Presence({
  show,
  children,
  variant = "fade",
  presenceKey = "presence",
  mode = "wait",
  className,
}: PresenceProps) {
  return (
    <AnimatePresence initial={false} mode={mode}>
      {show ? (
        <m.div
          key={presenceKey}
          className={className}
          variants={variants[variant]}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {children}
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
