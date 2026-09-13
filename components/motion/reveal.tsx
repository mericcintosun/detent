"use client";

import { useEffect, useRef } from "react";
import type * as React from "react";
import type { VariantName } from "@/lib/motion";
import { cn } from "@/lib/utils";

type RevealTag = "div" | "section" | "article" | "li" | "header" | "p";

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
   * `fade`: they start at zero opacity. Use `wipe`, which starts at 35 percent.
   */
  trigger?: "view" | "mount";
  once?: boolean;
  className?: string;
  id?: string;
}

/*
 * Every entrance is CSS: the tw-animate-css enter keyframe and the detent-wipe
 * keyframe in app/globals.css. A mount entrance plays from the server HTML
 * without waiting for hydration or for a JavaScript animation engine, and the
 * reduced motion block in app/globals.css collapses all of them to a frame.
 * The class strings are written out in full so Tailwind can find them.
 */
const ON_MOUNT: Record<VariantName, string> = {
  fade: "animate-in fade-in duration-(--duration-base) ease-standard fill-mode-both",
  rise: "animate-in fade-in slide-in-from-bottom-2 duration-(--duration-slow) ease-emphasized fill-mode-both",
  wipe: "detent-enter",
  scaleIn:
    "animate-in fade-in zoom-in-96 duration-(--duration-base) ease-standard fill-mode-both",
};

const IN_VIEW: Record<VariantName, string> = {
  fade: "data-[reveal=waiting]:opacity-0 data-[reveal=playing]:animate-in fade-in duration-(--duration-base) ease-standard fill-mode-both",
  rise: "data-[reveal=waiting]:opacity-0 data-[reveal=playing]:animate-in fade-in slide-in-from-bottom-2 duration-(--duration-slow) ease-emphasized fill-mode-both",
  wipe: "data-[reveal=waiting]:opacity-0 data-[reveal=playing]:animate-wipe",
  scaleIn:
    "data-[reveal=waiting]:opacity-0 data-[reveal=playing]:animate-in fade-in zoom-in-96 duration-(--duration-base) ease-standard fill-mode-both",
};

/**
 * Moves the element's data-reveal attribute from waiting to playing when a
 * share of it scrolls into view. An element already on screen when the page
 * hydrates keeps its server rendered state, so nothing visible blinks out. React
 * never renders data-reveal, so a re-render cannot reset it.
 */
export function useViewEntrance(
  ref: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  { once = true, amount = 0.2 }: { once?: boolean; amount?: number } = {},
) {
  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node || typeof IntersectionObserver === "undefined") {
      return;
    }
    const rect = node.getBoundingClientRect();
    const onScreen = rect.top < window.innerHeight && rect.bottom > 0;
    if (onScreen && once) return;
    if (!onScreen) node.dataset.reveal = "waiting";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          node.dataset.reveal = "playing";
          if (once) observer.disconnect();
        } else if (!once && node.dataset.reveal === "playing") {
          node.dataset.reveal = "waiting";
        }
      },
      { threshold: amount },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, enabled, once, amount]);
}

/** Plays one entrance variant on an element, on mount or when scrolled into view. */
export function Reveal({
  children,
  variant = "rise",
  as = "div",
  delay = 0,
  trigger = "view",
  once = true,
  className,
  id,
}: RevealProps) {
  const Component = as as React.ElementType;
  const ref = useRef<HTMLElement>(null);
  useViewEntrance(ref, trigger === "view", { once });

  return (
    <Component
      ref={ref}
      id={id}
      className={cn(
        trigger === "mount" ? ON_MOUNT[variant] : IN_VIEW[variant],
        className,
      )}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </Component>
  );
}
