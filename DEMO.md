# Detent, the demo contract

This file is the contract every later phase reads. The shot list for the video
derives from it, the section anchors below are load bearing, and no phase may
rename them without amending this file first.

**Demo start route: `/`.** The console is the working surface: every action the
operator takes happens there, and there is no landing page, no settings page and
no auth screen to click through. There is exactly one other route,
`/record/[planHash]`, added in Phase 4. It is read only, it is reached from the
audit record rather than typed, and it exists because a record that dies with the
session is not a record.

## The problem

The person who administers a tokenized security pays a coupon to every holder
each quarter with a general purpose treasury key that can sign anything the
contract exposes, and the step before signing is reading an explorer or trusting
a script.

## The trigger

The operator opens Detent on the Q3 coupon window, picks the corporate action,
and reads the payout list line by line before anything is signed.

## The wow moment

An approved payout row is edited by hand, the treasury key refuses it and names
the condition that failed and the byte where the payload diverged, then the
untouched plan signs with the same wallet under the same policy.

## The closing

The preview is not a report sitting next to the signature. The preview is the
signing limit, it exists for exactly one corporate action, and it is revoked
when that transaction lands.

## The six steps

### Step 1. Read the register

**Anchor:** `/#register` **File:** `app/page.tsx` (renders
`components/operations-console.tsx`, where the masthead markup itself lives)

The fold prints six things, in this order. First the status line, which is the
one place the page states which mode a viewer is looking at: the register source
(`Cached register`, or `Live read from Hedera testnet`), the treasury key mode
(`Treasury key, policy evaluated locally`, or `Privy server wallet`), and
`Hedera testnet 296`. The line ends on the policy slot: `No policy locked yet`
before step 3, then `Privy policy <id>` when Privy issued the id, or
`Policy <id>, compiled locally` when the local evaluator compiled it. Then the
standard and the coupon window, then the product name **Detent**, then its
one-sentence promise, then the security name, then the line that counts the
register: 12 holders on partition CLASS-A, 3 of them held by the compliance
module.

The register source badge sits under that, and what follows it depends on the
same source. On the cached register the badge beside it reads
`Seed register address, not on chain` and the token address is plain text, with
no HashScan link, because that address is a seed literal the explorer has never
seen. On a live read the address is linked to HashScan and carries the
`Verified on HashScan` badge. The register note block beside it carries the
snapshot time, the source, the partition and the settlement asset.

### Step 2. Build the plan

**Anchor:** `/#plan` **File:** `app/page.tsx`

Pick "Distribute quarterly coupon". The plan table fills row by row, three rows
go oxide-red carrying the hold reason from the compliance state, and the
treasury cover and headroom print under the totals with the plan hash and the
selector.

### Step 3. Lock the plan to the key

**Anchor:** `/#policy` **File:** `app/page.tsx`

Two approvers sign, which satisfies the key quorum of two, then
"Lock this plan to the treasury key". The compiled policy card shows the four
pinned conditions (`chain_id eq`, `to eq`, `data starts_with` the selector,
`data eq` the whole calldata) over `default_action DENY`.

### Step 4. Edit a row and get refused

**Anchor:** `/#send` **File:** `app/page.tsx`

Before either button is pressed, the send section states in plain language what
the send would do: the function it calls, the destination contract (truncated,
linked to HashScan, with a copy control), the row count, the exact draw in the
settlement asset and the chain id. Read that line out loud on camera.

Change the amount on the first row by hand, press "Send edited plan". The wallet
refuses. The reason names the failed condition and the byte offset where the
submitted calldata diverged from the approved calldata.

### Step 5. Send the approved plan and take the record

**Anchor:** `/#ledger` **File:** `app/page.tsx`

The same disclosure line is still on screen, unchanged: same destination
contract, same draw, same chain. Nothing is asked of a browser wallet at any
point, because Detent installs no connector; the key that signs is the Privy
server wallet. Press "Execute the approved plan". It signs, the policy is
revoked, the HashScan link and the plan hash land in the audit record, and
"Download the record" writes the JSON audit file.

### Step 6. Read the record back off the chain

**Anchor:** `/record/<planHash>` **File:** `app/record/[planHash]/page.tsx`

Press "Open the permanent record" in the audit record section. The route reads
`planOf` off `PlanAnchor` with no operator key and prints what the contract holds:
the state reads settled, the token and the selector match the plan that was just
sent, the anchored and settled timestamps print in UTC, and the HashScan link
opens `PlanAnchor` itself. Reload it, or open it in a fresh private window, and
the record is still there, which is the point: this page outlives the session.

Degraded states are documented, not bugs. With no
`NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS` the page says the anchor contract is not
configured; with a hash the contract has never seen it says to lock a plan first;
with a busy relay it says to reload.

## What is real at each phase

| Step | Phase 1 (this build) | Later |
| --- | --- | --- |
| 1 | Cached seed register, source badge reads "Cached register" | Phase 2 reads the live ATS token over Hashio |
| 2 | Real plan engine, real ABI encoding, real keccak plan hash | Unchanged, fed by live balances |
| 3 | Policy compiled locally, quorum enforced server side | Phase 2 installs it on a real Privy wallet |
| 4 | Real evaluation against the compiled policy | Same evaluator, Privy returns the refusal |
| 5 | Stub receipt derived from the calldata | Real HashScan transaction, plus the on chain anchor |
| 6 | Route did not exist | Phase 4 added it: `planOf` read back off `PlanAnchor`, so the record survives the session |
