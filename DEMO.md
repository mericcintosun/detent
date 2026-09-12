# Detent, the demo contract

This file is the contract every later phase reads. The shot list for the video
derives from it, the section anchors below are load bearing, and no phase may
rename them without amending this file first.

**Demo start route: `/`.** The console is the only route in the product. There is
no landing page, no settings page and no auth screen to click through.

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

## The five steps

### Step 1. Read the register

**Anchor:** `/#register` **File:** `app/page.tsx` (renders
`components/operations-console.tsx`)

The masthead prints the security name, the token address linked to HashScan, the
register source badge, 12 holders on partition CLASS-A and 3 of them held by the
compliance module.

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

Change the amount on the first row by hand, press "Send edited plan". The wallet
refuses. The reason names the failed condition and the byte offset where the
submitted calldata diverged from the approved calldata.

### Step 5. Send the approved plan and take the record

**Anchor:** `/#ledger` **File:** `app/page.tsx`

Press "Execute the approved plan". It signs, the policy is revoked, the HashScan
link and the plan hash land in the audit record, and "Download the record"
writes the JSON audit file.

## What is real at each phase

| Step | Phase 1 (this build) | Later |
| --- | --- | --- |
| 1 | Cached seed register, source badge reads "Cached register" | Phase 2 reads the live ATS token over Hashio |
| 2 | Real plan engine, real ABI encoding, real keccak plan hash | Unchanged, fed by live balances |
| 3 | Policy compiled locally, quorum enforced server side | Phase 2 installs it on a real Privy wallet |
| 4 | Real evaluation against the compiled policy | Same evaluator, Privy returns the refusal |
| 5 | Stub receipt derived from the calldata | Real HashScan transaction, plus the on chain anchor |
