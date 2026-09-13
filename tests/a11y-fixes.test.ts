// Regressions for the Wave 3 A11Y_AUDIT fixes. The suite has no DOM
// environment (see vitest.config.ts: environment "node"), so this file checks
// pure functions and source text, the same technique tests/design-system.test.ts
// uses for app/globals.css. Real focus/paint behaviour is covered by
// e2e/a11y-regressions.spec.ts, which runs a browser.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buttonVariants } from "@/components/ui/button-variants";

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("A11Y-01: forced colors focus outline (app/globals.css)", () => {
  const css = read("app/globals.css");

  it("restores a visible outline under forced-colors, for every focus-visible control", () => {
    expect(css).toMatch(/@media \(forced-colors: active\)/);
    const block = /@media \(forced-colors: active\)\s*\{([\s\S]*?)\n\}/.exec(
      css,
    )?.[1];
    expect(block, "forced-colors block body").toBeTruthy();
    expect(block).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid/);
  });

  it("gives buttons, badges, pills and fields a real border under forced colors", () => {
    const block = /@media \(forced-colors: active\)\s*\{([\s\S]*?)\n\}/.exec(
      css,
    )?.[1] as string;
    for (const slot of [
      "button",
      "badge",
      "status-pill",
      "input",
      "textarea",
    ]) {
      expect(block, `[data-slot="${slot}"] rule`).toMatch(
        new RegExp(`\\[data-slot="${slot}"\\]`),
      );
    }
    expect(block).toMatch(/border:\s*1px solid ButtonText/);
  });
});

describe("A11Y-02: reflow at 320 CSS px", () => {
  it("buttonVariants never sets whitespace-nowrap, so a long label can wrap", () => {
    const sizes = [
      "default",
      "xs",
      "sm",
      "lg",
      "icon",
      "icon-xs",
      "icon-sm",
      "icon-lg",
    ] as const;
    const variants = [
      "default",
      "secondary",
      "outline",
      "ghost",
      "destructive",
      "link",
    ] as const;
    for (const variant of variants) {
      for (const size of sizes) {
        const classes = buttonVariants({ variant, size });
        expect(classes, `${variant}/${size}`).not.toMatch(
          /\bwhitespace-nowrap\b/,
        );
      }
    }
  });

  it("keeps every size at least 44px tall on the demo path (min-height, not a fixed height)", () => {
    for (const size of ["default", "sm", "lg"] as const) {
      const classes = buttonVariants({ size });
      expect(classes).toMatch(/\bmin-h-(11|12)\b/);
    }
  });

  const css = read("app/globals.css");
  it("lets prose break an unbroken run of characters rather than force real page scroll", () => {
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
  });

  const policySection = read("components/console/policy-section.tsx");
  it("gives the Policy grid an explicit single column below lg, so it cannot blow out its track", () => {
    // Tailwind's grid-cols-1 resolves to repeat(1, minmax(0, 1fr)): a plain
    // `grid` with only `lg:grid-cols-2` has no explicit template below lg, so
    // the implicit column has no minmax(0, ...) floor and a wide child (a
    // long, non-wrapping button label) can force the whole page wider than
    // the viewport. See docs/frontend/A11Y_AUDIT.md A11Y-02.
    expect(policySection).toMatch(/grid grid-cols-1 gap-6 lg:grid-cols-2/);
  });
});

describe("A11Y-05: table column headers carry scope", () => {
  const table = read("components/ui/table.tsx");

  it('TableHead defaults to scope="col" and lets a caller override it', () => {
    expect(table).toMatch(/scope=\{props\.scope \?\? "col"\}/);
    // {...props} must stay after the default (inside the same <th>) so an
    // explicit scope="row" from a caller wins over the default.
    const theadStart = table.indexOf("function TableHead(");
    const theadEnd = table.indexOf("function TableCell(");
    const body = table.slice(theadStart, theadEnd);
    const scopeIndex = body.indexOf('scope={props.scope ?? "col"}');
    expect(scopeIndex).toBeGreaterThan(-1);
    // Search for the JSX spread only after the default, so a mention of
    // "{...props}" inside a comment above it cannot pass this by accident.
    const spreadIndex = body.indexOf("{...props}", scopeIndex);
    expect(spreadIndex).toBeGreaterThan(scopeIndex);
  });
});

describe("A11Y-06: HashText/AddressText tooltip triggers clear a 24px hit area", () => {
  const tooltip = read("components/ui/tooltip.tsx");

  it("TooltipTrigger pads its hit and hover region with an inset pseudo-element", () => {
    expect(tooltip).toMatch(
      /after:absolute after:-inset-1 after:content-\[['"]{2}\]/,
    );
  });

  it("merges the caller's own className (string or function) rather than replacing it", () => {
    const start = tooltip.indexOf("function TooltipTrigger(");
    const end = tooltip.indexOf("function TooltipContent(");
    const body = tooltip.slice(start, end);
    expect(body).toMatch(
      /typeof className === "function" \? className\(state\) : className/,
    );
  });
});

describe("A11Y-04: tooltip collision handling keeps clear of the next control", () => {
  const tooltip = read("components/ui/tooltip.tsx");

  it("TooltipContent sets collisionPadding and shifts instead of flipping to the opposite side", () => {
    expect(tooltip).toMatch(/collisionPadding\s*=\s*8/);
    expect(tooltip).toMatch(
      /collisionAvoidance=\{\{\s*side:\s*"shift",\s*align:\s*"shift"\s*\}\}/,
    );
  });
});

describe("A11Y-03: focus-loop backstop", () => {
  const focusLoop = read("components/ui/focus-loop.ts");
  const dialog = read("components/ui/dialog.tsx");
  const sheet = read("components/ui/sheet.tsx");

  it("is wired into both the Dialog popup (command palette) and the Sheet popup", () => {
    expect(dialog).toMatch(/useFocusLoop\(popupRef\)/);
    expect(sheet).toMatch(/useFocusLoop\(popupRef\)/);
  });

  it("listens for Tab in the capture phase, so it runs before Base UI's own guards", () => {
    expect(focusLoop).toMatch(/addEventListener\("keydown", onKeyDown, true\)/);
  });

  it("only wraps focus at the boundary, never intercepting a Tab that stays inside", () => {
    // A structural check that both branches early-return instead of always
    // calling preventDefault, since a change here would relitigate the whole
    // "does it interfere with the middle of the tab order" question that the
    // e2e 40-press loop test exists to answer.
    expect(focusLoop).toMatch(/if \(!inside \|\| active === first\)/);
    expect(focusLoop).toMatch(/else if \(!inside \|\| active === last\)/);
  });
});
