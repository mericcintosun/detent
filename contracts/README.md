# Contracts (Foundry)

```bash
forge build
forge test
forge script script/Deploy.s.sol --rpc-url $RPC_URL --private-key $FARM_EVM_PRIVATE_KEY --broadcast
```

TESTNET ONLY. The farm app's contract-deploy step writes the deployed address
back into `.env.local` and README, and saves the explorer link.
