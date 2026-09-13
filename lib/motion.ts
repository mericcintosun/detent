/**
 * Motion tokens and shared variants for `motion/react`.
 *
 * Durations and easings mirror the CSS custom properties in app/globals.css
 * (`--duration-*`, `--ease-*`), in seconds because that is what Motion takes.
 * Every variant set here has a reduced motion reading: MotionProvider sets
 * `reducedMotion="user"`, which drops transform and layout animation for a
 * reader who asked for less motion, and the variants below only ever pair a
 * transform with opacity, so what remains is a plain fade or nothing.
 */

import type { Transition, Variants } from "motion/react";

export const duration = {
  instant: 0,
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
  wipe: 0.6,
} as const;

export const easing = {
  standard: [0.2, 0, 0, 1],
  emphasized: [0.3, 0, 0, 1],
  exit: [0.4, 0, 1, 1],
  /** The Detent M4 wipe curve. */
  wipe: [0.65, 0, 0.35, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export const spring = {
  /** Small controls: toggles, pills, the theme switch indicator. */
  snappy: { type: "spring", stiffness: 520, damping: 38, mass: 0.7 },
  /** Panels and sheets. */
  gentle: { type: "spring", stiffness: 260, damping: 30, mass: 1 },
  /** Layout changes: rows reordering, a list growing. */
  layout: { type: "spring", stiffness: 380, damping: 36, mass: 0.9 },
} as const satisfies Record<string, Transition>;

/** Stagger between siblings, the same 40ms step the CSS stagger uses. */
export const STAGGER_STEP = 0.04;

export const transition = {
  fast: { duration: duration.fast, ease: easing.standard },
  base: { duration: duration.base, ease: easing.standard },
  slow: { duration: duration.slow, ease: easing.emphasized },
  exit: { duration: duration.fast, ease: easing.exit },
  wipe: { duration: duration.wipe, ease: easing.wipe },
} as const satisfies Record<string, Transition>;

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transition.base },
  exit: { opacity: 0, transition: transition.exit },
};

export const rise: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: transition.slow },
  exit: { opacity: 0, y: 4, transition: transition.exit },
};

/**
 * The Detent wipe: a clip-path inset reveal from the left edge. It starts at 35
 * percent opacity rather than zero, the same as the `detent-wipe` keyframe, so
 * the text is present for the largest contentful paint.
 */
export const wipe: Variants = {
  hidden: { clipPath: "inset(0 100% 0 0)", opacity: 0.35 },
  visible: {
    clipPath: "inset(0 0% 0 0)",
    opacity: 1,
    transition: transition.wipe,
  },
  exit: { opacity: 0, transition: transition.exit },
};

/** Overlays: dialogs, menus and popovers grow from 96 percent. */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: transition.base },
  exit: { opacity: 0, scale: 0.98, transition: transition.exit },
};

export function staggerContainer(
  step: number = STAGGER_STEP,
  delayChildren = 0,
): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: step, delayChildren } },
    exit: { transition: { staggerChildren: step / 2, staggerDirection: -1 } },
  };
}

export const variants = { fade, rise, wipe, scaleIn } as const;
export type VariantName = keyof typeof variants;
