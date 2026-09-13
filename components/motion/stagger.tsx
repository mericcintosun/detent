"use client";

import { useEffect, useRef } from "react";
import type * as React from "react";
import { STAGGER_STEP, type VariantName } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useViewEntrance } from "./reveal";

type StaggerTag = "div" | "ul" | "ol" | "dl" | "section";
type ItemTag = "div" | "li" | "article";

export interface StaggerProps {
  children: React.ReactNode;
  as?: StaggerTag;
  /** Seconds between children in view. Defaults to the 40ms Detent step. */
  step?: number;
  trigger?: "view" | "mount";
  className?: string;
}

/**
 * A container whose StaggerItem children enter one after another, in CSS.
 *
 * On mount the delays come from the detent-stagger rules in app/globals.css
 * (40ms steps on direct children, capped at 240ms), so the entrance plays from
 * the server HTML. In view, the container numbers its items in document order,
 * nested or not, before they play; that is where a custom `step` applies.
 */
export function Stagger({
  children,
  as = "div",
  step = STAGGER_STEP,
  trigger = "view",
  className,
}: StaggerProps) {
  const Component = as as React.ElementType;
  const ref = useRef<HTMLElement>(null);
  const inView = trigger === "view";
  useViewEntrance(ref, inView, { amount: 0.15 });

  useEffect(() => {
    const node = ref.current;
    if (!inView || !node) return;
    node
      .querySelectorAll<HTMLElement>("[data-stagger-item]")
      .forEach((item, index) => {
        item.style.animationDelay = `${index * step}s`;
      });
  }, [inView, step, children]);

  return (
    <Component
      ref={ref}
      data-stagger={trigger}
      className={cn("group/stagger", !inView && "detent-stagger", className)}
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

// Mount: the animation applies at once. View: the item waits invisible while
// the container is off screen and plays when the container does.
const ITEM: Record<VariantName, string> = {
  fade: "group-data-[stagger=mount]/stagger:animate-in group-data-[reveal=waiting]/stagger:opacity-0 group-data-[reveal=playing]/stagger:animate-in fade-in duration-(--duration-base) ease-standard fill-mode-both",
  rise: "group-data-[stagger=mount]/stagger:animate-in group-data-[reveal=waiting]/stagger:opacity-0 group-data-[reveal=playing]/stagger:animate-in fade-in slide-in-from-bottom-2 duration-(--duration-slow) ease-emphasized fill-mode-both",
  wipe: "group-data-[stagger=mount]/stagger:animate-wipe group-data-[reveal=waiting]/stagger:opacity-0 group-data-[reveal=playing]/stagger:animate-wipe",
  scaleIn:
    "group-data-[stagger=mount]/stagger:animate-in group-data-[reveal=waiting]/stagger:opacity-0 group-data-[reveal=playing]/stagger:animate-in fade-in zoom-in-96 duration-(--duration-base) ease-standard fill-mode-both",
};

/** One child of Stagger. It plays when its container does. */
export function StaggerItem({
  children,
  as = "div",
  variant = "rise",
  className,
}: StaggerItemProps) {
  const Component = as as React.ElementType;
  return (
    <Component data-stagger-item="" className={cn(ITEM[variant], className)}>
      {children}
    </Component>
  );
}
