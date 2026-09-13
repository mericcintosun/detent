"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CONSOLE_SECTIONS } from "./nav";

/**
 * The console's in page navigation, rendered on `/` only. It reports two things:
 * which section is being read (aria-current="location") and how far down the
 * console the reader is, as a gold hairline filling a track. Every link renders
 * and navigates with JavaScript off; the observer only adds the marking.
 */
export function ConsoleSections({
  onNavigate,
  showProgress = true,
}: {
  onNavigate?: () => void;
  showProgress?: boolean;
}) {
  const pathname = usePathname();
  const [marked, setMarked] = useState<string | null>(null);
  const onConsole = pathname === "/";
  const labelId = useId();

  useEffect(() => {
    if (!onConsole) return;
    const nodes = CONSOLE_SECTIONS.map(({ id }) =>
      document.getElementById(id),
    ).filter((node): node is HTMLElement => node !== null);
    if (nodes.length === 0) return;

    // The reading line is the upper fifth of the viewport: the first section in
    // document order inside that band is the one being read, which stays stable
    // while a long section scrolls past.
    const inBand = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        }
        setMarked(
          CONSOLE_SECTIONS.find(({ id }) => inBand.has(id))?.id ?? null,
        );
      },
      { rootMargin: "-12% 0px -68% 0px", threshold: 0 },
    );
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [onConsole]);

  if (!onConsole) return null;

  return (
    <nav aria-labelledby={labelId}>
      <p id={labelId} className="detent-label mb-3 px-3">
        On this page
      </p>
      <div className="relative">
        {showProgress ? <ScrollTrack /> : null}
        <ul className="flex flex-col">
          {CONSOLE_SECTIONS.map(({ id, label }, index) => {
            const active = marked === id;
            return (
              <li key={id}>
                <a
                  href={`#${id}`}
                  aria-current={active ? "location" : undefined}
                  onClick={onNavigate}
                  className={cn(
                    "flex min-h-11 items-center gap-3 px-3 text-body-sm transition-colors duration-(--duration-fast) focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    active
                      ? "font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="amount w-5 font-mono text-caption text-muted-foreground"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

/**
 * Decorative: the position is already announced by aria-current. A passive
 * scroll listener writes the fill once per frame. It used Motion's useScroll,
 * which pulled the scroll timeline and animation engine into the first load
 * bundle of every route just to scale one hairline.
 */
function ScrollTrack() {
  const fill = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = fill.current;
    if (!node) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const root = document.documentElement;
      const range = root.scrollHeight - window.innerHeight;
      const progress =
        range > 0 ? Math.min(1, Math.max(0, window.scrollY / range)) : 0;
      node.style.transform = `scaleY(${progress})`;
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <span
      aria-hidden="true"
      className="absolute inset-y-2 left-0 w-0.5 bg-border"
    >
      <span
        ref={fill}
        className="absolute inset-0 origin-top bg-hairline"
        style={{ transform: "scaleY(0)" }}
      />
    </span>
  );
}
