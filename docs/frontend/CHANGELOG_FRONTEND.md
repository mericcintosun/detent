# Frontend changelog

Every entry below is one merge into `refactor/main`, in order, from the frontend
redesign that started at `docs/frontend/00_INTAKE.md`. The commit hash is the
merge commit; `git show --stat <hash>` lists the exact files it touched.

## Wave 0: Next.js 16 and the React Compiler

- `e8dc754` Upgraded from Next.js 15.5.25 to 16.3.5. Turned on the React
  Compiler (`reactCompiler: true` in `next.config.ts`), stable in Next 16 but
  off by default. Updated `eslint.config.mjs`, `tsconfig.json` and
  `playwright.config.ts` for the new major; no source file changed.

## Wave 1: the design system and the metadata routes

- `869a521` Design system: the shadcn CLI on Base UI 1.8.0, style `base-lyra`;
  light and dark OKLCH tokens in `app/globals.css`; the type, spacing, radius,
  elevation and motion scales; Motion for React through `lib/motion.ts` and
  `components/motion/**`; the `components/ui/**` and `components/design/**`
  primitive sets; the `/design-system` route; the `IDENTITY.md` amendment
  recording the move to two themes. See `docs/frontend/04_DESIGN_SYSTEM.md`.
- `1b4c8d1` Metadata routes: `app/icon.tsx`, `app/apple-icon.tsx`,
  `app/manifest.ts`, `app/robots.ts`, `app/sitemap.ts`,
  `app/opengraph-image.tsx`, `app/twitter-image.tsx`, and a per-record
  `app/record/[planHash]/opengraph-image.tsx`. Removed the static
  `app/opengraph-image.png` and `app/icon.svg` in favour of the generated
  routes.

## Wave 2: shell, console, record and content pages

- `4bd9cb5` App shell: `components/shell/app-rail.tsx` (a persistent left rail
  on `lg` and up) replaces `components/rail.tsx`; a mobile top bar and menu
  sheet; the command palette (Cmd/Ctrl K, `components/shell/command-palette*`);
  `app/global-error.tsx` added; `app/not-found.tsx` and `app/error.tsx`
  rebuilt on the new primitives. `components/section-progress.tsx` is gone,
  folded into the shell's section navigation.
- `07d796e` Console rebuilt as a five-section flow in `components/console/**`
  (register, plan, policy, send, ledger), replacing the single
  `components/operations-console.tsx` file for the section bodies (the file
  itself stays as the composing shell). Added stale, offline and fee states;
  added `app/api/fee/route.ts` and `lib/fees.ts` for the real-mode gas
  estimate.
- `589a009` `/record/[planHash]` rebuilt as an on-chain certificate in
  `components/record/**`, covering every anchor state (anchored, settled,
  abandoned, unknown, not configured, read failed).
- `fa0b989` Content pages added: `/how-it-works`, `/security`, `/faucet`,
  `/privacy`, `/terms`, plus `components/content/architecture-diagram.tsx` and
  `e2e/content.spec.ts`.

## Wave 3: polish, perf, axe in e2e, the a11y audit and assets

- `a2bb714` Polish pass across the shared primitives and the console and
  record pages: layout, the tailwind-merge scale, button variants, table
  markup and record page tone.
- `5f9bc07` / `f963bbd` axe added to the end to end suite (`e2e/axe.spec.ts`),
  run on every merged route in both themes, gating on zero serious or
  critical findings.
- `dcee9a7` Read-only WCAG 2.2 accessibility audit beyond what axe covers
  (`docs/frontend/A11Y_AUDIT.md`): 2 blockers (forced-colors focus rings,
  320px reflow on the console), 3 should-fix, 2 nice-to-have findings.
  Findings only, no source file changed by this merge.
- `8dfda1f` Asset inventory and a typed registry (`docs/frontend/ASSETS.md`,
  `lib/assets.ts`, `tests/assets.test.ts`). Documents the existing plates and
  logo, proposes dark-theme plate companions and a record-page empty-state
  plate; nothing new was generated or wired in by this merge, every proposed
  row is `status: "planned"`.
- `4fd163c` Performance pass: every entrance moved off the Motion runtime and
  onto CSS (`tw-animate-css` and the existing `detent-wipe` keyframe) plus one
  `IntersectionObserver`; `components/motion/motion-provider.tsx` and
  `components/motion/features.ts` deleted; the mobile menu sheet now loads on
  first tap instead of on every route; prefetch restored on the shell's
  content links now that those pages exist. Same-origin JS on `/` measured
  341.5 kB before this merge and 280.3 kB gzip after (see
  `docs/frontend/PERF.md`).

## Motion and accessibility fixes

TODO(orchestrator): the motion agent and the a11y fix agent were still working
in parallel while this file was written (Wave 5, DOCS). Neither had merged at
the time of this commit. Add their merge commit hash(es) here once they land,
and re-check the "Breaking for contributors" list below and `HANDOFF.md`'s
accessibility status section against whatever they actually changed,
especially A11Y-01 (forced-colors focus ring, proposed owner
`app/globals.css`) and A11Y-02 (320px reflow, proposed owners
`components/ui/button-variants.ts` and `components/console/policy-section.tsx`)
from `docs/frontend/A11Y_AUDIT.md`.

## Breaking for contributors

Anyone working from the pre-redesign codebase (before `e8dc754`) hits these:

- **`Button` has no `asChild`.** The shadcn `base-lyra` `Button` does not
  support Base UI's render-prop composition the way the old CVA button
  supported Radix's `asChild`. A link styled as a button uses `render` for a
  Base UI trigger, or `buttonVariants()` on an `<a>` or `<Link>` directly.
- **`buttonVariants` and `badgeVariants` moved.** They are no longer exported
  from `components/ui/button.tsx` / `components/ui/badge.tsx`. Import them
  from `@/components/ui/button-variants` and `@/components/ui/badge-variants`
  so a server component can style a link without pulling in the client
  component.
- **`components/rail.tsx` is gone.** Replaced by
  `components/shell/app-rail.tsx` plus the rest of `components/shell/**`
  (mobile menu, command palette, top bar). `components/section-progress.tsx`
  is also gone, folded into the shell's section navigation.
- **`#brief` is gone.** The old console's "why it exists" block, three-step
  strip and simulator comparison moved to `/how-it-works`. The console's
  section ids are now `register`, `plan`, `policy`, `send`, `ledger` only.
- **The `#console-status` selector.** The status line that names the run mode
  now has a stable id, `#console-status` (in
  `components/console/console-hero.tsx`, read as `role="status"`), used by
  `e2e/fixtures.ts`. Anything that greps or queries for the old inline status
  paragraph needs to target this id instead.
- **The e2e lock for parallel runs.** `POST /api/detent` and
  `/api/fee` rate-limit per client address (`x-forwarded-for`). Every
  Playwright test now gets a random private address from
  `uniqueClientAddress()` in `e2e/fixtures.ts`, injected as
  `extraHTTPHeaders`, so parallel workers never share a rate-limit bucket. A
  new spec that calls the API directly (not through `test`/`expect` from
  `e2e/fixtures.ts`) must set this header itself or it will intermittently see
  429s under `workers: 4` in `playwright.config.ts`.
- **The `DETENT_DESIGN_SYSTEM` flag.** `/design-system` renders unconditionally
  in development. In a production build it answers 404 unless the server runs
  with `DETENT_DESIGN_SYSTEM=1` (checked in `app/design-system/page.tsx`). It
  is never indexed regardless.
