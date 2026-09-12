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
```

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

## Wiring the frontend

Put the deployed address in `.env.local` as `NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS`
and the chain in `NEXT_PUBLIC_CHAIN_ID` (296). Verify the contract on Sourcify
for chain 296 so HashScan shows the source.

TESTNET ONLY.
