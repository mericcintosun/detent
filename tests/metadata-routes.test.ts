// The metadata routes, pinned.
//
// sitemap.ts, robots.ts and manifest.ts are plain functions with no request
// object and no chain read, so they are exercised directly rather than
// through a server. Each assertion below is tied to a decision named in
// docs/frontend/05_IA.md: the six public routes and no others in the sitemap,
// /api/ and /design-system carved out of robots, and the manifest's brand
// colours matching IDENTITY.md's bone ground and ink text.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SITE_URL = "https://detent-app.vercel.app";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE_URL);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("sitemap", () => {
  it("lists exactly the six public routes from docs/frontend/05_IA.md", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toEqual([
      `${SITE_URL}/`,
      `${SITE_URL}/how-it-works`,
      `${SITE_URL}/security`,
      `${SITE_URL}/faucet`,
      `${SITE_URL}/privacy`,
      `${SITE_URL}/terms`,
    ]);
  });

  it("never lists a record URL or the design system route", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = sitemap().map((entry) => entry.url);

    expect(urls.some((url) => url.includes("/record/"))).toBe(false);
    expect(urls.some((url) => url.includes("/design-system"))).toBe(false);
  });

  it("gives the console the highest priority", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const home = sitemap().find((entry) => entry.url === `${SITE_URL}/`);

    expect(home?.priority).toBe(1);
  });
});

describe("robots", () => {
  it("allows everything except /api/ and /design-system", async () => {
    const { default: robots } = await import("@/app/robots");
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(rules?.userAgent).toBe("*");
    expect(rules?.allow).toBe("/");
    expect(rules?.disallow).toEqual(["/api/", "/design-system"]);
  });

  it("points at the sitemap on the configured site origin", async () => {
    const { default: robots } = await import("@/app/robots");
    const result = robots();

    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});

describe("manifest", () => {
  it("names the app Detent with the README's one line description", async () => {
    const { default: manifest } = await import("@/app/manifest");
    const result = manifest();

    expect(result.short_name).toBe("Detent");
    expect(result.description).toBe(
      "Operator console for tokenized securities: preview a coupon run or a forced transfer line by line, then lock the treasury wallet to exactly that transaction.",
    );
    expect(result.start_url).toBe("/");
    expect(result.display).toBe("standalone");
  });

  it("uses the bone ground and ink text colours from IDENTITY.md", async () => {
    const { default: manifest } = await import("@/app/manifest");
    const result = manifest();

    expect(result.background_color).toBe("#f4f1ea");
    expect(result.theme_color).toBe("#191713");
  });

  it("points its icons at the generated icon routes", async () => {
    const { default: manifest } = await import("@/app/manifest");
    const result = manifest();
    const srcs = (result.icons ?? []).map((icon) =>
      typeof icon === "object" ? icon.src : icon,
    );

    expect(srcs).toEqual(["/icon", "/apple-icon"]);
  });
});
