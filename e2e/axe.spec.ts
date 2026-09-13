import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * The automated half of the accessibility gate: every public route, in both
 * themes, with no serious or critical axe violation once the page has settled.
 * Reduced motion is on so the entrance wipes are not caught half drawn, which
 * produced transient contrast findings in the Phase 0 audit.
 */
const routes = [
  "/",
  "/how-it-works",
  "/security",
  "/faucet",
  "/privacy",
  "/terms",
  `/record/0x${"ab".repeat(32)}`,
];

/** Chrome logs the 404 document itself as a console error; same as routes.spec.ts. */
const NOT_FOUND_DOCUMENT =
  /^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/;

async function blockingViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`);
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`axe, ${colorScheme} theme`, () => {
    test.use({ colorScheme, reducedMotion: "reduce" });

    for (const route of routes) {
      test(`${route} has no serious or critical violations`, async ({
        page,
      }) => {
        await page.goto(route, { waitUntil: "networkidle" });
        expect(await blockingViolations(page)).toEqual([]);
      });
    }

    test.describe("the not found page", () => {
      test.use({ allowedConsoleErrors: [NOT_FOUND_DOCUMENT] });

      test("/no-such-page has no serious or critical violations", async ({
        page,
      }) => {
        await page.goto("/no-such-page", { waitUntil: "networkidle" });
        expect(await blockingViolations(page)).toEqual([]);
      });
    });
  });
}
