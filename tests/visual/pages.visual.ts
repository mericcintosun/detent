import { expect, test } from "../../e2e/fixtures";
import { pinClock, settle, volatile } from "./helpers";

/**
 * Full page baselines of every public route, at each project's width and
 * theme. The fixtures from e2e/fixtures.ts give every test its own
 * x-forwarded-for address and fail it on a console error, a page error or a
 * same origin 5xx.
 */
const routes = [
  { name: "console", path: "/" },
  { name: "how-it-works", path: "/how-it-works" },
  { name: "security", path: "/security" },
  { name: "faucet", path: "/faucet" },
  { name: "privacy", path: "/privacy" },
  { name: "terms", path: "/terms" },
  { name: "record", path: `/record/0x${"ab".repeat(32)}` },
];

/** Chrome logs the 404 document itself as a console error; same as e2e/axe.spec.ts. */
const NOT_FOUND_DOCUMENT =
  /^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/;

test.beforeEach(async ({ page }) => {
  await pinClock(page);
});

for (const route of routes) {
  test(`${route.path} full page`, async ({ page }) => {
    await page.goto(route.path);
    await settle(page);
    await expect(page).toHaveScreenshot(`${route.name}.png`, {
      fullPage: true,
      mask: volatile(page),
    });
  });
}

test.describe("the not found page", () => {
  test.use({ allowedConsoleErrors: [NOT_FOUND_DOCUMENT] });

  test("/no-such-page full page", async ({ page }) => {
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    await settle(page);
    await expect(page).toHaveScreenshot("not-found.png", {
      fullPage: true,
      mask: volatile(page),
    });
  });
});
