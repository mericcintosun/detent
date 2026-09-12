# Changelog

Refactor and bug-fix pass on top of `v0.1-hackathon`. Findings are referenced by
the ids in `docs/AUDIT.md`. Each section is one workstream branch merged into
`refactor/main`.

## Build (coordinator)

| Severity | Change | Rationale |
| --- | --- | --- |
| Critical | `postcss.config.mjs` switched to the object plugin form (C4). | vite, and therefore vitest, rejected the array form, so `npm test` exited 1 with zero tests on a fresh clone while the README documents that command. Next accepts both forms; the build is unchanged. |
| Low | Prettier applied once across the code in its own commit after every workstream merged; Markdown excluded through `.prettierignore`. | Formatting in a single commit keeps the behavioural diffs reviewable, and running it after the merges meant parallel branches never conflicted on whitespace. |
| Low | The deprecated `settledAt` mirror and the never emitted `recompiled-from-approved-plan` member of `SubmitResult.policySource` were removed once the console stopped reading them. | Both existed only to keep the build green while the API changed underneath the console. |

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

## Backend and API (`refactor/backend`)

| Severity | Change | Rationale |
| --- | --- | --- |
| Critical | The compiled policy is bound to the treasury wallet: the wallet is read, the policy is created with `POST /v1/policies`, bound with `PATCH /v1/wallets/{id}` carrying `policy_ids`, and after the send the previous list is restored before the policy is revoked. The lock is refused when binding fails. The local mirror now explains decisions and never makes them on the live path (C1). | Nothing in Privy constrained the treasury key; the policy was created and never attached. Privy allows one policy per wallet and the PATCH replaces the whole list, which is why the previous list is saved and restored. |
| Critical | The server derives the plan itself on both intents and rejects a mismatch with `plan_mismatch`. `lock` returns a server generated lock id; `submit` accepts only that id, and a lock the instance does not hold is refused with `lock_unknown`. The policy is never compiled from request data (C2). | On a cold instance the route rebuilt the policy from the request body, so every condition came from the caller and evaluation always allowed. |
| Critical | Approvals resolve against a server side registry of officers; each must be a distinct registered signer, and the approvers are stored in the lock record (C3). | Any two distinct strings satisfied the quorum. This is still not cryptographic without real authentication, and `SECURITY.md` states that limit. |
| High | A keyless send returns a typed synthetic receipt with a reference and no `transactionHash`; an on-chain receipt carries the hash and the broadcast path (H2). | A stub derived from the calldata was returned in the field a real transaction hash occupies. |
| High | `lock` accepts an optional operator token header, is rate limited per IP, and anchor writes are idempotent per server derived plan hash and capped per hour (H6). | Unauthenticated repeated locks could drain the operator account through anchor transactions. |
| High | Blockers are enforced on both `lock` and `submit`, from the server derived plan (H7). | A compliance held row could reach payout calldata through a direct submit. |
| High | Cross-request state lives in a bounded store with server minted keys, a TTL and size eviction (H8). | Client chosen deterministic keys with no bound let one visitor overwrite another's record on a warm instance. |
| Medium | Request arrays and strings are capped: 500 rows and 8 approvals (M1); a fixed window per-IP limiter answers 429 with `Retry-After` (M2); contract reads are memoized briefly with a bounded cache (M3); settle refuses a zero or non 32 byte reference (M4); `tampered` is derived on the server from the calldata (M6); the response names the deciding engine in `decidedBy`, and `live` now only reports whether credentials are configured (M7). | Each closed an unbounded input, an abuse path, or a client controlled value written into the audit record. |
| Medium | The three `TODO` comments are gone; `lib/hedera.ts` now states plainly that the Asset Tokenization Studio reads are hand written viem ABI calls (M10). | Shipped TODOs, one of them stating the SDK was never adopted. |
| Note | `lib/anchor.ts` decodes the new `PlanAnchor` struct with `closedAt`, and the plan target reads `NEXT_PUBLIC_ATS_TOKEN_ADDRESS` in real mode. | Follows the contract interface change and makes the destination link able to match a live token. |
| Note | Intentional behaviour changes: a submit reaching an instance that does not hold the lock is refused; a successful submit consumes the lock while a refused one keeps it open; a synthetic receipt does not settle a plan on chain; only registered officers can approve. | Each is the fail closed consequence of the fixes above and is documented in `SECURITY.md`. |

## Testing and CI (`refactor/testing`)

| Severity | Change | Rationale |
| --- | --- | --- |
| High | `app/api/detent/route.ts` covered end to end by invoking the route handlers directly: happy lock and submit, tampered calldata, malformed body, schema error hints, unknown intent, quorum refusal, blocked plan, idempotent resubmission, and an error envelope that leaks no provider body or stack. | The only server entry point had no test. |
| High | Plan hashes and calldata pinned to fixed literals, and the coupon payload decoded with an independent ABI and compared against fixture values. | The previous calldata assertion was self-referential: the policy was compiled from `plan.calldata` and then validated against the same value, so an encoding regression would pass. |
| Medium | `lib/anchor.ts` and `lib/hedera.ts` covered without network: unwired branches, unusable operator key, chain definition, step naming, dead relay error mapping with a stubbed fetch, adapter mode gate. | Both modules had no tests. |
| Medium | Hold detection moved from the seed script into the suite; zod boundaries covered for formats, widths, checksums, missing and mistyped fields, and error path naming. | Compliance holds were asserted only by a script nobody runs in CI. |
| Medium | `.github/workflows/ci.yml`: install, typecheck, test and build for the app, plus `forge build` and `forge test` for the contracts, as two parallel jobs with read-only permissions and per-ref concurrency. | The repository had no CI. |
| High | The backend fixes are locked by regression tests: `lock_unknown` for a lock the server does not hold (C2), `quorum_not_met` for unregistered approvers (C3), `429` with `Retry-After` on repeated locks (H6), `plan_blocked` on submit when the treasury falls short under an open lock (H7), 500 rows accepted and 501 refused (M1), `plan_mismatch`, a server derived `tampered` flag, a synthetic receipt with no transaction hash, and a lock that survives a refused submit but is consumed by a successful one. | Tests first written to document the open findings were converted into guarantees once the fixes landed, so a regression now fails the suite. |
| Low | The stack trace assertion matches real frame patterns instead of the substring "at ". | It flagged the legitimate message "The request failed validation at approvals." as a leaked trace. |
| Low | Coverage thresholds set just below the final measured baseline: statements 69, branches 87, functions 82, lines 69. The suite grew from 18 tests to 174. | Honest about the current state rather than aspirational, so regressions fail without inventing a target. |
| Medium | Regression tests for network free branches: the title and action of every failure code including the `Retry-After` wait rules, the display helpers, the `DetentError` defaults, the empty zod issue path, the chain id and broadcast mode fallbacks, and the rule that a receipt which does not name itself is synthetic and never linked. | The frontend integration had pushed branch coverage below its threshold, and these branches decide what an operator reads at the worst moment. |
| Medium | CI runs the linter and enforces the coverage thresholds with `npm run test:coverage` instead of plain `npm test`. | Thresholds are only checked when coverage runs and lint ran only in the local hook, so before this neither could fail a CI build. |
| Low | The treasury key state tests assert the receipt kind rules: `tx-confirmed` for on-chain and synthetic receipts, `tx-failed` for an allowed verdict with no receipt, and `wrong-network` only from a failure that names the chain. | The chain refusal flag the old test relied on could only be set by the removed recompile path. |

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
| High | The console speaks the fail closed API: `lock` sends the plan selection and registered officer ids, the server issued lock id is held, and `submit` sends only the lock id, the submitted rows and the broadcast preference. The client side submission key and calldata recomputation are gone. | The previous request shape is refused by the hardened route, which would have broken the demo at the refusal step. |
| Medium | `lock_unknown` returns the operator to the lock step with approvals kept, a "Lock the plan again" prompt and an audit record line; `plan_mismatch`, `plan_blocked`, `quorum_not_met` and `429` each render a titled message beside the step that can act on it, with the `Retry-After` wait shown. | Every new server refusal is explained where the operator can respond, rather than surfacing as a generic failure. |
| Medium | "Refused by" and the banner's engine label come from `decidedBy`; the fixed "policy source" badge is removed; a synthetic receipt shows its reference as plain text and never links. | `live` no longer means the wallet decided, and a synthetic reference is not a transaction. |
| Low | The record page reads `closedAt` and labels the row "Closed at". | PlanAnchor closes an abandoned plan with the same field it closes a settled one. |

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

## Verification round: dry runs, browser exploration and end to end

Findings from executing the project rather than reading it: a real broadcast of
both Foundry scripts on anvil, a simulation against Hedera testnet, an API
behaviour matrix against a production build, a mock of the Privy REST API that
records every request, and a Chromium walk through every page, state and edge
interaction.

| Severity | Change | Rationale |
| --- | --- | --- |
| High | `Deploy.s.sol` no longer reverts after deploying: printing goes through a low-level staticcall to forge's console instead of a typed interface call. | Solidity checks that a high-level call target has code, and the console address has none on anvil, on Hedera or in a test, so the documented deploy command could not have worked anywhere. Found by the deployment dry run and covered by `contracts/test/Scripts.t.sol`, which runs both scripts end to end. |
| Medium | `Smoke.s.sol` is safe to repeat: it anchors and settles an unknown plan, only settles a plan an interrupted run left anchored, and sends nothing for a closed plan. | A retry after a relay error used to revert with `AlreadyAnchored` and leave the smoke row unsettled. |
| Low | `contracts/broadcast/` is ignored, the README deploy commands use the keystore flow, and the Foundry suite is 37 tests with 9 of them fuzz. | Broadcast records were untracked but not ignored, and the README still passed the key on the command line. |
| Note | Dry run evidence: both scripts broadcast on anvil (deploy, smoke, a repeated smoke that sends nothing, one anchored row), and a full simulation against Hedera testnet estimating 1,540,792 gas at 1,200 gwei, about 1.85 HBAR. | Nothing was broadcast to testnet. The only faucet that funds an EVM address without an account requires a reCAPTCHA. |
| Note | API matrix against a production build: 52 scenarios across both corporate actions, 47 as documented. Of the other five, two are the documented idempotent replay of an identical submit and three are malformed record URLs answering 200 instead of 404. | Lock and submit median latency about 2 ms on localhost; the lock store evicts at its bound and memory returns to baseline after 2,000 distinct locks. |
| High | The live register read now matches how an ATS token answers: compliance is checked with `canTransferByPartition` from a configured treasury, balances and checks use a configurable partition that defaults to ATS's default partition, and a refusal is decoded from the EIP-1066 status byte and the ATS error selector, computed from the ATS error signatures. An unrecognised refusal stays held and shows its raw codes. | Found in the ATS v8 source: `canTransfer` reverts on a multi partition token, checks the caller rather than the holder, and never returns the reason codes the old mapping expected, so a real token would have shown all twelve holders as blocked. A dry run against a mock ATS token rendered twelve holders, nine clear and three held with the right reasons. |
| Medium | A missing treasury address to check from is a configuration error: the register falls back to the cached seed and says why in the log and in the register note. | A live compliance check without a sender cannot answer the question it asks, and a silent wrong answer is worse than a named fallback. |
| High | A Playwright end-to-end suite runs the seven step demo, the second corporate action, the record and not found routes, keyboard operation and live regions, the 390 px flow, and the API contract over real HTTP. Every test fails on a console error, a page error or a same origin 5xx. CI runs it as its own job and uploads the HTML report when it fails. | The unit suite could not see a broken page, a hydration error or a real request shape. The 26 tests run in about 15 seconds against a production build. |
| Note | The end-to-end suite runs with one worker for now. | Parallel cold loads exposed an intermittent client hydration error. One worker keeps the console guard strict instead of loosening it, and the worker count goes back up once that race is fixed. |
| Critical | Every request to Privy now matches the published API: the policy is owned through `owner_id`, calldata conditions use `ethereum_calldata` with the ABI, and the wallet RPC carries `chain_type`. | Against a mock that enforces the documented shapes, the previous policy creation was rejected on the first lock, so the live path could not have worked. |
| Critical | No payment or policy creation is retried blindly: a retry reuses the same `privy-idempotency-key`, and a response that never arrives is reported as an unknown result to check on HashScan. | A timeout used to resend `eth_sendTransaction` without a key, which on a real network can pay twice. |
| High | Every exit cleans up: a refused binding, a failed or timed out send, and a lock expiring from the store all restore the wallet's previous policy list and revoke the policy. | The policy used to be left orphaned in Privy or still attached to the treasury wallet. |
| High | The Privy authorization signature is produced from the published algorithm when `PRIVY_AUTHORIZATION_KEYS` is set, so an owned wallet and a quorum owned policy can be bound, used and revoked. | Without it the binding on an owned wallet was refused and the lock could never open. |
| High | A tampered payload is refused by the server before it reaches the wallet. | Privy's calldata conditions cannot compare the coupon's holder and amount arrays, so the installed policy pins the chain, the contract, the function and the partition, and the server enforces the exact calldata. `SECURITY.md` states this limit. |
| Medium | Failed locks and sends each write one log line with the error code and the provider status, and malformed requests count toward a per-IP limit that runs before the body is read. | Failures were invisible in the server log, and a flood of invalid bodies was never limited. |
