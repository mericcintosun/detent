# CLAUDE.md

Permanent working notes for anyone (human or agent) editing this repo.
Read `IDENTITY.md` (with its amendments, most recently the Wave 1 design
system amendment) for the design contract, `docs/frontend/04_DESIGN_SYSTEM.md`
for the token and primitive rules it produced, `docs/frontend/06_CONTRACTS.md`
for the page template and per-area contracts, and `DEMO.md` for the demo
contract. `docs/frontend/HANDOFF.md` is the longer-form engineering handoff;
this file stays short on purpose.

## Build commands

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # must pass with zero TypeScript errors before every commit
npm run lint      # ESLint 9, flat config; next build does not lint
npm run typecheck # tsc --noEmit, the same check CI runs
npm test          # vitest: edge schemas, the policy evaluator, the design system contrast check
npm run test:coverage
npm run test:e2e  # Playwright, builds the app and serves it on :3120, see the lock note below
npm run seed      # validates fixtures/register.seed.json, writes the report file
```

`npm run format` writes Prettier over the tree; run it on its own commit,
never inside a feature commit.

`npm install` installs a husky pre-commit hook that runs lint, typecheck and
the test suite. It is the same gate CI runs, so a commit that passes locally
passes there. `git commit --no-verify` skips it; do that only for a commit
that cannot build by design.

**The e2e lock note for parallel agents.** `POST /api/detent` and
`POST /api/fee` rate-limit per client address (`x-forwarded-for`).
`e2e/fixtures.ts` gives every Playwright test its own random private address
so parallel workers (`workers: 4` in `playwright.config.ts`) never share a
rate-limit bucket. A new spec that talks to the API directly, without the
`test`/`expect` exported from `e2e/fixtures.ts`, must set that header itself
or it will see intermittent 429s.

Contract commands live in `contracts/README.md`. Foundry is not wired into the
npm scripts on purpose.

## The design contract

`IDENTITY.md` is append-only: the block at the top (ground, ink, accent, type,
archetype, radius, motion) is fixed, and every later decision is a dated line
under "Amendments", never an edit to the block above. The Wave 1 amendment
(13 September 2026) is the one in force now: two themes (light and dark,
system-aware), a full motion token set through `lib/motion.ts`, a semantic
color token set with success/warning/info/mirror roles, and JetBrains Mono for
hashes and addresses. `docs/frontend/04_DESIGN_SYSTEM.md` is the reference for
every token value, contrast pair and component convention that amendment
produced. `docs/frontend/06_CONTRACTS.md` is the page template and per-area
contract every route and every agent-owned area builds against; if something
in it looks wrong or missing, stop and report rather than working around it.

## Hard rules

- No raw color anywhere outside `app/globals.css`. Use the semantic utilities
  (`bg-card`, `text-destructive`, `border-hold-refused`), never a hex literal
  in a component.
- No arbitrary Tailwind value, except CSS variable shorthands
  (`z-(--z-modal)`, `duration-(--duration-fast)`), grid templates for tables
  and two-column layouts, and whatever ships inside `components/ui/**` from
  shadcn itself. Reading widths use `max-w-measure-*`, never `max-w-[..ch]`.
- No inline `style` except on Motion components (`components/motion/**`),
  where Motion writes it.
- No em dashes anywhere: not in code comments, not in commit messages, not in
  any Markdown file, not in UI copy.
- The end to end suite pins section ids, button labels and status texts (see
  `DEMO.md` and `docs/frontend/06_CONTRACTS.md` section 4). A change that
  renames or restructures any of them updates the owning spec in the same
  commit.
- No secrets in a tracked file. Every `process.env.X` read in the repo has a
  matching `X=` line in `.env.example`, and that file only ever holds a
  variable name, never a real value.
- Every interactive or surface element goes through `components/ui/*` or
  `components/design/*` with `cn()`. A bare `<button>` or `<input>` in a page
  is a defect.
- `Button` has no `asChild`. Style a link with `buttonVariants()` from
  `@/components/ui/button-variants`, or use `render` for a Base UI trigger.

## Stack pitfalls

- Next.js 16 App Router, React Compiler on (`reactCompiler: true` in
  `next.config.ts`). `params` and `searchParams` are Promises, so await them.
- TypeScript strict. No `any`, no unused imports, no unused locals.
- Tailwind v4. There is no `tailwind.config.js` and no `@tailwind` directives.
  Tokens are declared in `app/globals.css` under `:root`, `.dark` and
  `@theme inline`.
- `lib/privy.ts` is server only, it reads `PRIVY_APP_SECRET`. Never import it
  from a client component. Shared types live in `lib/types.ts`, which is types
  only and safe to import anywhere.
- `lib/adapter.ts` must not import `lib/hedera.ts` or `lib/privy.ts`. Those two
  import the adapter, so the reverse direction would cycle.
- `motion/react` components are `m.*`, never `motion.*`, and only inside
  `components/motion/**`. Do not import `motion/react` directly in a page or a
  console/record/content component.

## Where things live

- `components/ui/**`: shadcn base-lyra primitives (Base UI underneath).
- `components/design/**`: Detent-specific primitives (PageHeader, Section,
  StatusPill, HashText, AddressText, EmptyState, ErrorState, LoadingState).
- `components/motion/**`: Reveal, Stagger, Presence, NumberTicker.
- `components/shell/**`: the persistent left rail, mobile top bar and sheet,
  command palette, footer, skip link. `app/layout.tsx` mounts the shell; a
  page renders only its own content, no page-level `<main>` or footer.
- `components/console/**`: the five console sections (register, plan,
  policy, send, ledger); `components/operations-console.tsx` composes them.
- `components/record/**`: the on-chain record page's pieces.
- `components/content/**`: the how-it-works architecture diagram.
- `lib/**`: see `docs/frontend/HANDOFF.md`'s directory map for the full list
  and what each module is allowed to import.
- `docs/frontend/`: every planning and audit document from the redesign;
  `HANDOFF.md` and `CHANGELOG_FRONTEND.md` are the two written for a new
  engineer, the numbered files (00 to 06 plus PERF, A11Y_AUDIT, ASSETS,
  UPGRADE_PLAN) are the working record of how the redesign got here.

## Folders never to touch

- `public/brand/` (the pre-generated rasters, one mark per page; `LOGO_POLICY`
  in `IDENTITY.md` is raster-only)
- Everything in `IDENTITY.md` above the "Amendments" line. That block is
  append-only: add a dated line under Amendments instead.
- `app/icon.tsx`, `app/apple-icon.tsx`, `app/manifest.ts`, `app/robots.ts`,
  `app/sitemap.ts`, `app/opengraph-image.tsx`, `app/twitter-image.tsx`: these
  are the generated metadata routes; there is no static
  `app/opengraph-image.png` any more, do not add one back.

## Vercel guardrails

No runtime filesystem writes in app code; build-time and `scripts/seed.mjs` may
write. `useSearchParams` only under a `Suspense` boundary. No Node-only API on an
edge path, no custom server, no `output: export`, standard Next build only. Every
`process.env.X` read in the repo has a matching `X=` line in `.env.example`. No
fixed pixel width on a container; every table, code block, long hash and address
sits in its own `overflow-x-auto` wrapper or uses `break-all`.

## Context

When compacting preserve the list of modified files and test commands.
