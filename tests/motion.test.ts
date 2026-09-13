// The motion contract in docs/frontend/07_MOTION.md: the tokens in lib/motion.ts
// mirror app/globals.css, Motion loads after first paint through LazyMotion, and
// the pieces the perf pass moved off the first load stay off it.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  duration,
  easing,
  fade,
  knock,
  lockRule,
  rise,
  scaleIn,
  wipe,
} from "@/lib/motion";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

function sources(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(root, path)).isDirectory()) return sources(path);
    return /\.(tsx?|mts)$/.test(name) ? [path] : [];
  });
}

type Resolved = { transition?: Record<string, unknown> } & Record<
  string,
  unknown
>;
const resolve = (variant: unknown, custom?: object): Resolved =>
  (typeof variant === "function" ? variant(custom) : variant) as Resolved;

describe("motion tokens", () => {
  const css = read("app/globals.css");

  it("mirror the easing custom properties", () => {
    const bezier = (values: readonly number[]) =>
      `cubic-bezier(${values.join(", ")})`;
    expect(css).toContain(`--ease-standard: ${bezier(easing.standard)}`);
    expect(css).toContain(`--ease-emphasized: ${bezier(easing.emphasized)}`);
    expect(css).toContain(`--ease-exit: ${bezier(easing.exit)}`);
    expect(css).toContain(`--ease-wipe: ${bezier(easing.wipe)}`);
  });

  it("keep the wipe keyframe on the wipe duration", () => {
    expect(css).toContain(
      `--animate-wipe: detent-wipe ${duration.wipe * 1000}ms ${`cubic-bezier(${easing.wipe.join(", ")})`} both`,
    );
  });
});

describe("entrance variants", () => {
  const entrances = { fade, rise, wipe, scaleIn };

  it.each(Object.entries(entrances))("%s hides instantly", (_, variant) => {
    expect(resolve(variant.hidden).transition).toEqual({ duration: 0 });
  });

  it.each(Object.entries(entrances))(
    "%s collapses to a fade with reduced motion",
    (_, variant) => {
      const reduced = resolve(variant.visible, { reduced: true });
      expect(reduced.opacity).toBe(1);
      expect(reduced.transition?.duration).toBe(duration.base);
      for (const key of ["x", "y", "scale", "clipPath"]) {
        expect(reduced.transition?.[key]).toEqual({ duration: 0 });
      }
    },
  );

  it("renders the same visible values with and without reduced motion", () => {
    for (const variant of Object.values(entrances)) {
      const { transition: _full, ...full } = resolve(variant.visible);
      const { transition: _reduced, ...reduced } = resolve(variant.visible, {
        reduced: true,
      });
      expect(reduced).toEqual(full);
    }
  });

  it("carries the delay into the visible transition", () => {
    expect(resolve(rise.visible, { delay: 0.2 }).transition?.delay).toBe(0.2);
  });

  it("starts the wipe at 35 percent opacity, like the keyframe", () => {
    expect(resolve(wipe.hidden).opacity).toBe(0.35);
  });

  it("knocks with two identical labels and draws the lock rule", () => {
    expect(knock.knockA).toEqual(knock.knockB);
    // A move to the right would widen the document at 320 px (A11Y-02).
    const { x } = knock.knockA as { x: number[] };
    expect(Math.max(...x)).toBe(0);
    expect(lockRule.locked).toMatchObject({ scaleX: 1 });
    expect(lockRule.open).toMatchObject({ scaleX: 0 });
  });
});

describe("Motion loads after first paint", () => {
  const provider = read("components/motion/motion-provider.tsx");

  it("uses LazyMotion strict with a dynamic feature import and user reduced motion", () => {
    expect(provider).toMatch(/<LazyMotion features=\{loadFeatures\} strict>/);
    expect(provider).toContain('import("./features")');
    expect(provider).toContain('reducedMotion="user"');
    expect(read("app/layout.tsx")).toContain("<MotionProvider>");
  });

  it("never imports the full motion component or the engine statically", () => {
    const offenders = [
      ...sources("app"),
      ...sources("components"),
      ...sources("lib"),
    ].filter((path) => {
      const text = read(path);
      if (!text.includes("motion/react")) return false;
      const staticImport = /import\s+\{([^}]*)\}\s+from\s+"motion\/react"/.exec(
        text,
      );
      const names = staticImport?.[1] ?? "";
      const allowedModule = [
        "components/motion/features.ts",
        "components/motion/animate-number.ts",
      ].includes(path);
      return (
        /<motion\.|\bmotion\.(div|span|button|li|ul|ol|section|p)\b/.test(
          text,
        ) ||
        (!allowedModule &&
          /\b(animate|domMax|domAnimation|useSpring|useAnimate|useScroll)\b/.test(
            names,
          ))
      );
    });
    expect(offenders).toEqual([]);
  });

  it("loads the amount animation on demand", () => {
    expect(read("components/motion/number-ticker.tsx")).toContain(
      'import("./animate-number")',
    );
  });
});

describe("first load budget moves (docs/frontend/PERF.md)", () => {
  it("A: the console raises toasts through the manager and loads the region late", () => {
    expect(read("components/console/use-console.ts")).toContain(
      '"@/components/ui/toast-manager"',
    );
    const consoleFile = read("components/operations-console.tsx");
    expect(consoleFile).toContain('import("@/components/ui/toast")');
    expect(consoleFile).toContain("ssr: false");
    expect(read("components/ui/toast-manager.ts")).not.toContain(
      'components/ui/toast"',
    );
  });

  it("B: HashText loads the whole tooltip after hydration", () => {
    const hash = read("components/design/hash-text.tsx");
    expect(hash).toContain('import("./hash-tooltip")');
    expect(hash).not.toMatch(/from "@\/components\/ui\/tooltip"/);
  });

  it("C: the console hero prefetches the explanation", () => {
    expect(read("components/console/console-hero.tsx")).not.toContain(
      "prefetch={false}",
    );
  });
});
