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
| `contracts/src/PlanAnchor.sol` | Anchors and settles plan hashes on chain. |
| `contracts/script/Deploy.s.sol`, `Smoke.s.sol` | Deploy, then one real interaction for proof. |
| `public/brand/logo.png`, `public/brand/og.png` | Pre-generated brand rasters. `og.png` is the register figure in the masthead. |
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
