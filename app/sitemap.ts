// The public sitemap.
//
// Only the pages a crawler should index: the six public routes named in
// docs/frontend/05_IA.md. `/record/[planHash]` is left out on purpose, because
// the set of plan hashes is unbounded and none of them is a page a search
// index should discover on its own; `/design-system` is left out because it is
// a development only living style guide, not a public page. The base URL
// mirrors the expression app/layout.tsx uses for metadataBase, so a link
// preview and a sitemap entry always agree on the same origin.

import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://detent-app.vercel.app";

/** The public, indexable routes. Order matches the IA document's sitemap block. */
const ROUTES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/how-it-works", priority: 0.8 },
  { path: "/security", priority: 0.8 },
  { path: "/faucet", priority: 0.6 },
  { path: "/privacy", priority: 0.3 },
  { path: "/terms", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map(({ path, priority }) => ({
    url: new URL(path, SITE_URL).toString(),
    changeFrequency: "monthly",
    priority,
  }));
}
