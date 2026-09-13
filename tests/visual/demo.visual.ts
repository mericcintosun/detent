import {
  approveBothOfficers,
  editOneDigit,
  executeApprovedPlan,
  fillCouponPlan,
  lockPlan,
  openConsole,
  sendEditedPlan,
} from "../../e2e/console";
import { type Page } from "@playwright/test";
import { expect, test } from "../../e2e/fixtures";
import { pinClock, settle, volatile } from "./helpers";

/**
 * The console's demo states, each clipped to the section that changes, plus the
 * two overlays. The steps are the README walk from e2e/console.ts, so a
 * baseline here and an assertion there always describe the same state.
 */

/**
 * A section taller than the viewport is captured by scrolling, and the phone
 * and tablet top bar is sticky, so without this it is painted across the middle
 * of the clip wherever the scroll left it. The bar is not part of any section,
 * so it is hidden for the section clips only; the full page and overlay
 * baselines still show it.
 */
async function hideStickyBar(page: Page) {
  await page.addStyleTag({
    content: "header.sticky { visibility: hidden !important; }",
  });
}

test.beforeEach(async ({ page }) => {
  await pinClock(page);
});

test("approved: both officers signed", async ({ page }) => {
  await openConsole(page);
  await fillCouponPlan(page);
  await approveBothOfficers(page);
  await settle(page);
  await hideStickyBar(page);
  await expect(page.locator("#policy")).toHaveScreenshot("approved.png", {
    mask: volatile(page),
  });
});

test("locked: the policy is compiled over DENY", async ({ page }) => {
  await openConsole(page);
  await fillCouponPlan(page);
  await approveBothOfficers(page);
  await lockPlan(page);
  await settle(page);
  await hideStickyBar(page);
  await expect(page.locator("#policy")).toHaveScreenshot("locked.png", {
    mask: volatile(page),
  });
});

test("edited send refused", async ({ page }) => {
  await openConsole(page);
  await fillCouponPlan(page);
  await approveBothOfficers(page);
  await lockPlan(page);
  await editOneDigit(page);
  await sendEditedPlan(page);
  // The amount field keeps focus after the fill; move it off so no focus ring
  // depends on where the last click landed.
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await settle(page);
  await hideStickyBar(page);
  await expect(page.locator("#send")).toHaveScreenshot("send-refused.png", {
    mask: volatile(page),
  });
});

test("approved send signed", async ({ page }) => {
  await openConsole(page);
  await fillCouponPlan(page);
  await approveBothOfficers(page);
  await lockPlan(page);
  await executeApprovedPlan(page);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await settle(page);
  await hideStickyBar(page);
  await expect(page.locator("#send")).toHaveScreenshot("send-signed.png", {
    mask: volatile(page),
  });
});

test("command palette open", async ({ page }) => {
  await openConsole(page);
  await settle(page);
  await page
    .getByRole("button", { name: "Search and jump" })
    .filter({ visible: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Command palette" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox")).toBeFocused();
  await settle(page);
  await expect(page).toHaveScreenshot("command-palette.png", {
    mask: volatile(page),
  });
});

test("mobile menu sheet open", async ({ page }) => {
  test.skip(
    page.viewportSize()?.width !== 375,
    "the menu sheet is the phone navigation; wider projects show the rail or the same bar",
  );
  await openConsole(page);
  await settle(page);
  await page.getByRole("button", { name: "Open the menu" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot("mobile-sheet.png", {
    mask: volatile(page),
  });
});
