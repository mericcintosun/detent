"use client";

import { useEffect, useRef } from "react";
import { duration, easing } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface NumberTickerProps {
  value: number;
  /** Fraction digits shown. Amounts in Detent carry up to six. */
  decimals?: number;
  locale?: string;
  className?: string;
}

/** A CSS cubic-bezier(x1, y1, x2, y2) timing function, solved for y at time x. */
function cubicBezier([x1, y1, x2, y2]: readonly [
  number,
  number,
  number,
  number,
]) {
  const curve = (a: number, b: number, t: number) =>
    3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t ** 2 + t ** 3;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 20; i += 1) {
      const current = curve(x1, x2, t);
      if (Math.abs(current - x) < 1e-4) break;
      if (current < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return curve(y1, y2, t);
  };
}

const ease = cubicBezier(easing.standard);

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function format(value: number, decimals: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * An amount that counts to its new value when it changes, so a reader sees the
 * total draw move when a row is held or released. It renders the final value on
 * the server and on the first client render, and only animates on a change, so
 * it never affects hydration or the largest contentful paint. Screen readers
 * get the final value once, from a visually hidden copy, and never the frames.
 * With reduced motion the value jumps. The count runs on requestAnimationFrame
 * rather than Motion's animate(), which would put the animation engine in the
 * first load bundle of the console.
 */
export function NumberTicker({
  value,
  decimals = 0,
  locale = "en-US",
  className,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);

  useEffect(() => {
    const node = ref.current;
    const from = previous.current;
    previous.current = value;
    if (!node || from === value) return;
    if (prefersReducedMotion()) {
      node.textContent = format(value, decimals, locale);
      return;
    }
    const total = duration.slow * 1000;
    let start: number | null = null;
    let frame = window.requestAnimationFrame(function step(now) {
      start ??= now;
      const progress = Math.min(1, (now - start) / total);
      node.textContent = format(
        from + (value - from) * ease(progress),
        decimals,
        locale,
      );
      if (progress < 1) frame = window.requestAnimationFrame(step);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      node.textContent = format(value, decimals, locale);
    };
  }, [value, decimals, locale]);

  const final = format(value, decimals, locale);
  return (
    <span className={cn("amount", className)}>
      <span ref={ref} aria-hidden="true">
        {final}
      </span>
      <span className="sr-only">{final}</span>
    </span>
  );
}
