"use client";

import * as React from "react";

/**
 * A11Y-03: Base UI's own focus-guard sentinels (@base-ui/react/dialog, built
 * on floating-ui-react's FloatingFocusManager) bounce Tab back inside a modal
 * correctly the first time, but not reliably on a second full loop: the
 * guard's re-focus is scheduled with `enqueueFocus` (a rAF-deferred focus
 * call), and docs/frontend/A11Y_AUDIT.md (A11Y-03) traced a real, reproducible
 * case where that scheduled focus loses the race and focus lands on <body>,
 * after which the next Tab reaches the page behind the still-open, still
 * scrimmed dialog or sheet.
 *
 * This hook is a deterministic backstop, not a replacement for Base UI's own
 * guards: on every Tab press while the container is mounted, it looks at the
 * real tabbable elements inside the container and wraps focus itself when the
 * press would leave the first or last one (or when focus has already escaped
 * to somewhere outside the container, e.g. <body>). Because it runs in the
 * capture phase, it decides the outcome before Base UI's guards ever see the
 * event, so the trap holds regardless of the guard's own timing. It never
 * interferes with a Tab press that stays inside the middle of the tab order.
 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]",
].join(",");

function isVisible(element: HTMLElement): boolean {
  return (
    element.offsetWidth > 0 ||
    element.offsetHeight > 0 ||
    element.getClientRects().length > 0
  );
}

function getTabbable(container: HTMLElement): HTMLElement[] {
  const nodes = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  );
  return nodes.filter((element) => {
    if (element.hasAttribute("data-base-ui-focus-guard")) return false;
    if (element.getAttribute("aria-hidden") === "true") return false;
    const tabIndexAttr = element.getAttribute("tabindex");
    if (tabIndexAttr !== null && Number(tabIndexAttr) < 0) return false;
    return isVisible(element);
  });
}

/**
 * Attaches the backstop for as long as the calling component stays mounted
 * (a Dialog/Sheet Popup is only mounted while it is open or animating shut),
 * scoped to the element `containerRef` points at.
 */
export function useFocusLoop(
  containerRef: React.RefObject<HTMLElement | null>,
): void {
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const container = containerRef.current;
      if (!container || !container.isConnected) return;
      const focusable = getTabbable(container);
      if (focusable.length === 0) return;
      const active = document.activeElement as HTMLElement | null;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const inside = active ? container.contains(active) : false;

      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    // Capture phase: this must decide the outcome before Base UI's own
    // focus-guard onFocus handlers run, since those are what the guard's
    // own (occasionally losing) bounce-back race depends on.
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [containerRef]);
}
