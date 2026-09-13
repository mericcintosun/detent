"use client";

import { useEffect, useState } from "react";
import type * as React from "react";
import type { VariantName } from "@/lib/motion";
import { cn } from "@/lib/utils";

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

const ENTER: Record<VariantName, string> = {
  fade: "animate-in fade-in duration-(--duration-base) ease-standard fill-mode-both",
  rise: "animate-in fade-in slide-in-from-bottom-2 duration-(--duration-slow) ease-emphasized fill-mode-both",
  wipe: "animate-wipe",
  scaleIn:
    "animate-in fade-in zoom-in-96 duration-(--duration-base) ease-standard fill-mode-both",
};

const EXIT: Record<VariantName, string> = {
  fade: "animate-out fade-out duration-(--duration-fast) ease-exit fill-mode-forwards",
  rise: "animate-out fade-out slide-out-to-bottom-1 duration-(--duration-fast) ease-exit fill-mode-forwards",
  wipe: "animate-out fade-out duration-(--duration-fast) ease-exit fill-mode-forwards",
  scaleIn:
    "animate-out fade-out zoom-out-98 duration-(--duration-fast) ease-exit fill-mode-forwards",
};

/** Longer than the slowest exit, for a subtree where no animation runs. */
const EXIT_FALLBACK_MS = 400;

interface Shown {
  key: string | null;
  node: React.ReactNode;
  phase: "rest" | "enter" | "exit";
}

/**
 * Mounts and unmounts content with an entrance and an exit, one at a time: the
 * old content finishes leaving before the new content enters. The first render
 * does not animate, so server rendered content is visible immediately. CSS runs
 * both halves, so the console carries no animation engine for it.
 */
export function Presence({
  show,
  children,
  variant = "fade",
  presenceKey = "presence",
  className,
}: PresenceProps) {
  const wanted = show ? presenceKey : null;
  const [shown, setShown] = useState<Shown>(() => ({
    key: wanted,
    node: show ? children : null,
    phase: "rest",
  }));

  // Derived while rendering: a new key starts the exit of the old content, and
  // new children under the same key replace the old ones in place.
  let current = shown;
  if (current.phase !== "exit") {
    if (current.key === wanted) {
      if (wanted !== null && current.node !== children) {
        current = { ...current, node: children };
      }
    } else if (current.key === null) {
      current = { key: wanted, node: children, phase: "enter" };
    } else {
      current = { ...current, phase: "exit" };
    }
    if (current !== shown) setShown(current);
  }

  const finishExit = () =>
    setShown(
      wanted === null
        ? { key: null, node: null, phase: "rest" }
        : { key: wanted, node: children, phase: "enter" },
    );

  const exiting = current.phase === "exit";
  useEffect(() => {
    if (!exiting) return;
    const timer = window.setTimeout(finishExit, EXIT_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  });

  if (current.key === null) return null;

  return (
    <div
      key={current.key}
      className={cn(
        current.phase === "enter" && ENTER[variant],
        exiting && EXIT[variant],
        className,
      )}
      onAnimationEnd={(event) => {
        if (exiting && event.target === event.currentTarget) finishExit();
      }}
    >
      {current.node}
    </div>
  );
}
