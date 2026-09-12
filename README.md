# Detent

Operator console for tokenized securities: preview a coupon run or a forced
transfer line by line, then lock the treasury wallet to exactly that transaction.

> Live demo: https://detent-app.vercel.app
> Video: <ADD_VIDEO_URL>

## The problem

Whoever operates a tokenized security, a fund administrator or the issuer's ops
lead, spends the quarter on actions that cannot be undone: coupon
distributions, court ordered transfers, freezing a screened address,
redemptions. They run against a live holder set. Today the step before signing
is reading an explorer or trusting a script, and the key that signs is a general
purpose treasury key with rights over everything the contract exposes. There is
nothing between "I think this is right" and "I just signed something the whole
cap table will feel". A wrong parameter, a lapsed allowlist entry or a thin
treasury only shows up after the transaction reverts or, worse, succeeds.

## The solution

Detent reads the holder set and the compliance state of an Asset Tokenization
Studio token from Hedera testnet, replays the selected corporate action off
chain and prints a plan: who receives what, which address the transfer hook will
reject, how much cover the treasury actually has. When the operator accepts the
plan, its calldata is compiled into a Privy wallet policy. The treasury server
wallet is then permitted to sign that contract, that selector and those exact
parameter bytes; everything else stays on `default_action: DENY`. A key quorum
with threshold two installs the policy, the transaction goes out, and the policy
is revoked. The plan hash and the HashScan link land in the audit record.

The line that matters: the preview is not a report next to the signature, the
preview *is* the signing limit.

### How it differs from what already exists

Tenderly, and the Safe integration built on it, simulate before you sign, but
the simulation and the signature are separate events, so what you previewed and
what you signed can differ. The Fireblocks policy engine is authored up front by
an administrator and its rules persist across every transaction. OpenZeppelin
Defender routes proposals through a multisig or a relayer and carries no
ERC-1400 semantics for who is eligible to be credited. Detent generates a policy
for exactly one corporate action, derived from the plan the operator read, and
throws it away afterwards.

## How it uses the sponsor tech

**Hedera, Asset Tokenization Studio (target track: Tokenization of Anything).**
The security is an ATS equity token on Hedera testnet. `lib/hedera.ts` reads
`balanceOfByPartition` (ERC-1410) for every holder and `canTransfer`
(ERC-1594) for the compliance verdict on a would-be credit, over the Hashio
JSON-RPC relay. The reason code the compliance module returns is what turns a
row red in the console. `contracts/src/PlanAnchor.sol` anchors each approved
plan hash on Hedera before the policy opens and settles it after, so HashScan
carries the record. Issuance, configuration and one lifecycle operation (the
coupon distribution) all happen on testnet.

**Privy, server wallets, policies and key quorums (Best B2B financial product).**
`lib/privy.ts` is the compiler and the client. `compilePolicy` turns an approved
plan into a policy with a single ALLOW rule pinning `chain_id`, `to`,
`data starts_with <selector>` and `data eq <calldata>`, on top of
`default_action: DENY`. `installPolicy` POSTs it to `/v1/policies` owned by a key
quorum of threshold two; `submitTransaction` calls
`/v1/wallets/{id}/rpc` with `eth_sendTransaction`; `revokePolicy` removes the
rule once the transaction is in. `evaluatePolicy` mirrors the same rule
evaluation locally so the refusal can be explained in words on screen, and so
the demo runs with no keys configured.

## Tech stack

Next.js 15 (App Router), TypeScript strict, Tailwind CSS v4, shadcn primitives,
viem, Hedera testnet (chain 296) over Hashio, Asset Tokenization Studio
contracts (ERC-1400 / 1410 / 1594 / 1643 / 1644), Privy REST server wallets with
policies and key quorums, Foundry for `PlanAnchor`, Sourcify for verification,
HashScan for receipts, Vercel for hosting.

## Quickstart

```bash
npm install
cp .env.example .env.local   # every value is optional, see below
npm run dev                  # http://localhost:3000
```

With an empty `.env.local` the console runs on the cached register in
`lib/data.ts` and evaluates the compiled policy locally. That is enough to click
through the entire flow, including the refusal. Fill in
`NEXT_PUBLIC_ATS_TOKEN_ADDRESS` to read the live ATS token, and `PRIVY_APP_ID`
plus `PRIVY_APP_SECRET` to install the policy on a real treasury wallet. The
recorded demo runs with both sets filled in.

Two more keys turn on the rest of the path:

| Key | What it turns on |
| --- | --- |
| `NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS` | The testnet settlement token whose `balanceOf` funds the coupon draw. With it set, the treasury cover and the headroom under the plan totals are read on chain instead of taken from the seed figure. |
| `OPERATOR_PRIVATE_KEY` | The ECDSA key that deployed `PlanAnchor`. The contract pins its operator to the deployer, so anchoring from the app needs that same key. No `NEXT_PUBLIC_` prefix: it never reaches the browser. |

Contract build and deploy commands are in `contracts/README.md`.

## The anchor lifecycle

`PlanAnchor` carries the on chain half of the audit record, and the console
drives it:

1. **Lock.** The approved plan hash is anchored with the target token and the
   selector, before the wallet policy opens. The audit entry links the anchoring
   transaction on HashScan next to the plan hash.
2. **Send, allowed.** The plan is closed as settled, carrying a reference to the
   payout transaction. The audit entry then carries two HashScan links: the
   payout and the anchor.
3. **Send, refused.** The plan is closed as abandoned with the reason, so a
   refused run leaves a complete record rather than an open one.

Every call reads `planOf` before it writes. An already anchored hash returns the
existing record and sends nothing, which is what makes a rehearsal repeatable. A
missing key, a missing address or a busy relay comes back as a receipt with
`anchored: false` and a note; the anchor never fails a send.

## Store and migrations

There is no database in this product, and therefore no migration command. State
lives in exactly two places: `PlanAnchor` on Hedera testnet for the durable
record, and one in-process map behind `lib/store.ts` for the compiled policy
held between the lock and the send, plus the submission ledger that makes a
repeated send idempotent. Module scope survives warm invocations only, which is
why the send path recompiles the policy from the approved plan the client echoes
and says so in `policySource`.

Rejected on the way here: a KV blob (an Upstash account, a token and a
dependency for state whose durable copy is already on chain), and Postgres
(nothing in the five demo steps filters or joins anything, and the register is
12 rows read from a contract).

```bash
npm run demo:reset   # re-assert the fixture, rewrite the report, print the start state
npm run seed         # validate fixtures/register.seed.json
```

`demo:reset` does not reset the on chain anchors, because `PlanAnchor` has no
reset entrypoint and a plan hash is permanent. That is safe: the anchor calls
read before they write, so the second rehearsal of the same coupon run reuses
the record already on chain and the screen looks identical.

## On chain proof

`PlanAnchor` deployment and the two `Smoke.s.sol` transaction hashes (one
`anchor`, one `settle`) go here as live interaction proof:

- Contract: `<ADD_PLAN_ANCHOR_ADDRESS>`
- Anchor transaction: `<ADD_SMOKE_ANCHOR_TX>`
- Settle transaction: `<ADD_SMOKE_SETTLE_TX>`

## Tests

```bash
npm test              # vitest: the edge schemas and the policy evaluator
cd contracts && forge test   # PlanAnchor, including two fuzz tests
```

`npm test` covers the two mechanisms the demo turns on: the zod validation at
the API edge, and the policy evaluation that produces the refusal with the
failing condition and the byte offset. Foundry is deliberately not wired into
the npm scripts, so the contract suite runs from `contracts/`.

## Demo, ninety seconds

1. The console opens on the register: token address, HashScan badge, twelve
   holders, three of them held by the compliance module.
2. Pick the coupon distribution. The plan fills line by line, the three held
   rows go red with the reason, and the treasury headroom prints under the
   totals.
3. Two approvers sign, the plan is locked, and the compiled policy appears:
   one contract, one selector, pinned calldata, default DENY.
4. Edit one amount in the plan and send it. The wallet refuses, and the reason
   names the condition that failed and the byte where the payload diverged.
5. Send the untouched plan. It signs, the HashScan link and the plan hash drop
   into the audit record, and the policy is revoked.

## What we would build next

- Scheduled transactions for the payment date, so a locked plan can execute in
  its window without the operator holding the session open.
- The remaining lifecycle actions: redemption, address freeze, partition
  rebalance, each with its own compliance replay.
- Move policy storage from the in-process map behind `lib/store.ts` to Privy's
  own policy read endpoint, which removes the cold start fallback.
- An importer for existing ATS deployments so an issuer can point Detent at a
  token it did not issue through us.

## AI use

We used AI coding assistants for scaffolding and boilerplate. Architecture,
product decisions, and final code review are our own.
