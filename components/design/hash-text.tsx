"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from "react";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";
import { truncateMiddle } from "./format";
import type { HashTooltipProps } from "./hash-tooltip";

export interface HashTextProps {
  value: string;
  /** Names the value for assistive technology: "transaction hash", "plan hash". */
  label?: string;
  lead?: number;
  tail?: number;
  /** Show a copy control after the text. */
  copyable?: boolean;
  className?: string;
}

/*
 * The tooltip loads after hydration (docs/frontend/PERF.md, proposal B). One
 * promise for every HashText on the page, and the component kept at module
 * level once it resolves, so a HashText mounted later renders it at once.
 */
let HashTooltip: ComponentType<HashTooltipProps> | null = null;
let loading: Promise<void> | null = null;
function loadTooltip(): Promise<void> {
  loading ??= import("./hash-tooltip").then((mod) => {
    HashTooltip = mod.default;
  });
  return loading;
}

/** The value whose trigger held focus when the plain span was swapped out. */
let focusHandOff: string | null = null;

const subscribe = () => () => {};

/**
 * A long hex value shown truncated in the mono face. The full value is in a
 * tooltip on hover and keyboard focus, and in the accessible name, so nothing
 * is hidden from a screen reader. Truncation never changes the stored value.
 *
 * The server and hydration render the trigger as a plain focusable span with
 * the same classes and accessible name. After hydration the Base UI tooltip
 * loads and wraps it; if a keyboard reader was on the span at that moment,
 * focus moves to the new trigger.
 */
export function HashText({
  value,
  label = "hash",
  lead = 10,
  tail = 6,
  copyable = true,
  className,
}: HashTextProps) {
  const short = truncateMiddle(value, lead, tail);
  const hydrating = useSyncExternalStore(
    subscribe,
    () => false,
    () => true,
  );
  const [Loaded, setLoaded] = useState(() => (hydrating ? null : HashTooltip));

  useEffect(() => {
    if (Loaded) return;
    let live = true;
    void loadTooltip().then(() => {
      if (live) setLoaded(() => HashTooltip);
    });
    return () => {
      live = false;
    };
  }, [Loaded]);

  // The last three classes are the 24px hit area TooltipTrigger adds for
  // WCAG 2.5.8 (A11Y-06). The plain span carries them too, so the target is
  // the same size before and after the tooltip loads.
  const triggerClass =
    "amount min-w-0 truncate font-mono text-caption text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring relative after:absolute after:-inset-1 after:content-['']";
  const content = (
    <>
      <span aria-hidden="true">{short}</span>
      <span className="sr-only">
        {label} {value}
      </span>
    </>
  );

  return (
    <span
      data-slot="hash-text"
      className={cn(
        "inline-flex max-w-full items-center gap-1 align-middle",
        className,
      )}
    >
      {Loaded ? (
        <Loaded
          value={value}
          trigger={
            <span
              tabIndex={0}
              className={triggerClass}
              ref={(node) => {
                if (node && focusHandOff === value) {
                  focusHandOff = null;
                  node.focus();
                }
              }}
            />
          }
        >
          {content}
        </Loaded>
      ) : (
        <span
          tabIndex={0}
          className={triggerClass}
          ref={(node) => () => {
            if (node && document.activeElement === node) focusHandOff = value;
          }}
        >
          {content}
        </span>
      )}
      {copyable ? <CopyButton value={value} label={label} /> : null}
    </span>
  );
}
