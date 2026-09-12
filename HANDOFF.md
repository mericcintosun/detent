# Detent, build handoff

You are picking up a working Next.js scaffold and finishing it into a hackathon
submission. Read this file top to bottom before touching anything, then start at
"Mission".

## 1. Context

**Product:** Detent.
**One-liner:** Operator console for tokenized securities: preview a coupon run
or a forced transfer line by line, then lock the treasury wallet to exactly that
transaction.

**Plain pitch.** The person who administers a company's digital shares has to
pay a coupon to every shareholder each quarter. They open Detent, choose
"distribute coupon", and read the payout list on screen: who gets what, whose
record is incomplete so the payment would fail, how much the treasury is short.
If the list looks right they approve it, a second officer approves it too, and
the payment goes out. After that approval the treasury key can only perform that
exact list. Change a single number by hand and the transaction is refused. When
it is done, the key gets its general authority back.

**Hackathon:** ETHOnline 2026 (ETHGlobal, online).
**Submission deadline:** 2026-09-16 05:00 UTC. This scaffold was written on
2026-09-12, so there are roughly four days left.
**Target track:** Tokenization of Anything (Hedera), $6,000, up to 3 teams at
$2,000 each.
**Second bounty:** Best B2B financial product (Privy), $2,500, single slot.
Both are opt-in on the submission form. The event allows at most 3 bounties per
project, so there is one free slot if time appears; do not spend build hours on
it.

**Verified submission requirements (from the event and prize pages):**

- A repo under version control with a visible commit history. No single-commit
  entries on the final day.
- A demo video. The Hedera track caps it at five minutes and requires it to show
  issuance, configuration, and at least one lifecycle operation. Aim for two
  minutes.
- A project description.
- Any pre-existing code must be declared. Classic track code must be written
  from the event start; this repo is the event's work.
- For each partner prize, an explanation of how you used the sponsor's tools,
  plus feedback and comments.
- Hedera track specifics: use Asset Tokenization Studio (SDK, contracts, web app
  or any combination), deploy and demo on Hedera testnet, public GitHub repo,
  verify contracts on HashScan where applicable. Extra credit is written for
  compliance controls, scheduled transactions, custom fee schedules, oracle
  integration, secondary markets and upstream contributions.
- Privy track specifics: Privy at the core of the product, at least one Privy
  wallet, a business use case, at least one B2B flow (payment, approval,
  treasury operation, wallet administration), at least one Privy control
  (policies, signers, key quorums, intents), a working demo and source, and an
  explanation of how Privy made the product possible.

**Judging criteria (unweighted, as published):** creativity, functionality,
technical difficulty, impact of the solution.

**Unverified, check before you rely on it:** the general video length cap for
this event (only the Hedera five minute cap is confirmed), the three bounty per
project limit, and whether Privy supports `eth_sendTransaction` on Hedera
testnet (`eip155:296`). If Privy will not broadcast to 296, take the signature
from Privy and broadcast through Hashio yourself. The policy still governs the
signing request, so the product claim survives intact. Do this rather than
switching chains.

## 2. Current state

Identity: see IDENTITY.md (direction D11 museum, archetype L6 rail). The palette,
fonts, radius, motion signature and header treatment are a contract; the file is
append-only, so add dated lines under Amendments rather than editing the block.

One-mark proof, the entire brand link in `components/rail.tsx`:

```tsx
<Link
  href="/"
  className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
>
  <Image
    src="/brand/logo.png"
    alt=""
    width={44}
    height={44}
    priority
    className="h-11 w-11 object-contain"
  />
  <span className="font-display text-2xl tracking-tight">Detent</span>
</Link>
```

One raster mark plus the product name as text, and the rail renders no other
brand image anywhere.

**File map**

| File | What it does |
| --- | --- |
| `IDENTITY.md` | The design contract. Colours, fonts, archetype, motion, radius. |
| `app/layout.tsx` | Loads Libre Caslon Text and Libre Franklin, metadata, renders the rail plus the content pane. |
| `app/page.tsx` | Server component. Pulls the register snapshot, renders the console and the prose fold. |
| `app/globals.css` | Every colour token, the `detent-wipe` motion signature, the reduced-motion block. |
| `app/api/detent/route.ts` | Two intents: `lock` compiles and installs the policy, `submit` evaluates a payload against it. Holds locked policies in an in-process map. |
| `components/rail.tsx` | The persistent left rail: mark, section nav, the single CTA, network line. |
| `components/operations-console.tsx` | The whole operator surface. Action picker, plan table, quorum, policy card, send and refuse, audit record, download. Client component. |
| `lib/data.ts` | The seed register: 12 holders, the ATS token, the treasury, the two corporate actions, the coupon rate. |
| `lib/plan.ts` | The plan engine. Builds rows, flags holds, computes headroom, encodes calldata with viem, hashes the plan. |
| `lib/hedera.ts` | ATS / Hedera adapter. Real reads when configured, cached register otherwise. |
| `lib/privy.ts` | Privy policy compiler, local evaluator, and the REST client for policies and wallet RPC. |
| `lib/store.ts` | The only owner of cross-request state: the policy vault and the submission ledger. |
| `lib/register.ts` | The register entry point the page imports, in front of `lib/hedera.ts`. |
| `lib/anchor.ts` | PlanAnchor client: anchor on lock, settle or abandon on send, read before write. |
| `lib/wallet-state.ts` | The eight treasury key states and the pure function that derives them. |
| `components/console-states.tsx` | The banner, the skeleton, the send error surface and the three empty states. |
| `contracts/src/PlanAnchor.sol` | Anchors and settles plan hashes on chain. |
| `contracts/script/Deploy.s.sol`, `Smoke.s.sol` | Deploy, then one real interaction for proof. |
| `public/brand/logo.png`, `public/brand/og.png` | Pre-generated brand rasters. `logo.png` is the one mark per page, in the rail. `og.png` is no longer rendered in the console: Phase 4 replaced the masthead figure with the register note block. |
| `app/record/[planHash]/page.tsx` | Demo step 6. Reads `planOf` off `PlanAnchor` and renders the permanent record. Server component, no key needed. |
| `DELIVERY.md` | The human's submission checklist: the opt-in checkbox string per bounty, and what to paste where. |
| `public/logo.svg`, `app/icon.svg`, `public/illustrations/ledger-rule.svg` | Text-only wordmark for OG reuse, favicon, the ruled paper behind the plan header. |
| `app/opengraph-image.png` | Already the OG image. Do not add an `opengraph-image.tsx`. |

**What is real**

- The plan engine. Rows, holds, headroom, ABI encoding through viem, and the
  keccak plan hash are all real and deterministic.
- The policy compiler and evaluator in `lib/privy.ts`. The rule shape matches
  Privy's schema and the evaluation logic is the same one that would run server
  side, which is why the refusal message can name the failing condition and the
  diverging byte.
- `PlanAnchor.sol`. Small, complete, ready to deploy.

**What is mocked, by function name**

- `getRegisterSnapshot()` in `lib/hedera.ts` returns the seed register unless
  `NEXT_PUBLIC_ATS_TOKEN_ADDRESS` is set. The live branch is written and reads
  `balanceOfByPartition` and `canTransfer`; it has not been run against a real
  token yet. It also swallows relay failures and falls back, which is deliberate
  for demo safety but hides errors while you develop: log inside the catch while
  you are wiring it up.
- `installPolicy()`, `submitTransaction()` and `revokePolicy()` in
  `lib/privy.ts` take the local path unless `PRIVY_APP_ID` and
  `PRIVY_APP_SECRET` are set. The local path returns a stub transaction hash
  derived from the calldata, so the HashScan link in the audit record is dead
  until Privy is live.
- Nothing calls `PlanAnchor` from the app yet. That wiring is feature 5 below.
- The approvals in `components/operations-console.tsx` are two named signers in
  seed data, not real Privy quorum signatures. `quorumSatisfied()` in
  `lib/privy.ts` enforces the threshold server side; connecting it to real
  quorum members is part of feature 3.

## 3. Mission

Build order, with what "done" looks like on screen. Total is about 11.5 hours of
build plus 3 hours of documentation, video and submission.

**Feature 1. Issue the ATS token and light up the live register. 3 hours.**
Set up the ATS monorepo (`npm run ats:setup`), fund a Hedera testnet account
from the portal, and break the hollow account trap by sending the first
transaction with your own key as fee payer. Issue an Equity token through the
ATS factory, configure roles and the allowlist, distribute to the twelve test
holders in `lib/data.ts` so the addresses match, and verify on Sourcify for
chain 296. Then set `NEXT_PUBLIC_ATS_TOKEN_ADDRESS` and confirm the console
badge flips from "Cached register" to "Live read from Hedera testnet" with real
balances and three genuinely held rows.
Done on screen: the masthead shows the real token address, the HashScan badge,
twelve holders, and the compliance holds come from the contract's own reason
codes.

**Feature 2. Harden the plan engine against the live register. 1.5 hours.**
`buildPlan` already handles both actions, but it reads the treasury balance from
seed data. Read the settlement asset balance on chain, handle a holder set that
is not exactly twelve rows, and make sure the forced transfer path picks its
subject from live compliance state rather than the seeded `sanctions-hold` flag.
Done on screen: change a balance on chain, reload, and the plan totals move.

**Feature 3. Real Privy policy, key quorum and revoke. 2.5 hours.**
Create the treasury server wallet with `POST /v1/wallets`, create a key quorum
with threshold two, and set `PRIVY_KEY_QUORUM_ID`. Verify the policy install
returns a real id, that the wallet RPC signs under it, and that the revoke
actually removes the rule (read it back before and after). If Privy will not
broadcast to `eip155:296`, switch `submitTransaction` to request a signature and
broadcast through Hashio with viem; keep the policy on the signing request.
Done on screen: the policy card shows "Installed on Privy" with a real policy
id, and the receipt links to a live HashScan transaction.

**Feature 4. The wow moment. 1.5 hours. Schedule this last but rehearse it most.**
The refusal already works end to end against the compiled policy. What is left
is making it unmistakable on camera: the edited row highlighted in the plan
while the refusal is on screen, the failing condition and the byte offset large
enough to read in a compressed recording, and a one-click reset back to the
approved plan so the second take is immediate. Then send the untouched plan and
let it through with the same wallet and the same policy.
Done on screen: amount changed by hand, refusal with a readable reason, then the
same wallet signs the untouched plan and HashScan opens.

**Feature 5. Anchor, proof line and audit export. 1.5 hours.**
The contract phase runs here. Deploy `PlanAnchor` and run its smoke script, the
same commands `contracts/README.md` carries:

```bash
cd contracts
forge build
export RPC_URL=https://testnet.hashio.io/api
forge script script/Deploy.s.sol --rpc-url $RPC_URL \
  --private-key $FARM_EVM_PRIVATE_KEY --broadcast --legacy
export DEPLOYED_CONTRACT=0xYourDeployedAnchor
forge script script/Smoke.s.sol --rpc-url $RPC_URL \
  --private-key $FARM_EVM_PRIVATE_KEY --broadcast --legacy
```

`--legacy` is not optional: the Hedera relay rejects the typed transactions
Foundry sends by default. Put the deployed address in
`NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS`, verify on Sourcify for chain 296, then call
`anchor()` from the lock step and `settle()` or `abandon()`
from the send step. Put the anchor transaction link next to the plan hash in the
audit record. The JSON export already carries the plan, the policy and the log;
add the anchor references to it.
Done on screen: plan hash in the audit record links to the anchoring transaction
on HashScan, and the downloaded file contains both.

**Feature 6. Polish, docs, video, submission. 3 hours.**
Fill the two demo links in `README.md`. Record two minutes: register, plan,
lock, refusal, execution, HashScan. Shoot it twice, because Hashio answers BUSY
under load and the console caches the register but the transaction path does
not. Write the sponsor feedback notes both tracks ask for. Opt in to both
bounties on the form. Make the repo public.

## 4. Constraints

- Stack is fixed: Next.js 15 App Router, TypeScript strict, Tailwind v4 (no
  `tailwind.config.js`, no `@tailwind` directives), the shadcn primitives in
  `components/ui`. Deploys to Vercel: no custom server, no runtime filesystem
  writes, no long-lived processes. `params` and `searchParams` are Promises.
- Every interactive or surface element goes through the primitives in
  `components/ui` with `cn()`. A bare `<button>` or `<input>` in a page is a
  defect. Need something new, write it into `components/ui` in the same form.
- Colours come from the tokens in `app/globals.css`, which come from
  `IDENTITY.md`. No raw hex in a component, ever. Radius is sharp; do not
  reintroduce `rounded-lg` or `rounded-full`.
- Copy rules for anything a judge will read: no em dashes or en dashes, no
  double hyphens standing in for one. Banned words: seamless, leverage, empower,
  revolutionize, streamline, game-changer, cutting-edge, delve, robust, unlock,
  elevate, harness, effortless. Vary sentence length, use concrete numbers,
  write like a builder.
- Everything shipped is in English. The idea notes this came from are Turkish;
  they are internal.
- Keep `npm run build` passing after every change. Run it before each commit.
- Commit as you go with readable messages. The event asks for a visible history
  and the 1inch and Hedera tracks both call out final-day single commits.
- Scope discipline: if something threatens the deadline, cut a feature rather
  than polish one. The order above is the priority order. Feature 4 is the one
  that wins the room; features 1 and 3 are what the two bounties are scored on.
  Feature 5 is the first thing to drop.

## 5. Definition of done

- Deployed on Vercel and reachable.
- `README.md` demo links filled: the live URL and the video URL.
- The ninety second flow works end to end on the deployed build: register loads
  from Hedera testnet, plan fills with three held rows, quorum of two locks the
  policy, an edited payload is refused with a readable reason, the untouched
  plan signs, HashScan opens on the receipt, the audit record downloads.
- The wow moment rehearsed at least three times, including one full take with
  the network under load.
- Both bounties opted in, sponsor feedback written, repo public with a real
  commit history.

## 6. Phase log

### Phase 1, 2026-09-12. Walking skeleton, seams and the demo path

**Goal.** Make the whole ninety second flow clickable on `/` with seed data, and
freeze the five seams later phases lean on: the demo contract (`DEMO.md`), the
adapter seam (`ADAPTER_MODE`), the server seam (the typed API envelope), the
visual seam (`app/globals.css`, already in place) and the deploy pipeline.

**Status.** All five slices landed. No integration work was attempted, which is
correct for this phase: the register is the cached fixture, the policy is
compiled locally, the receipt is a stub derived from the calldata.

**Decisions.**

- `lib/types.ts` is the single home for every shape crossing a boundary. It
  carries no runtime code at all, so a client component can import it. The old
  declaration sites in `lib/privy.ts` and `lib/hedera.ts` now re-export from it,
  so no existing import path broke.
- The API route answers one envelope for every outcome:
  `{ ok: true, data }` or `{ ok: false, error, blockers? }`, keeping the 400,
  409 and 502 statuses. The console reads `payload.ok` before it touches
  `payload.data`, which removed four duplicated interfaces from the component.
- The seed register moved into `fixtures/register.seed.json` so `npm run seed`
  can assert it. `lib/data.ts` reads the fixture and casts once through
  `unknown`, because JSON widens the address and compliance literals.
- The plan table empty state and the loading skeleton were both kept rather than
  cut; the budget held.

**The adapter seam contract, for Phase 2.** `lib/adapter.ts` owns the switch and
imports nothing from `lib/hedera.ts` or `lib/privy.ts`, because both import it.
`ADAPTER_MODE` reads `NEXT_PUBLIC_ADAPTER_MODE` once and defaults to `fake`.
`useLiveRegister()` is true only when the mode is `real` and
`NEXT_PUBLIC_ATS_TOKEN_ADDRESS` is set; `useLivePrivy()` is true only when the
mode is `real` and both `PRIVY_APP_ID` and `PRIVY_APP_SECRET` are set, and it is
the entire body of `isPrivyLive()`. Every register read goes through a
`RegisterAdapter` (`{ mode, load(): Promise<RegisterSnapshot> }`).
`getRegisterSnapshot()` picks `liveRegisterAdapter` or `fakeRegisterAdapter` and
calls `.load()`; if the live adapter throws (no token address, or Hashio answers
BUSY) it falls back to the fake adapter and overwrites the note. So Phase 2 has
exactly two jobs: make `liveRegisterAdapter.load()` correct against a real token,
and set the env values. Nothing else has to move.

**Still untested against anything real.** `liveRegisterAdapter.load()` has never
run against a deployed ATS token, and `installPolicy` / `submitTransaction` have
never run against a real Privy app. Both live paths are written, neither is
proven. The seed fallback hides relay errors on purpose, so log inside the catch
in `getRegisterSnapshot()` while wiring the live read.

**Failed attempts.** None. No slice needed a second correction pass.

**Files changed.** Added: `DEMO.md`, `CLAUDE.md`, `lib/types.ts`,
`lib/adapter.ts`, `fixtures/register.seed.json`, `scripts/seed.mjs`,
`app/loading.tsx`, `contracts/test/PlanAnchor.t.sol`, `.farm-commits.json`.
Edited: `lib/hedera.ts`, `lib/privy.ts`, `lib/data.ts`,
`app/api/detent/route.ts`, `components/operations-console.tsx`,
`components/rail.tsx`, `app/layout.tsx`, `app/page.tsx`, `app/error.tsx`,
`app/not-found.tsx`, `package.json`, `.gitignore`, `.env.example`, this file.

**Commands run.** None. This phase was file only: the agent had no shell. Every
command below is the runner's or a human's to execute.

**Open questions.**

- `components/operations-console.tsx` is a client component and imports
  `hashscanToken` from `lib/hedera.ts`, which now pulls `lib/adapter.ts` into the
  client bundle. The Privy reads there compile to `undefined` on the client, so
  nothing leaks, but moving the two HashScan URL helpers into their own module
  would keep the client graph cleaner. Out of fence this phase.
- The masthead figure in the console renders `public/brand/og.png`, a second
  `<Image>` beside the rail's brand mark. It came with the scaffold and is
  documented above as the register figure rather than a brand mark. Worth a
  decision before the video.
- `NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS` is in `.env.example` but nothing reads it
  yet. That is feature 5.

**Next best step.** Phase 2: fund the testnet account, break the hollow account
trap, issue the ATS token, then set `NEXT_PUBLIC_ADAPTER_MODE=real` plus
`NEXT_PUBLIC_ATS_TOKEN_ADDRESS` and confirm the masthead badge flips from
"Cached register" to "Live read from Hedera testnet".

### Phase 2, 2026-09-12. The treasury key goes real

**Goal.** Turn one mechanism real: the treasury key. `lib/privy.ts` stops being
a local compiler with a stub receipt and becomes a client against the Privy REST
API (`POST /v1/policies` owned by a key quorum, `POST /v1/wallets/{id}/rpc`,
`DELETE /v1/policies/{id}`), with a documented fallback that takes a signature
from Privy and broadcasts through Hashio when Privy will not send to
`eip155:296`. Around it: one config home, a secret-free client graph, zod at the
edge, typed error codes, and the register read hardened with timeouts, one
retry and logging.

**Status.** All five slices landed. Nothing was executed: this phase had no
shell, so every live path is written and type-checked by reading, not proven
against a real Privy app or a real ATS token. The fake path is untouched and is
still the insurance for the recorded demo: with an empty `.env.local` the
refusal names the failed condition and the byte offset, and the approved plan
still returns the stub receipt.

**Decisions.**

- **The config split.** `lib/public-config.ts` reads only `NEXT_PUBLIC_*` and is
  safe in a browser bundle. `lib/config.ts` re-exports it and adds the secret
  block plus the named constants (`QUORUM_THRESHOLD`, `PRIVY_TIMEOUT_MS`,
  `RPC_TIMEOUT_MS`, `RETRY_COUNT`, `SIGNED_TX_GAS_LIMIT`, `LOG_PREFIX`). Those
  two files are the only `process.env` readers in the repo.
- **Why `lib/adapter.ts` had to lose its Privy read.** The console is
  `"use client"` and reached `lib/hedera.ts`, which imports `lib/adapter.ts`,
  which read `PRIVY_APP_ID` and `PRIVY_APP_SECRET`. Those compile to `undefined`
  in the browser so nothing leaked, but a secret-reading module sat in the
  client import graph, which is a structural defect rather than a runtime one.
  `useLivePrivy()` is deleted; its logic is now the body of `isPrivyLive()` in
  `lib/privy.ts`, reading `lib/config.ts`. The console and the rail now import
  the HashScan helpers from the new `lib/hashscan.ts` and `RegisterSnapshot`
  from `lib/types.ts`, so neither touches `lib/hedera.ts` any more.
- **The error code union.** `lib/errors.ts` carries eight codes
  (`invalid_input`, `plan_blocked`, `quorum_not_met`, `not_configured`,
  `upstream_timeout`, `upstream_error`, `parse_failure`, `policy_denied`), a
  `DetentError` carrying `code` and `hint`, and one sentence per code. The API
  envelope's failure arm is now `{ ok: false, error: <code>, hint, blockers? }`,
  the route never passes a provider body or a stack trace out, and the console
  switches on the code and renders the hint.
- **Two broadcast paths.** `PRIVY_BROADCAST_MODE` is `auto` by default. `rpc`
  and `auto` ask the wallet for `eth_sendTransaction` with
  `caip2: eip155:<chain>`. When Privy answers 4xx and the body does not read as
  a policy refusal, `auto` falls to the signature path: `eth_signTransaction`
  from the same wallet under the same policy, then `sendRawTransaction` through
  the Hashio client, with the nonce from `getTransactionCount`, the price from
  `getGasPrice`, the gas from `SIGNED_TX_GAS_LIMIT` and `type: 0`, because the
  Hedera relay rejects typed transactions. The `note` on the result says which
  path ran. The policy still governs the signing request either way, so the
  product claim survives.
- **The local mirror runs first on the live path too.** `evaluatePolicy` is
  evaluated before Privy is asked, so a tampered payload is refused in words the
  operator can read without waiting on the provider. That is what keeps the wow
  step identical with and without keys.
- **One retry, written out.** `privyFetch` is a first attempt plus a single
  re-attempt on a timeout or a 5xx, with no loop and no recursion, so a slow
  provider costs at most two bounded waits. The viem transport uses the same
  shape: `http(url, { timeout: RPC_TIMEOUT_MS, retryCount: RETRY_COUNT })`.
- **The register read no longer loses eleven rows to one bad call.** Each holder
  read is wrapped: a failing row keeps its seed values and its
  `complianceNote` says it was not read in this snapshot. Only a total failure
  throws, which is what still triggers the cached fallback. The `catch` in
  `getRegisterSnapshot()` now logs, which the Phase 1 handoff asked for.

**Failed attempts.** None. No slice needed a second correction pass.

**Files changed.** Added: `lib/public-config.ts`, `lib/config.ts`,
`lib/hashscan.ts`, `lib/errors.ts`, `lib/schemas.ts`, `vitest.config.ts`,
`tests/core.test.ts`, `.farm-commits.json`. Edited: `lib/adapter.ts`,
`lib/plan.ts`, `lib/hedera.ts`, `lib/privy.ts`, `lib/types.ts`,
`app/api/detent/route.ts`, `components/operations-console.tsx`,
`components/rail.tsx`, `contracts/test/PlanAnchor.t.sol`, `.env.example`,
`package.json`, `README.md`, `contracts/README.md`, `IDENTITY.md` (one dated
line under Amendments), this file.

**Commands run.** None. This phase was file only, the agent had no shell.

The runner's commands: `npm install`, `npm run build`, the per-slice commit
replay from `.farm-commits.json` with a closing `faz-2:` commit, then push.

The human's commands:

```bash
npm test
cd contracts && forge test
export RPC_URL=https://testnet.hashio.io/api
forge script script/Deploy.s.sol --rpc-url $RPC_URL \
  --private-key $FARM_EVM_PRIVATE_KEY --broadcast --legacy
export DEPLOYED_CONTRACT=0xYourDeployedAnchor
forge script script/Smoke.s.sol --rpc-url $RPC_URL \
  --private-key $FARM_EVM_PRIVATE_KEY --broadcast --legacy
```

`DEPLOYED_CONTRACT` is the only `vm.env*` name in `contracts/script/*.s.sol`:
`Smoke.s.sol` reads it with `vm.envAddress`, and `Deploy.s.sol` reads no
environment value at all. Before the deploy, the wallet behind
`FARM_EVM_PRIVATE_KEY` needs roughly 20 testnet HBAR (portal faucet, 100 HBAR
per request), and its first transaction must be paid by that ECDSA key to break
the hollow account trap.

**Env keys the runner and the human must fill.**

| Key | Where the value comes from |
| --- | --- |
| `NEXT_PUBLIC_ADAPTER_MODE` | Set to `real` to turn on both live paths. Anything else is read as fake. |
| `NEXT_PUBLIC_ATS_TOKEN_ADDRESS` | EVM address of the ATS equity token, from the factory deploy output or HashScan. |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | Written by the contract deploy step. `lib/public-config.ts` reads `NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS` first and falls back to this. |
| `PRIVY_APP_ID` | Privy dashboard, Settings then Basics. |
| `PRIVY_APP_SECRET` | Privy dashboard, API keys. |
| `PRIVY_TREASURY_WALLET_ID` | The `id` in the `POST /v1/wallets` response, or the dashboard wallet page. |
| `PRIVY_TREASURY_WALLET_ADDRESS` | The `address` in the same response. Only the signature fallback needs it, and it throws `not_configured` naming this key when it is missing. |
| `PRIVY_KEY_QUORUM_ID` | Privy dashboard, Key quorums, threshold two. `installPolicy` throws `not_configured` naming this key when it is missing. |
| `PRIVY_BROADCAST_MODE` | Leave at `auto`. Set to `signature` only if Privy refuses `eip155:296` outright, `rpc` to pin the Privy broadcast for a rehearsal. |

**Acceptance items not met, with evidence.**

- `app/page.tsx:3` still imports `getRegisterSnapshot` from `@/lib/hedera`. The
  gate reads "no page or client component imports `lib/hedera.ts`". It is a
  server component, so no secret reaches the browser, and slice 1 did not list
  `app/page.tsx` among the files it may edit. Every client component is clean:
  `components/operations-console.tsx:17` and `components/rail.tsx:5` now import
  from `@/lib/hashscan`. Phase 3 can move the snapshot read behind a
  `lib/register.ts` entry point if the literal reading matters.
- Everything that needs a command is unverified: `npm run build`,
  `npm test` and `forge test` were never executed. The Privy request and
  response shapes, the Hashio raw broadcast and the two fuzz tests are written
  from the documented shapes, not from a run.

**Open questions.**

- Privy's `eth_signTransaction` response field name. The parser reads
  `data.signed_transaction` and treats anything else as `parse_failure`, so a
  different field name shows up as a clean typed error rather than a crash. Fix
  it in `lib/schemas.ts` (`privyRpcResponseSchema`) the first time the live path
  runs.
- Telling a Privy policy refusal apart from an unsupported chain: both are 4xx.
  `looksLikePolicyDenial` reads the body for `policy`, `denied` or `not allowed`
  without ever passing it to the client. If Privy words it differently, `auto`
  will take the signature path on a genuine refusal, where the local mirror has
  already produced the correct refusal text anyway.
- The masthead figure in the console still renders `public/brand/og.png` beside
  the rail's brand mark, carried over from Phase 1. Still worth a decision
  before the video.
- `NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS` is now read into
  `PLAN_ANCHOR_ADDRESS`, but nothing calls `PlanAnchor` from the app yet. That
  is still feature 5.

**Next best step.** Phase 3: wire `PlanAnchor` from the console (anchor on lock,
settle or abandon on send, both links in the audit record), read the treasury
settlement balance on chain so the headroom is live, and add the per-step
loading and error surfaces the send path still lacks.

### Phase 3, 2026-09-12. The whole demo path on real data

**Goal.** Make the rest of the path real around the Privy half: one store seam
with an idempotent send, the treasury cover read on chain so the headroom is a
real number, `PlanAnchor` driven from the console so the plan hash is witnessed
before the policy opens and closed after it, and a treasury key state machine
with a rendered branch per state.

**Status.** All five slices landed. Nothing was executed: this phase had no
shell, so every path below is written and checked by reading, not by running.
The fake path is untouched and still the insurance for the recorded demo: with
an empty `.env.local` the refusal names the failed condition and the byte
offset, the anchor reports itself as not wired, and the send still returns the
stub receipt.

**Decisions.**

- **The persistence decision, verbatim.** Chosen: decision table row 4, "the
  step's proof IS the chain" (`PlanAnchor` plus `lib/config.ts`), combined with
  row 1, "seed constants and in-memory per request" for the policy vault and the
  submission ledger, both behind the single wrapper `lib/store.ts`. Rejected:
  row 2, a KV blob, because it would add an Upstash account, a token and a
  dependency for state whose durable copy already exists on chain and whose
  warm-instance fallback (recompiling the policy from the approved plan the
  client echoes) is already written and tested. Row 3, Postgres, because nothing
  in the five DEMO.md steps filters or joins anything; the register is 12 rows
  read from a contract. If a future step genuinely cannot work without KV,
  re-read the table before reaching for it.
- **Read before write is what makes the demo repeatable.** A plan hash is
  deterministic, so the second rehearsal of the same coupon run produces the
  same hash, and `anchor()` reverts with `AlreadyAnchored`. Every function in
  `lib/anchor.ts` calls `planOf` first: an already anchored hash returns
  `{ anchored: true, note: "Already anchored in an earlier run, reusing the
  existing record." }` and sends nothing, and `settlePlan` / `abandonPlan` guard
  the same way against a status that is not `Anchored`. None of the three ever
  throws; a missing key, a missing address or a busy relay is a receipt with
  `anchored: false` and a note, because the anchor must never fail a send.
- **The submission key carries the broadcast preference.** The specified key was
  `policyId:planHash:tampered|approved:calldata`. The console appends the
  broadcast preference, because without it the `wrong-network` action would
  re-send under the same key and be answered from the ledger, so the sign and
  relay path would never run. Two clicks on the same button still carry the same
  preference and still broadcast once, which is the property the key exists for.
- **`idle` covers live with a policy held.** The specified mapping names `idle`
  as "live and nothing locked". Holding a policy is a plan state, not a wallet
  state, so `deriveTreasuryKeyState` returns `idle` for live with nothing in
  flight whether or not a policy is held. The other seven mappings are as
  specified.
- **The register memo is not shared with the failure path.** A successful
  snapshot is cached for `REGISTER_CACHE_MS` (30 seconds, matched by
  `export const revalidate = 30` in `app/page.tsx`). The cached-register fallback
  is deliberately not memoised, so a relay that recovers shows on the next
  navigation rather than 30 seconds later.
- **The treasury cover reads the settlement token, not the security.** The ATS
  token is the register; the coupon is paid in the settlement asset, so
  `NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS` is its own key with its own two line
  ABI. The balance is already in micro units, which is what `PlanInput`
  `treasuryMicros` expects.

**Failed attempts.** None. No slice needed a second correction pass.

**Files changed.** Added: `lib/store.ts`, `lib/register.ts`, `lib/anchor.ts`,
`lib/wallet-state.ts`, `components/console-states.tsx`,
`scripts/demo-reset.mjs`, `.farm-commits.json`. Edited: `lib/hedera.ts`,
`lib/plan.ts`, `lib/privy.ts`, `lib/config.ts`, `lib/public-config.ts`,
`lib/schemas.ts`, `lib/types.ts`, `app/page.tsx`, `app/loading.tsx`,
`app/api/detent/route.ts`, `components/operations-console.tsx`,
`tests/core.test.ts`, `package.json`, `.env.example`, `README.md`,
`contracts/README.md`, `IDENTITY.md` (one dated line under Amendments), this
file.

**Commands run.** None. This phase was file only, the agent had no shell.

The runner's commands: `npm install`, `npm run build`, the per-slice commit
replay from `.farm-commits.json` with a closing `faz-3:` commit, then push.

The human's commands:

```bash
npm test
npm run demo:reset
npm run seed
cd contracts && forge test
export RPC_URL=https://testnet.hashio.io/api
forge script script/Deploy.s.sol --rpc-url $RPC_URL \
  --private-key $FARM_EVM_PRIVATE_KEY --broadcast --legacy
export DEPLOYED_CONTRACT=0xYourDeployedAnchor
forge script script/Smoke.s.sol --rpc-url $RPC_URL \
  --private-key $FARM_EVM_PRIVATE_KEY --broadcast --legacy
```

Then put the deployed address in `NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS`, the same
deploying key in `OPERATOR_PRIVATE_KEY`, and the two smoke transaction hashes
under "On chain proof" in `README.md`. Before any on chain step the wallet
behind `FARM_EVM_PRIVATE_KEY` needs roughly 20 testnet HBAR from
https://portal.hedera.com/faucet, and its first transaction must be paid by that
ECDSA key to break the hollow account trap.

**Env keys the runner and the human must fill.** Everything in the Phase 2 table
still applies, plus:

| Key | Where the value comes from |
| --- | --- |
| `NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS` | EVM address of the testnet settlement token (the USDC-like asset the coupon is paid in). Its `balanceOf` for the treasury address funds the draw. Empty keeps the seed cover figure and the register note says so. |
| `OPERATOR_PRIVATE_KEY` | The same ECDSA private key that deployed `PlanAnchor`, because the contract's `onlyOperator` pins the writer to the deployer. Server only, no `NEXT_PUBLIC_` prefix, never committed. Empty leaves the anchor reported as not wired and changes nothing else. |

**Acceptance items not met, with evidence.**

- Everything that needs a command is unverified. `npm run build`, `npm test`,
  `npm run demo:reset`, `forge test` and the two `forge script` runs were never
  executed by the agent, which had Write, Edit, Read, Glob and Grep only. In
  particular the viem wallet path in `lib/anchor.ts:149` (`writeContract` with
  `type: "legacy"`) and the struct return shape in `lib/anchor.ts:36` are
  written from the documented shapes, not from a run against a deployed
  `PlanAnchor`.
- The live treasury cover in `lib/hedera.ts:189` has never read a real
  settlement token. The fallback branch beside it is what runs today.
- `components/operations-console.tsx:26` still imports `buildCalldata` into the
  client bundle to derive the submission key. It is pure viem encoding with no
  secret and no network, and the same function already arrived through
  `buildPlan`, so this adds no new surface. Worth noting rather than fixing.
- The masthead figure in the console still renders `public/brand/og.png` beside
  the rail's brand mark, carried over from Phase 1 and unchanged here. Still
  worth a decision before the video.

**Open questions.**

- Does Hashio accept `eth_estimateGas` free writes with an explicit `gas` of
  1,500,000 for `anchor`? `lib/anchor.ts` passes `SIGNED_TX_GAS_LIMIT` rather
  than estimating, to save a round trip. If a call reverts for gas, lower it in
  `lib/config.ts` rather than adding an estimate step.
- `chainRefused` in `components/operations-console.tsx:137` reads a refused
  chain as "Privy was live, the policy was recompiled, the payload was allowed
  and no hash came back". If the live path turns out to fail differently, that
  is the one line to adjust, and the `wrong-network` branch is already written.
- Nothing reads the anchor status back into the console. The audit record shows
  what the write returned, not what the contract holds now. A later phase could
  read `planOf` on load and show the plan as settled before anything is clicked.

**Next best step.** Fund the testnet account, deploy `PlanAnchor`, set
`OPERATOR_PRIVATE_KEY` and `NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS`, then walk DEMO.md
three times with `NEXT_PUBLIC_ADAPTER_MODE=real` and record the two smoke
transaction hashes in `README.md`. After that, Phase 4 is the landing and OG
polish plus the video.

### Phase 4, 2026-09-12. Bounty ledger, the record route, and the surface judges touch

**Goal.** Two things at once. Make the submission surface complete: a bounty
ledger in `README.md` quoting each prize's own qualification wording and
answering it with a file and a symbol, plus `DELIVERY.md` so no opt-in box is
missed. Then add the second wow, a new route `/record/[planHash]` that reads the
plan hash back off `PlanAnchor` so the record outlives the session, and finish
with the responsive, touch target, metadata and landing pass on the one artifact
every judge touches.

**Status.** All four slices landed. Nothing was executed: this phase had no
shell, so the new read path is written and checked by reading, not by running.
DEMO.md now has six steps and the sixth one has never been seen on screen in any
state other than by reading the code.

**Decisions.**

- **The record route is a read with no key.** `planOf` is a view call, so
  `readPlanRecord` checks `PLAN_ANCHOR_ADDRESS` only and never touches
  `OPERATOR_PRIVATE_KEY`. A deployment that can read but not write still renders
  step 6, which matters because the Vercel deployment does not need the operator
  key to show the record.
- **Six states, two of which are not chain states.** `PlanRecordState` is
  `unwired | unreadable | unknown | anchored | settled | abandoned`. The first two
  are local conditions (no address configured, the relay would not answer), the
  other four mirror `PlanAnchor.Status`. The route narrows the first three into
  `RecordEmptyState` with a `const` rather than a cast, so adding a state forces a
  decision at that branch instead of silently falling through.
- **The masthead figure is gone.** `public/brand/og.png` was a second raster
  beside the rail's brand mark, flagged as an open question in all three previous
  handoffs. It is now a bordered register note block carrying the snapshot time,
  the register source, the partition and the settlement asset, ending in
  `snapshot.note`. Same treatments the file already used, so no new colour, radius,
  font or motion value, recorded as a dated line under Amendments in
  `IDENTITY.md`. `components/operations-console.tsx` no longer imports
  `next/image`, and `brand/logo.png` in `components/rail.tsx:27` is the only brand
  raster rendered anywhere.
- **Touch targets are `min-h`, not `h`.** The button size variants became
  `min-h-11` / `min-h-12` rather than fixed heights, because several controls sit
  in grid cells whose content can wrap at 360px; a fixed height would clip. The
  rail's six section links got `inline-flex min-h-11 items-center`, which is the
  only way a wide-tracked small-caps label is tappable on the stacked mobile bar.
- **`NEXT_PUBLIC_SITE_URL` is read in `app/layout.tsx`, not in the config home.**
  The phase brief specified that line verbatim, and `metadataBase` is evaluated at
  module scope in the root layout. It breaks the Phase 2 invariant that
  `lib/config.ts` and `lib/public-config.ts` are the only `process.env` readers, so
  the exception is written into the comment at the top of `lib/config.ts` rather
  than left for a reviewer to find by grep. The key has its own line in
  `.env.example`.
- **No third bounty.** No `targetTracks` row was dropped: both claimed rows
  already had their integrations in code, so this phase's cost for them was
  documentation only. The third slot the event allows stays empty.
  `🧬 Best Use of ENSv2` (`$4,500, 1st place: $1,500, 2nd place: $1,500, 3rd
  place: $1,000, Runner-Up: $500`, 4 slots, about 2 marginal hours) was not taken:
  this phase's budget was 1.7 hours, and naming would be cosmetic in a product
  whose addresses come from a register rather than from a user, which that row's
  own wording rejects.

**Failed attempts.** None. No slice needed a second correction pass.

**Files changed.** Added: `DELIVERY.md`, `app/record/[planHash]/page.tsx`,
`app/record/[planHash]/loading.tsx`, `.farm-commits.json`. Edited: `README.md`,
`.env.example`, `lib/anchor.ts`, `lib/types.ts`, `lib/schemas.ts`,
`lib/config.ts` (comment only), `components/console-states.tsx`,
`components/operations-console.tsx`, `components/rail.tsx`,
`components/ui/button.tsx`, `components/ui/input.tsx`, `app/layout.tsx`,
`app/page.tsx`, `DEMO.md`, `IDENTITY.md` (one dated line under Amendments), this
file.

**Commands run.** None. This phase was file only and the agent had no shell: the
tools were Write, Edit, Read, Glob and Grep. Every command below is the runner's
or a human's.

The runner's commands: `npm install`, `npm run build`, the per-slice commit
replay from `.farm-commits.json` with a closing `faz-4:` commit, then push and the
Vercel redeploy to the same project.

The human's commands and checks, unchanged from Phase 3 plus the new route:

```bash
npm test
npm run build
cd contracts && forge test
```

Then walk steps 1 to 6 on the live URL in a private window, check 360px, 768px and
1280px in devtools, view-source for an absolute `og:image`, and run Lighthouse.

**Acceptance items not met, with evidence.**

- Everything that needs a command is unverified. `npm run build`, `npm test`,
  `forge test`, the two `forge script` runs, the devtools sweep, the view-source
  check and Lighthouse were never executed here.
- The `planOf` struct decode in `readPlanRecord` (`lib/anchor.ts`, the
  `OnChainPlan` cast in the read path) has never run against a deployed
  `PlanAnchor`. It reads the struct as an object with named fields, which is what
  viem returns for a single struct return value; if viem hands back a positional
  tuple instead, that cast is the one place to change, and the symptom would be
  every field reading as undefined while `state` fell to `unknown`.
- The record route's settled state has never been seen on screen. With no
  `NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS` the route renders `unwired`, which is the
  documented degraded state, not a bug.
- One `shortHex` rendering on the demo path carries no `title`:
  `components/operations-console.tsx` composes `shortHex(plan.planHash)` into the
  audit entry's `detail` sentence for the lock event, and that entry is a plain
  string rather than an element, so there is no single full value to attach. The
  full plan hash is printed with `break-all` and a `title` in the `#plan` dl on
  the same page, and the new `/record/[planHash]` page prints it in full again.
- The live treasury cover in `lib/hedera.ts:189` still has never read a real
  settlement token, and `installPolicy` / `submitTransaction` have still never run
  against a real Privy app. Carried forward from Phase 2 and Phase 3, untouched
  here.
- `app/page.tsx:3` still imports `getRegisterSnapshot` from `@/lib/register`,
  which is the Phase 3 seam; the Phase 2 gate about `lib/hedera.ts` is satisfied
  through it. No client component imports `lib/hedera.ts`.
- `components/operations-console.tsx` still imports `buildCalldata` into the
  client bundle to derive the submission key, carried forward from Phase 3. Pure
  viem encoding, no secret, no network.

**Open questions.**

- Should `/record/[planHash]` also read the token symbol so the record names the
  security rather than printing an address? It would cost one more relay read on a
  route whose whole point is that it works with nothing but the anchor address.
- Nothing reads the anchor status back into the console itself, carried forward
  from Phase 3. The audit record still shows what the write returned, not what the
  contract holds now; `readPlanRecord` is the function a later phase would call on
  load to show a plan as already settled before anything is clicked.
- `NEXT_PUBLIC_SITE_URL` would be cleaner as `SITE_URL` in
  `lib/public-config.ts`. One line to move if a second reader appears.

**Next best step.** Fund the testnet account, deploy `PlanAnchor`, run
`Smoke.s.sol` with `DEPLOYED_CONTRACT` set, paste the contract address and the two
transaction hashes under "On chain proof" in `README.md`, then set
`NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS` and open `/record/<planHash>` after a full walk
to see step 6 in its settled state for the first time. Then record the video and
work `DELIVERY.md` top to bottom.

### Phase 5, 2026-09-12. Security pass, contract audit and wallet trust

**Goal.** Trust on two fronts, with no new feature, route or dependency. Audit
every state-mutating function in `PlanAnchor` and fix the one real gap. Then make
the frontend legible to a judge who opens the live URL: say what a send does
before the button is pressed, fix the `rel` hygiene on every external link, put
an About and Security block in the shared shell, and write a `SECURITY.md` that
matches the code rather than a generic template.

**REDEPLOY NOT NEEDED.** `README.md`'s `On chain proof` section still holds the
`<ADD_PLAN_ANCHOR_ADDRESS>` placeholder, so nothing is deployed and this phase's
bytecode change owes no redeploy. The first deploy will simply carry the pause.
Because that step rewrites only `.env.local` and `README.md`, the human must
update the address line in `SECURITY.md` by hand afterwards.

**Status.** All four slices landed. Nothing was executed: this phase had Write,
Edit, Read, Glob and Grep and no shell, so `forge test`, `npm run build` and
`npm test` are all unrun here. The greps below were actually run and their
results are quoted verbatim.

**Decisions.**

#### The `PlanAnchor` audit ledger

Read against `contracts/src/PlanAnchor.sol` as it stands after this phase.

| Check | Finding | Evidence |
| --- | --- | --- |
| Access control | Pass. Every external state-mutating function is `onlyOperator`, and the operator is pinned to the deployer in the constructor: `anchor` at line 71-75, `settle` at 92-96, `abandon` at 107-111, `setPaused` at 65. `modifier onlyOperator` at 48-51, `operator = msg.sender` at 59. | Read, four call sites. |
| Withdraw and sweep | Not applicable, and deliberately absent. The contract holds no value: no `payable` function, no `receive`, no `fallback`, no `msg.value` read. There is nothing to withdraw or sweep, so adding either would only add an operator-controlled surface. | Grep over `contracts/src/` for `payable\|receive(\|fallback(\|msg.value\|withdraw\|sweep`: no hit. |
| Reentrancy, checks-effects-interactions | **Vacuous**, not passed by hand. The contract makes no external call at all: no `.call{`, no `delegatecall`, no `staticcall`, no `.transfer(`, no `.send(`, no interface call, no import. Every function writes its own storage and emits. A `nonReentrant` guard would guard nothing, so none was added. | Grep over `contracts/src/` for `transferFrom\|.call{\|delegatecall\|staticcall\|payable\|selfdestruct\|receive(\|fallback(\|withdraw\|sweep\|approve(\|msg.value\|.transfer(\|.send(\|nonReentrant\|import `: exactly one hit, `PlanAnchor.sol:82`, the word "withdrawn" inside a doc comment. |
| Integer and rounding | **Vacuous.** There is no share, fee, price or balance arithmetic anywhere: no division, no multiplication, no percentage. The only casts are `uint64(block.timestamp)` at lines 82, 101 and 116, which cannot overflow before the year 584942417355. | Read, three casts. |
| Allowance hygiene | **Vacuous.** Grep over `contracts/` for `type(uint256).max` and `approve`: the only hits are the English word "approved" in comments at `PlanAnchor.sol:5`, `PlanAnchor.sol:54` and `contracts/README.md:11`. No `approve(` call, no infinite allowance, nothing to bound. | Grep, three prose hits. |
| Event coverage | Pass. Every value-recording function emits: `anchor` emits `PlanAnchored(planHash, token, selector, anchoredBy)`, `settle` emits `PlanSettled(planHash, txReference)`, `abandon` emits `PlanAbandoned(planHash, reason)`, and the new `setPaused` emits `PauseSet(value)`. The app does not depend on events to know state: `lib/anchor.ts` reads `planOf` before every write (`statusOf`, line 102-116) and `readPlanRecord` (line 159) reads `planOf` for the record route, and the write path returns the transaction hash viem gives it rather than assuming success. | Read, four emits plus `lib/anchor.ts:106`, `lib/anchor.ts:168`. |
| Token flow, deposits | None. No function accepts value and no token is ever received. | Same grep as reentrancy. |
| Token flow, withdrawals | None. No function sends value or tokens out. | Same grep. |
| Token flow, `transferFrom` | None. `transferFrom` does not appear anywhere in `contracts/`. | Same grep. |
| Escape hatch | **The one real gap, now fixed.** There was no way to stop writes to the register short of a redeploy, so a wedged register could wedge the recorded demo. Added `bool public paused`, `error Paused()`, `event PauseSet(bool)`, `modifier whenNotPaused` and `function setPaused(bool) external onlyOperator`, applied to `anchor`, `settle` and `abandon`. `planOf` and `anchoredCount` stay open reads, so a paused register still renders `/record/[planHash]`. | `PlanAnchor.sol:29, 41, 46, 53-56, 62-68, 74, 95, 110`. |

Two tests were added, named after the finding, using the same minimal local `Vm`
interface already in the file and plain `require`, because forge-std is not
vendored: `test_pausedBlocksAnchorAndOperatorCanResume` (anchoring while paused
reverts with `PlanAnchor.Paused.selector`, then the same anchor succeeds after
unpausing) and `testFuzz_setPausedRejectsNonOperator(address caller)` (mirrors
`testFuzz_anchorRejectsNonOperator`, including the `caller == address(this)`
early return). `contracts/script/Smoke.s.sol` was not touched and still reads
`vm.envAddress("DEPLOYED_CONTRACT")` at line 18.

#### The frontend grep evidence

Every grep below was run against the working tree in this session. Where a grep
contradicted the brief, the grep is what is written here.

**Browser wallet, the vacuous half.** `eth_requestAccounts`, `window.ethereum`,
`wallet_switchEthereumChain`, `personal_sign`, `connect(` and
`@privy-io/react-auth` produce, across the whole repo, exactly four hits and not
one of them is a call site: `README.md:144` (the sentence saying
`@privy-io/react-auth` is deliberately not installed), `README.md:130`,
`HANDOFF.md:394` and `HANDOFF.md:481` (prose about `eth_signTransaction`). The
only code hits belong to `eth_sign` as a prefix of the server-side method name:
`lib/privy.ts:356` (the union type `"eth_sendTransaction" | "eth_signTransaction"`)
and `lib/privy.ts:420`. There is no browser wallet in this product, so every
browser-wallet hygiene rule verifies vacuously rather than passing.

**Approvals.** There is no approval call site anywhere in the repo, so there is
no unbounded approval and no EOA spender. The bounded thing is the signing
surface: `compilePolicy` in `lib/privy.ts:131-169` emits one ALLOW rule with four
conditions (`chain_id eq 296`, `to eq` the plan target, `data starts_with` the
selector, `data eq` the whole calldata) over `default_action: DENY`.

**Secrets.** `sk-`, `PRIVATE_KEY`, `APP_SECRET` and `PRIVY_APP_ID` over the
non-Markdown tree hit only `.env.example` (empty values), `lib/config.ts:27, 28,
42`, `lib/privy.ts` and `lib/anchor.ts`, plus one comment in `lib/adapter.ts:12`.
`@/lib/config`, `@/lib/privy`, `@/lib/hedera` and `@/lib/anchor` are imported by
`lib/*` , `app/api/detent/route.ts`, `app/record/[planHash]/page.tsx` (a server
component reading `planOf`, which needs no key) and `tests/core.test.ts`. No file
under `components/` imports any of them. Every `NEXT_PUBLIC_` value is genuinely
public: adapter mode, chain id, the public Hashio URL, three contract addresses
and the site origin.

**64-hex and address literals.** `0x[0-9a-fA-F]{40,}` hits five files only:
`lib/data.ts` and `fixtures/register.seed.json` (the documented seed register
fixture), and `contracts/test/PlanAnchor.t.sol`, `contracts/script/Smoke.s.sol`,
`contracts/script/Deploy.s.sol` (the cheatcode address
`0x7109709ECfa91a80626fF3989D68f67F5b1DD12D`). No contract address literal exists
outside that fixture.

**Transport.** `http://` hits five files: `CLAUDE.md:10` and `README.md:183`
(`npm run dev` prose), and the `xmlns="http://www.w3.org/2000/svg"` namespace in
`public/logo.svg`, `public/illustrations/ledger-rule.svg` and `app/icon.svg`. A
namespace is not fetched. Nothing in the app fetches an `http://` URL.

**Forms.** `<form` has zero hits in the repo. `fetch(` has three:
`components/operations-console.tsx:210` and `:280`, both to `/api/detent`, a route
implemented here at `app/api/detent/route.ts`, and `lib/privy.ts:88`, which is
server side. So the only data path out of the browser is `/api/detent`.

**Link hygiene.** All six pre-existing `target="_blank"` links carried
`rel="noreferrer"` alone. They now carry `rel="noopener noreferrer"`, along with
the three links added this phase. A grep for `rel="noreferrer"` now returns zero
hits, and all nine `target="_blank"` sites are accounted for:
`app/record/[planHash]/page.tsx:135`, `components/rail.tsx:82, 96, 113`,
`components/operations-console.tsx:416, 779, 877, 941, 951`.

#### Other decisions

- **The disclosure block names values already in scope.** It renders
  `plan.signature`, `snapshot.token.name`, `includedRows.length`,
  `formatMicros(plan.drawMicros)`, `snapshot.treasury.settlementAsset` and
  `plan.chainId`, so `components/operations-console.tsx` still imports nothing
  new and still never touches `lib/config.ts`.
- **The copy control swallows its own failure.** `copyTarget()` wraps
  `navigator.clipboard?.writeText(plan.target)` in a `try`/`catch` and attaches a
  no-op `.catch`, because a browser that refuses clipboard permission must not
  throw into a React handler. The address is on screen with a `title` and an
  explorer link beside it, so nothing is lost when the copy fails.
- **The rail keeps one brand mark.** The About and Security block extends the
  existing `dl`; no image was added, and `brand/logo.png` in the brand link is
  still the only raster the shell renders.
- **`SECURITY.md` states the vacuity rather than inventing a connect flow.** The
  wallet section says plainly that no connector is installed and lists the greps
  that prove it, and the approvals section says there is no approval at all
  rather than implying a bounded one exists.

**Findings found and not fixed**, each with severity and the shortest fix path:

- **Low. `app/record/[planHash]/page.tsx:25` imports `lib/anchor.ts`, which
  imports `lib/config.ts`, which reads `OPERATOR_PRIVATE_KEY`.** It is a server
  component and `readPlanRecord` never touches the key (it checks
  `PLAN_ANCHOR_ADDRESS` only, `lib/anchor.ts:160`), so nothing reaches the
  browser. It is the same structural shape Phase 2 removed from the client graph,
  on the server side where it is allowed. Shortest fix: split `readPlanRecord`
  into a `lib/anchor-read.ts` that imports only `lib/public-config.ts`. Out of
  fence this phase (a refactor).
- **Low. `components/operations-console.tsx:26` still imports `buildCalldata`
  into the client bundle** to derive the submission key. Pure viem encoding, no
  secret, no network, and the same function already arrives through `buildPlan`.
  Carried from Phase 3. Shortest fix: derive the submission key server side in
  `app/api/detent/route.ts`. Not worth the round trip.
- **Low. `components/rail.tsx` now imports `shortHex` from `@/lib/plan`**, which
  pulls viem into the shell's server render. The rail is a server component so no
  client bytes are added, but `lib/plan.ts` is a bigger module than a string
  helper needs to be. Shortest fix: move `shortHex` into its own
  `lib/short-hex.ts`. Deliberately not done: it is a refactor, and the fence says
  ask first.
- **Informational. `PauseSet(bool paused)` names its parameter after the state
  variable `paused`.** Solidity may emit a shadowing warning on some compiler
  versions. It is a warning, not an error, and the event signature was specified.
  Shortest fix if it ever matters: rename the event parameter to `value`.
- **Informational. The pause has no on-chain timelock and no second signer.** The
  operator can pause writes unilaterally. For a testnet demo register that holds
  no value this is the intended property, not a risk: the worst case is that the
  audit record stops being written, which `lib/anchor.ts` already reports as a
  receipt with `anchored: false` and a note rather than a failed send.

**MetaMask and Blockaid.** The question does not arise for a site that never asks
for a wallet: there is no connect request, no signature request and no
transaction request from the browser, so there is no prompt for a wallet security
provider to warn about. The human must still check two things by hand on the live
URL in a fresh profile with MetaMask installed: that the page loads with no popup
of any kind, and that the console shows no mixed-content warning over https. If
any wallet warning does appear it is a finding, and it goes here so the Phase 9
video plan can show the full flow on screen.

**Failed attempts.** None. No slice needed a second correction pass.

**Files changed.** Added: `SECURITY.md`, `.farm-commits.json`. Edited:
`contracts/src/PlanAnchor.sol`, `contracts/test/PlanAnchor.t.sol`,
`contracts/README.md`, `components/operations-console.tsx`, `components/rail.tsx`,
`app/record/[planHash]/page.tsx`, `README.md`, `DEMO.md`, `IDENTITY.md` (one
dated line under Amendments), this file. Eleven files, under the fifteen the
phase allows. No new dependency, no new route, no new env variable, no new
component file, and `fixtures/register.seed.json` is untouched.

**Commands run.** None. This phase was file only and the agent had no shell: the
tools were Write, Edit, Read, Glob and Grep. Every command below belongs to the
runner or to a human.

The runner's commands: `npm install`, `npm run build`, the per-slice commit
replay from `.farm-commits.json` with a closing `faz-5:` commit, then push and the
Vercel redeploy.

The human's commands:

```bash
npm test
npm run build
cd contracts && forge test    # includes the two tests added this phase
```

Then, when the account behind `FARM_EVM_PRIVATE_KEY` holds testnet HBAR (the
deploy plus the two smoke transactions need only a few; faucet at
https://portal.hedera.com/faucet, 100 test HBAR per request, and it creates a
hollow account until that key pays a fee itself, so the first transaction must be
paid by it):

```bash
export RPC_URL=https://testnet.hashio.io/api
forge script script/Deploy.s.sol --rpc-url $RPC_URL \
  --private-key $FARM_EVM_PRIVATE_KEY --broadcast --legacy
export DEPLOYED_CONTRACT=0xYourDeployedAnchor
forge script script/Smoke.s.sol --rpc-url $RPC_URL \
  --private-key $FARM_EVM_PRIVATE_KEY --broadcast --legacy
```

Record the two smoke hashes under `On chain proof` in `README.md`, then update
the address line in `SECURITY.md` by hand: the deploy step rewrites only
`.env.local` and `README.md`.

**Carried forward, still unrun from Phases 2 to 4.**

- The live ATS register read. `liveRegisterAdapter.load()` has never run against
  a deployed ATS token, and the live treasury cover in `lib/hedera.ts:189` has
  never read a real settlement token.
- The live Privy install and submit. `installPolicy`, `submitTransaction` and
  `revokePolicy` have never run against a real Privy app, so the response shapes
  in `lib/schemas.ts` are written from documentation.
- The whole anchor write path. `anchorPlan`, `settlePlan` and `abandonPlan` have
  never reached a deployed `PlanAnchor`; `writeContract` with `type: "legacy"` at
  `lib/anchor.ts:242` is unproven against the relay.
- The `planOf` struct decode. `readPlanRecord` casts the result to an object with
  named fields (`lib/anchor.ts:174`). If viem hands back a positional tuple
  instead, every field reads as undefined and `state` falls to `unknown`; that
  cast is the one place to change.
- The settled state of `/record/[planHash]` has never been seen on screen. With no
  `NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS` the route renders `unwired`, which is the
  documented degraded state.

**Open questions.**

- Should the pause be readable in the console, so an operator can see that the
  register is stopped rather than discovering it through an anchor note? One
  `paused()` read on load would do it. Out of fence here: it is an anchor read
  back into the console, which this phase was told not to add.
- `SECURITY.md` holds the anchor address as a placeholder. Nothing verifies that
  it and `README.md` stay in step after the deploy. A line in `DELIVERY.md` would
  be the cheapest guard.
- Sourcify verification for chain 296 is named in `contracts/README.md` and in the
  bounty ledger but has not been run, so HashScan will not show the source until
  it is.

**Next best step.** Unchanged from Phase 4, and now blocking more than it was:
fund the testnet account, deploy `PlanAnchor` (the pause ships with it), run
`Smoke.s.sol`, paste the address and the two hashes into `README.md` and the
address into `SECURITY.md`, then walk DEMO.md end to end with
`NEXT_PUBLIC_ADAPTER_MODE=real` and open `/record/<planHash>` to see step 6
settled for the first time.

### Phase 8, 2026-09-12. Structural frontend overhaul

**Goal.** Make the live URL read as a finished operator console in the first ten
seconds at phone width as well as desktop, and make DEMO.md step 4, the refusal,
the loudest thing on the page. No new feature, no new route, no new dependency:
a visual and structural pass over existing markup, on tokens that already exist.

**Status.** All four slices landed. Nothing was executed: this phase had Write,
Edit, Read, Glob and Grep and no shell, so `npm run build`, `npm test` and every
browser check are unrun here. Every grep quoted below was actually run against
the working tree in this session and its result is quoted verbatim.

The diagnosis, the twelve changes and the proof strings live in `.farm-delta.md`
at the repo root, written before any other file was touched.

**Decisions.**

- **The rail collapses, it does not turn into a drawer.** Below `lg` the rail is
  a compact bar: the brand link on one row, then the six section links as a
  single horizontally scrollable row inside its own `overflow-x-auto` wrapper
  (`components/rail.tsx:122`), each link keeping `min-h-11` and
  `whitespace-nowrap`. The wrapper carries `-mx-5 ... px-5` so the row bleeds to
  the screen edges and a half-cut label reads as "there is more"; the page itself
  never scrolls sideways. No disclosure button, no overlay, no new state: a
  collapsing menu would be a new interactive component in a phase whose fence
  says no new feature. At `lg` and up every class that mattered is still there:
  `lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r`.
- **The CTA is dropped below `lg`, not moved.** The phase allowed either. At
  390px the gold block cost a full screen third and the plan table is the next
  thing on screen anyway, so `hidden w-full lg:mt-auto lg:inline-flex` drops it
  and the "Plan" link in the section bar carries the same jump. Judges on a phone
  now meet the register masthead, not a call to action.
- **About and Security moved into the shared shell, not into the page footer.**
  The `dl` is now `AboutSecurity`, exported from `components/rail.tsx` and
  rendered twice: inside the rail behind `lg:block`, and once in
  `app/layout.tsx:66` under the console for widths below `lg`. Putting it in
  `app/page.tsx`'s footer instead would have dropped all four rows and the
  SECURITY.md link from `/record/[planHash]`, undoing Phase 5's "in the shared
  shell so both routes reach it". The layout copy is a
  `<section aria-label="About and security">` rather than a second `<footer>`, so
  `app/page.tsx` keeps the page's only `contentinfo` landmark. `hashscanToken`,
  `shortHex`, `CHAIN_ID` and `PLAN_ANCHOR_ADDRESS` are reused, not re-derived.
- **The ledger rule is gone from the plan card header and stays declared.**
  `detent-ruled` was painting the repeating rule behind the `CardTitle` and the
  `CardDescription`, which renders as a strikethrough through both. The header is
  now `border-b border-border` with a `detent-label` eyebrow over the title. The
  class itself stays in `app/globals.css:107` and `public/illustrations/ledger-rule.svg`
  is untouched, so a later phase can put the rule back on a surface where no text
  sits. Grep for `detent-ruled` under `components/`: zero.
- **The register note is demoted, not deleted.** It was
  `border border-border bg-card p-4`, the heaviest object on the fold, outranking
  the h1 that names the security. It is now `border-t border-border pt-3` with
  `divide-y divide-border` rows at `text-xs` on the ground colour. All four rows
  (`snapshot.fetchedAt`, the source, `snapshot.token.partition`,
  `snapshot.treasury.settlementAsset`), `snapshot.note` and `detent-enter`
  survive, verified by grep.
- **The disabled treatment is a token, not an opacity.** `disabled:opacity-50`
  came off the cva base entirely. Each variant now names its own disabled state:
  the gold `default` becomes a bordered, unfilled control with
  `muted-foreground` ink, the others take `disabled:text-muted-foreground`, and
  `destructive` keeps its oxide rule and takes `disabled:text-bad`. The rule was
  moved out of the base on purpose: two `disabled:text-*` utilities in one class
  string have equal specificity, so the winner would depend on Tailwind's output
  order rather than on the variant. `disabled:pointer-events-none`,
  `rounded-none`, `min-h-11` and `min-h-12` are all intact.
- **The refusal control is now the loudest control on the page.** `destructive`
  is `border-2 border-destructive bg-destructive ... text-destructive-foreground`
  set `font-semibold uppercase tracking-[0.14em]`. Both halves are existing
  tokens (`--destructive` is `--oxide`, `--destructive-foreground` is `--ground`)
  and the wide-tracked capitals are the `detent-label` idiom the product already
  reads in. Disabled, it drops the fill and keeps the 2px oxide rule with oxide
  ink, so it never fades to the pink in `before-desktop-page-2.png`.
- **The tamper field is an editable cell.** `bg-transparent` with no foreground
  made `7756.25` indistinguishable from placeholder text. It is now
  `bg-card ... text-foreground`, with `disabled:bg-muted` rather than a text
  fade, so the value stays in ink before the lock as well as after it and is
  legible in a compressed recording. `placeholder:text-muted-foreground` and
  `<label htmlFor="tamper">` are untouched.

**Failed attempts.** None. No slice needed a second correction pass, and no edit
was reverted.

**Files changed.** Added: `.farm-delta.md`, `.farm-commits.json`. Edited:
`components/rail.tsx`, `app/layout.tsx`, `components/operations-console.tsx`,
`components/ui/button.tsx`, `components/ui/input.tsx`,
`components/console-states.tsx`, `app/page.tsx`, `IDENTITY.md` (one dated line
appended under Amendments, nothing above it touched), this file. Nothing under
`lib/`, `contracts/`, `fixtures/`, `scripts/` or `app/api/` was opened for
writing. `fixtures/register.seed.json` is untouched, so the demo still carries 12
holders and 3 held rows. `contracts/script/Smoke.s.sol` is untouched and still
reads `DEPLOYED_CONTRACT`.

**Commands run.** None. This phase was file only and the agent had no shell: the
tools were Write, Edit, Read, Glob and Grep. Every command below belongs to the
runner or to a human.

The runner's commands: `npm install`, `npm run build`, the per-slice commit
replay from `.farm-commits.json` with a closing `faz-8: structural frontend
overhaul` commit, then push and the Vercel redeploy.

**Acceptance items not met, with evidence.**

- `app/icon.svg` carries four hex literals (`#f4f1ea`, `#ece7dc`, `#ad8c3a`,
  `#9c3b2a` at lines 2 to 5). The gate reads "no hex literal under `app/` or
  `components/` outside `app/globals.css`". It is the pre-existing favicon
  convention file, not a component; an SVG served as its own document cannot read
  the custom properties in `app/globals.css`, and the four values are
  IDENTITY.md's own GROUND, SURFACE, ACCENT and SECOND. Zero hex literals exist
  in any `.tsx` under `app/` or `components/`. Left as it stands rather than
  breaking the favicon.
- Everything that needs a command is unverified: `npm run build`, `npm test`,
  `forge test`, the devtools sweep at 360px, 390px, 768px and 1440px, the cold
  private window stranger test and Lighthouse were never executed here. In
  particular the mobile rail bar, the segmented corporate action group and the
  new disabled and destructive states have been reasoned about from the class
  strings and never rendered.
- The Kept row in `.farm-delta.md`: at 390px the plan table still shows only
  Holder and Account, with Position, Coupon due and Status behind the horizontal
  scroll of the `min-w-[46rem]` grid at
  `components/operations-console.tsx:509-511`. Deliberate, and the amount the
  judge edits is printed again in ink in the tamper field.
- `/record/[planHash]` was read and inherits every treatment through the shared
  shell and `components/console-states.tsx`; nothing in it needed a fix, so
  nothing in it was edited. That claim is from reading the file, not from opening
  the route.

**Carried forward, still unrun from Phases 2 to 5, verbatim.**

- The live ATS register read. `liveRegisterAdapter.load()` has never run against
  a deployed ATS token, and the live treasury cover in `lib/hedera.ts:189` has
  never read a real settlement token.
- The live Privy install and submit. `installPolicy`, `submitTransaction` and
  `revokePolicy` have never run against a real Privy app, so the response shapes
  in `lib/schemas.ts` are written from documentation.
- The whole anchor write path. `anchorPlan`, `settlePlan` and `abandonPlan` have
  never reached a deployed `PlanAnchor`; `writeContract` with `type: "legacy"` at
  `lib/anchor.ts:242` is unproven against the relay.
- The `planOf` struct decode. `readPlanRecord` casts the result to an object with
  named fields (`lib/anchor.ts:174`). If viem hands back a positional tuple
  instead, every field reads as undefined and `state` falls to `unknown`; that
  cast is the one place to change.
- The settled state of `/record/[planHash]` has never been seen on screen. With no
  `NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS` the route renders `unwired`, which is the
  documented degraded state.

**The mark.** `public/brand/logo.png` does not need a Marka rerun. It reads as a
gold ring on parchment with an oxide-red detent, which is GROUND, ACCENT and
SECOND exactly as IDENTITY.md sets them, and it is rendered exactly once, inside
the home `Link` in `components/rail.tsx`, as one `<Image>` plus one text node.
No second brand image exists anywhere under `components/`.

**Open questions.**

- Nothing was cut this phase, so nothing is parked here from the cut protocol.
- The plan table at 390px, carried from the Kept row above. If a later phase
  wants the coupon amount on screen without a sideways drag, the cheapest change
  is a second, stacked rendering of the five fields behind `sm:hidden` beside the
  existing grid, at `components/operations-console.tsx:509`. It doubles the
  markup for the table, which is why it was not done inside this budget.
- `.detent-ruled` in `app/globals.css:107` and
  `public/illustrations/ledger-rule.svg` are now referenced by nothing. Either
  give the rule a home where no text sits on it (the plan card's footer band at
  `components/operations-console.tsx` is the obvious candidate) or delete both in
  a later pass. Deleting an asset was out of fence here.
- The rail's `lg` column and the layout's mobile block render the same four About
  and Security rows, so the `dl` terms appear twice in the DOM at `lg` and up,
  once hidden. If that matters for a screen reader audit, the fix is to render
  `AboutSecurity` only in the layout and drop the rail copy, which costs the rail
  its footer at desktop width.

**Next best step.** Unchanged and still blocking: fund the account behind
`FARM_EVM_PRIVATE_KEY` with testnet HBAR
(https://portal.hedera.com/faucet, 100 HBAR per request, and the first
transaction must be paid by that key to break the hollow account trap), deploy
`PlanAnchor` over `https://testnet.hashio.io/api` with `--legacy`, run
`contracts/script/Smoke.s.sol`, paste the address and the two transaction hashes
under "On chain proof" in `README.md` and the address into `SECURITY.md`, set
`NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS`, then walk DEMO.md steps 1 to 6 on the live URL
in a cold private window, once at phone width.

### Phase 9, 2026-09-12. The scene pass and the submission package

**Goal.** Two halves. Make the console read as a funded product on camera: give
the L6 rail section awareness, stage the fold with the existing M4 wipe, tie the
four pinned policy conditions to the call they pin, and put an engraved plate
where the page was blank. Then write the submission package, which is the half
that cannot be cut: an unsubmittable beautiful site scores zero.

**Status.** All five slices landed. Nothing was cut. Nothing was executed: this
phase had Write, Edit, Read, Glob and Grep and no shell, so `npm run build`,
`npm test`, `forge test` and every browser check are unrun here. Every grep
quoted below was actually run against the working tree in this session and its
result is quoted verbatim.

The diagnosis, the eight changes and the proof strings live in `.farm-delta.md`
at the repo root, written before any other file was touched.

**Decisions.**

- **The rail reports position, it does not grow a stepper.** The six section
  links moved into `components/section-progress.tsx`, a client component, so
  `components/rail.tsx` stays a server component. An `IntersectionObserver` with
  `rootMargin: "-12% 0px -68% 0px"` watches the five DEMO section ids and marks
  whichever is first in document order inside that band; that is stable while a
  long section like `#plan` scrolls past, where "whichever fired last" is not.
  The marking is `aria-current="location"`, `text-foreground`, and a gold left
  border held behind `lg` because a left rule on a horizontal scrolling row reads
  as a divider rather than as a marker. Every link renders and navigates with
  JavaScript off: nothing structural is behind the effect. `#brief` is
  deliberately not observed, and on `/record/[planHash]` none of the five ids
  exists, so nothing is marked and the rail reads exactly as it did before.
- **The fold stages on the rules that already existed.** The masthead's four
  children each took `detent-enter` inside a `detent-stagger` container, so the
  delays come from the `nth-child` rules in `app/globals.css` and not from an
  inline `--delay`. The register note keeps its own `detent-enter` and is no
  longer the only thing on the first screen that moves.
- **One new class, no second keyframe.** `.detent-band` declares nothing on its
  own; the whole rule body sits inside `@supports (animation-timeline: view())`
  and runs the existing `detent-wipe` on the element's own scroll progress
  (`animation-range: entry 15% cover 40%`). A browser without scroll-driven
  animations gets a plain band, never a hidden one, which is the failure mode
  that matters. `app/globals.css` still contains exactly one `@keyframes` block.
- **Meshy was unavailable, so the plates are hand-authored SVG.** The Meshy tools
  are not in this session's toolset, so the five-plate family is the documented
  fallback: `public/brand/plate-plan.svg`, `plate-policy.svg`, `plate-refusal.svg`,
  `plate-register.svg` and `plate-record.svg`, written by hand as flat matte
  ledger shapes on IDENTITY's six values, square corners, no gradient, no glow,
  no circuit or hexagon or orbit motif. They render through one wrapper,
  `components/plates.tsx`, with `unoptimized` because Next's image optimizer
  refuses SVG without a `next.config.ts` change and that file is out of fence.
  Each carries `alt=""` and `aria-hidden="true"`: they are section visuals, and
  none of them renders in the rail or in the register masthead, so LOGO_POLICY is
  untouched.
- **The policy card became a diagram rather than a list.** The call is printed
  once as one wrapped strip (chain, destination, selector, payload) and each
  condition is a control that lights the fragment it pins, on hover and on focus
  alike, with one sentence of plain English under the active row. The controls go
  through the `Button` primitive with `variant="ghost"`, which renders a real
  `<button>` and already carries `focus-visible:ring-2 focus-visible:ring-ring`
  in its cva base; that satisfies the phase brief's "a real `<button>`" and
  CLAUDE.md's "every interactive element goes through `components/ui/*`" at the
  same time. The lit and unlit states are a ternary on `className` rather than a
  `data-lit` attribute with `data-[lit=true]:` variants, because `Button` is typed
  as `React.ComponentProps<"button">` and TypeScript's `data-*` escape hatch
  applies to intrinsic elements only, so the attribute form would not have
  compiled.
- **The brief lost 450 words and gained three objects.** One lead sentence plus
  the existing outline Button, then three steps of one sentence each with a plate
  apiece, then the two "Why this exists" paragraphs kept as they were, then the
  simulator prose folded into a `<details>` carrying a four row table. The ledger
  rule sits behind the plates and under no running text, which is the Phase 8
  open question closed: `detent-ruled` and `public/illustrations/ledger-rule.svg`
  are referenced again.
- **The package is written against what the demo actually shows.** Every sponsor
  write-up in `SUBMISSION.md` ends with a "state of play, stated plainly"
  sentence naming the seed register and the locally compiled policy as such. No
  field claims a live Privy install or a live ATS read that has not been run.

**Where every number on screen comes from.** The three interactive moments
display these and nothing else:

- The rail's section progress displays no number at all.
- The `#brief` strip contains exactly one counted thing, "Two officers", which is
  the two entries in `approvers` in `lib/data.ts` and `QUORUM_THRESHOLD` in
  `lib/config.ts`. Every other sentence in the strip is countless on purpose.
- The policy explorer displays only live values: the chain id comes from the
  compiled `chain_id` condition, which `lib/plan.ts` fills from `CHAIN_ID`; the
  destination is `security.address` in `lib/data.ts`; the selector and the
  calldata are derived in `lib/plan.ts` from the `signature` in `lib/data.ts`
  `actions` and the holder rows in `fixtures/register.seed.json`. There is no
  literal address, hash or amount anywhere in `components/policy-explorer.tsx`.

**Asset to component pairs, all five plates referenced by a renderer.**

| Asset | Rendered by | Where it lands |
| --- | --- | --- |
| `public/brand/plate-plan.svg` | `components/plates.tsx`, from `app/page.tsx` | `#brief` step 1, "Read the plan" |
| `public/brand/plate-policy.svg` | `components/plates.tsx`, from `app/page.tsx` | `#brief` step 2, "Lock the key" |
| `public/brand/plate-refusal.svg` | `components/plates.tsx`, from `app/page.tsx` | `#brief` step 3, "Watch it refuse" |
| `public/brand/plate-register.svg` | `components/plates.tsx`, from `components/console-states.tsx` | `PlanEmptyState` |
| `public/brand/plate-record.svg` | `components/plates.tsx`, from `components/console-states.tsx` | `LedgerEmptyState` |

**Failed attempts.** None. No slice needed a second correction pass and no edit
was reverted. One change was made pre-emptively rather than after a failure: the
policy explorer's lit state was written as a `data-lit` attribute first and
rewritten as a `className` ternary before anything else was touched, for the
TypeScript reason given above.

**Files changed.** Added: `components/section-progress.tsx`,
`components/plates.tsx`, `components/policy-explorer.tsx`,
`public/brand/plate-plan.svg`, `public/brand/plate-policy.svg`,
`public/brand/plate-refusal.svg`, `public/brand/plate-register.svg`,
`public/brand/plate-record.svg`, `SUBMISSION.md`, `docs/VIDEO.md`,
`docs/SCREENSHOTS.md`, `LICENSE`, `.farm-commits.json`. Edited: `.farm-delta.md`,
`components/rail.tsx`, `components/operations-console.tsx`,
`components/console-states.tsx`, `app/page.tsx`, `app/globals.css`, `README.md`,
`IDENTITY.md` (one dated line appended under Amendments, nothing above it
touched), this file. Nothing under `lib/`, `contracts/`, `fixtures/`, `scripts/`
or `app/api/` was opened for writing. `public/brand/logo.png` and
`public/brand/og.png` are untouched, `fixtures/register.seed.json` is untouched,
`next.config.ts` is untouched, no dependency was added, no route was added and no
environment variable was added.

**Commands run.** None. This phase was file only and the agent had no shell: the
tools were Write, Edit, Read, Glob and Grep. Every command below belongs to the
runner or to a human.

The runner's commands: `npm install`, `npm run build`, the per-slice commit
replay from `.farm-commits.json` with a closing `faz-9: the scene pass and the
submission package` commit, then push and the Vercel redeploy. No tag:
`v0.1-hackathon` was Phase 7's move.

**Acceptance items not met, with evidence.**

- **One Phase 8 `proof-gone` string returns 1 match, and it is not a
  regression.** `max-w-[28ch] text-sm leading-relaxed text-muted-foreground` hits
  `components/rail.tsx:113`. Phase 8's own replacement for that row was
  `hidden max-w-[28ch] text-sm leading-relaxed`, which contains the old string as
  a substring, so the row could never have returned zero on the day it was
  written. The behaviour Phase 8 claimed is intact: the blurb is still held
  behind `lg`. The class string was deliberately not reordered to make the grep
  pass, because reordering classes to satisfy a regression check would defeat the
  check. The other eleven Phase 8 `proof-gone` strings return **0**.
- Phase 8's `proof-new` for its C11 row, `id="brief" className="max-w-[68ch]
  space-y-8`, now returns **0**: the section carries `space-y-10` since this
  phase added the strip and the disclosure to it. The gate only requires Phase 8
  `proof-gone` strings to stay at zero, but it is recorded here rather than left
  for a reviewer to find.
- `app/icon.svg` carries four hex literals (`#f4f1ea`, `#ece7dc`, `#ad8c3a`,
  `#9c3b2a` at lines 2 to 5), carried unchanged from Phase 8. It is the
  pre-existing favicon convention file, not a component; an SVG served as its own
  document cannot read the custom properties in `app/globals.css`, and the four
  values are IDENTITY.md's own. **Zero hex literals exist in any `.tsx` under
  `app/` or `components/`.** The five plates carry the same six IDENTITY values
  and are under `public/`, which the gate does not cover.
- Everything that needs a command is unverified: `npm run build`, `npm test`,
  `forge test`, the devtools sweep at 390px and 1440px, the cold private window
  walk, Lighthouse, and whether the five plates return 200 on the live URL were
  never executed here. In particular the `IntersectionObserver` band, the
  scroll-driven `animation-timeline` band and the hover-and-focus highlighting
  have been reasoned about from the code and never rendered in a browser.
- The `<details>` disclosure in `app/page.tsx` is closed by default, so the
  comparison table is one click from view rather than on screen. That is the
  point of the change, but it means a judge who does not click never sees the
  competitive claim. It is stated in `README.md` under "How it differs from what
  already exists" as well, which is where a judge reading the repo will meet it.
- `/record/[planHash]` was read and inherits every treatment through the shared
  shell and `components/console-states.tsx`; nothing in it needed a fix this
  phase, so nothing in it was edited. That claim is from reading the file, not
  from opening the route.

**Grep evidence, run in this session.**

- Every Phase 9 `proof-gone`: **0 matches** outside `.farm-delta.md`. Every
  `proof-new`: **at least 1**. Counts are in the `.farm-delta.md` table.
- Dead hex and banned keyframes over `app/` and `components/`
  (`0b0f14|080b11|0f172a|0a0f1a|10151f|111820|1e293b|1e2a36|212b3d|2dd4bf|5eead4|14b8a6|0d9488|99f6e4|34d399|22d3ee|67e8f9|06b6d4|0891b2|38bdf8|0ea5e9|f5a524|fbbf24|f59e0b|fade-up|float-y|glow-pulse|caret-blink|pulse-dot`):
  **0 hits**, both directories.
- Banned shapes over `app/` and `components/`: `font-mono` **0**,
  `role="tablist"` **0**, `animate-pulse` **0**, `--delay` **0**, `--d:` **0**,
  `rounded-xl` **0**, `rounded-full` **0**, `backdrop-blur` **0**, `mask-image`
  **0**, `border-dashed` **0**, `CopyChip` **0**, `Reveal` **0**.
- `@keyframes` in `app/globals.css`: **1**, and it is `detent-wipe`.
  `animation-timeline: view()` appears once, inside `@supports`, and
  `.detent-band` appears in the `prefers-reduced-motion: reduce` block.
- Hex literals over `app/`: `app/globals.css` (the IDENTITY values) and
  `app/icon.svg` only. Over `components/`: **0**.
- `pending|not recorded|to be added|coming soon` over `README.md` and
  `SUBMISSION.md`: **0**. Em dash, en dash and every banned word over all
  Markdown: **0**, except the sentence in this file that lists the banned words.
- `<ADD_VIDEO_URL>` appears in `README.md` (deployed artefacts table) and in
  `SUBMISSION.md` (field 7). The two bounty rows are byte-identical across
  `README.md:148-149`, `SUBMISSION.md:126-127` and `DELIVERY.md`.
- `contracts/script/Smoke.s.sol:18` still reads `vm.envAddress("DEPLOYED_CONTRACT")`.
  `.gitignore` already carries `.env*` with `!.env.example`, twice. Every
  `process.env` read in the repo (`lib/config.ts`, `lib/public-config.ts`,
  `app/layout.tsx:29`) has a matching line in `.env.example`. None of the three
  needed an edit.

**Carried forward, still unrun from Phases 2 to 8, verbatim.**

- The live ATS register read. `liveRegisterAdapter.load()` has never run against
  a deployed ATS token, and the live treasury cover in `lib/hedera.ts:189` has
  never read a real settlement token.
- The live Privy install and submit. `installPolicy`, `submitTransaction` and
  `revokePolicy` have never run against a real Privy app, so the response shapes
  in `lib/schemas.ts` are written from documentation.
- The whole anchor write path. `anchorPlan`, `settlePlan` and `abandonPlan` have
  never reached a deployed `PlanAnchor`; `writeContract` with `type: "legacy"` at
  `lib/anchor.ts:242` is unproven against the relay.
- The `planOf` struct decode. `readPlanRecord` casts the result to an object with
  named fields (`lib/anchor.ts:174`). If viem hands back a positional tuple
  instead, every field reads as undefined and `state` falls to `unknown`; that
  cast is the one place to change.
- The settled state of `/record/[planHash]` has never been seen on screen. With no
  `NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS` the route renders `unwired`, which is the
  documented degraded state.

**Open questions.**

- Nothing was cut this phase, so nothing is parked here from the cut protocol.
  All five plates, the scroll-driven band and the policy explorer landed.
- The scroll-driven band runs only where `animation-timeline: view()` is
  supported, which today is Chromium and not Safari or Firefox. The demo is
  recorded in one browser, so this is a nicety rather than a risk, but a reviewer
  opening the live URL in Safari sees a static strip where the video shows a
  wipe. If that matters, the alternative is an `IntersectionObserver` that adds
  `detent-enter` on first sight, which costs a second observer and a second
  client component.
- `components/section-progress.tsx` observes five hard-coded ids that also live
  in `sections` in `components/rail.tsx`. Renaming a section anchor means editing
  both, and DEMO.md says the anchors are load bearing. One shared constant would
  close it; it was not worth a new module inside this budget.
- The plan table at 390px, carried from Phase 8. Position, Coupon due and Status
  still sit behind the horizontal scroll of the `min-w-[46rem]` grid.
- The rail's `lg` column and the layout's mobile block still render the same four
  About and Security rows, carried from Phase 8, so the `dl` terms appear twice
  in the DOM at `lg` and up, once hidden.

**Next best step.** Unchanged and still the only thing blocking a complete
submission: fund the account behind `FARM_EVM_PRIVATE_KEY` with testnet HBAR
(https://portal.hedera.com/faucet, 100 HBAR per request, and the first
transaction must be paid by that key to break the hollow account trap), deploy
`PlanAnchor` over `https://testnet.hashio.io/api` with `--legacy`, run
`contracts/script/Smoke.s.sol` with `DEPLOYED_CONTRACT` set, paste the address
and the two transaction hashes into the deployed artefacts table and the "On
chain proof" section in `README.md` and the address into `SECURITY.md`, set
`NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS`, then record the video against `docs/VIDEO.md`
and work `SUBMISSION.md` field by field into the form.

## The manual submit checklist

Everything here is a human's click. Nothing automatic reads this list.
`DELIVERY.md` carries the opt-in mechanics, `SUBMISSION.md` carries the text for
every field, `docs/VIDEO.md` carries the shot list.

- [ ] Tick both opt-in bounty boxes on the ETHOnline 2026 project form:
      `🪙 Tokenization of Anything` (`$6,000, Up to 3 teams: $2,000 each`) and
      `🏢 Best B2B financial product` (`$2,500`). The strings are byte-identical
      in `README.md`, `SUBMISSION.md` and `DELIVERY.md`; paste, do not retype.
- [ ] Paste the live URL: `https://detent-app.vercel.app`
- [ ] Paste the repo URL: `https://github.com/mericcintosun/detent`
- [ ] Record the video against `docs/VIDEO.md`, upload it, and put the URL in
      three places: the submission form, the deployed artefacts table in
      `README.md`, and field 7 of `SUBMISSION.md`. All three carry the literal
      `<ADD_VIDEO_URL>` until then.
- [ ] **Optional since Phase 6, not a blocker.** The three on chain placeholders
      are gone: `README.md` and `SECURITY.md` now state that `PlanAnchor` was not
      deployed for this submission, which is the honest state and needs no
      further edit. Only if the deploy and the smoke run actually happen before
      the deadline, put the address and the two transaction hashes into the
      deployed artefacts table and the "On chain proof" section of `README.md`,
      and the address into `SECURITY.md` by hand: the deploy step rewrites only
      `.env.local` and `README.md`.
- [ ] Confirm the repository is **public**.
- [ ] Confirm the commit history is **not one commit on the final day**. Both
      prize pages call that out by name.
- [ ] Confirm `LICENSE` is present and named in `README.md`. It is MIT.
- [ ] Paste the pre-existing code declaration from field 11 of `SUBMISSION.md`.
      The event's wording is `Varsa önceden yazılmış kodun beyan edilmesi`, "any
      previously written code must be declared", and the answer is that there is
      none: every file here was written during the event.
- [ ] Paste both sponsor write-ups and both feedback blocks from `SUBMISSION.md`
      fields 9 and 10. Both prizes ask for feedback, and an empty feedback box is
      a scored answer left blank.
- [ ] Leave the third bounty slot empty unless time appears, per `DELIVERY.md`.

**Still mocked and unrun at submission time, if the on chain steps do not
happen.** The live ATS register read, the live Privy install and submit, the
whole anchor write path, the `planOf` struct decode at `lib/anchor.ts:174`, and
the settled state of `/record/[planHash]`. The console names each degraded state
on screen ("Cached register", "Treasury key, compiled locally", the anchor note,
and the record route's `unwired` state), and `SUBMISSION.md` states each one in
the write-up it belongs to. A submission made on the cached path is honest and
complete; one that implies a live read it did not make is neither.

## Phase 6, the first jury fixes

**Goal.** The first judge panel scored 5.8 with `fix-then-submit` and two of three
judges would not advance the project. Not one finding was about the idea: every
blocker was a claim the repo made that the screen or the README could not back.
This phase closed the agent-owned half of that gap. The README stops promising an
on chain deploy that has not happened, the page states in one line above the fold
which mode a reader is looking at, and the fold leads with the product name and
its promise instead of with the name of a fixture security.

**Status.** All three code and document slices landed, plus this ledger. Nothing
was cut. Everything that needs a shell (`npm run build`, `npm test`,
`forge test`, the live URL spot check) is the runner's or a human's, and is
recorded below as unverified rather than claimed.

**Decisions.**

- **The retraction is worded as a decision, not as an omission.** The three
  angle-bracket rows are gone from the deployed artefacts table and one row takes
  their place naming the contract, its two fuzz tests and both scripts by path,
  and saying that the app renders its documented `unwired` state when
  `NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS` is absent. "On chain proof" now opens with
  "What is on chain today: nothing" and carries the exact two `forge script`
  commands that fill it. A judge reading either place learns the state in one
  sentence and can check every path named.
- **The mode line is built in the console, not passed as a string.** `lib/register.ts`
  gained one re-export, `isPrivyLive` from `lib/privy.ts`, so `app/page.tsx` reads
  the signer mode through the same door it already reads the snapshot through and
  never imports the server-only Privy module by name. What crosses to the client
  is a boolean, `signerLive`. The console assembles the line itself from
  `snapshot.source`, that boolean, `CHAIN_ID` and, once a plan is locked,
  `installation.policyId`.
- **`CHAIN_ID` came through `lib/plan.ts`, not through a new import of
  `lib/public-config.ts`.** `lib/plan.ts:30` already re-exports it as a value and
  the console already imports from `lib/plan`, so the line reads the same constant
  the compiled `chain_id` condition is built from, with no second config import in
  a client component.
- **The status line is the first child of the existing `detent-stagger`
  container.** No inline `--delay`, no new keyframe: the container's nth-child
  delays already cover seven children through the `n + 7` clause in
  `app/globals.css`. The masthead now holds the mode line, the eyebrow, the `h1`,
  the promise, the security name, the register count and the badge row, in that
  order.
- **`snapshot.token.name` moved down two positions rather than being deleted.** It
  is now a `detent-label` line under the promise, so DEMO step 1 still prints the
  security name, the token address linked to HashScan, the source badge, 12
  holders and 3 held rows.
- **`PRIVY_WALLET_ID` does not exist in this repo and was not invented.** The
  phase brief named it; the real variable is `PRIVY_TREASURY_WALLET_ID`
  (`.env.example:51`, read in `lib/config.ts:29`). The README section documents
  the real name, and it also documents that `isPrivyLive()` needs
  `NEXT_PUBLIC_ADAPTER_MODE=real` beside `PRIVY_APP_ID` and `PRIVY_APP_SECRET`,
  which is what `lib/privy.ts:65-71` actually tests. No environment variable was
  added anywhere.
- **Two stale claims were corrected while their files were open.** "The recorded
  demo runs with both sets filled in" in the Quickstart was false and is now the
  opposite sentence, naming the cached path the video actually shows; it is the
  same finding as the second blocker, one document further down. And the
  `@privy-io/react-auth` grep row in `SECURITY.md` claimed "one hit,
  `README.md:144`", which drifted; it now names where the string does and does not
  appear instead of a line number.

**Failed attempts.** None. No edit needed a second correction pass and nothing was
reverted.

**Files changed.** Edited: `README.md`, `SECURITY.md`, `DELIVERY.md`,
`lib/register.ts`, `app/page.tsx`, `components/operations-console.tsx`, `DEMO.md`,
`IDENTITY.md` (one dated line appended under Amendments, nothing above it
touched), this file. Added: nothing except the rewritten `.farm-commits.json`.
Untouched on purpose: `SUBMISSION.md`, `docs/VIDEO.md`, `docs/SCREENSHOTS.md`
(the farm's surfaces this round), `fixtures/register.seed.json`, `package.json`,
`public/brand/`, `app/opengraph-image.png`, everything under `contracts/`,
`app/api/` and `lib/` other than the two-line re-export in `lib/register.ts`.

**Commands run.** None. This phase was file only: the tools were Write, Edit,
Read, Glob and Grep, and there was no shell for `npm`, `git`, `forge` or a dev
server. Every claim below that needed one is marked unverified.

**Acceptance items not met, with evidence.**

- `npm install`, `npm run build`, `npm test` and `forge test` were never run here.
  The type risk in this phase is one new required prop, `signerLive`, on
  `OperationsConsole`; `app/page.tsx:78` is the only call site
  (`grep -n OperationsConsole` returns exactly that one render plus the
  declaration), so a missing-prop error has one place to appear.
- The rendered fold was never opened in a browser. The order of the seven
  masthead children, the wrapping of the mode line at 360px and the policy id row
  in the policy card are read off `components/operations-console.tsx` and not off
  a screen.
- The live status line has never printed its live half, because no phase has ever
  had Privy credentials. `signerLive` is false on every run so far.

**Open questions.**

- Nothing was cut, so nothing is parked here from the cut protocol.
- The mode line and the treasury key banner now both name the key mode, in
  different words: the line says `Treasury key, policy evaluated locally` and
  `components/console-states.tsx` says "compiled locally". Neither is wrong and
  the duplication is deliberate for now (one is above the fold, one is at the
  point of signing), but a later phase may want one shared string.
- The policy id appears three times once a plan is locked: the mode line, the new
  `Policy id` row in the compiled policy card, and the audit `detail` at
  `components/operations-console.tsx:308`. That is on purpose, because the panel
  could not find it at all, but it is worth revisiting if the fold gets crowded.
- Everything in the Phase 9 open-questions list above still stands: the plan table
  at 390px, the duplicated About and Security rows, the Safari fallback for the
  scroll-driven band, and the five hard-coded section ids in
  `components/section-progress.tsx`.

**Next best step.** Regenerate the video script and the submission pack from the
Jüri card before the second panel runs, so the judges score the fixed
deliverables rather than the old ones. Those two surfaces are the farm's, and
three of the six panel items are on them. After that, and only if a human has
time: fund the account behind `FARM_EVM_PRIVATE_KEY`, deploy `PlanAnchor`, run
the smoke script, and put the address and the two hashes back into `README.md`
and `SECURITY.md`, which turns the retraction row back into a proof row.

## Phase 6 fix ledger

Every item the first panel raised appears exactly once below.

### Applied

- **Blocker, all three judges: "README'nin \"Deployed artefacts\" tablosu
  doldurulmamış placeholder'larla gönderiliyor, yani zincir üstü iddiaların tek
  bir koordinatı yok."** Criteria lifted: Teknik zorluk, İşlevsellik. The panel's
  own fallback was applied, because no deploy was possible in this phase. The
  three placeholder rows are removed from the deployed artefacts table in
  `README.md` and replaced by one row that names
  `contracts/src/PlanAnchor.sol`, `contracts/test/PlanAnchor.t.sol`,
  `contracts/script/Deploy.s.sol` and `contracts/script/Smoke.s.sol` and states
  the `unwired` state. The malformed three-cell Demo video row in the same table
  is now a two-cell row carrying
  `https://detent-app.vercel.app/demo-video.mp4`. "On chain proof" in `README.md`
  is rewritten to say what is on chain today (nothing), what would be there, and
  the two commands that fill it, and it keeps the instruction that `SECURITY.md`
  needs the address by hand. `SECURITY.md` carries the same retraction in one
  sentence. `DELIVERY.md`'s checklist item is now conditional on the contract
  actually being deployed. `grep -n` for the three placeholder strings over those
  three files returns zero.
- **Blocker, two judges: "Canlı deploy sponsor ürünlerini çalıştırmıyor (register
  cache'ten, policy lokalde değerlendiriliyor) ama video ve deck aynı ekran için
  canlı Hedera testnet iddiasında bulunuyor."** Criterion lifted: İşlevsellik.
  The code half is applied exactly as the panel wrote it: the fixture path is not
  removed, a line is added above it. `lib/register.ts` re-exports `isPrivyLive`,
  `app/page.tsx` reads it beside `getRegisterSnapshot()` and passes `signerLive`,
  and `components/operations-console.tsx` renders one `detent-enter detent-label`
  line as the first child of the masthead's `detent-stagger` container: the
  register source, the treasury key mode and `Hedera testnet 296`, joined by the
  middle dot the eyebrow uses, with `Privy policy <id>` appended once a policy
  exists. The register badge row and the register note block are untouched. The
  compiled policy card also prints `installation.policyId` as a labelled row, so
  the id is on screen and not only inside the audit `detail` string. `README.md`
  documents which keys flip each half of the line. The video and deck half of this
  finding is the farm's, listed below.
- **fixList rank 6: "app/page.tsx, ilk ekran, \"Bosphorus Mercantile Equity\"
  başlığının üstü ... Kaydırmadan görünen alana ürün adını ve tek cümlelik vaadi
  koy."** Criterion lifted: Yaratıcılık. Applied in
  `components/operations-console.tsx`, not in `app/page.tsx`: the masthead markup
  lives in the console component, and `app/page.tsx` only renders it. The `h1` is
  now `Detent` in `font-display` on the size and tracking classes it already had,
  followed by the one-sentence promise, then `{snapshot.token.name}` in the
  eyebrow's treatment, then the unchanged register count line. `DEMO.md` step 1 is
  rewritten to describe the new order and names both files. `IDENTITY.md` carries
  a dated Amendments line stating that no new colour, font, radius or motion value
  was introduced.
- **couldNotVerify: "lib/store.ts'in in-memory mi yoksa kalıcı mı olduğu
  payload'da yok."** Rebutted below, and one sentence was added to `README.md`
  under "Store and migrations" because that section named the cold-start
  consequence but not the second-user one.

### Declined

- Nothing was declined. Every item on the panel's list is either applied above,
  rebutted with file evidence below, blocked on a shell and listed as
  could-not-verify, or on a surface the farm owns.

### Rebutted, with file evidence, no fix needed

These are `couldNotVerify` lines that are wrong about this repo. They are recorded
here rather than acted on.

- **"Stack iddiasındaki \"@privy-io/react-auth\" gerçekten kullanılıyor mu
  belirsiz."** It is deliberately not installed, and the repo says so in three
  places: `README.md:215`, `SECURITY.md:58` and the grep table row at
  `SECURITY.md:71`. `package.json:14-24` lists nine dependencies
  (`@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `next`, `react`,
  `react-dom`, `tailwind-merge`, `viem`, `zod`) and not one is a Privy package,
  because the signing key is a server wallet reached over the REST API from
  `lib/privy.ts`. The string returns no hit in `package.json`, `app/`,
  `components/` or `lib/`; every hit in the repo is prose saying it is absent. The
  `SECURITY.md` row that used to pin this to `README.md:144` was corrected this
  phase, since that line number had drifted.
- **"README aynı bölümde \"Nothing below is aspirational\" diyor ama tabloda
  ..."** The sentence is at `README.md:87-88`, inside the Architecture module map,
  and it is a claim about that mermaid diagram: every box in it is a file that the
  box above imports. It is not above the deployed artefacts table, which is at
  `README.md:15-24`, nine sections earlier. The two were never in the same
  section. Recorded as a correction, and Slice 1 removed the contradiction anyway
  by retiring the placeholder rows.
- **"lib/store.ts'in in-memory mi yoksa kalıcı mı olduğu payload'da yok."** It is
  in-process module scope and nothing else: `const policies = new Map(...)` at
  `lib/store.ts:30` behind the `policyVault` API at `lib/store.ts:33-43`, plus
  `const submissions = new Map(...)` at `lib/store.ts:45` for send idempotency.
  The file's own header comment states the decision and the serverless caveat at
  `lib/store.ts:1-20`, and `README.md` documents the choice and what was rejected
  (a KV blob, Postgres) under "Store and migrations". That section did **not**
  name the second-user consequence, so one sentence was added there: two people on
  the live URL at once share no map, neither sees the other's locked policy or
  audit log, and the durable half is the chain.

### Could not verify, with the missing evidence

Both need a shell and credentials, neither of which this phase had.

- **Whether `installPolicy` has ever received a 200 from `POST /v1/policies`.**
  The call is at `lib/privy.ts:284`, inside the branch guarded by `isPrivyLive()`
  at `lib/privy.ts:264`. No phase of this project has ever had `PRIVY_APP_ID` and
  `PRIVY_APP_SECRET` set, so that branch has never been entered and the response
  shapes in `lib/schemas.ts` are still written from documentation. Missing
  evidence: a Privy app id, an app secret, a server wallet id and a threshold-two
  key quorum id, set in the Vercel project, plus one lock step run against them.
- **Whether `PlanAnchor` is deployed.** It is not, and as of this phase both
  `README.md` and `SECURITY.md` say so. Missing evidence: a funded account behind
  `FARM_EVM_PRIVATE_KEY`, a `forge script script/Deploy.s.sol` run over
  `https://testnet.hashio.io/api` with `--legacy`, and a
  `contracts/script/Smoke.s.sol` run with `DEPLOYED_CONTRACT` set. Until then the
  whole anchor write path (`anchorPlan`, `settlePlan`, `abandonPlan`) and the
  `planOf` struct decode at `lib/anchor.ts:174` stay unproven, as the carried-forward
  list above already records.

### Handled by the farm, nothing was written here for these

Quoted verbatim so the ledger can name them. All four are the submission pack and
the video script, which this phase was told not to touch, and
`SUBMISSION.md`, `docs/VIDEO.md` and `docs/SCREENSHOTS.md` are byte-unchanged.

- **fixList rank 1, surface `submission-text`:** "SUBMISSION.md, 1-4 arası
  alanların tamamı ve \"3. Description\" ilk paragrafı".
- **fixList rank 2, surface `video`:** "video sahne 1 ve sahne 2 (docs/VIDEO.md
  shot list ve seslendirme)".
- **fixList rank 5, surface `submission-text`:** "SUBMISSION.md, her sponsor için
  \"how you used the sponsor tools, feedback and comments\" alanı (Hedera ve Privy
  ayrı)".
- **Blocker 3, product judge:** "Platform formuna giden metin, kurucuya yazılmış
  iç notlar içeriyor ve jüri bunları proje açıklaması sanıp okuyor".

### One bookkeeping note on the ranking

The phase brief quoted fixList ranks 1, 2, 5 and 6 verbatim and the three
blockers. Ranks 3 and 4 were not quoted in the brief, and the closest reading is
that they are the two blockers whose surfaces are code and documentation, which
are the first two applied items above. Nothing was skipped for lack of a quote:
every finding the brief carried is on this list. If the Jüri card holds ranks 3
and 4 as separate items, Phase 7 should check them against this ledger first.

## Phase 7, the second jury fixes and the freeze

**Goal.** Make the screen and the README tell the truth about which engine is
speaking and which address resolves, so the second panel's two standing
objections ("there is no address or policy id to show", "the refusal may be your
own local copy, not Privy") die on the page rather than in an argument. Then
freeze the code.

**Status.** Four code and documentation slices applied, the fifth slice
(verification plus this ledger) done by reading files. No new route, no new
dependency, no new module, no new env variable, no schema change, no touch to
`lib/plan.ts` or `contracts/src`. Nothing was cut: the 50 minutes held.

**Decisions.**

- The status line's fourth segment now branches on `installation.live` rather
  than printing one string for both modes. `lib/privy.ts:266` mints
  `pol_local_<8 hex>` in the local branch, so the old string at
  `components/operations-console.tsx:415` was literally labelling a local id with
  a sponsor's name. The branch is in the component, not in `lib/privy.ts`: the
  id itself is fine, the words around it were the defect.
- The line now ends on `No policy locked yet` before a lock instead of dropping
  the segment. A judge who lands cold and never presses anything still reads the
  term "policy" on the fold and learns where its value will appear, which is what
  both judges said they went looking for and could not find.
- The engine attribution is a prop, `engineLive?: boolean`, and not a second
  `TreasuryKeyState` member. Adding a state would have doubled every branch of
  the switch in `components/console-states.tsx` for one sentence in one branch;
  the optional prop defaults to `false`, so the local wording is what an
  un-passed call renders, which is the safe direction to be wrong in.
- The seed branch of the fold keeps the address on screen rather than hiding it.
  The objection was never that the address exists, it was that clicking it lands
  on an empty explorer page. Plain text plus a badge saying what the address is
  answers that without removing a number the register note also quotes.
- `contracts/README.md` keeps its Sourcify instruction. It is a step for whoever
  deploys, and the surrounding sentence now says so and adds that nothing has
  been verified because nothing has been deployed. Deleting the step would have
  made the deploy path incomplete to fix a claim that lives in `README.md`.

**Failed attempts.** None. No edit needed a second correction, and no slice was
abandoned.

**Files changed.** `README.md` (the Tech stack sentence at :243-251),
`contracts/README.md` (:67-73), `components/operations-console.tsx` (the
`modeLine` construction, the fold's badge and address row, the
`TreasuryKeyBanner` call, the settlement badge row), `components/console-states.tsx`
(`TreasuryKeyBannerProps` and the `tx-rejected` branch), `DEMO.md` (step 1),
`IDENTITY.md` (one dated Amendments line, appended after the Phase 6 line),
`HANDOFF.md` (this section) and `.farm-commits.json` (new, five entries).

Untouched, deliberately: `SUBMISSION.md`, `docs/VIDEO.md`, `docs/SCREENSHOTS.md`
(the farm's surfaces this round, byte-unchanged), `lib/` in its entirety,
`app/` in its entirety, `package.json`, `fixtures/`, `public/brand/`,
`app/opengraph-image.png`, `contracts/` other than the one prose clause above,
and the block above Amendments in `IDENTITY.md`.

**Commands run.** None. This session had Write, Edit, Read, Glob and Grep and no
shell: no `npm`, no `git`, no `forge`, no dev server. Every claim below that
would need one is marked unverified and left for the runner.

**Round-2 ledger.**

- **REGRESSION. Blocker, sponsor-devrel: "SUBMISSION stack'inde beyan edilen
  Sourcify kontrat doğrulamasının karşılığı yok, deploy edilmemiş bir kontratın
  doğrulaması olamaz."** `SUBMISSION.md` is the farm's file and was not touched.
  The same claim in this repo's own file is gone: `Sourcify for verification,`
  is removed from the Tech stack sentence, and the paragraph now at
  `README.md:249-251` states that `PlanAnchor` was not deployed for this
  submission, so there is no address and no transaction hash to quote, naming
  `contracts/test/PlanAnchor.t.sol`. `grep -n "Sourcify" README.md` returns zero
  hits; `grep -n -i "not deployed for this submission" README.md` returns two,
  at `:21` (the table row) and `:249` (the stack paragraph). The single remaining
  Sourcify mention in the repo's instructions is `contracts/README.md:70-73`,
  rewritten to read as a step for whoever deploys and to say outright that
  nothing has been verified because nothing has been deployed.
- **REPEAT. `roundDelta.repeated`: "Geçen turun 4. fix maddesi (Privy policy
  id'sinin ve durum satırının ekrana yazılması): iki jüri de ekranda bir policy
  id göremediğini yazdı."** Phase 6 did add the line, and the defect it left is
  now fixed at `components/operations-console.tsx:407-424`: the fourth segment
  branches on `installation.live`, reading `Privy policy <id>` live and
  `Policy <id>, compiled locally` on the local path, and the same slot reads
  `No policy locked yet` before a plan is locked, so the term is on the fold
  from the first paint. The `Policy id` term-and-value row in the compiled policy
  card is unchanged, at `components/operations-console.tsx:777-780` before this
  phase's insertions. The likeliest reason both judges saw no id stands recorded:
  the id only ever appeared after step 3, and nobody who stops at the fold gets
  that far.
- **NEW, blocker: "Tamper sahnesindeki ret, sponsorun policy motorunun değil
  uygulamanın lokal kopyasının reddi olabilir, Privy ödülü tam da bu sahneye
  dayanıyor."** The judges are right about the run they saw, and the screen now
  says so instead of leaving it to be inferred. `TreasuryKeyBannerProps` in
  `components/console-states.tsx` takes `engineLive?: boolean`, and the
  `tx-rejected` branch prints one extra muted sentence: live reads "Refused by
  the Privy server wallet under the installed policy.", local reads "Refused by
  the local mirror of the same policy evaluator, before any wallet was asked.
  With Privy credentials set, the wallet returns this refusal instead."
  `components/operations-console.tsx` passes `engineLive={settlement?.live ?? false}`
  at the banner call, and the settlement badge row carries one more outline
  badge, `refused by: privy wallet` or `refused by: local policy mirror`, shown
  only when `settlement.verdict.allowed` is false. The `Frame` tones are still
  `neutral | bad | ok` and no colour, border or motion value was added.
- **NEW, blocker: "Video ve deck zincir üstü kanıt vaat ediyor, README aynı
  iddiayı geri çekiyor", plus both judges reporting that they went looking for a
  token address and found nothing that resolves.** The code half is fixed. The
  fold's verified badge and its HashScan link are now inside a
  `snapshot.source === "hedera-testnet"` branch; the cached register renders a
  `border-border text-muted-foreground` badge reading `Seed register address, not
  on chain` and prints the same `shortHex(snapshot.token.address, 12, 8)` with
  the same `title`, as plain text with no `<a>`. The live branch is byte-identical
  to what it was. `DEMO.md` step 1 now describes both branches. The video and
  deck half of this finding is the farm's, quoted below and untouched.

**Held, regressed or re-done: every Phase 6 fix.**

- **The README, SECURITY and DELIVERY retraction of the undeployed contract.**
  HELD. `README.md:21` still carries the one-row retraction, and this phase added
  a second statement of it in the Tech stack section rather than weakening it.
- **The fold status line.** RE-DONE. It held as a line but regressed as a claim:
  it called a `pol_local_…` id a Privy policy id. Fixed in Slice 2, and it now
  also names the policy slot before a lock.
- **The fold reorder that puts the product name first.** HELD. `Detent` in
  `font-display` is still the `h1`, followed by the one-sentence promise and then
  `snapshot.token.name`; this phase changed nothing above the badge row except
  the trailing segment of the status line.
- **The README "Store and migrations" sentence on the second-user consequence.**
  HELD. Untouched this phase.
- **The compiled policy card's `Policy id` row.** HELD. Untouched this phase, and
  the brief explicitly asked for nothing new in that card.
- **One regression found against Phase 6 itself:** the Sourcify claim survived in
  `README.md`'s Tech stack sentence while Phase 6 retracted the deploy everywhere
  else. That is Slice 1, and it is first in `.farm-commits.json`.

**Handled by the farm, nothing written here.** Quoted as the brief carried them,
and `SUBMISSION.md`, `docs/VIDEO.md` and `docs/SCREENSHOTS.md` are byte-unchanged.
No substitute shot list, slide deck or form text was written anywhere in this
repo.

- **fixList rank 1, surface `submission-text`:** "the Sourcify line in
  `SUBMISSION.md`".
- **fixList rank 2, surface `video`:** "scenes 2, 3 and 7 plus the scene 2
  status-line framing".
- **fixList rank 3, surface `deck`:** "slide 7 and video scene 9".
- **fixList rank 4, surface `submission-text`:** "the differentiation paragraph".
- **fixList rank 5, surface `video`:** "scenes 5 and 6 hold times".
- **fixList rank 6, surface `video`:** "the cold open".

One consequence worth stating for whoever writes those: the scene 2 status-line
framing now has to match a line that ends in `No policy locked yet` on the fold
and in `Policy <id>, compiled locally` after step 3, and the tamper scene now has
a sentence and a badge on screen naming the local mirror. A shot list written
against the Phase 6 wording will not match what the camera sees.

**Acceptance gate, compared item by item.**

- *Every round-2 finding routed to code, readme or deploy is applied or declined
  with a reason.* Met. Four findings, four applied, nothing declined; the six
  farm-owned items are quoted above and untouched.
- *The regression is first in `.farm-commits.json`, before any NEW item.* Met.
  Entry 1 is `fix(jury2): retract the Sourcify verification claim from the README
  stack`; the two NEW slices are entries 3 and 4.
- *No new route, no new dependency, no new module.* Met by reading: nothing was
  written under `app/`, `package.json` was not opened for edit, and no file was
  created under `lib/`. UNVERIFIED that the dependency set still installs, since
  `npm install` was not run.
- *Every import in the edited files resolves.* Met by reading: this phase added
  no import statement to either component. `components/console-states.tsx` gained
  one optional prop and one paragraph; `components/operations-console.tsx` reuses
  `Badge`, `shortHex` and `hashscanToken`, all already imported and all still
  used elsewhere in the file, so no import went unused either.
- *`fixtures/register.seed.json` still holds twelve holders with three held rows.*
  Met by reading: twelve `"legalName"` keys, nine `"compliance": "clear"`, so
  three non-clear rows. The file was not touched.
- *`DEMO.md` still names the three files and the six anchors.* Met. Step 1 still
  names `app/page.tsx` and `components/operations-console.tsx`, step 6 still
  names `app/record/[planHash]/page.tsx`, and `#register #plan #policy #send
  #ledger` plus `/record/<planHash>` are unchanged; only the prose of step 1
  changed.
- *`SUBMISSION.md`, `docs/VIDEO.md`, `docs/SCREENSHOTS.md` byte-unchanged.* Met.
  None of the three was opened for writing.
- *Sameness tripwire.* Met by reading. A case-insensitive grep over `app/` and
  `components/` for the nine ground hexes, the twelve accent hexes, the three
  amber hexes, `fade-up`, `float`, `float-y`, `glow-pulse`, `caret-blink`,
  `pulse-dot`, `--delay`, `--d:`, `backdrop-blur`, `rounded-full`, `rounded-xl`,
  `<button` and `<select` returns hits only on `<Button`, the project's own
  primitive. A case-sensitive grep for the same list minus `<Button` returns zero
  matches. `app/globals.css:115` is the only `@keyframes` in the repo
  (`detent-wipe`). `public/brand/logo.png` appears in a rendered page exactly
  once, at `components/rail.tsx:103`; the only other occurrence in `app/` or
  `components/` is the explanatory comment at `components/plates.tsx:4`.
- *`HANDOFF.md` carries the round-2 ledger and a held / regressed / re-done
  verdict per Phase 6 fix.* Met, above.

**Acceptance items not met, with evidence.**

- `npm install`, `npm run build`, `npm test` and `forge test` were never run in
  this session. The type surface this phase added is one optional prop,
  `engineLive?: boolean`, on `TreasuryKeyBanner`; being optional it cannot break
  the one call site, which is the render in `components/operations-console.tsx`
  inside the `#send` card. The other risk is the JSX fragment pair added to the
  fold's badge row; it was written complete but never compiled here.
- Nothing was opened in a browser. The wrapping of the longer status line at
  360px, the badge row now carrying three badges on a refusal, and the seed
  address rendering as plain text are all read off the source and not off a
  screen.
- The live half of every branch this phase wrote has never executed. No phase of
  this project has had Privy credentials, so `installation.live` and
  `settlement.live` have always been false: `Privy policy <id>`, "Refused by the
  Privy server wallet under the installed policy.", `refused by: privy wallet`
  and the whole `hedera-testnet` branch of the fold are unrun code paths.

**Open questions.**

- Nothing was cut, so nothing is parked here from the cut protocol.
- The word "locally" now appears three times on a full run: the status line's
  `Treasury key, policy evaluated locally`, its `Policy <id>, compiled locally`,
  and the banner's "Refused by the local mirror of the same policy evaluator".
  That is deliberate under a panel that missed the point twice, but it is the
  first thing to thin if a later round says the fold is crowded.
- `engineLive` is sourced from `settlement?.live`, which is the send answer. In a
  run where the policy was installed live but the send failed before Privy
  answered, `settlement` is null and the banner is not in `tx-rejected`, so the
  sentence does not print; no wrong attribution is possible today. If a future
  path can set `tx-rejected` without a settlement, that prop needs a second
  source.
- Everything in the Phase 6 and Phase 9 open-questions lists above still stands:
  the plan table at 390px, the duplicated About and Security rows, the Safari
  fallback for the scroll-driven band, and the five hard-coded section ids in
  `components/section-progress.tsx`.

**Next best step.** The runner's: `npm install`, `npm run build`, the commits
from `.farm-commits.json`, the Vercel redeploy, then the tag `v0.1-hackathon`.
The code is frozen after that redeploy and only the submission form remains. The
one thing that would still change a judge's mind, and it needs a human with a
funded account rather than another phase: fund the account behind
`FARM_EVM_PRIVATE_KEY` on Hedera testnet 296, run `contracts/script/Deploy.s.sol`
with `--legacy` and then `contracts/script/Smoke.s.sol` with `DEPLOYED_CONTRACT`
set, and paste the address and the two hashes into the `README.md` table by hand.
That turns the retraction row into a proof row and retires the deploy half of two
round-2 blockers at once.
