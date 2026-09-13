"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import type * as React from "react";

const loadFeatures = () => import("./features").then((mod) => mod.default);

/**
 * One provider for every Motion component in the app.
 *
 * `reducedMotion="user"` follows the operating system setting: transforms and
 * layout animation are dropped and only opacity still transitions. `LazyMotion`
 * with `strict` means only the tiny `m.*` components ship up front; importing
 * the full `motion.*` components throws in development instead of silently
 * doubling the bundle.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadFeatures} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}
