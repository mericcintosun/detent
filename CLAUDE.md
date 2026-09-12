# CLAUDE.md

Permanent working notes for anyone (human or agent) editing this repo.
Read `IDENTITY.md` for the design contract and `DEMO.md` for the demo contract.

## Build commands

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # must pass with zero TypeScript errors before every commit
npm run lint    # ESLint 9, flat config; next build does not lint
npm test        # vitest: the edge schemas and the policy evaluator
npm run seed    # validates fixtures/register.seed.json, writes the report file
```

`npm run format` writes Prettier over the tree and has not been run yet, so it
touches a lot of lines. Run it on its own commit, never inside a feature commit.

Contract commands live in `contracts/README.md`. Foundry is not wired into the
npm scripts on purpose.

## Stack pitfalls

- Next.js 15 App Router. `params` and `searchParams` are Promises, so await them.
- TypeScript strict. No `any`, no unused imports, no unused locals.
- Tailwind v4. There is no `tailwind.config.js` and no `@tailwind` directives.
  Tokens are declared in `app/globals.css` under `:root` and `@theme inline`.
- `lib/privy.ts` is server only, it reads `PRIVY_APP_SECRET`. Never import it
  from a client component. Shared types live in `lib/types.ts`, which is types
  only and safe to import anywhere.
- `lib/adapter.ts` must not import `lib/hedera.ts` or `lib/privy.ts`. Those two
  import the adapter, so the reverse direction would cycle.
- Every interactive or surface element goes through `components/ui/*` with
  `cn()`. A bare `<button>` or `<input>` in a page is a defect.
- No raw hex colour in a component. Tokens only.

## Folders never to touch

- `public/brand/` (the pre-generated rasters, one mark per page)
- `app/opengraph-image.png` (already the OG image, never add `opengraph-image.tsx`)
- Everything in `IDENTITY.md` above the "Amendments" line. That block is
  append-only: add a dated line under Amendments instead.

## Vercel guardrails

No runtime filesystem writes in app code; build-time and `scripts/seed.mjs` may
write. `useSearchParams` only under a `Suspense` boundary. No Node-only API on an
edge path, no custom server, no `output: export`, standard Next build only. Every
`process.env.X` read in the repo has a matching `X=` line in `.env.example`. No
fixed pixel width on a container; every table, code block, long hash and address
sits in its own `overflow-x-auto` wrapper or uses `break-all`.

## Context

When compacting preserve the list of modified files and test commands.
