// The design system's colour contract: app/globals.css and
// components/design/tokens.ts agree, and every published pair clears AA.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COLOR_TOKENS,
  THEMES,
  contrastRatio,
  contrastTable,
  type ThemeName,
} from "@/components/design/tokens";

const css = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);

function block(selector: ":root" | ".dark"): Map<string, string> {
  const pattern =
    selector === ":root"
      ? /^:root \{([\s\S]*?)^\}/m
      : /^\.dark \{([\s\S]*?)^\}/m;
  const body = pattern.exec(css)?.[1] ?? "";
  const vars = new Map<string, string>();
  for (const match of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    vars.set(match[1], match[2].replace(/\s*\/\*.*?\*\/\s*/g, "").trim());
  }
  return vars;
}

function resolve(theme: ThemeName, name: string): string {
  const root = block(":root");
  const dark = block(".dark");
  let value = (theme === "dark" ? dark.get(name) : undefined) ?? root.get(name);
  for (let depth = 0; value?.startsWith("var(") && depth < 5; depth += 1) {
    const ref = /^var\(--([\w-]+)\)$/.exec(value)?.[1] ?? "";
    value = (theme === "dark" ? dark.get(ref) : undefined) ?? root.get(ref);
  }
  if (!value) throw new Error(`--${name} is not declared for ${theme}`);
  return value;
}

describe("design tokens", () => {
  it.each(["light", "dark"] as const)(
    "the %s mirror matches app/globals.css",
    (theme) => {
      for (const token of COLOR_TOKENS) {
        expect(resolve(theme, token), `--${token}`).toBe(THEMES[theme][token]);
      }
    },
  );

  it.each(["light", "dark"] as const)(
    "every %s pair clears WCAG 2.2 AA",
    (theme) => {
      const failures = contrastTable(theme)
        .filter((row) => !row.passes)
        .map((row) => `${row.foreground} on ${row.background} = ${row.ratio}`);
      expect(failures).toEqual([]);
    },
  );

  it("computes known ratios", () => {
    expect(contrastRatio("oklch(1 0 0)", "oklch(0 0 0)")).toBeCloseTo(21, 1);
    expect(contrastRatio("oklch(0.5 0 0)", "oklch(0.5 0 0)")).toBeCloseTo(1, 5);
  });
});
