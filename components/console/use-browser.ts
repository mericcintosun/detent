"use client";

// Two facts only the browser knows: whether it is online, and how old the
// register snapshot on screen has become. Both are read through
// useSyncExternalStore with a server snapshot that matches the server render
// (online, not stale), so hydration never disagrees and the real value lands in
// the render right after it.

import { useSyncExternalStore } from "react";

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** False only while the browser reports no network. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/** How often the age of the snapshot is looked at again. */
const CLOCK_TICK_MS = 5_000;

function subscribeClock(onChange: () => void) {
  const timer = window.setInterval(onChange, CLOCK_TICK_MS);
  return () => window.clearInterval(timer);
}

/**
 * Whole minutes since `readAt` once it is older than `staleAfterMs`, or null
 * while it is still fresh. Minutes rather than milliseconds, so the snapshot
 * value only changes when the sentence on screen would.
 */
export function useStaleMinutes(
  readAt: string,
  staleAfterMs: number,
): number | null {
  const readMs = Date.parse(readAt);
  return useSyncExternalStore(
    subscribeClock,
    () => {
      if (!Number.isFinite(readMs)) return null;
      const age = Date.now() - readMs;
      return age > staleAfterMs ? Math.floor(age / 60_000) : null;
    },
    () => null,
  );
}

/** "less than a minute ago", "1 minute ago", "12 minutes ago". */
export function describeAge(minutes: number): string {
  if (minutes < 1) return "less than a minute ago";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 120) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hours ago`;
}
