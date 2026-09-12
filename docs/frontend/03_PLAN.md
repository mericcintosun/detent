# 03 Plan

The work breakdown for the frontend pass, adapted from the master prompt to this
repository. It depends on the four open questions in `00_INTAKE.md` and the
findings in `02_AUDIT.md`. Nothing below starts before the author's go.

## Constraints that shape every wave

- The submission deadline is 16 September 2026.
- `IDENTITY.md` is the design contract: one light theme, sharp radius, the
  fonts it names, one keyframe, and no new colour, font, radius or motion value
  without a dated amendment.
- The end to end suite pins section ids (`#register`, `#plan`, `#policy`,
  `#send`, `#ledger`) and button and text labels listed in `02_AUDIT.md`. A wave
  that renames one updates `e2e/` in the same change.
- Both run modes stay first class: the keyless mode on the public URL and the
  live mode with a token and Privy credentials. The fold's status line names the
  mode and must keep doing so.
- `next build`, `npm test`, `npm run test:coverage`, `npm run test:e2e`, lint and
  typecheck stay green after every merge.

## Two tracks

**Track A, within the identity contract (recommended before the deadline).**
Close the gaps, complete the state coverage, add the universal pages, build the
design system documentation and a living style guide from the tokens that
already exist, add visual regression baselines, and pass the quality gates. No
dependency is added that ships to the browser, and no contract value changes
except where a quality gate forces it, recorded as an amendment.

**Track B, the master prompt defaults.** Adopt the shadcn CLI on the Radix
primitive layer with a sharp style, add Motion, add a dark theme, and upgrade to
Next.js 16. Each item is a separate decision because each one amends
`IDENTITY.md` or adds risk in the deadline window. The recommendation is to take
Track B after the submission, one item at a time, in the order listed in
`UPGRADE_PLAN.md`.

## Track A waves

| Wave | Agent | Model tier | Owns exclusively |
| --- | --- | --- | --- |
| 1 | design-system | top | `app/globals.css` (documented, not revalued), `components/ui/*`, new `components/design/*` layout and text primitives mapped to existing tokens, `lib/motion.ts` exposing the existing motion tokens, `app/design-system/page.tsx` (development only, noindex), `docs/frontend/04_DESIGN_SYSTEM.md` with computed contrast ratios |
| 2 | app-shell | top | `app/layout.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, `app/error.tsx`, `components/rail.tsx`, `components/section-progress.tsx` |
| 2 | page-console | mid | `app/page.tsx`, `components/operations-console.tsx`, `components/console-states.tsx`, `components/policy-explorer.tsx`, `components/plates.tsx`: the states the audit marks missing, with no section id or label change |
| 2 | page-record | mid | `app/record/**` |
| 2 | page-legal-seo | fast | `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/sitemap.ts`, `app/robots.ts`, `app/manifest.ts`, `docs/frontend/05_IA.md` |
| 3 | motion | top | read mostly; `docs/frontend/07_MOTION.md` listing every animated treatment, its purpose, duration, easing and reduced motion path |
| 3 | a11y | mid | small diffs limited to aria, focus and contrast, coordinated with the owner of the touched file |
| 3 | perf | mid | read mostly; bundle and Lighthouse findings with proposed diffs handed to the owning agent. First target: mobile LCP measured at 2.5 s against a 2.0 s budget, most likely because the largest text block starts its entrance animation at zero opacity |
| 4 | qa | top | `tests/visual/**` baselines at 375, 768 and 1440 px, a `test:visual` script, `docs/frontend/QA_REPORT.md` |
| 5 | assets | mid | `docs/frontend/ASSETS.md`, prompts anchored on the existing engraved plate family |
| 5 | docs | fast | `docs/frontend/HANDOFF.md`, `docs/frontend/CHANGELOG_FRONTEND.md` |

The orchestrator owns `package.json`, the lockfile, `next.config.ts`,
`playwright.config.ts`, `e2e/**`, `IDENTITY.md` amendments, every merge, and
`docs/frontend/06_CONTRACTS.md`, published after Wave 1 so Wave 2 builds against
it. Each agent works in its own git worktree on its own branch and reports in
the master prompt's format.

## Gates, adapted

- Typecheck, lint, unit tests with coverage thresholds, production build with no
  new warnings, the full end to end suite.
- axe: zero critical and zero serious violations on `/` at rest, `/` in the
  signed and refused states, the record page and the not found page, at 390 and
  1440 px, with and without reduced motion. Scans wait for the entrance
  animation to settle: mid animation, partly transparent text reports a
  transient contrast failure that is not present at rest.
- Lighthouse on `/`, mobile: Performance at least 80 for an app page, and
  Accessibility, Best Practices and SEO at 100. The baseline already scores 97,
  100, 100 and 100, so the gate protects it rather than chasing it, and LCP must
  come under 2.0 s.
- Visual regression at three widths, single theme.
- Initial JS stays under the 300 KB app budget.

## Marked SKIP, with the reason

- Marketing, auth, onboarding, settings, dashboard analytics, docs and
  e-commerce page sets: Detent is one operator console with a record route.
- Wallet connect modal, portfolio, faucet and token selector: the treasury wallet
  is a Privy server wallet and the operator never connects a browser wallet.
- A toast system: the treasury key banner is the feedback surface and is
  announced through a live region.
- Dark theme, Motion, the shadcn CLI and Next.js 16: Track B, pending the
  author's decisions.
