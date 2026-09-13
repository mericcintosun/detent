"use client";

import { useReducedMotionConfig } from "motion/react";
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
 * With reduced motion the value jumps.
 *
 * The count runs on Motion's `animate`, imported on the first change from
 * ./animate-number, so the engine is never part of the page's first load.
 */
export function NumberTicker({
  value,
  decimals = 0,
  locale = "en-US",
  className,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  const reduced = useReducedMotionConfig() ?? false;

  useEffect(() => {
    const node = ref.current;
    const from = previous.current;
    previous.current = value;
    if (!node || from === value) return;
    const settle = () => {
      node.textContent = format(value, decimals, locale);
    };
    if (reduced) {
      settle();
      return;
    }
    let cancelled = false;
    let stop: (() => void) | undefined;
    import("./animate-number")
      .then(({ animate }) => {
        if (cancelled) return;
        const controls = animate(from, value, {
          duration: duration.slow,
          ease: easing.standard,
          onUpdate: (latest) => {
            node.textContent = format(latest, decimals, locale);
          },
          onComplete: settle,
        });
        stop = () => controls.stop();
      })
      .catch(settle);
    return () => {
      cancelled = true;
      stop?.();
      settle();
    };
  }, [value, decimals, locale, reduced]);

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
