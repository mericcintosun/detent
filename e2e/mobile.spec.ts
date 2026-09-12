import { type Page } from "@playwright/test";
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

test.describe("phone width", () => {
  test("the demo completes at 390 px without horizontal overflow", async ({
    page,
  }) => {
    expect(page.viewportSize()?.width).toBe(390);

    await openConsole(page);
    await expectNoHorizontalOverflow(page, "on load");

    await fillCouponPlan(page);
    await approveBothOfficers(page);
    await lockPlan(page);
    await expectNoHorizontalOverflow(page, "after the lock");

    await editOneDigit(page);
    await sendEditedPlan(page);
    await expectNoHorizontalOverflow(page, "after the refusal");

    await executeApprovedPlan(page);
    await expectNoHorizontalOverflow(page, "after the send");
  });
});
