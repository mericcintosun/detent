"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import type * as React from "react";
import { variants, type VariantName } from "@/lib/motion";
import { useMotionCustom } from "./use-client-mount";

export interface PresenceProps {
  /** Whether the content is mounted. Unmounting plays the exit first. */
  show: boolean;
  children: React.ReactNode;
  variant?: VariantName;
  /**
   * Changing the key swaps the content with an exit then an entrance, which is
   * how a status line moves from one state to the next.
   */
  presenceKey?: string;
  className?: string;
}

/**
 * Mounts and unmounts content with an entrance and an exit, one at a time
 * (AnimatePresence `mode="wait"`): the old content finishes leaving before the
 * new content enters. The first render does not animate, so server rendered
 * content is visible immediately and hydration never waits on Motion.
 */
export function Presence({
  show,
  children,
  variant = "fade",
  presenceKey = "presence",
  className,
}: PresenceProps) {
  const custom = useMotionCustom();
  return (
    <AnimatePresence initial={false} mode="wait" custom={custom}>
      {show ? (
        <m.div
          key={presenceKey}
          className={className}
          variants={variants[variant]}
          custom={custom}
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
