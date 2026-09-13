"use client";

import { useInView } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useRef, useState } from "react";
import type * as React from "react";
import { variants, type VariantName } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useClientMount, useMotionCustom } from "./use-client-mount";

type RevealTag = "div" | "section" | "article" | "li" | "header" | "p";

/*
 * `m` comes from motion/react-m, never motion/react: the latter builds its `m`
 * export from a namespace import of the whole library, which puts the full
 * animation engine in the first load. Static member reads keep only these tags.
 */
const MOTION_TAG = {
  div: m.div,
  section: m.section,
  article: m.article,
  li: m.li,
  header: m.header,
  p: m.p,
} as const;

export interface RevealProps {
  children: React.ReactNode;
  /** fade, rise, wipe or scaleIn, the same names as lib/motion.ts. */
  variant?: VariantName;
  as?: RevealTag;
  /** Seconds before the entrance starts. */
  delay?: number;
  /**
   * `view` waits until a fifth of the element is on screen, `mount` plays on
   * load. Never wrap the largest element on the first screen with `rise` or
   * `fade` on a client navigation: they start at zero opacity. Use `wipe`,
   * which starts at 35 percent.
   */
  trigger?: "view" | "mount";
  once?: boolean;
  className?: string;
  id?: string;
}

/*
 * A server rendered mount entrance is CSS: the tw-animate-css enter keyframe and
 * the detent-wipe keyframe in app/globals.css. It plays from the HTML without
 * waiting for hydration or for Motion, and the reduced motion block in
 * app/globals.css collapses it to a frame. The class strings are written out in
 * full so Tailwind can find them.
 */
const ON_MOUNT: Record<VariantName, string> = {
  fade: "animate-in fade-in duration-(--duration-base) ease-standard fill-mode-both",
  rise: "animate-in fade-in slide-in-from-bottom-2 duration-(--duration-slow) ease-emphasized fill-mode-both",
  wipe: "detent-enter",
  scaleIn:
    "animate-in fade-in zoom-in-96 duration-(--duration-base) ease-standard fill-mode-both",
};

type Phase = "rest" | "waiting";

/**
 * The view entrance state. Every element renders visible on the server and on
 * the first client render. After mount, an element that is off screen is
 * hidden at once (the hidden variants are instant) and plays when a share of it
 * scrolls into view; an element already on screen stays as the server drew it.
 * Before Motion's features load, nothing is hidden at all.
 */
export function useViewEntrance(
  ref: React.RefObject<HTMLElement | null>,
  { once = true, amount = 0.2 }: { once?: boolean; amount?: number } = {},
): "hidden" | "visible" {
  const [phase, setPhase] = useState<Phase>("rest");
  const inView = useInView(ref, { once, amount });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const onScreen = rect.top < window.innerHeight && rect.bottom > 0;
    if (!onScreen) setPhase("waiting");
  }, [ref]);

  return phase === "waiting" && !inView ? "hidden" : "visible";
}

/** Plays one entrance variant on an element, on mount or when scrolled into view. */
export function Reveal({
  variant = "rise",
  as = "div",
  delay = 0,
  trigger = "view",
  once = true,
  className,
  id,
  children,
}: RevealProps) {
  const clientMount = useClientMount();
  if (trigger === "view") {
    return (
      <ViewReveal
        variant={variant}
        as={as}
        delay={delay}
        once={once}
        className={className}
        id={id}
      >
        {children}
      </ViewReveal>
    );
  }
  if (clientMount) {
    return (
      <MountReveal
        variant={variant}
        as={as}
        delay={delay}
        className={className}
        id={id}
      >
        {children}
      </MountReveal>
    );
  }
  const Component = as as React.ElementType;
  return (
    <Component
      id={id}
      className={cn(ON_MOUNT[variant], className)}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </Component>
  );
}

type InnerProps = Required<Pick<RevealProps, "variant" | "as" | "delay">> &
  Pick<RevealProps, "className" | "id" | "children">;

/** A client mounted entrance, through Motion. */
function MountReveal({
  variant,
  as,
  delay,
  className,
  id,
  children,
}: InnerProps) {
  const Component = MOTION_TAG[as];
  const custom = useMotionCustom(delay);
  return (
    <Component
      id={id}
      className={className}
      variants={variants[variant]}
      custom={custom}
      initial="hidden"
      animate="visible"
    >
      {children}
    </Component>
  );
}

function ViewReveal({
  variant,
  as,
  delay,
  once,
  className,
  id,
  children,
}: InnerProps & { once: boolean }) {
  const Component = MOTION_TAG[as];
  const ref = useRef<HTMLElement>(null);
  const state = useViewEntrance(ref, { once });
  const custom = useMotionCustom(delay);
  return (
    <Component
      // m[as] is a union of element components; the ref is an HTMLElement.
      ref={ref as React.Ref<never>}
      id={id}
      className={className}
      variants={variants[variant]}
      custom={custom}
      initial={false}
      animate={state}
    >
      {children}
    </Component>
  );
}
