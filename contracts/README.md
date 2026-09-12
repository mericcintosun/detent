# PlanAnchor (Foundry)

`PlanAnchor` is the on chain half of Detent's audit record. Before the treasury
wallet policy opens, the operator anchors the plan hash together with the target
token and the function selector. After the transaction lands, the plan is closed
with a receipt reference. A refused or withdrawn plan is closed as abandoned, so
the sequence of anchored, settled and abandoned plans reads as a register.

The security itself is NOT deployed from here: it is an Asset Tokenization
Studio equity token issued through the ATS factory on Hedera testnet. This
contract only witnesses what Detent approved.

## Build and test

```bash
cd contracts
forge build
forge test
```

`forge test` runs `test/PlanAnchor.t.sol`: the anchor to settle lifecycle plus
two fuzz tests, one asserting that no address other than the deploying operator
can write to the register, one asserting the status transition and the recorded
token and selector for any plan hash.

`setPaused(bool)` is the operator-only escape hatch added in Phase 5: it flips
`paused`, which `anchor`, `settle` and `abandon` all read through
`whenNotPaused`, so a wedged register can be stopped mid demo without a
redeploy. `planOf` and `anchoredCount` stay open reads either way.

Two more tests cover it: `test_pausedBlocksAnchorAndOperatorCanResume` asserts
that anchoring while paused reverts with `Paused()` and that the same anchor
succeeds after unpausing, and `testFuzz_setPausedRejectsNonOperator` asserts
that no other address can touch the hatch.

## Deploy to Hedera testnet (chain 296)

```bash
export RPC_URL=https://testnet.hashio.io/api
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --private-key $FARM_EVM_PRIVATE_KEY \
  --broadcast \
  --legacy
```

Hedera's relay prefers legacy transactions, hence `--legacy`. If Hashio answers
`BUSY`, wait a few seconds and rerun: the deploy is not idempotent, so check
whether the previous attempt actually landed on HashScan first.

## Smoke test (one real interaction)

```bash
export DEPLOYED_CONTRACT=0xYourDeployedAnchor
forge script script/Smoke.s.sol \
  --rpc-url $RPC_URL \
  --private-key $FARM_EVM_PRIVATE_KEY \
  --broadcast \
  --legacy
```

It anchors one demo plan hash and settles it, leaving two transactions on
HashScan as proof of a live interaction.

Record both transaction hashes under "On chain proof" in the root `README.md`.

## Wiring the frontend

Put the deployed address in `.env.local` as `NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS`
and the chain in `NEXT_PUBLIC_CHAIN_ID` (296). Whoever runs the deploy above
should then verify the contract on Sourcify for chain 296 so HashScan shows the
source; nothing in this repo has been verified yet, because nothing has been
deployed yet.

The app writes to this contract too, from `lib/anchor.ts`: `anchor` on the lock
step, `settle` or `abandon` on the send step. `onlyOperator` pins the writer to
the deploying address, so set `OPERATOR_PRIVATE_KEY` in `.env.local` to the same
ECDSA key used for the deploy above. It has no `NEXT_PUBLIC_` prefix and must
never get one.

Anchoring is read before write: `lib/anchor.ts` calls `planOf` first and reuses
an existing record rather than reverting on `AlreadyAnchored`. A plan hash is
deterministic, so rehearsing the same coupon run twice is a no-op on chain, and
there is no reset entrypoint to undo one.

TESTNET ONLY.
