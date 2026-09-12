# SUBMISSION, the ETHOnline 2026 form, field by field

Everything below is paste-ready, in the order the ETHGlobal project form asks for
it. One submission, two opt-in bounty checkboxes, the single deadline
**2026-09-16 05:00 UTC**.

**Character limits are unverified.** The live form was not opened from this repo,
so every field carries a note with its length and a shorter fallback where the
field is likely to be capped. Check the counter in the form itself before
pasting; if a field is capped shorter than the text here, use the fallback.

**What is claimed, and what is not.** The claims below are limited to what a
judge sees on the live URL. With no environment keys set, the register is the
cached seed fixture in `fixtures/register.seed.json` and the wallet policy is
compiled and evaluated locally rather than on Privy; the refusal text, the failed
condition and the byte offset are produced by the same evaluator either way. Both
degraded states are named on screen by the console itself, and both are stated
again in each write-up below. Nothing here claims a live Privy install or a live
ATS read that has not been run.

---

## 1. Project name

```
Detent
```

*Length: 6 characters. Every form caps this well above that.*

---

## 2. Tagline / short description

```
Preview a coupon run line by line, then lock the treasury wallet to exactly that transaction.
```

*Length: 92 characters. ETHGlobal short-description fields are usually capped at
around 140, so this should fit as is. Fallback at 79: "Preview the corporate
action line by line, then lock the treasury key to exactly it."*

---

## 3. Description

```
Whoever administers a tokenized security spends the quarter on operations that cannot be taken back: coupon distributions, court ordered transfers, freezing a screened address, redemptions. They run against a live holder set, and the key that signs is a general purpose treasury key with rights over everything the token contract exposes. The step before signing is reading an explorer or trusting a script, so a wrong parameter, a lapsed allowlist entry or a thin treasury only shows up after the transaction lands.

Detent puts one step in that gap. It reads the holder set and the compliance state off Asset Tokenization Studio contracts on Hedera testnet, replays the selected corporate action off chain, and prints the plan: who receives what, which address the transfer hook will reject, and how much cover the treasury actually has. When the operator accepts that plan, its calldata is compiled into a Privy wallet policy with one ALLOW rule pinning the chain id, the destination contract, the function selector and the exact parameter bytes, over default_action DENY. A key quorum of two opens the policy, the transaction goes out, and the policy is revoked.

The line that matters: the preview is not a report sitting next to the signature, the preview is the signing limit.

The demo shows it in ninety seconds. Pick the Q3 coupon run, read the twelve rows and the three the compliance module is holding, approve as both officers, lock the plan, then edit one amount by hand and send it. The key refuses and names the condition that failed and the byte offset where the submitted calldata diverged from the approved calldata. Send the untouched plan and the same wallet signs it under the same policy. The plan hash is anchored on chain before the policy opens and closed after it, so /record/<planHash> reads the record back with no operator key and outlives the session.

Run with no environment keys and the register is the cached seed fixture and the policy is compiled and evaluated locally; the console says so on screen in both cases, and the refusal is produced by the same evaluator that runs against Privy.
```

*Length: about 2,050 characters. ETHGlobal's description field has historically
been generous, but if it is capped at 1,000, cut the last two paragraphs and keep
the first three.*

---

## 4. How it's made

```
Next.js 15 App Router with TypeScript strict and Tailwind v4, deployed on Vercel. One page carries the whole operator flow and there is exactly one other route, /record/[planHash], which is read only.

lib/plan.ts is the plan engine. It builds the payout rows from the register, flags the held ones from the compliance state, computes the draw and the headroom against the treasury cover, ABI-encodes the call with viem and hashes the plan with keccak. It is deterministic, which is what makes a rehearsal repeatable: the same coupon run produces the same plan hash every time.

lib/hedera.ts is the Hedera and ATS adapter. It declares the ATS contract surface in one parseAbi block, balanceOfByPartition from ERC-1410 and canTransfer from ERC-1594, and issues one read per holder over the Hashio JSON-RPC relay against chain 296. The bytes32 reason code the compliance module returns is what turns a row oxide red in the console. A failing row keeps its seed values and says it was not read in this snapshot rather than losing the other eleven.

lib/privy.ts is both the policy compiler and the REST client. compilePolicy turns an approved plan into a policy with one ALLOW rule and four conditions. installPolicy POSTs it to /v1/policies with owner.key_quorum_id so the policy is owned by a key quorum of threshold two rather than by one signer. submitTransaction calls /v1/wallets/{id}/rpc for eth_sendTransaction and falls back to eth_signTransaction plus a raw broadcast through Hashio when Privy will not send to eip155:296, because the Hedera relay rejects typed transactions and needs type 0. evaluatePolicy mirrors the same rule evaluation locally and runs first, which is why the refusal can be explained in words on screen and why the whole flow runs with no keys at all.

contracts/src/PlanAnchor.sol is a small Foundry contract that anchors a plan hash with its token and selector, then settles or abandons it. Every function is onlyOperator with the operator pinned to the deployer, there is a pause with an explicit event, and it holds no value at all: no payable function, no receive, no fallback, no external call anywhere, which is why there is no reentrancy guard. lib/anchor.ts reads planOf before every write, so a second rehearsal of the same plan reuses the record already on chain instead of reverting.

The hacky bit worth naming: the anchor must never fail a send. A missing operator key, a missing contract address or a busy relay all come back as a receipt with anchored false and a sentence, never as a thrown error, so the demo path stays intact when the testnet is having a bad minute.

There is no database and no wallet connector. State lives in PlanAnchor for the durable half and one in-process map behind lib/store.ts for the compiled policy held between the lock and the send. @privy-io/react-auth is deliberately not installed: the operator never connects a browser wallet, the key that signs is a Privy server wallet, and the policy is the product.
```

*Length: about 2,900 characters. If the field is capped at 1,500, keep the first
four paragraphs and the "hacky bit" one.*

---

## 5. Source code

```
https://github.com/mericcintosun/detent
```

The repository must be **public** before submitting. It is MIT licensed and the
commit history runs across the whole event, not one commit on the final day.

---

## 6. Live demo

```
https://detent-app.vercel.app
```

---

## 7. Demo video

```
https://detent-app.vercel.app/demo-video.mp4
```

The shot list, the spoken lines and the timings are in `docs/VIDEO.md`. The
Hedera row caps the video at five minutes and requires issuance, configuration
and at least one lifecycle operation on screen; the plan targets 2:00 to 2:30.

---

## 8. Prizes, both opt-in

Tick both checkboxes on the project form. The names and prize strings below are
byte-identical to the bounty ledger in `README.md` and to `DELIVERY.md`.

| Bounty | Prize | Slots |
| --- | --- | --- |
| `🪙 Tokenization of Anything` | `$6,000, Up to 3 teams: $2,000 each` | 3 |
| `🏢 Best B2B financial product` | `$2,500` | 1 |

The event allows at most three bounties per project. The third slot is left empty
on purpose, with the reasoning in `DELIVERY.md`.

---

## 9. 🪙 Tokenization of Anything, how the project uses Hedera and ATS

```
The security in the console is an ERC-1400 equity token issued through Asset Tokenization Studio on Hedera testnet, chain 296.

lib/hedera.ts carries the ATS contract surface in one parseAbi block and calls it rather than only declaring it: liveRegisterAdapter.load() issues balanceOfByPartition (ERC-1410) for every holder on partition CLASS-A and canTransfer (ERC-1594) for the compliance verdict on each would-be credit, over the Hashio JSON-RPC relay. The bytes32 reason code the compliance module returns is what turns a row red in the plan table, so the three held rows in the demo carry the contract's own words, not a UI flag.

The lifecycle operation on screen is the Q3 coupon distribution: the coupon is replayed off chain into a plan, the plan is locked, and the payout is executed against the token. Configuration is the roles and the allowlist set at issuance, which is what produces the expired allowlist entry, the lapsed KYC refresh and the sanctions hold the plan table reports.

contracts/src/PlanAnchor.sol is the on chain half of the audit record. The approved plan hash is anchored with its token and selector before the wallet policy opens, and settled or abandoned after the send, so HashScan carries the record of every run. readPlanRecord reads planOf back with no operator key, which is what the /record/[planHash] route renders: a record that outlives the browser session.

Every explorer link in the product is built from one constant in lib/hashscan.ts, so the token, the treasury, the payout and the anchor all resolve to HashScan for chain 296 and no URL is written by hand.

State of play, stated plainly: the register read, the anchor write path and the settled record have been written and reviewed but not yet run against a deployed token and a funded account. With no NEXT_PUBLIC_ATS_TOKEN_ADDRESS set, the console runs on the cached seed register and says "Cached register" on the masthead badge, which is the state a judge sees until the contract address is filled in.
```

*Length: about 1,900 characters. If the field is capped at 1,000, keep paragraphs
two, three and the last one.*

### Feedback for Hedera

```
The relay, not the contracts, is what costs a builder their afternoon. Two things would have saved ours. First, the hollow account trap: a faucet-funded ECDSA key has no account on the network until it pays a fee itself, so the first Foundry broadcast fails in a way that reads like a gas problem rather than an account problem. It is documented, but it is not in the first place you look. Second, Foundry sends typed transactions by default and the relay rejects them, so every forge script needs --legacy and every viem write needs type: "legacy". A one-line note in the Hedera quickstart at the point where Foundry is first mentioned would remove the whole class of error.

Hashio answering BUSY under load is fair for a free relay, but it means demo safety has to be designed in: our register read falls back to a cached snapshot and says so on screen, and the anchor writes degrade to a receipt with a note rather than failing the send. Good defaults for that pattern in the ATS examples would help teams who discover it at recording time.

Asset Tokenization Studio itself was the pleasant surprise. ERC-1410 partitions and the ERC-1594 canTransfer verdict gave us a compliance reason code to render directly, which is the whole reason the held rows in our plan table carry real text instead of a generic warning.
```

---

## 10. 🏢 Best B2B financial product, how the project uses Privy

```
Privy is the product, not the login. There is no browser wallet anywhere in Detent: @privy-io/react-auth is deliberately not installed, no connector is present, and nothing on the page ever asks a visitor to connect. The key that signs is a Privy server wallet, and the control that makes the product possible is the wallet policy.

lib/privy.ts compiles an approved plan into a policy with a single ALLOW rule carrying four conditions: chain_id eq 296, to eq the token contract, data starts_with the function selector, and data eq the entire calldata, on top of default_action DENY. installPolicy POSTs that to /v1/policies with owner.key_quorum_id set, so the policy is owned by a key quorum of threshold two and no single officer can open the treasury key. submitTransaction calls /v1/wallets/{id}/rpc, and revokePolicy removes the rule once the transaction is in, so the key gets its general authority back.

The B2B flow is a quarterly coupon run on a tokenized security: two named officers approve, the policy installs, the payout executes, the policy is revoked. That is a treasury operation with an approval step, which is the business scenario the prize asks for.

Why Privy made it possible: without wallet policies there is no way to narrow a general purpose treasury key down to one corporate action, so the preview would stay a report next to the signature instead of becoming the signing limit. The key quorum is what stops the narrowing itself from being a single person's decision. Both are Privy primitives we did not have to build.

evaluatePolicy mirrors Privy's own rule evaluation locally and runs before the provider is asked, which does two things: the refusal can name the failed condition and the byte offset in words the operator reads, and the entire demo runs with no credentials configured. State of play, stated plainly: with no PRIVY_APP_ID and PRIVY_APP_SECRET set, the policy is compiled and evaluated locally and the receipt is a stub, which the console states on screen as "Treasury key, compiled locally". The install and submit calls against a real Privy app have not been run yet.
```

*Length: about 2,100 characters. If the field is capped at 1,000, keep paragraphs
two and four and the last sentence of five.*

### Feedback for Privy

```
Policies as a first-class object are the reason this project exists, and the condition set (field_source, field, operator, value) was expressive enough to pin an entire calldata payload without any special casing on our side. Writing the compiler took under an hour.

Three things would have helped. First, chain support for less common EVM networks is hard to determine ahead of time: we could not confirm from the documentation whether eth_sendTransaction would be accepted for eip155:296, so we wrote both paths, the RPC broadcast and an eth_signTransaction plus self-broadcast fallback, and chose at runtime by reading the error. A published support matrix, or an endpoint that answers "can this wallet send to this caip2", would have saved that entire branch.

Second, telling a policy refusal apart from an unsupported chain is guesswork: both come back 4xx, so we read the body for the words policy, denied and not allowed. A stable machine-readable error code for a policy denial would make the difference between "your transaction was refused by your own rule" and "we cannot reach that chain" legible to a product.

Third, the response field name for eth_signTransaction was not obvious from the docs, so our parser treats an unexpected shape as a typed parse failure rather than crashing. A worked example of the signature path next to the send path would close that.

The key quorum was the piece we expected to fight and did not. Ownership of a policy by a quorum rather than by a signer is exactly the right shape for a treasury, and it is what let us say honestly that two officers, not one administrator, open the key.
```

---

## 11. Pre-existing code declaration

```
None. Every file in this repository was written during ETHOnline 2026. No code was carried in from an earlier project and no part of the product existed before the event started; the public commit history shows the build from the first commit onward. AI coding assistants were used for scaffolding and boilerplate. Architecture, product decisions and final code review are our own.
```

The event's own wording for this requirement is
`Varsa önceden yazılmış kodun beyan edilmesi`, which reads in English as "any
previously written code must be declared". The same declaration is in `README.md`
under "Pre-existing code and AI use". ETHOnline 2026 publishes no AI policy of its
own, so nothing above is claimed against one.

---

## 12. Before pressing submit

Work `DELIVERY.md` top to bottom. In short: both opt-in boxes ticked, the repo
public, https://detent-app.vercel.app/demo-video.mp4 filled in here and in `README.md`, the three on chain
placeholders filled in `README.md` and the address line updated in `SECURITY.md`,
and a commit history that is not one commit on the final day.
