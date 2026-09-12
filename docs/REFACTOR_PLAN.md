# Refactor plan

Baseline: `refactor/main` at the audit commit. Findings are referenced by the
ids in `docs/AUDIT.md`.

## Workstreams and file ownership

Each workstream owns its paths exclusively. No workstream edits a path it does
not own; anything it wants changed elsewhere goes into its report instead.

| Branch | Owns | Findings |
| --- | --- | --- |
| `refactor/contracts` | `contracts/**` | M5, L1, L2, L3, L4 |
| `refactor/backend` | `app/api/**`, `lib/{privy,anchor,hedera,plan,register,adapter,schemas,store,config,errors,data,types}.ts`, `SECURITY.md` | C1, C2, C3, H2, H6, H7, H8, M1, M2, M3, M4, M6, M7, M10 (two of three) |
| `refactor/frontend` | `app/{page,layout,error,loading,not-found}.tsx`, `app/record/**`, `app/globals.css`, `components/**`, `lib/{hashscan,public-config,wallet-state,utils}.ts` | H1, H2 (render side), L5, L8, L9 |
| `refactor/testing` | `tests/**`, `vitest.config.ts`, `.github/**` | C4 (verified), section 3 of the audit |
| `refactor/dx` | `package.json`, `.gitignore`, `.env.example`, `README.md`, `next.config.ts`, `tsconfig.json`, `HANDOFF.md`, `.farm-delta.md`, `DELIVERY.md`, `DEMO.md`, `CLAUDE.md`, `docs/{VIDEO,SCREENSHOTS}.md`, linter and formatter config | H3, H4, M8, M9, L6, L7, L10, L11, L12 |

Coordinator owns `docs/{AUDIT,REFACTOR_PLAN,CHANGELOG,REMAINING_WORK}.md`,
`postcss.config.mjs`, and every merge.

## Sequencing

All five run in parallel in separate git worktrees, then merge in this order:
contracts, backend, frontend, testing, dx. Backend before frontend because the
refusal and receipt payload shape is a backend decision the console renders.

## Out of scope

`SUBMISSION.md` carries the prize submission copy and the AI and commit history
declarations. Those are non-technical deliverables and a decision for the author,
so no workstream edits that file; the audit records the two false claims in it.
The demo video, the deck and the brand assets are untouched.

## Definition of done

`npm run build`, `npx tsc --noEmit`, `npm test`, `forge build` and `forge test`
all green on `refactor/main` after every merge, with no new warnings, and every
bug fix carrying a regression test.
