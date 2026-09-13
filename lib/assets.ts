// The image asset registry: one row per raster or vector file under public/,
// present or planned. This is documentation with types, not a loader; a page
// still imports its own component (Image, Plate) and its own path string. The
// registry exists so a reader can answer "what images does Detent have, where
// do they live, and what is queued next" from one file instead of grepping
// public/ and every page.
//
// A "planned" row describes an asset that does not exist on disk yet: the
// ChatGPT prompt that would produce it lives in docs/frontend/ASSETS.md, and
// nothing in app/ or components/ imports its path. Flip status to "present"
// only once the file has actually landed under public/ and this row's path,
// width and height match it exactly; tests/assets.test.ts fails a "present"
// row whose file is missing, so that flip is the thing that keeps this file
// honest.
//
// `alt` is always a real, non-empty description of what the image depicts,
// independent of how a given usage site renders it. Several current usage
// sites pass alt="" with aria-hidden because the plate is decorative and the
// sentence beside it already carries the meaning (see components/plates.tsx);
// `decorative: true` records that choice without pretending the image itself
// has no content worth describing.

export type AssetStatus = "present" | "planned";
export type AssetTheme = "light" | "dark" | "any";
export type AssetFormat = "svg" | "png" | "webp" | "avif";

export interface AssetEntry {
  /** Stable id, kebab-case, matches the filename stem where one exists. */
  id: string;
  /** Path under public/, always leading with a slash. */
  path: string;
  width: number;
  height: number;
  format: AssetFormat;
  theme: AssetTheme;
  status: AssetStatus;
  /**
   * A real, non-empty description of the image content. Not necessarily the
   * alt attribute a consumer renders: see `decorative`.
   */
  alt: string;
  /**
   * True when every current (or intended) usage site renders this image with
   * alt="" and aria-hidden="true" because adjacent text already carries the
   * meaning. False means a consumer should render `alt` verbatim.
   */
  decorative: boolean;
  /** Files that import or read this path today (present), or the one page this asset is planned for (planned). */
  usedBy: string[];
  /** One line: why it exists, or what gap it fills and why it was approved. */
  note: string;
}

export const ASSETS: readonly AssetEntry[] = [
  // --- Present -------------------------------------------------------------
  {
    id: "logo",
    path: "/brand/logo.png",
    width: 1024,
    height: 1024,
    format: "png",
    theme: "light",
    status: "present",
    alt: "Detent",
    decorative: true,
    usedBy: [
      "components/shell/brand-mark.tsx",
      "app/icon.tsx",
      "app/apple-icon.tsx",
      "app/opengraph-image.tsx",
    ],
    note: "The one brand mark LOGO_POLICY allows per page. Ships on an opaque bone (#f4f1ea) square with no alpha channel, so it prints a visible light box on the dark theme; out of fence for this registry to fix, since LOGO_POLICY forbids proposing a new or amended mark.",
  },
  {
    id: "plate-plan",
    path: "/brand/plate-plan.svg",
    width: 160,
    height: 120,
    format: "svg",
    theme: "light",
    status: "present",
    alt: "An engraved ledger plate: a header row of three gold column ticks over two rows of redacted ink text, a gold total rule and a closing gold figure block, styled as the read-the-plan step of a coupon run.",
    decorative: true,
    usedBy: ["app/how-it-works/page.tsx", "components/console-states.tsx"],
    note: "Flat-shape SVG, not the raster the design system doc describes (see the drift note in ASSETS.md). Dark mode is a CSS filter on the <Image>, not a native dark asset.",
  },
  {
    id: "plate-policy",
    path: "/brand/plate-policy.svg",
    width: 160,
    height: 120,
    format: "svg",
    theme: "light",
    status: "present",
    alt: "An engraved policy glyph: an open gold ring like a partial lock, crossed by an oxide-red pennant, beside one ink bar and a short hairline tick.",
    decorative: true,
    usedBy: ["app/how-it-works/page.tsx", "components/console-states.tsx"],
    note: "Same SVG-not-raster and CSS-filter dark mode note as plate-plan.",
  },
  {
    id: "plate-refusal",
    path: "/brand/plate-refusal.svg",
    width: 160,
    height: 120,
    format: "svg",
    theme: "light",
    status: "present",
    alt: "An engraved refusal plate: a flagged row shaded bone-shadow and set in oxide-red between two ink header bars, reading as a blocked ledger line.",
    decorative: true,
    usedBy: ["app/how-it-works/page.tsx"],
    note: "Same SVG-not-raster and CSS-filter dark mode note as plate-plan.",
  },
  {
    id: "plate-register",
    path: "/brand/plate-register.svg",
    width: 160,
    height: 120,
    format: "svg",
    theme: "light",
    status: "present",
    alt: "An engraved register plate: a six-tick gold header over a six-row, two-divider ledger grid with no filled cells.",
    decorative: true,
    usedBy: ["components/console-states.tsx"],
    note: "Same SVG-not-raster and CSS-filter dark mode note as plate-plan.",
  },
  {
    id: "plate-record",
    path: "/brand/plate-record.svg",
    width: 160,
    height: 120,
    format: "svg",
    theme: "light",
    status: "present",
    alt: "An engraved record plate: two ink header lines over a gold rule, ending in a gold-ringed, oxide-inset seal with a black centre bar.",
    decorative: true,
    usedBy: ["components/console-states.tsx"],
    note: "Same SVG-not-raster and CSS-filter dark mode note as plate-plan. Also referenced, unused, from the dead RecordEmptyState in components/console-states.tsx.",
  },
  {
    id: "ledger-rule",
    path: "/illustrations/ledger-rule.svg",
    width: 120,
    height: 36,
    format: "svg",
    theme: "light",
    status: "present",
    alt: "A single hairline gold rule at 28 percent opacity on a parchment ground, tiled as a background pattern.",
    decorative: true,
    usedBy: ["app/globals.css (.detent-ruled background-image)"],
    note: "Not consumed by any React component; only by the CSS class .detent-ruled. Dark mode redraws .detent-ruled from tokens instead of filtering this file (04_DESIGN_SYSTEM.md section 10).",
  },

  // --- Planned ---------------------------------------------------------------
  {
    id: "plate-plan-dark",
    path: "/brand/plate-plan-dark.webp",
    width: 640,
    height: 480,
    format: "webp",
    theme: "dark",
    status: "planned",
    alt: "The dark-theme companion to plate-plan: the same header, row and total-rule composition redrawn on the dark card ground with dark-theme gold, ink and oxide tokens instead of a CSS filter.",
    decorative: true,
    usedBy: ["app/how-it-works/page.tsx"],
    note: "Approved gap: replaces the invert/hue-rotate CSS filter components/plates.tsx applies today with a native dark asset. See docs/frontend/ASSETS.md for the full ChatGPT prompt. Not imported by any page yet.",
  },
  {
    id: "plate-policy-dark",
    path: "/brand/plate-policy-dark.webp",
    width: 640,
    height: 480,
    format: "webp",
    theme: "dark",
    status: "planned",
    alt: "The dark-theme companion to plate-policy: the same lock-ring and pennant glyph redrawn on the dark card ground with dark-theme gold and oxide tokens instead of a CSS filter.",
    decorative: true,
    usedBy: ["app/how-it-works/page.tsx"],
    note: "Approved gap, same rationale as plate-plan-dark. Not imported by any page yet.",
  },
  {
    id: "plate-refusal-dark",
    path: "/brand/plate-refusal-dark.webp",
    width: 640,
    height: 480,
    format: "webp",
    theme: "dark",
    status: "planned",
    alt: "The dark-theme companion to plate-refusal: the same flagged-row composition redrawn on the dark card ground with dark-theme oxide and ink tokens instead of a CSS filter.",
    decorative: true,
    usedBy: ["app/how-it-works/page.tsx"],
    note: "Approved gap, same rationale as plate-plan-dark. Not imported by any page yet.",
  },
  {
    id: "plate-record-unknown",
    path: "/brand/plate-record-unknown.webp",
    width: 640,
    height: 480,
    format: "webp",
    theme: "light",
    status: "planned",
    alt: "An engraved plate for a plan hash PlanAnchor has never seen: the same header and frame as plate-record, but the body carries one dashed, unfilled hairline row and an open, dashed seal ring in place of the closed gold-and-oxide seal, reading as a ledger line that was never written.",
    decorative: false,
    usedBy: [
      "app/record/[planHash]/page.tsx (components/record/record-empty-states.tsx, UnknownRecordState)",
    ],
    note: "Approved gap: the record page's three empty states (components/record/record-empty-states.tsx) carry no icon today, unlike the console's analogous EmptyState instances, which all use a Plate. decorative is false because this is the one candidate the record page could reasonably surface with a real accessible name rather than folding into the adjoining Callout text; the consumer still decides at render time. Not imported by any page yet.",
  },
  {
    id: "plate-record-unknown-dark",
    path: "/brand/plate-record-unknown-dark.webp",
    width: 640,
    height: 480,
    format: "webp",
    theme: "dark",
    status: "planned",
    alt: "The dark-theme companion to plate-record-unknown, redrawn on the dark card ground with dark-theme tokens rather than depending on a CSS filter from day one.",
    decorative: false,
    usedBy: [
      "app/record/[planHash]/page.tsx (components/record/record-empty-states.tsx, UnknownRecordState)",
    ],
    note: "Shipped alongside plate-record-unknown so this new asset never needs the CSS-filter workaround the other five plates carry. Not imported by any page yet.",
  },
] as const;

export function getAsset(id: string): AssetEntry | undefined {
  return ASSETS.find((asset) => asset.id === id);
}

export function presentAssets(): AssetEntry[] {
  return ASSETS.filter((asset) => asset.status === "present");
}

export function plannedAssets(): AssetEntry[] {
  return ASSETS.filter((asset) => asset.status === "planned");
}
