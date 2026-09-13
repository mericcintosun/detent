import { type Locator, type Page } from "@playwright/test";

/**
 * A fixed wall clock for every visual test, set before the first navigation.
 *
 * The register snapshot is stamped when the server reads it, and the console
 * shows a stale banner once that stamp is older than twice the cache window.
 * With the browser clock pinned before any build could have happened, the age
 * is never positive, so the banner never appears on one run and not the next.
 * The audit record's HH:MM:SS stamps also stop depending on when the test ran.
 * Both are still masked below, so a change to the pinning cannot leak a time
 * into a baseline.
 */
export const FIXED_NOW = new Date("2020-01-01T00:00:00.000Z");

export async function pinClock(page: Page) {
  await page.clock.setFixedTime(FIXED_NOW);
}

/**
 * Everything on screen that is derived from the current time. Only the text
 * that carries the time is masked, never the section around it.
 *
 * - The register snapshot's read time ("2026-09-13 04:36:10 UTC",
 *   components/console/register-section.tsx). The server stamps it on every
 *   revalidate, so it differs between two builds and between two requests.
 * - The stale banner's relative age ("12 minutes ago", components/design/states.tsx).
 * - The audit record's entry stamps ("HH:MM:SS UTC", components/console/ledger-section.tsx).
 * - The record timeline's anchored and closed timestamps
 *   (components/record/record-timeline.tsx), empty in seed mode.
 */
export function volatile(page: Page): Locator[] {
  return [
    page.locator("#register time"),
    page.locator('[data-slot="stale-banner"] time'),
    page.locator("#ledger li time"),
    page.locator("#record time"),
  ];
}

/**
 * Waits until the page can be captured the same way twice: the network is
 * quiet, every web font has loaded, every image has decoded, and the view
 * entrances below the fold have been scrolled through once so none is caught
 * at zero opacity in a full page capture.
 */
export async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await document.fonts.ready;

    for (const image of Array.from(document.images)) {
      image.loading = "eager";
    }

    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    window.scrollTo(0, 0);

    await Promise.all(
      Array.from(document.images).map((image) =>
        image.decode().catch(() => undefined),
      ),
    );
    await document.fonts.ready;
  });
  await page.waitForLoadState("networkidle");
  // Two frames, so the layout after the last scroll is painted.
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}
