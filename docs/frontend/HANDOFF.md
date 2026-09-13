# Frontend handoff

For the next engineer picking up Detent's frontend. Written at the end of the
Wave 3 to Wave 5 redesign tracked in `docs/frontend/00_INTAKE.md` through
`06_CONTRACTS.md`. Read this file first, then the numbered docs it links to.

## Stack

Versions are the ones pinned in `package.json` on this branch.

| Layer | Package | Version |
| --- | --- | --- |
| Framework | `next` | ^16.3.5 |
| UI | `react`, `react-dom` | ^19.3.0 |
| Language | `typescript` | ^5 (strict) |
| Styling | `tailwindcss`, `@tailwindcss/postcss` | ^4.1.11 |
| Primitives | `@base-ui/react` | ^1.8.0 |
| Icons | `@phosphor-icons/react` | ^2.1.10 |
| Motion | `motion` (imported as `motion/react`) | ^13.2.0 |
| Theme | `next-themes` | ^0.4.6 |
| Command palette | `cmdk` | ^1.1.1 |
| Overlay enter/exit CSS | `tw-animate-css` | ^1.4.0 |
| Class merging | `class-variance-authority`, `clsx`, `tailwind-merge` | ^0.7.1, ^2.1.1, ^3.0.1 |
| Chain client | `viem` | ^2.21.0 |
| Validation | `zod` | ^3.23.8 |
| Unit tests | `vitest`, `@vitest/coverage-v8` | ^2.1.8, ^2.1.9 |
| End to end | `@playwright/test`, `@axe-core/playwright` | 1.63.0, 4.13.0 |
| Compiler | `babel-plugin-react-compiler` | ^1.0.0 (enabled, `next.config.ts`) |

Node: this repo was verified against Node v24.15.0. Next 16 requires Node 20.9
or later.

## Directory map

```
app/
  page.tsx                    the operator console (server component, revalidate 30)
  layout.tsx                  root layout: theme provider, motion provider, shell
  record/[planHash]/          the on-chain record route + its opengraph-image.tsx
  how-it-works/, security/, faucet/, privacy/, terms/   static content pages
  design-system/              living style guide, dev always, prod behind DETENT_DESIGN_SYSTEM=1
  api/detent/route.ts         the only mutating API: intents lock, submit
  api/fee/route.ts            real-mode gas estimate for the plan about to send
  not-found.tsx, error.tsx, global-error.tsx    universal states
  icon.tsx, apple-icon.tsx, manifest.ts, robots.ts, sitemap.ts, opengraph-image.tsx, twitter-image.tsx   metadata routes
  globals.css                 every design token, one keyframe set, the base layer

components/
  ui/          shadcn base-lyra primitives (Button, Card, Dialog, Sheet, Table, Toast, ...)
  design/      Detent-specific primitives (PageHeader, Section, StatusPill, HashText, AddressText, EmptyState, ErrorState, LoadingState, StaleBanner, OfflineBanner, Callout, CodeBlock, ...)
  motion/      Reveal, Stagger, StaggerItem, Presence, NumberTicker (CSS-driven since the perf pass, see below)
  shell/       app-rail, top-bar, mobile-menu(-sheet), command-palette(-dialog), primary-nav, run-mode-status, site-footer, skip-link, brand-mark
  console/     the five section components (register, plan, policy, send, ledger) plus use-console.ts, api.ts, use-browser.ts
  record/      the record page's pieces: timeline, empty states, status pill, chain detail
  content/     architecture-diagram.tsx, used on /how-it-works
  operations-console.tsx      composes the console/** sections; the console page's client entry point
  console-states.tsx          shared empty/error states the console sections reuse
  plates.tsx, policy-explorer.tsx    decorative ledger plates, the explorable policy condition row
  theme-provider.tsx, theme-toggle.tsx

lib/
  adapter.ts        the fake/real adapter seam. Must not import hedera.ts or privy.ts (those import it)
  config.ts          server-only env reads (secrets live here and nowhere else)
  public-config.ts   NEXT_PUBLIC_* reads, safe on the client
  data.ts             the seed register fixture and static product facts
  register.ts         builds the register snapshot from the selected adapter
  hedera.ts           live ATS reads over Hashio (balanceOfByPartition, canTransferByPartition)
  privy.ts             policy compiler, installer, evaluator, revoker (server only, reads PRIVY_APP_SECRET)
  anchor.ts             PlanAnchor read/write (anchor, settle, abandon, planOf)
  plan.ts               plan rows, holds, headroom, calldata, plan hash
  fees.ts               the real-mode gas estimate math, pure apart from injected fetch
  schemas.ts            zod schemas for the API edge
  types.ts              shared types only, safe to import anywhere including client components
  errors.ts             typed API error codes
  store.ts               in-process lock store, rate limiter, idempotency ledger
  wallet-state.ts         client-side wallet/lock state machine
  hashscan.ts             explorer link builders
  motion.ts               duration/easing/spring tokens (motion library types now unused at runtime, see PERF.md item D)
  utils.ts                cn() and the Detent-specific class utilities
  assets.ts               the typed image asset registry (docs/frontend/ASSETS.md)

e2e/            Playwright specs: demo-flow, accessibility, mobile, routes, content, axe, api-contract, plus console.ts and fixtures.ts helpers
tests/          Vitest unit/integration tests, one file per concern (see the list in the repo root)
docs/frontend/  every planning and audit document from this redesign, 00 through UPGRADE_PLAN
```

## How to run

```bash
npm install          # also installs the husky pre-commit hook (lint, typecheck, test)
npm run dev           # http://localhost:3000, seed mode with an empty .env.local
npm run build         # production build, must have zero TypeScript errors and no new warnings
npm run start         # serve the production build
```

## How to test

```bash
npm run typecheck      # tsc --noEmit
npm run lint            # ESLint 9, flat config; next build does not lint
npm run format:check    # Prettier, reports without writing
npm test                # vitest run, unit and integration
npm run test:coverage   # vitest run --coverage
```

## How to run the end to end suite

```bash
npm run test:e2e
```

This builds the app and starts it on port 3120 (`playwright.config.ts`), then
runs two projects, `desktop` (1440x1000) and `mobile` (390x844, touch). It runs
with `workers: 4` and `fullyParallel: true`.

**The lock note for parallel agents or CI runners:** `POST /api/detent` and
`POST /api/fee` rate-limit per client address, trusting `x-forwarded-for`.
`e2e/fixtures.ts` gives every test its own random private address
(`uniqueClientAddress()`) through `extraHTTPHeaders`, so parallel workers never
share a bucket and never trip a 429 that belongs to another test. If you add a
spec that calls the API directly instead of going through the `test`/`expect`
exported from `e2e/fixtures.ts`, set that header yourself. Two other things the
suite depends on: the app runs in seed mode (no env keys) unless you configure
real credentials, and `workers: 4` assumes the Next 16 hydration fix in
`e8dc754` holds (see "Known risks" below).

## Visual regression

TODO: not merged yet as this file is written. `docs/frontend/03_PLAN.md`
assigns visual regression baselines (`tests/visual/**`,
`playwright.visual.config.ts`, `docs/frontend/QA_REPORT.md`) to the `qa` agent
in Wave 4. Neither `tests/visual/` nor `playwright.visual.config.ts` exists on
this branch yet. Check `git log --oneline --first-parent refactor/main` for a
merge after `dcee9a7` before assuming it landed.

## The design system route

`/design-system` renders the full token and component catalogue live. It is
always served in `npm run dev`. In a production build (`npm run build && npm
run start`) it answers 404 unless the server process has
`DETENT_DESIGN_SYSTEM=1` set, and it carries `noindex` regardless of that flag.
Source: `app/design-system/page.tsx` and `app/design-system/demos.tsx`.

## The theming model

`ThemeProvider` (`next-themes`, wired in `app/layout.tsx`) sets
`attribute="class"`, `defaultTheme="system"`, `enableSystem`,
`enableColorScheme`, `disableTransitionOnChange`. The class is written to
`<html>` before first paint, so there is no flash; `<html>` carries
`suppressHydrationWarning` for that one attribute. The dark variant is
`@custom-variant dark (&:where(.dark, .dark *))` in `app/globals.css`. Light
reproduces the `IDENTITY.md` palette exactly; dark is derived, not inverted,
with brighter status colors so they still read as text on a near-black ground.
`ThemeToggle` (`@/components/theme-toggle`) is a labelled three-way radio
(light, dark, system); nothing is marked checked until mount, so server and
client markup match and no hydration warning fires. Full token values and the
derivation rules are in `docs/frontend/04_DESIGN_SYSTEM.md` section 3.

## Token and primitive rules

Full detail: `docs/frontend/04_DESIGN_SYSTEM.md`. The short version every new
line of UI code must follow:

- No raw color outside `app/globals.css`. Use the semantic utilities
  (`bg-card`, `text-destructive`, `border-hold-refused`).
- No arbitrary Tailwind value, except CSS variable shorthands
  (`z-(--z-modal)`), grid templates for tables and two-column layouts, and
  whatever ships inside `components/ui/**` from shadcn itself. Reading widths
  use `max-w-measure-*`, never `max-w-[..ch]`.
- No inline `style` except on Motion components, where Motion writes it.
- Every interactive element comes from `components/ui` or `components/design`,
  never a bare `<button>` or `<input>`.
- A status is never color-only; a word sits next to it.
- Navigation is a link, never a `Button`: use `buttonVariants()` on `<a>` or
  `<Link>`, imported from `@/components/ui/button-variants`.
- A token change updates `components/design/tokens.ts`;
  `tests/design-system.test.ts` fails otherwise, and fails if any published
  pair drops below WCAG AA.

## Page template and contracts

Full detail: `docs/frontend/06_CONTRACTS.md`. Every route needs: a `metadata`
export (title, description, `alternates.canonical`), one `h1`, a `PageHeader`
from `@/components/design`, a `Section` per section with an `id` and heading,
one hero `Reveal` and at most one `Stagger` per section from
`@/components/motion`, correct layout at 375, 768, 1024 and 1440px with no
horizontal scroll, a logical tab order, visible focus, and both themes.
`app/layout.tsx` owns the skip link, the shell (rail or top bar), `<main
id="main" tabIndex={-1}>`, the footer and the global offline banner; a page
component renders only its own content.

## The e2e pinned labels, and why

`DEMO.md` (repo root) is the demo contract: the six-step recorded walk
through the console, and the exact anchors, button labels and status texts
that walk depends on. `06_CONTRACTS.md` section 4 repeats the load-bearing
subset for the redesign. The short version: section ids `register`, `plan`,
`policy`, `send`, `ledger`; button labels including "Distribute quarterly
coupon", "Lock this plan to the treasury key", "Send edited plan", "Execute the
approved plan"; status texts including "2 of 2 signatures collected.",
"Signature refused", "Synthetic receipt, nothing on chain"; and the headings
"Detent" and "On chain plan record". These strings are asserted directly by
`e2e/demo-flow.spec.ts`, `e2e/accessibility.spec.ts` and `e2e/console.ts`
because the recorded demo video narrates the same screen and cannot be
reshot on a whim. If you rename or restructure any of them, update the owning
spec (and, if the change is visible on camera, flag it to whoever re-records
`DEMO.md`'s video) in the same commit. `#console-status` is the stable
selector `e2e/fixtures.ts` reads for the run-mode status line.

## Run modes and env vars that change the UI

Two independent switches, both read at the top of the console fold
(`#console-status`). Full table: `.env.example` at the repo root.

| Switch | Off (default) | On |
| --- | --- | --- |
| `NEXT_PUBLIC_ADAPTER_MODE=real` + `NEXT_PUBLIC_ATS_TOKEN_ADDRESS` | "Cached register": the seed fixture from `fixtures/register.seed.json` | "Live read from Hedera testnet": `lib/hedera.ts` reads `balanceOfByPartition` / `canTransferByPartition` |
| `NEXT_PUBLIC_ADAPTER_MODE=real` + `PRIVY_APP_ID` + `PRIVY_APP_SECRET` | "Treasury key, policy evaluated locally": `lib/privy.ts` evaluates the compiled policy in-process | "Privy server wallet": policy installed on a real Privy server wallet under a key quorum |

Other env-driven UI behavior worth knowing:

- `NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS` set: treasury cover and headroom are
  read on chain instead of the seed figure.
- In real mode, the send section's fee line calls `app/api/fee/route.ts`
  (`eth_estimateGas` + `eth_gasPrice` against the configured relay, converted
  to HBAR). In the fake adapter it always reads the fixed sentence "No fee:
  local mirror, nothing is broadcast" (`lib/fees.ts`,
  `MIRROR_FEE_SENTENCE`). This path is written and unit-tested but has never
  run against a live relay in this environment (see "Known risks").
- `OPERATOR_PRIVATE_KEY` and `NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS` unset: the
  record route and the audit entry both render their documented "not
  configured" / "unwired" state rather than a broken link.
- `DETENT_DESIGN_SYSTEM=1`: see "The design system route" above.

## Performance budgets and current numbers

Source: `docs/frontend/PERF.md`, measured on `refactor/main` at `4bd9cb5` with
`fa0b989` and `df9125b` merged in (before the a11y and assets merges, and
before whatever the parallel motion/a11y-fix agents land after this file is
written). **TODO(orchestrator): re-measure after the motion and a11y fix
agents merge**, since both can plausibly move bytes or the LCP path.

| Gate | Budget | Measured | Pass |
| --- | --- | --- | --- |
| Lighthouse mobile Performance, `/` | ≥ 80 | 92 | yes |
| Accessibility, Best Practices, SEO | 100 each | 100, 100, 100 | yes |
| LCP, mobile `/` | < 2.0s | 3.32s (simulated) | no, and was not met before the redesign either (2.5s on Next 15.5) |
| CLS | < 0.05 | 0 | yes |
| TBT | < 150ms | 8ms | yes |
| Initial JS, `/`, gzip | < 300 kB | 280.3 kB | yes |
| React #418 under 60 parallel cold loads | 0 | 0 | yes |

Same-origin JS gzip by route: `/` 280.3 kB, `/how-it-works` 217.8 kB,
`/record/[hash]` 216.9 kB, `/nope` 174.5 kB (down from 341.5 / 279.2 / 278.5 /
246.3 kB before the perf pass). The LCP gap is mostly first-party console and
design-system code; `PERF.md` section "Proposed changes for other owners" has
five unapplied diffs (toast region after hydration, tooltip popup on demand,
prefetch on the console's "How it works" link, stale doc comments naming the
deleted `MotionProvider`, and moving the first plan computation server-side to
drop viem from the first load) that whoever owns those files next should
evaluate.

## Accessibility status

Source: `docs/frontend/A11Y_AUDIT.md`, a read-only audit beyond what
`e2e/axe.spec.ts` and `e2e/accessibility.spec.ts` already gate (those two
require zero serious/critical axe findings and pass one keyboard walk; the
audit covers WCAG 2.2's newer criteria, reflow, forced colors, and a wider
keyboard walk). No source file was changed to produce it.

All six findings are fixed on `refactor/main` (merge `1399f9e`), and each has
a **Status: fixed** line with its evidence in `A11Y_AUDIT.md`:

- A11Y-01, forced colors: a `@media (forced-colors: active)` block in
  `app/globals.css` draws a system coloured focus outline and gives buttons,
  badges, status pills and inputs a real border.
- A11Y-02, reflow: no horizontal scroll at 320 px on any public route or through
  the full demo. Buttons wrap (`whitespace-nowrap` removed from
  `components/ui/button-variants.ts`), the policy grid has a single column base,
  and prose elements break long tokens with `overflow-wrap: anywhere`.
- A11Y-03, dialog focus: `components/ui/focus-loop.ts` keeps Tab and Shift Tab
  inside the command palette and the mobile sheet, with focus returning to the
  trigger on close.
- A11Y-04, tooltips: collision padding and shift in `components/ui/tooltip.tsx`.
- A11Y-05, table headers: `scope="col"` by default in `components/ui/table.tsx`.
- A11Y-06, target size: a 24 px hit area on tooltip triggers.

`e2e/a11y-regressions.spec.ts` guards the forced colors outline, 320 px reflow,
the focus loops and header scope. The audit's 14 passing categories (target
size, reduced motion, landmarks, heading outline, `aria-current`, live
regions, and the full keyboard walk) still apply. Not run: Safari, Firefox, a
real phone and a VoiceOver pass (see `QA_REPORT.md`).

## Known risks and open items

Collected from `docs/REMAINING_WORK.md`, `PERF.md`'s unapplied proposals,
the audit, and direct checks against this tree.

- **Hydration.** An intermittent React #418 existed under parallel cold loads
  on Next 15.5 (2 in 120); `e8dc754`'s Next 16 upgrade measured 0 of 60 in two
  separate runs, which is why `playwright.config.ts` now runs 4 workers
  instead of 1. If it reappears, drop `workers` back down before anything
  else.
- **Unreferenced public files.** `public/demo-video.mp4` (6.8 MB),
  `public/brand/og.png` (542 KB, a duplicate of `app/opengraph-image.png`'s
  old content, now superseded by the generated `app/opengraph-image.tsx`),
  and `public/logo.svg` (a wordmark nothing imports) are all dead weight per
  `PERF.md` and `ASSETS.md`. `public/__farm.txt` looks unreferenced too but is
  kept on purpose (deployment fingerprint the author's tooling reads, see
  `docs/REMAINING_WORK.md`). Do not delete `__farm.txt`; the other three are
  safe to remove after confirming nothing else links to them.
- **The real-mode fee path has never run live.** `lib/fees.ts` and
  `app/api/fee/route.ts` are unit-tested against a mocked fetch, but no ATS
  token or Hedera relay call has actually exercised `eth_estimateGas` /
  `eth_gasPrice` in this environment, because no token has been issued (see
  next item).
- **`PlanAnchor` is not deployed.** No Hedera testnet address exists for it.
  `/record/[planHash]` renders its "anchor not configured" state, and the
  audit record carries a note instead of a HashScan link. Deploying it is two
  Foundry commands from `contracts/`, documented in `README.md`'s "On chain
  proof" section; it needs a funded testnet account.
- **The command palette and mobile sheet focus trap** (A11Y-03 above) needs
  either a `@base-ui/react` version bump or an app-level workaround; it is not
  a one-line fix and needs a judgment call from whoever owns
  `components/ui/sheet.tsx` and `components/shell/command-palette-dialog.tsx`.
- **Vitest dev-only advisories.** `npm audit --omit=dev` is clean; `npm audit`
  reports 6 advisories, all inside vitest 2.1.9's dev/UI server tooling
  (path traversal and file read in servers the test scripts never start). The
  fix is vitest 5, three majors up, deliberately deferred (see
  `docs/REMAINING_WORK.md`).
- **`e2e/routes.spec.ts` record assertions** are explicitly called out in
  `06_CONTRACTS.md` section 7 as needing coordination between the app-shell
  and page-record owners through their reports; check both agents' final
  reports before assuming this spec is fully consistent with the rebuilt
  record page.
- **Visual regression is not merged** (see "Visual regression" above);
  `docs/frontend/QA_REPORT.md` does not exist yet.

## What needs the author

Nothing in this list can be finished by an agent working from this machine.

- **Push.** Nothing on `refactor/main` (or `docs/handoff`) has been pushed to
  the remote. Every agent works locally, no merge and no push, by design.
- **Deploy `PlanAnchor`.** Needs a funded Hedera testnet ECDSA account (the
  official faucet requires a reCAPTCHA and cannot be automated) and running
  the two commands in `README.md`'s "On chain proof" section.
- **Issue the ATS token and fund the demo accounts.** Needs 40 to 120 HBAR
  depending on gas limits, and the ATS factory or web app.
- **Privy setup.** A Privy app, a server wallet, a key quorum of threshold
  two, and authorization keys, so the "Privy server wallet" half of the run
  mode line and the real send path can be exercised at all.
- **Vercel env.** Every real-mode variable in `.env.example` needs setting in
  the Vercel project once the above exist, plus deciding whether
  `DETENT_DESIGN_SYSTEM=1` should ever be set in production.
- **Video.** `DEMO.md`'s shot list assumes the six-step walk on the redesigned
  console; the current demo video predates this redesign and needs
  re-recording once the visual and a11y fixes above have landed and, ideally,
  once `PlanAnchor` is deployed so step 6 shows a real record instead of the
  unwired state.
