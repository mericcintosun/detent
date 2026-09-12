"use client";

import { m } from "motion/react";
import type * as React from "react";
import {
  STAGGER_STEP,
  staggerContainer,
  variants,
  type VariantName,
} from "@/lib/motion";

type StaggerTag = "div" | "ul" | "ol" | "dl" | "section";
type ItemTag = "div" | "li" | "article";

export interface StaggerProps {
  children: React.ReactNode;
  as?: StaggerTag;
  /** Seconds between children. Defaults to the 40ms Detent step. */
  step?: number;
  trigger?: "view" | "mount";
  className?: string;
}

/** A container whose StaggerItem children enter one after another. */
export function Stagger({
  children,
  as = "div",
  step = STAGGER_STEP,
  trigger = "view",
  className,
}: StaggerProps) {
  const Component = m[as];
  const play =
    trigger === "view"
      ? { whileInView: "visible", viewport: { once: true, amount: 0.15 } }
      : { animate: "visible" };
  return (
    <Component
      className={className}
      variants={staggerContainer(step)}
      initial="hidden"
      {...play}
    >
      {children}
    </Component>
  );
}

export interface StaggerItemProps {
  children: React.ReactNode;
  as?: ItemTag;
  variant?: VariantName;
  className?: string;
}

/** One child of Stagger. It inherits the parent's hidden and visible states. */
export function StaggerItem({
  children,
  as = "div",
  variant = "rise",
  className,
}: StaggerItemProps) {
  const Component = m[as];
  return (
    <Component className={className} variants={variants[variant]}>
      {children}
    </Component>
  );
}
