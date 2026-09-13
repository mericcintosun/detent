/**
 * Motion tokens and shared variants for `motion/react`.
 *
 * Durations and easings mirror the CSS custom properties in app/globals.css
 * (`--duration-*`, `--ease-*`), in seconds because that is what Motion takes.
 *
 * Reduced motion has two layers. MotionProvider sets `reducedMotion="user"`,
 * which makes every transform and layout animation jump for a reader who asked
 * for less motion. Opacity and clip-path are not transforms, so each variant
 * below also reads a `custom` value: pass `{ reduced: true }` and the wipe and
 * the entrances collapse to a short fade. `custom` is never rendered, so the
 * server HTML is the same for every reader.
 *
 * Every `hidden` state is instant. An entrance only ever starts from hidden,
 * and a view entrance hides an off screen element before it plays, so the hide
 * must not animate.
 *
 * docs/frontend/07_MOTION.md lists every element that uses these.
 */

import type {
  TargetAndTransition,
  Transition,
  Variant,
  Variants,
} from "motion/react";

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
  /** Small controls: toggles, pills, the step badge, press feedback. */
  snappy: { type: "spring", stiffness: 520, damping: 38, mass: 0.7 },
  /** Panels and sheets. */
  gentle: { type: "spring", stiffness: 260, damping: 30, mass: 1 },
  /** Layout changes: rows reordering, a list growing. */
  layout: { type: "spring", stiffness: 380, damping: 36, mass: 0.9 },
} as const satisfies Record<string, Transition>;

/** Stagger between siblings, the same 40ms step the CSS stagger uses. */
export const STAGGER_STEP = 0.04;

export const transition = {
  instant: { duration: duration.instant },
  fast: { duration: duration.fast, ease: easing.standard },
  base: { duration: duration.base, ease: easing.standard },
  slow: { duration: duration.slow, ease: easing.emphasized },
  exit: { duration: duration.fast, ease: easing.exit },
  wipe: { duration: duration.wipe, ease: easing.wipe },
} as const satisfies Record<string, Transition>;

/** What a variant reads from the `custom` prop. */
export interface MotionCustom {
  /** The reader asked for less motion: entrances collapse to a short fade. */
  reduced?: boolean;
  /** Seconds before the entrance starts. */
  delay?: number;
}

type Resolver = (custom?: MotionCustom) => TargetAndTransition;

const hidden =
  (target: TargetAndTransition): Resolver =>
  () => ({ ...target, transition: transition.instant });

/** An entrance's visible state, honouring the reduced and delay values. */
const visible =
  (target: TargetAndTransition, timing: Transition): Resolver =>
  (custom) => {
    const delay = custom?.delay ?? 0;
    if (custom?.reduced) {
      return {
        ...target,
        transition: {
          ...transition.base,
          delay,
          clipPath: transition.instant,
          x: transition.instant,
          y: transition.instant,
          scale: transition.instant,
        },
      };
    }
    return { ...target, transition: { ...timing, delay } };
  };

export const fade: Variants = {
  hidden: hidden({ opacity: 0 }),
  visible: visible({ opacity: 1 }, transition.base),
  exit: { opacity: 0, transition: transition.exit },
};

export const rise: Variants = {
  hidden: hidden({ opacity: 0, y: 8 }),
  visible: visible({ opacity: 1, y: 0 }, transition.slow),
  exit: { opacity: 0, y: 4, transition: transition.exit },
};

/**
 * The Detent wipe: a clip-path inset reveal from the left edge. It starts at 35
 * percent opacity rather than zero, the same as the `detent-wipe` keyframe, so
 * the text is present for the largest contentful paint. With reduced motion the
 * clip opens at once and only the opacity moves.
 */
export const wipe: Variants = {
  hidden: hidden({ clipPath: "inset(0 100% 0 0)", opacity: 0.35 }),
  visible: visible(
    { clipPath: "inset(0 0% 0 0)", opacity: 1 },
    transition.wipe,
  ),
  exit: { opacity: 0, transition: transition.exit },
};

/** Overlays: dialogs, menus and popovers grow from 96 percent. */
export const scaleIn: Variants = {
  hidden: hidden({ opacity: 0, scale: 0.96 }),
  visible: visible({ opacity: 1, scale: 1 }, transition.base),
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

/**
 * Press feedback for a primary control: a 3 percent dip on the snappy spring.
 * A transform, so reduced motion drops it.
 */
export const press = {
  whileTap: { scale: 0.97 },
  transition: spring.snappy,
} as const;

/**
 * The refusal: the send card knocks sideways once, like a detent that will not
 * turn. Two labels with the same keyframes, so a second refusal in a row plays
 * again when the label flips. A transform, so reduced motion drops it and the
 * oxide ring and the alert carry the refusal alone.
 */
const knockTarget: Variant = {
  x: [0, -6, 5, -3, 0],
  transition: { duration: duration.slow, ease: easing.standard },
};
export const knock: Variants = {
  rest: { x: 0 },
  knockA: knockTarget,
  knockB: knockTarget,
};

/**
 * The lock: a gold rule draws across the top of the send card when a plan is
 * locked, on the wipe curve, and retracts fast when the lock is dropped. A
 * transform, so reduced motion shows the rule at once.
 */
export const lockRule: Variants = {
  open: { scaleX: 0, transition: transition.exit },
  locked: { scaleX: 1, transition: transition.wipe },
};
