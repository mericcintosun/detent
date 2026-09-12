# Audit, pre-refactor state

Date: 2026-09-12. Commit audited: `96d1dbc`, tag `v0.1-hackathon`.
Method: fresh clone from GitHub, five independent review passes (claims versus
code, build and tests, security and contracts, live deployment, prize fit), plus
direct probes against Hedera testnet and the deployed site.

## 1. Toolchain state

| Command | Result | Time |
| --- | --- | --- |
| `npm install` | OK, 105 packages, lockfile untouched | 4.3 s |
| `npx tsc --noEmit` | OK, zero errors under strict | 2.2 s |
| `npm test` | **FAILS, exit 1, zero tests executed** | 1.3 s |
| `npx vitest run` (after the postcss fix) | 18 of 18 pass | 4.5 s |
| `npm run build` | OK, 7 routes, no warnings | 86 s |
| `forge build` | OK, solc 0.8.24 | 20 s |
| `forge test -vv` | 5 of 5 pass, 3 of them fuzz | 0.2 s |
| `npm run lint` | Script does not exist, no linter installed | - |
| CI | No workflow, `.github/` absent | - |

`npm test` failure, verbatim:

```
Failed to load PostCSS config: [TypeError] Invalid PostCSS Plugin found at: plugins[0]
(@/Users/.../detent/postcss.config.mjs)
```

Cause: `postcss.config.mjs` uses the Next array form `plugins: ["@tailwindcss/postcss"]`,
which vite 5 (under vitest) rejects. The object form is accepted by both.

## 2. Findings by severity

### Critical

| ID | Finding | Evidence |
| --- | --- | --- |
| C1 | The compiled Privy policy is never attached to a wallet. No `policy_ids` assignment and no `PATCH /v1/wallets/{id}` call exists anywhere, so nothing in Privy constrains the treasury key. The product's central claim, "the preview is the signing limit", is enforced only by the app's own local mirror. | `lib/privy.ts`, whole file |
| C2 | `POST /api/detent` with intent `submit` recompiles the policy from the `approvedPlan` in the request body when the in-memory vault is cold. Every policy condition then derives from attacker-supplied data, so evaluation always ALLOWs. The route has no authentication. With live Privy credentials this signs and broadcasts a transaction the operator never saw. | `app/api/detent/route.ts:118-150` |
| C3 | The approval quorum is a client-supplied string array. `quorumSatisfied` only checks that the set has two entries, so `{"approvals":["a","b"]}` opens the lock. | `app/api/detent/route.ts:92`, `lib/privy.ts:251-253`, `lib/schemas.ts:77` |
| C4 | `npm test` does not run on a fresh clone, and the README documents that exact command. A judge running it sees exit 1 and zero tests. | `postcss.config.mjs`, `README.md:385` |

### High

| ID | Finding | Evidence |
| --- | --- | --- |
| H1 | The live page links "BMEQ on HashScan" and "Destination contract" to `0x4b7d0e91c358af260d1e7b04c93f5a68d20e17bc`, a seed fixture address. Hedera testnet returns `eth_getCode = 0x` for it and HashScan renders a 404. A source comment in the same component states that an empty explorer link is worse than no link. | `components/rail.tsx:44`, `components/operations-console.tsx:868`, `lib/data.ts:78` |
| H2 | After a successful send with no credentials, the transaction hash is a stub derived from the first 32 bytes of the calldata, and the console renders it unconditionally as a HashScan link next to a "Signed" badge, with nothing on screen marking it synthetic. | `lib/privy.ts:503`, `components/operations-console.tsx:974-982` |
| H3 | `README.md` contradicts itself: one section states issuance, configuration and a lifecycle operation all happen on testnet, another states that nothing is on chain today. Nothing is deployed: no ATS token, no `PlanAnchor`, no transaction hash anywhere in the repo. | `README.md:128` versus `README.md:346` |
| H4 | The repository publishes its build pipeline: `HANDOFF.md` is a 125 KB agent briefing opening with "You are picking up a working Next.js scaffold", `.farm-delta.md` embeds absolute local paths from the author's machine, and `.gitignore` carries a Turkish comment in an otherwise English repo. | `HANDOFF.md:1-5`, `.farm-delta.md:5`, `.gitignore:15` |
| H5 | `SUBMISSION.md` claims the commit history runs across the whole event. 59 of 60 commits land inside a five hour window on a single day. | `SUBMISSION.md:95` |
| H6 | The `lock` intent is unauthenticated and each call writes an `anchor` transaction with a 1,500,000 gas limit using `OPERATOR_PRIVATE_KEY`. `planHash` comes from the client, so the `AlreadyAnchored` guard never trips on repeated calls. A loop drains the operator account. | `app/api/detent/route.ts:106`, `lib/anchor.ts:242-249` |
| H7 | `blockers` are checked on `lock` but never on `submit`, so a compliance-held row can reach payout calldata through a direct API call. | `app/api/detent/route.ts:88` versus `:118` |
| H8 | The shared in-memory store is keyed by client-chosen `submissionKey` and `policyId`, both deterministic, with no TTL and no size bound. One visitor can pre-seed or overwrite another visitor's record on the same warm instance. | `lib/store.ts:30,45`, `app/api/detent/route.ts:98,125,173` |

### Medium

| ID | Finding | Evidence |
| --- | --- | --- |
| M1 | Request arrays are unbounded, so a large `rows` payload drives `encodeFunctionData` and `keccak256` without limit. | `lib/schemas.ts:60,84` |
| M2 | No rate limiting, no auth, no CORS policy on the public API route. | `app/api/detent/route.ts:65` |
| M3 | `/record/[planHash]` performs one contract read per unique hash with no memo or bound once an address is configured. | `app/record/[planHash]/page.tsx:31,63` |
| M4 | `settleRecord` zero-pads a reference that is not 32 bytes and writes it on chain as if it were a real transaction reference. | `lib/anchor.ts:289-292` |
| M5 | Contract tests omit `onlyOperator` on `settle` and `abandon`, never call `abandon`, and never assert the `AlreadyAnchored` or `NotAnchored` reverts. | `contracts/test/PlanAnchor.t.sol` |
| M6 | The `tampered` flag is client supplied and is written into the audit record verbatim. | `app/api/detent/route.ts:118,168` |
| M7 | The local policy mirror returns `live: true` whenever Privy credentials exist, so a refusal produced locally can be labelled as coming from the wallet. | `lib/privy.ts:515-525` |
| M8 | No linter, no formatter, no CI, no pre-commit hook. `next build` silently skips linting. | repo root |
| M9 | `docs/SCREENSHOTS.md` specifies ten fallback screenshots; `docs/screenshots/` does not exist. | `docs/` |
| M10 | Three `TODO` comments ship in production code, one of them stating the ATS SDK was never adopted. | `lib/hedera.ts:115`, `app/api/detent/route.ts:33`, `lib/privy.ts:494` |

### Low

| ID | Finding | Evidence |
| --- | --- | --- |
| L1 | `pragma ^0.8.20` is open while `foundry.toml` pins 0.8.24. | `contracts/src/PlanAnchor.sol:2` |
| L2 | `anchor()` does not reject the zero address for `token`. | `contracts/src/PlanAnchor.sol:71-88` |
| L3 | `abandon` writes `settledAt`, which misnames the field. | `contracts/src/PlanAnchor.sol:116` |
| L4 | The `Plan` struct occupies three storage slots and packs into two if reordered. | `contracts/src/PlanAnchor.sol:19-26` |
| L5 | `hashscanAccount` is exported and documented but never called. | `lib/hashscan.ts:17` |
| L6 | Video duration is stated as 3:01 in the README and 2:05 in `docs/VIDEO.md`. | `README.md:20`, `docs/VIDEO.md:38` |
| L7 | `DELIVERY.md` still lists a checklist item for a placeholder that no longer exists. | `DELIVERY.md:61` |
| L8 | `next/font/google` fetches at request time in dev; on a restricted network the first render took 29 s and logged a download failure before falling back. | `app/layout.tsx` |
| L9 | Four in-text links fall below a 40 px touch target on a 390 px viewport. | `components/rail.tsx`, `components/operations-console.tsx` |
| L10 | `og.png` and `app/opengraph-image.png` are the same 542 KB bytes committed twice; `logo.png` is 830 KB. | `public/brand/`, `app/` |
| L11 | `contracts/cache/` is untracked but not ignored. | `.gitignore` |
| L12 | Production dependency advisory: one high severity postcss advisory reachable through next; dev-only vitest advisory is out of the shipped surface. | `npm audit --omit=dev` |

## 3. Untested critical paths

`app/api/detent/route.ts` is never exercised end to end. `lib/anchor.ts` and
`lib/hedera.ts` have no tests at all. The plan hash derivation is not pinned to a
fixed expected value, and the calldata assertion is self-referential: the policy
is compiled from `plan.calldata` and then validated against the same value, so an
ABI encoding regression would pass. Hold detection is asserted only inside the
seed script.

## 4. What is solid and must not regress

The policy compiler and evaluator are real: four pinned conditions over
`default_action: DENY`, a genuine byte-by-byte divergence offset, and 18 tests
that assert behaviour rather than truthiness. The Privy REST request shapes match
the documented API, including basic auth, the app id header, `owner.key_quorum_id`
and the `eip155:296` CAIP-2 identifier. `lib/plan.ts` is deterministic and uses
real viem ABI encoding with a keccak plan hash. The server and client config
split holds: no secret reaches a client component, an API response or a log line.
`app/error.tsx` prints nothing from the error object. Every external link is built
from one constant, and there is no `dangerouslySetInnerHTML` anywhere.
`app/record/[planHash]` validates its parameter as 0x plus 64 hex before use.
The seven step demo passes on desktop and at 390 px with zero console errors.

## 5. Blocked, needs credentials or funds

Deploying `PlanAnchor` to Hedera testnet, issuing an Asset Tokenization Studio
token, and exercising the live Privy path all require accounts, keys and testnet
funds that are not present in this environment. Every fix below is therefore
written to be correct under live credentials and verified by test rather than by
a live run. See `docs/REMAINING_WORK.md`.
