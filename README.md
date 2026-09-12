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

Contract build and deploy commands are in `contracts/README.md`.

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

- Anchor the plan hash through `PlanAnchor` from the console itself, so the
  approval is on chain before the policy opens rather than in the audit file.
- Scheduled transactions for the payment date, so a locked plan can execute in
  its window without the operator holding the session open.
- The remaining lifecycle actions: redemption, address freeze, partition
  rebalance, each with its own compliance replay.
- Move policy storage from the in-process map in `app/api/detent/route.ts` to
  Privy's own policy read endpoint, which removes the cold start fallback.
- An importer for existing ATS deployments so an issuer can point Detent at a
  token it did not issue through us.

## AI use

We used AI coding assistants for scaffolding and boilerplate. Architecture,
product decisions, and final code review are our own.
