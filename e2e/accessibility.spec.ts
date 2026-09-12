import { type Page } from "@playwright/test";
import {
  approveBothOfficers,
  changeOneDigit,
  editOneDigit,
  fillCouponPlan,
  lockPlan,
  openConsole,
  refusal,
  sendEditedPlan,
} from "./console";
import { expect, statusLine, test } from "./fixtures";

/** The accessible text of whatever holds focus: aria-label, label or text. */
function focusedName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) return "";
    const label =
      element instanceof HTMLInputElement
        ? (element.labels?.[0]?.textContent ?? "")
        : "";
    return (
      element.getAttribute("aria-label") ||
      label ||
      element.textContent ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim();
  });
}

/** Presses Tab until the named control holds focus, and fails if it never does. */
async function tabTo(page: Page, name: string | RegExp) {
  for (let presses = 0; presses < 300; presses += 1) {
    await page.keyboard.press("Tab");
    const current = await focusedName(page);
    if (typeof name === "string" ? current === name : name.test(current)) {
      await expectFocusVisible(page);
      return;
    }
  }
  throw new Error(`Tab never reached a control named ${String(name)}`);
}

/** The focused control matches :focus-visible and draws a ring or an outline. */
async function expectFocusVisible(page: Page) {
  const state = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement;
    const style = getComputedStyle(element);
    return {
      matches: element.matches(":focus-visible"),
      outline: style.outlineStyle !== "none" && style.outlineWidth !== "0px",
      ring: style.boxShadow !== "none" && style.boxShadow !== "",
    };
  });
  expect(state.matches, "focus is keyboard visible").toBe(true);
  expect(state.outline || state.ring, "focus draws a ring or outline").toBe(
    true,
  );
}

test.describe("keyboard and assistive technology", () => {
  test("the demo's primary controls work with the keyboard alone and show focus", async ({
    page,
  }) => {
    await openConsole(page);

    const coupon = page.getByRole("button", {
      name: "Distribute quarterly coupon",
      exact: true,
    });
    await tabTo(page, "Distribute quarterly coupon");
    await page.keyboard.press("Enter");
    await expect(coupon).toHaveAttribute("aria-pressed", "true");

    await tabTo(page, "Approve");
    await page.keyboard.press("Space");
    await tabTo(page, "Approve");
    await page.keyboard.press("Enter");
    await expect(page.getByText("2 of 2 signatures collected.")).toBeVisible();

    await tabTo(page, "Lock this plan to the treasury key");
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: "Plan locked to the treasury key" }),
    ).toBeDisabled();

    const amount = page.getByLabel(/^Amount for /);
    await expect(amount).toBeEnabled();
    const edited = changeOneDigit(await amount.inputValue());
    await tabTo(page, /^Amount for /);
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type(edited);
    await expect(amount).toHaveValue(edited);

    await tabTo(page, "Send edited plan");
    await page.keyboard.press("Enter");
    await expect(refusal(page)).toContainText(/diverges at byte \d+/);

    await tabTo(page, "Execute the approved plan");
    await page.keyboard.press("Space");
    await expect(
      page.getByRole("button", { name: "Executed, the lock is spent" }),
    ).toBeDisabled();
  });

  test("the status line and the refusal are announced through live regions", async ({
    page,
  }) => {
    await openConsole(page);
    const status = statusLine(page);
    await expect(status).toHaveAttribute("aria-live", "polite");

    await fillCouponPlan(page);
    await approveBothOfficers(page);
    await lockPlan(page);
    // The policy id lands inside the polite region rather than beside it.
    await expect(status).toContainText(/Policy \S+/);

    await editOneDigit(page);
    await sendEditedPlan(page);
    const assertive = page
      .locator('[aria-live="assertive"]')
      .filter({ hasText: /diverges at byte \d+/ });
    await expect(assertive).toHaveCount(1);
    await expect(assertive).toHaveAttribute("role", "alert");
    await expect(assertive).toContainText("ethereum_transaction.data");
  });
});
