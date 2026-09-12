import { defineConfig } from "@playwright/test";

/**
 * End to end suite for the Detent console.
 *
 * The server is a production build on its own port, so the suite exercises the
 * same bundle a deployment serves. With no environment keys the app runs in
 * seed mode (cached register, locally evaluated policy, synthetic receipts), and
 * the tests that depend on that mode read the status line before asserting.
 */
const PORT = 3120;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  outputDir: "test-results",
  fullyParallel: true,
  // One worker on purpose. Under parallel cold loads (8 workers, 60 loads) the
  // production build intermittently throws React hydration error #418 on
  // byte identical server HTML, while the same 60 loads on one worker stay
  // clean. The silent breakage guard stays strict; the race is reported as an
  // application bug instead of being allowlisted.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
  projects: [
    {
      name: "desktop",
      testIgnore: /mobile\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      testMatch: /(mobile|routes)\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
