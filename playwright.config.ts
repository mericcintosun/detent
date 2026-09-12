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
  // Four workers. On Next 15.5, parallel cold loads (8 concurrent, 60 loads)
  // intermittently threw React hydration error #418 on byte identical server
  // HTML, so the suite ran on one worker. On Next 16.3.5 the same probe (/,
  // a well formed record page and an unknown route, 20 loads each, 8
  // concurrent pages) measured 0 of 60 in two separate runs, so the suite runs
  // parallel again. The silent breakage guard stays strict: a returning #418
  // fails a test rather than being allowlisted.
  workers: 4,
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
