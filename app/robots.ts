// Every page in docs/frontend/05_IA.md is public and read only, so the default
// rule allows everything. Two paths are carved out: /api/ is a write and read
// surface for the console itself, never a page, and /design-system is a
// development only living style guide the IA document marks noindex.

import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://detent-app.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/design-system"],
    },
    sitemap: new URL("/sitemap.xml", SITE_URL).toString(),
  };
}
