# Changelog

Refactor and bug-fix pass on top of `v0.1-hackathon`. Findings are referenced by
the ids in `docs/AUDIT.md`. Each section is one workstream branch merged into
`refactor/main`.

## Build (coordinator)

| Severity | Change | Rationale |
| --- | --- | --- |
| Critical | `postcss.config.mjs` switched to the object plugin form (C4). | vite, and therefore vitest, rejected the array form, so `npm test` exited 1 with zero tests on a fresh clone while the README documents that command. Next accepts both forms; the build is unchanged. |

## Contracts (`refactor/contracts`)

| Severity | Change | Rationale |
| --- | --- | --- |
| Medium | Test suite rewritten: 5 tests to 34, 3 fuzz to 9, 100% line, statement, branch and function coverage on `PlanAnchor.sol` (M5). | Access control on `settle` and `abandon`, the `abandon` path and the `AlreadyAnchored` and `NotAnchored` reverts were never asserted. Both terminal paths and every illegal transition are now covered, including the paused and unpaused gate. |
| Low | Pragma pinned to `0.8.24` in the contract, the test and both scripts (L1). | Matched the compiler `foundry.toml` actually builds with. |
| Low | Input validation with custom errors: `InvalidPlanHash`, `InvalidToken`, `InvalidSelector`, `InvalidTxReference`, `InvalidReason` with a 256 byte bound (L2). | The zero address was accepted for `token`, and a zero reference could be written as a settlement. |
| Low | `settledAt` renamed to `closedAt` (L3). | `abandon` wrote a field named for settlement on the one path that is not a settlement. |
| Low | `Plan` struct reordered to pack into two slots (L4). | `anchor` max gas 140,079 to 118,229, `planOf` 9,022 to 7,072, measured with `forge test --gas-report`. |
| Low | `evm_version = "shanghai"` and a `[fmt]` section in `foundry.toml`. | Hedera's EVM is Shanghai-equivalent; foundry otherwise targeted cancun for 0.8.24. |
| Low | Deploy docs use `cast wallet import` and `--account` instead of `--private-key`; `Smoke.s.sol` refuses to broadcast against an empty or codeless `DEPLOYED_CONTRACT`. | Keeps the operator key out of shell history and prevents a smoke run against nothing. |
| Note | Interface change: the `Plan` struct field order and the `closedAt` name change the `planOf` return ABI. No function signature changed. | The contract has never been deployed, so no live consumer is affected; `lib/anchor.ts` is updated in the backend workstream. |

## Testing and CI (`refactor/testing`)

| Severity | Change | Rationale |
| --- | --- | --- |
| High | `app/api/detent/route.ts` covered end to end by invoking the route handlers directly: happy lock and submit, tampered calldata, malformed body, schema error hints, unknown intent, quorum refusal, blocked plan, idempotent resubmission, and an error envelope that leaks no provider body or stack. | The only server entry point had no test. |
| High | Plan hashes and calldata pinned to fixed literals, and the coupon payload decoded with an independent ABI and compared against fixture values. | The previous calldata assertion was self-referential: the policy was compiled from `plan.calldata` and then validated against the same value, so an encoding regression would pass. |
| Medium | `lib/anchor.ts` and `lib/hedera.ts` covered without network: unwired branches, unusable operator key, chain definition, step naming, dead relay error mapping with a stubbed fetch, adapter mode gate. | Both modules had no tests. |
| Medium | Hold detection moved from the seed script into the suite; zod boundaries covered for formats, widths, checksums, missing and mistyped fields, and error path naming. | Compliance holds were asserted only by a script nobody runs in CI. |
| Medium | `.github/workflows/ci.yml`: install, typecheck, test and build for the app, plus `forge build` and `forge test` for the contracts, as two parallel jobs with read-only permissions and per-ref concurrency. | The repository had no CI. |
| Low | Coverage thresholds set just below the measured baseline: statements 62, branches 78, functions 64, lines 62. | Honest about the current state rather than aspirational, so regressions fail without inventing a target. |

## Frontend (`refactor/frontend`)

| Severity | Change | Rationale |
| --- | --- | --- |
| High | Explorer links are produced only for addresses that exist on chain; seed and fixture addresses render as plain text with the existing honest note, across the rail, the send card, the audit record and the record page (H1). | The live page linked a fixture address to HashScan. Hedera testnet returns empty code for it and the explorer page is a 404. |
| High | A synthetic receipt renders as synthetic: "Signed, nothing broadcast", a warning line and a plain-text hash with no link, in the banner and in the audit record (H2, render side). | A calldata-derived stub hash was shown as a HashScan link beside a "Signed" badge with nothing marking it synthetic. |
| Low | `hashscanAccount` removed (L5). | Dead export; the only treasury account on screen is a fixture and would not qualify for a link under the rule above. |
| Low | Touch targets raised to 44 px on rail rows, the destination address, receipt and audit record links, and the record page (L9). | Four in-text links fell below a 40 px target at a 390 px viewport. |
| Medium | Status line, refusal and mode line announced through live regions; plan table, comparison table and policy strip keyboard focusable; a misplaced `aria-current` removed. | The refusal, the moment the product exists for, was not announced to assistive technology. |
| Low | Unchecked address casts in `lib/public-config.ts` replaced with `parseEvmAddress`; `CHAIN_ID` can no longer be `NaN`; the API response read through `readApiResponse`. | Removed casts that could carry a malformed env value into the UI. |
| Note | Fonts left on `next/font/google` (L8). | Production builds inline the fonts at build time; the 29 second delay was dev-only, and `display: swap` with fallbacks is already set. |

## Developer experience, dependencies and docs (`refactor/dx`)

| Severity | Change | Rationale |
| --- | --- | --- |
| High | `HANDOFF.md` and `.farm-delta.md` removed from the tracked tree and ignored; the `.gitignore` comment rewritten in English (H4). | An internal build briefing and absolute paths from the author's machine were published in a public repository. Both files remain in git history. |
| High | README rewritten into one consistent account: what runs today, what is written and tested but not deployed, and the variables and commands that turn each half on (H3). | One section said issuance, configuration and a lifecycle operation happen on testnet; another said nothing is on chain. Nothing is deployed. |
| Medium | README states that the ATS reads are hand-rolled viem ABI calls and that `@hashgraph/asset-tokenization-sdk` is not installed. | The previous wording implied SDK adoption the code does not have. |
| Medium | ESLint 9 flat config with the Next core-web-vitals and TypeScript presets plus Prettier compatibility; `lint`, `lint:fix` and `format` scripts; zero errors and zero warnings (M8). | There was no linter, and `next build` skipped linting silently. |
| Medium | Husky pre-commit running lint, typecheck and test; `typecheck` and `test:coverage` scripts; `@vitest/coverage-v8` pinned to the vitest minor. | Requested by the testing workstream so the checks CI runs also run locally. |
| Medium | `overrides.postcss` set to `^8.5.28`; `npm audit --omit=dev` reports zero advisories (L12). | next 15.5.25 pins a vulnerable postcss; the registry's suggested fix is a major upgrade to next 16, which is not safe four days before a deadline. |
| Low | `contracts/cache/`, `contracts/out/` and `coverage/` ignored; a duplicate `!.env.example` removed (L11). | Build output was untracked but not ignored. |
| Low | `docs/VIDEO.md` clarifies that 2:05 was the shot plan and the recording runs 3:01 (L6); `DELIVERY.md` checklist item replaced with a check that the video link resolves (L7); `docs/SCREENSHOTS.md` states that no screenshots are captured (M9). | Removed contradictions and a promise the repository did not keep. |
| Low | `.env.example` verified against every variable the code reads: sixteen listed, none dead, no real values. | Keeps setup honest for a reader cloning the repository. |
| Note | Deliberately not upgraded: next 16, TypeScript 7, zod 4 (abitype under viem still requires zod 3) and vitest beyond 2.1.x. | All majors with breaking changes, inside a deadline window. |
