import type { Page } from "@playwright/test";
import {
  approveBothOfficers,
  editOneDigit,
  executeApprovedPlan,
  fillCouponPlan,
  lockPlan,
  openConsole,
  sendEditedPlan,
} from "./console";
import { expect, test } from "./fixtures";

/**
 * Regression coverage for the six findings in docs/frontend/A11Y_AUDIT.md
 * (Wave 3). Each block below is named after its finding id so a failure here
 * points straight back at the audit entry.
 */

/** Chrome logs the 404 document itself as a console error; same as routes.spec.ts. */
const NOT_FOUND_DOCUMENT =
  /^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/;

const STATIC_ROUTES = [
  "/how-it-works",
  "/security",
  "/faucet",
  "/privacy",
  "/terms",
];

/** The document never scrolls sideways; wide content scrolls in its own box. */
async function expectNoHorizontalOverflow(page: Page, moment: string) {
  const size = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    size.scrollWidth,
    `document width ${size.scrollWidth} exceeds the ${size.clientWidth}px viewport ${moment}`,
  ).toBeLessThanOrEqual(size.clientWidth);
}

async function focusedOutline(page: Page) {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element) return null;
    const style = getComputedStyle(element);
    return {
      tag: element.tagName,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  });
}

test.describe("A11Y-01: forced colors keep a visible focus outline", () => {
  test.use({ forcedColors: "active" });

  test("a focused button draws a system-coloured outline on /", async ({
    page,
  }) => {
    await page.goto("/");
    // First tab stop is the skip link; the second is the first real control.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const outline = await focusedOutline(page);
    expect(outline?.outlineStyle).toBe("solid");
    expect(outline?.outlineWidth).not.toBe("0px");
  });

  test.describe("a focused link on the not found page", () => {
    test.use({ allowedConsoleErrors: [NOT_FOUND_DOCUMENT] });

    test("draws a system-coloured outline", async ({ page }) => {
      await page.goto("/no-such-page");
      await page.getByRole("link", { name: "Back to the console" }).focus();
      const outline = await focusedOutline(page);
      expect(outline?.tag).toBe("A");
      expect(outline?.outlineStyle).toBe("solid");
      expect(outline?.outlineWidth).not.toBe("0px");
    });
  });
});

test.describe("A11Y-02: no horizontal reflow at 320 CSS px", () => {
  test.use({ viewport: { width: 320, height: 900 } });

  for (const route of STATIC_ROUTES) {
    test(`${route} has no horizontal overflow at 320px`, async ({ page }) => {
      await page.goto(route, { waitUntil: "networkidle" });
      await expectNoHorizontalOverflow(page, "on load");
    });
  }

  test("/ has no horizontal overflow at 320px through the full demo", async ({
    page,
  }) => {
    await openConsole(page);
    await expectNoHorizontalOverflow(page, "on load");

    await fillCouponPlan(page);
    await expectNoHorizontalOverflow(page, "after picking the plan");

    await approveBothOfficers(page);
    await expectNoHorizontalOverflow(page, "both approved, before the lock");

    await lockPlan(page);
    await expectNoHorizontalOverflow(page, "after the lock");

    await editOneDigit(page);
    await expectNoHorizontalOverflow(page, "after editing the amount");

    await sendEditedPlan(page);
    await expectNoHorizontalOverflow(page, "after the edited send is refused");

    await executeApprovedPlan(page);
    await expectNoHorizontalOverflow(page, "after the approved send");
  });
});

test.describe("A11Y-03: dialogs trap Tab indefinitely", () => {
  /** Whether the active element is inside the open role="dialog". */
  function focusState(page: Page) {
    return page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      const dialog = document.querySelector('[role="dialog"]');
      return {
        inside: dialog ? dialog.contains(active) : false,
        tag: active?.tagName ?? null,
      };
    });
  }

  test("the command palette holds focus through 40 Tab presses each way", async ({
    page,
  }) => {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Search and jump" });
    await trigger.click();
    await expect(
      page.getByRole("dialog", { name: "Command palette" }),
    ).toBeVisible();

    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press("Tab");
      const state = await focusState(page);
      expect(
        state.inside,
        `press ${i + 1} forward, landed on ${state.tag}`,
      ).toBe(true);
    }
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press("Shift+Tab");
      const state = await focusState(page);
      expect(
        state.inside,
        `press ${i + 1} backward, landed on ${state.tag}`,
      ).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Command palette" }),
    ).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("the mobile menu sheet holds focus through 40 Tab presses each way", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Open the menu" });
    await trigger.click();
    const sheet = page.getByRole("dialog", { name: "Menu" });
    await expect(sheet).toBeVisible();

    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press("Tab");
      const state = await focusState(page);
      expect(
        state.inside,
        `press ${i + 1} forward, landed on ${state.tag}`,
      ).toBe(true);
    }
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press("Shift+Tab");
      const state = await focusState(page);
      expect(
        state.inside,
        `press ${i + 1} backward, landed on ${state.tag}`,
      ).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe("A11Y-05: plan table headers carry scope", () => {
  test("every column header in the plan table has scope=col", async ({
    page,
  }) => {
    await openConsole(page);
    await fillCouponPlan(page);
    const table = page.getByRole("region", {
      name: /^Distribute quarterly coupon, \d+ rows$/,
    });
    const headers = table.locator("thead th");
    const count = await headers.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(headers.nth(i)).toHaveAttribute("scope", "col");
    }
  });
});
