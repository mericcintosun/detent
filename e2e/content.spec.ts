import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * The five static content routes this agent owns. Order matches the sitemap.
 */
const ROUTES = [
  "/how-it-works",
  "/security",
  "/faucet",
  "/privacy",
  "/terms",
] as const;

/**
 * A stand-in for an automated axe pass. No axe-core package is a dependency in
 * this repository (see package.json), so this checks the properties axe would
 * flag as serious or critical that a plain DOM walk can verify without it:
 * exactly one h1, no skipped heading level, every image with an alt
 * attribute, every link and button with an accessible name, no duplicate id,
 * and a lang attribute on the root. Anything this cannot see (colour
 * contrast, ARIA role misuse) is covered instead by the tokens.ts contrast
 * table in 04_DESIGN_SYSTEM.md, which is asserted in tests/design-system.test.ts.
 */
async function assertBasicAccessibility(page: Page) {
  const report = await page.evaluate(() => {
    const problems: string[] = [];

    if (!document.documentElement.getAttribute("lang")) {
      problems.push("the html element has no lang attribute");
    }

    const headings = Array.from(
      document.querySelectorAll("h1, h2, h3, h4, h5, h6"),
    );
    const levels = headings.map((node) => Number(node.tagName.slice(1)));
    const h1Count = levels.filter((level) => level === 1).length;
    if (h1Count !== 1) {
      problems.push(`expected exactly one h1, found ${h1Count}`);
    }
    for (let index = 1; index < levels.length; index += 1) {
      const jump = levels[index] - levels[index - 1];
      if (jump > 1) {
        problems.push(
          `heading level jumps from h${levels[index - 1]} to h${levels[index]}`,
        );
      }
    }

    for (const image of Array.from(document.querySelectorAll("img"))) {
      if (!image.hasAttribute("alt")) {
        problems.push(
          `image with no alt attribute: ${image.outerHTML.slice(0, 120)}`,
        );
      }
    }

    for (const control of Array.from(
      document.querySelectorAll("a[href], button"),
    )) {
      const name =
        control.getAttribute("aria-label")?.trim() ||
        control.textContent?.trim();
      if (!name) {
        problems.push(
          `interactive element with no accessible name: ${control.outerHTML.slice(0, 120)}`,
        );
      }
    }

    const ids = Array.from(document.querySelectorAll("[id]")).map(
      (node) => node.id,
    );
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length > 0) {
      problems.push(
        `duplicate id attributes: ${[...new Set(duplicates)].join(", ")}`,
      );
    }

    return problems;
  });

  expect(report, "manual accessibility checks").toEqual([]);
}

/** True once next-themes has applied a resolved theme class to <html>. */
async function themeApplied(page: Page, theme: "light" | "dark") {
  await expect
    .poll(() =>
      page.evaluate(
        (name) => document.documentElement.classList.contains(name),
        theme,
      ),
    )
    .toBe(true);
}

test.describe("content pages", () => {
  for (const route of ROUTES) {
    test(`${route} answers 200 with one h1 and no basic accessibility problems, light and dark`, async ({
      page,
    }) => {
      for (const theme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: theme });
        const response = await page.goto(route);
        expect(response?.status()).toBe(200);
        await themeApplied(page, theme);
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        await assertBasicAccessibility(page);
      }
    });
  }

  test("/how-it-works links to the console", async ({ page }) => {
    await page.goto("/how-it-works");
    const consoleLink = page
      .getByRole("link", { name: "Open the console" })
      .first();
    await expect(consoleLink).toBeVisible();
    await expect(consoleLink).toHaveAttribute("href", "/");
    await consoleLink.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Detent" }),
    ).toBeVisible();
  });

  test("security, privacy and terms link back to the console", async ({
    page,
  }) => {
    for (const route of ["/security", "/privacy", "/terms"] as const) {
      await page.goto(route);
      const back = page.getByRole("link", { name: /console/i }).first();
      await expect(back).toBeVisible();
    }
  });

  test("the faucet page names the official portal and the network facts", async ({
    page,
  }) => {
    await page.goto("/faucet");
    await expect(
      page.getByRole("link", { name: "Open the official faucet" }),
    ).toHaveAttribute("href", "https://portal.hedera.com/faucet");
    await expect(
      page.getByText("Hedera testnet, chain 296").first(),
    ).toBeVisible();
  });

  test("privacy names no cookies and the exact localStorage key", async ({
    page,
  }) => {
    await page.goto("/privacy");
    await expect(page.getByText(/no cookie/i).first()).toBeVisible();
    await expect(
      page.getByText("theme", { exact: true }).first(),
    ).toBeVisible();
  });
});
