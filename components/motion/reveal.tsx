"use client";

import { m } from "motion/react";
import type * as React from "react";
import { variants, type VariantName } from "@/lib/motion";

type RevealTag = "div" | "section" | "article" | "li" | "header" | "p";

export interface RevealProps {
  children: React.ReactNode;
  /** fade, rise, wipe or scaleIn from lib/motion.ts. */
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
  const Component = m[as];
  const play =
    trigger === "view"
      ? { whileInView: "visible", viewport: { once, amount: 0.2 } }
      : { animate: "visible" };

  return (
    <Component
      id={id}
      className={className}
      variants={variants[variant]}
      initial="hidden"
      transition={delay ? { delay } : undefined}
      {...play}
    >
      {children}
    </Component>
  );
}
