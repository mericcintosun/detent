import { randomBytes } from "node:crypto";
import { test as base, expect, type Page } from "@playwright/test";

export { expect };

export interface GuardOptions {
  /**
   * Console errors a test expects and accepts. Empty by default, so any console
   * error fails the test unless the test names it here.
   */
  allowedConsoleErrors: RegExp[];
}

/**
 * A random private address for x-forwarded-for. The lock route rate limits per
 * address and trusts that header, so every test gets its own bucket and a
 * parallel run never trips a 429 it did not ask for.
 */
export function uniqueClientAddress(): string {
  const [a, b, c] = randomBytes(3);
  return `10.${a}.${b}.${c}`;
}

export const test = base.extend<GuardOptions>({
  allowedConsoleErrors: [[], { option: true }],

  extraHTTPHeaders: async ({ extraHTTPHeaders }, provide) => {
    await provide({
      ...extraHTTPHeaders,
      "x-forwarded-for": uniqueClientAddress(),
    });
  },

  /**
   * Every page fails its test on silent breakage: a console error, an uncaught
   * page error, or a same origin response with status 500 or above. The
   * assertion runs after the test body, so a flow that looks right on screen
   * but logged a hydration error or swallowed a 500 still fails.
   */
  page: async ({ page, allowedConsoleErrors, baseURL }, provide) => {
    const problems: string[] = [];
    const origin = new URL(baseURL ?? "http://127.0.0.1:3120").origin;

    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (allowedConsoleErrors.some((pattern) => pattern.test(text))) return;
      problems.push(`console error: ${text}`);
    });
    page.on("pageerror", (error) => {
      problems.push(`page error: ${error.message}`);
    });
    page.on("response", (response) => {
      if (response.status() < 500) return;
      if (new URL(response.url()).origin !== origin) return;
      problems.push(`HTTP ${response.status()} from ${response.url()}`);
    });

    await provide(page);

    expect(problems, "the page reported silent breakage").toEqual([]);
  },
});

/**
 * The run mode status line, which states the mode the page runs in. It sits in
 * the console hero above the five steps, so it is addressed by its own id
 * rather than as a paragraph inside #register.
 */
export function statusLine(page: Page) {
  return page.locator('#console-status[role="status"]');
}

export interface ConsoleMode {
  /** The register is the cached seed, not a live Hedera read. */
  seedRegister: boolean;
  /** The treasury key is a real Privy server wallet. */
  liveSigner: boolean;
}

export async function readMode(page: Page): Promise<ConsoleMode> {
  const text = await statusLine(page).innerText();
  return {
    seedRegister: text.includes("Cached register"),
    liveSigner: text.includes("Privy server wallet"),
  };
}
