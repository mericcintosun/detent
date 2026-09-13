"use client";

import * as m from "motion/react-m";
import { createContext, useContext, useMemo, useRef } from "react";
import type * as React from "react";
import {
  STAGGER_STEP,
  spring,
  staggerContainer,
  variants,
  type VariantName,
} from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useViewEntrance } from "./reveal";
import { useClientMount, useMotionCustom } from "./use-client-mount";

type StaggerTag = "div" | "ul" | "ol" | "dl" | "section";
type ItemTag = "div" | "li" | "article";

// Static member reads of motion/react-m, see components/motion/reveal.tsx.
const MOTION_CONTAINER = {
  div: m.div,
  ul: m.ul,
  ol: m.ol,
  dl: m.dl,
  section: m.section,
} as const;
const MOTION_ITEM = { div: m.div, li: m.li, article: m.article } as const;

export interface StaggerProps {
  children: React.ReactNode;
  as?: StaggerTag;
  /** Seconds between children. Defaults to the 40ms Detent step. */
  step?: number;
  trigger?: "view" | "mount";
  className?: string;
}

/** How the container runs its items: CSS keyframes or Motion variants. */
const StaggerMode = createContext<"css" | "motion">("css");

/**
 * A container whose StaggerItem children enter one after another.
 *
 * A server rendered mount stagger is CSS: the detent-stagger rules in
 * app/globals.css give direct children 40ms steps capped at 240ms, and the
 * entrance plays from the HTML. A client mounted stagger (a list that appears
 * after a click) and every view stagger run through Motion variants, where
 * `step` applies and nested items count in document order. An item added to a
 * mounted Motion stagger enters on its own.
 */
export function Stagger({
  children,
  as = "div",
  step = STAGGER_STEP,
  trigger = "view",
  className,
}: StaggerProps) {
  const clientMount = useClientMount();
  if (trigger === "view" || clientMount) {
    return (
      <MotionStagger
        as={as}
        step={step}
        trigger={trigger}
        className={className}
      >
        {children}
      </MotionStagger>
    );
  }
  const Component = as as React.ElementType;
  return (
    <Component className={cn("detent-stagger", className)}>
      <StaggerMode.Provider value="css">{children}</StaggerMode.Provider>
    </Component>
  );
}

function MotionStagger({
  as,
  step,
  trigger,
  className,
  children,
}: Required<Pick<StaggerProps, "as" | "step" | "trigger">> &
  Pick<StaggerProps, "className" | "children">) {
  const Component = MOTION_CONTAINER[as];
  const ref = useRef<HTMLElement>(null);
  const state = useViewEntrance(ref, { amount: 0.15 });
  const container = useMemo(() => staggerContainer(step), [step]);
  const play =
    trigger === "view"
      ? { initial: false as const, animate: state }
      : { initial: "hidden", animate: "visible" };
  return (
    <Component
      ref={ref as React.Ref<never>}
      className={className}
      variants={container}
      {...play}
    >
      <StaggerMode.Provider value="motion">{children}</StaggerMode.Provider>
    </Component>
  );
}

export interface StaggerItemProps {
  children: React.ReactNode;
  as?: ItemTag;
  variant?: VariantName;
  /**
   * Animate this item's position when siblings arrive or leave, on the layout
   * spring. Only a Motion stagger moves; a server rendered list stays put.
   */
  layout?: boolean;
  className?: string;
}

const CSS_ITEM: Record<VariantName, string> = {
  fade: "animate-in fade-in duration-(--duration-base) ease-standard fill-mode-both",
  rise: "animate-in fade-in slide-in-from-bottom-2 duration-(--duration-slow) ease-emphasized fill-mode-both",
  wipe: "animate-wipe",
  scaleIn:
    "animate-in fade-in zoom-in-96 duration-(--duration-base) ease-standard fill-mode-both",
};

/** One child of Stagger. It plays when its container does. */
export function StaggerItem({
  children,
  as = "div",
  variant = "rise",
  layout = false,
  className,
}: StaggerItemProps) {
  const mode = useContext(StaggerMode);
  if (mode === "motion") {
    return (
      <MotionItem
        as={as}
        variant={variant}
        layout={layout}
        className={className}
      >
        {children}
      </MotionItem>
    );
  }
  const Component = as as React.ElementType;
  return (
    <Component className={cn(CSS_ITEM[variant], className)}>
      {children}
    </Component>
  );
}

function MotionItem({
  as,
  variant,
  layout,
  className,
  children,
}: Required<Pick<StaggerItemProps, "as" | "variant" | "layout">> &
  Pick<StaggerItemProps, "className" | "children">) {
  const Component = MOTION_ITEM[as];
  const custom = useMotionCustom();
  return (
    <Component
      className={className}
      variants={variants[variant]}
      custom={custom}
      layout={layout ? "position" : undefined}
      transition={layout ? { layout: spring.layout } : undefined}
    >
      {children}
    </Component>
  );
}
