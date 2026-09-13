import { defineConfig, devices } from "@playwright/test";

/**
 * Visual regression suite for the Detent frontend.
 *
 * Separate from playwright.config.ts on purpose: its own port, its own output
 * folders and only Chromium, so a baseline never depends on which e2e project
 * ran first. The server is a production build in seed mode, the same bundle
 * the e2e suite exercises.
 *
 * Six projects: 375, 768 and 1440 px, each in light and dark. Baselines live in
 * tests/visual/__screenshots__/<project>/<spec>/<name>.png, so a width or a
 * theme can be regenerated or reviewed on its own.
 *
 * Regenerate every baseline with `npm run test:visual:update`.
 */
const PORT = Number(process.env.VISUAL_PORT ?? 3125);
const baseURL = `http://127.0.0.1:${PORT}`;

const widths = [
  { width: 375, height: 812, mobile: true },
  { width: 768, height: 1024, mobile: true },
  { width: 1440, height: 900, mobile: false },
] as const;

const themes = ["light", "dark"] as const;

export default defineConfig({
  testDir: "tests/visual",
  testMatch: /.*\.visual\.ts$/,
  outputDir: "test-results/visual",
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}",
  fullyParallel: true,
  workers: 4,
  forbidOnly: !!process.env.CI,
  // No retries: a screenshot that needs a second try is a flaky baseline, and
  // the fix belongs in the helpers, not in the retry count.
  retries: 0,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      // Absorbs sub pixel anti aliasing differences between machines on the
      // same Chromium build (about 0.1 percent of a full page), and no more.
      // A real regression, such as a moved button or a changed colour, moves
      // far more pixels than that. See docs/frontend/QA_REPORT.md.
      maxDiffPixelRatio: 0.002,
      stylePath: "tests/visual/screenshot.css",
    },
  },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/visual", open: "never" }],
  ],
  use: {
    baseURL,
    browserName: "chromium",
    reducedMotion: "reduce",
    timezoneId: "UTC",
    locale: "en-US",
    deviceScaleFactor: 1,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
  projects: widths.flatMap(({ width, height, mobile }) =>
    themes.map((colorScheme) => ({
      name: `${width}-${colorScheme}`,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width, height },
        deviceScaleFactor: 1,
        isMobile: mobile,
        hasTouch: mobile,
        colorScheme,
      },
    })),
  ),
});
