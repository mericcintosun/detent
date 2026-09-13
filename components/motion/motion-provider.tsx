"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import type * as React from "react";

const loadFeatures = () => import("./features").then((mod) => mod.default);

/**
 * One provider for every Motion component in the app, in the root layout.
 *
 * `LazyMotion` with `strict`: only the small `m.*` renderer ships in the first
 * load, and the animation, gesture and layout features arrive from a dynamic
 * import that LazyMotion starts in an effect, after hydration. Importing a full
 * `motion.*` component throws in development instead of silently adding the
 * engine back. Until the features land an `m` element renders exactly what the
 * server sent, which is why no primitive in this folder hides content on the
 * server.
 *
 * `reducedMotion="user"` follows the operating system setting: transforms and
 * layout animation jump. The variants in lib/motion.ts also read `custom` so
 * the wipe and the entrances collapse to a fade.
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
