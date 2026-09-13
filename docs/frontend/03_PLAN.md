# 03 Plan

The execution plan for the master prompt's full track, decided by the author on
13 September 2026. `00_INTAKE.md` records the decisions and `02_AUDIT.md` the
baseline. The submission deadline is 16 September 2026; the author accepted the
risk of a framework upgrade and a redesign inside that window.

## Sequence

| Wave | What | Agents | Gate before the next wave |
| --- | --- | --- | --- |
| 0 | Next.js 16 upgrade, React Compiler and Cache Components if green, loading boundary and hydration measurements | next-upgrade | every existing gate green on Next 16 |
| 1 | Design system: shadcn on Base UI with the Lyra style, OKLCH light and dark tokens seeded from the brand palette, typography, spacing, elevation and motion tokens, Motion primitives, design primitives, the `/design-system` route, `04_DESIGN_SYSTEM.md`, the `IDENTITY.md` amendment | design-system | tokens and primitives published; orchestrator writes `06_CONTRACTS.md` |
| 2 | Shell and pages, in parallel | app-shell, page-console, page-record, page-content (which also takes the privacy and terms pages; the metadata routes already merged) | each branch green, merged in the order shell, console, record, content |
| 3 | Polish, read mostly, in parallel | motion, a11y, perf | `07_MOTION.md`, zero serious axe findings, budgets met |
| 4 | Quality | qa | visual baselines at 375, 768 and 1440 px in light and dark, `QA_REPORT.md` |
| 5 | Assets and handoff | assets, docs | `ASSETS.md`, `HANDOFF.md`, `CHANGELOG_FRONTEND.md` |

## Ownership

Ownership is exclusive. Each agent works in its own git worktree on its own
branch and edits nothing outside its row; anything it needs elsewhere goes into
its report.

| Agent | Model tier | Owns |
| --- | --- | --- |
| next-upgrade | top | `package.json`, lockfile, `next.config.ts`, `eslint.config.mjs`, `tsconfig.json`, caching and segment config in `app/page.tsx` and `app/record/[planHash]/page.tsx`, the worker count in `playwright.config.ts` |
| design-system | top | `app/globals.css`, `components.json`, `components/ui/**`, `components/design/**`, `components/motion/**`, `lib/motion.ts`, `lib/utils.ts`, `app/design-system/**`, the theme provider and font setup in `app/layout.tsx`, `IDENTITY.md`, `docs/frontend/04_DESIGN_SYSTEM.md`, dependencies it adds |
| app-shell | top | `app/layout.tsx` after Wave 1, `components/shell/**`, `components/rail.tsx`, `components/section-progress.tsx`, `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`, `app/loading.tsx`, `proxy.ts`, `e2e/routes.spec.ts` |
| page-console | mid | `app/page.tsx`, `components/operations-console.tsx` and any `components/console/**` it splits into, `components/console-states.tsx`, `components/policy-explorer.tsx`, `components/plates.tsx`, `lib/wallet-state.ts`, `lib/hashscan.ts`, UI helpers in `lib/plan.ts`, a new `lib/fees.ts`, `tests/frontend.test.ts`, `tests/ui-defects.test.ts`, `e2e/console.ts`, `e2e/fixtures.ts`, `e2e/demo-flow.spec.ts`, `e2e/accessibility.spec.ts`, `e2e/mobile.spec.ts` |
| page-record | mid | `app/record/**`, `components/record/**` |
| page-content | mid | `app/how-it-works/**`, `app/security/**`, `app/faucet/**`, `components/content/**` |
| page-legal-seo | fast | `app/privacy/**`, `app/terms/**`, `app/sitemap.ts`, `app/robots.ts`, `app/manifest.ts`, `app/opengraph-image.tsx`, `app/icon.*`, `app/apple-icon.*` |
| motion | top | `*.motion.tsx` wrappers and motion props, `docs/frontend/07_MOTION.md` |
| a11y | mid | small aria, focus and contrast diffs, agreed with the file's owner |
| perf | mid | findings and proposed diffs handed to owners |
| qa | top | `tests/visual/**`, `playwright.visual.config.ts`, `docs/frontend/QA_REPORT.md` |
| assets | mid | `docs/frontend/ASSETS.md`, `lib/assets.ts` |
| docs | fast | `docs/frontend/HANDOFF.md`, `docs/frontend/CHANGELOG_FRONTEND.md`, the frontend section of `README.md` |

The orchestrator owns every merge, `package.json` and the lockfile after Wave 1,
`next.config.ts` after Wave 0, `playwright.config.ts`, `e2e/api-contract.spec.ts`,
and `docs/frontend/00`, `01`, `02`, `03`, `05` and `06`. Subagent definitions live
in `.claude/agents/`.

## Rules every agent follows

- Build against `06_CONTRACTS.md`; never define a token, colour, spacing or motion
  value outside the design system.
- Every page: metadata, the states in Section 6.8 of the master prompt, 375, 768,
  1024 and 1440 px, a keyboard path, a reduced motion path, light and dark.
- A change that renames a section id, a button or a text the end to end suite
  asserts updates the owning spec in the same commit.
- Both run modes keep working and the fold's status line keeps naming the mode.
- Conventional commits through the pre-commit hook, no push.

## Gates

Typecheck, lint, format, unit tests with coverage thresholds, production build
with no new warnings, the full end to end suite, visual regression at three
widths in two themes, axe with zero critical and serious findings after the
entrance animation settles, Lighthouse on `/` mobile with Performance at least 80
and Accessibility, Best Practices and SEO at 100, LCP under 2.0 s, and initial JS
under the 300 KB app budget.

## Marked SKIP, with the reason

- Marketing, auth, onboarding, settings, dashboard analytics, docs and
  e-commerce page sets: Detent is an operator console with explanatory pages.
- Wallet connect modal, portfolio and token selector: the treasury wallet is a
  Privy server wallet and the operator never connects a browser wallet.
- `/cookies`: the app sets no cookies.
