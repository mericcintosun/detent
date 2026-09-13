"use client";

import { useReducedMotionConfig } from "motion/react";
import { useState, useSyncExternalStore } from "react";
import type { MotionCustom } from "@/lib/motion";

const subscribe = () => () => {};

/**
 * True when this component mounted on the client after the page hydrated (a
 * banner that appears after a click, a client navigation), false when it was
 * server rendered and is hydrating. Hydration always reads the server
 * snapshot, so the answer cannot differ between the server HTML and the first
 * client render, whatever Suspense boundaries sit above. It is fixed for the
 * component's lifetime.
 *
 * Server rendered entrances play in CSS from the HTML; client mounted ones
 * play through Motion.
 */
export function useClientMount(): boolean {
  const hydrating = useSyncExternalStore(
    subscribe,
    () => false,
    () => true,
  );
  const [clientMount] = useState(!hydrating);
  return clientMount;
}

/** The `custom` value every entrance variant reads. Never rendered. */
export function useMotionCustom(delay = 0): MotionCustom {
  const reduced = useReducedMotionConfig() ?? false;
  return { reduced, delay };
}
