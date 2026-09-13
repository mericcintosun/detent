import { type Page } from "@playwright/test";
import {
  approveBothOfficers,
  editOneDigit,
  fillCouponPlan,
  lockPlan,
  openConsole,
  sendEditedPlan,
} from "./console";
import { expect, test } from "./fixtures";

// The motion contract in docs/frontend/07_MOTION.md: nothing on the first
// screen waits for JavaScript, Motion runs the interaction moments after
// hydration, and reduced motion keeps every state change without the movement.

/** Records the send card's horizontal offset on every frame for a while. */
async function sampleKnock(page: Page) {
  await page.evaluate(() => {
    const target = document.querySelector<HTMLElement>(
      "[data-slot=send-knock]",
    );
    const samples: number[] = [];
    (window as unknown as { __knock: number[] }).__knock = samples;
    const end = performance.now() + 8000;
    const tick = () => {
      if (!target) return;
      samples.push(new DOMMatrix(getComputedStyle(target).transform).m41);
      if (performance.now() < end) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function knockSamples(page: Page): Promise<number[]> {
  return page.evaluate(
    () => (window as unknown as { __knock: number[] }).__knock,
  );
}

async function refuseAnEditedSend(page: Page) {
  await openConsole(page);
  await fillCouponPlan(page);
  await approveBothOfficers(page);
  await lockPlan(page);
  await editOneDigit(page);
  await sampleKnock(page);
  await sendEditedPlan(page);
  // The knock is 320ms; leave it time to finish before reading the frames.
  await page.waitForTimeout(600);
}

test.describe("first paint without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the console's first screen is drawn from the server HTML", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Detent" }),
    ).toBeVisible();
    const summary = page.getByText(/tokens across \d+ holders on partition/);
    await expect(summary).toBeVisible();
    // The CSS wipe settles on its own; no entrance waits for hydration.
    await expect
      .poll(() =>
        page
          .locator("[data-slot=page-header]")
          .first()
          .evaluate((node) => getComputedStyle(node.parentElement!).opacity),
      )
      .toBe("1");
  });

  test("view entrances render visible on a content page", async ({ page }) => {
    await page.goto("/how-it-works");
    const steps = page.locator("#steps ol > li");
    await expect(steps).toHaveCount(3);
    for (const step of await steps.all()) {
      expect(
        await step.evaluate((node) => getComputedStyle(node).opacity),
      ).toBe("1");
    }
  });
});

test.describe("interaction motion", () => {
  test("the refusal knocks the send card and the lock rule is drawn", async ({
    page,
  }) => {
    await refuseAnEditedSend(page);
    const offsets = await knockSamples(page);
    expect(Math.max(...offsets.map(Math.abs))).toBeGreaterThan(1);
    expect(offsets.at(-1)).toBe(0);
    // Refused, the lock stays open for the approved plan but the rule retracts:
    // the gold rule means "this key is narrowed and nothing went wrong".
    await expect(
      page.getByText("Policy compiled", { exact: true }),
    ).toBeVisible();
  });

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("the refusal lands without movement", async ({ page }) => {
      await refuseAnEditedSend(page);
      const offsets = await knockSamples(page);
      expect(offsets.length).toBeGreaterThan(0);
      expect(Math.max(...offsets.map(Math.abs))).toBe(0);
    });
  });
});
