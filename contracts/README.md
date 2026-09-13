# PlanAnchor (Foundry)

`PlanAnchor` is the on chain half of Detent's audit record. Before the treasury
wallet policy opens, the operator anchors the plan hash together with the target
token and the function selector. After the transaction lands, the plan is closed
with a receipt reference. A refused or withdrawn plan is closed as abandoned, so
the sequence of anchored, settled and abandoned plans reads as a register.

The security itself is NOT deployed from here: it is an Asset Tokenization
Studio equity token issued through the ATS factory on Hedera testnet. This
contract only witnesses what Detent approved.

## The state machine

```
Unknown --anchor--> Anchored --settle--> Settled
                        |
                        +---abandon----> Abandoned
```

One way, and both terminal states are final. Every other move reverts with a
named error:

| Attempted move | Error |
| --- | --- |
| `anchor` a hash that is Anchored, Settled or Abandoned | `AlreadyAnchored()` |
| `settle` or `abandon` a hash that is not Anchored | `NotAnchored()` |
| any write from an address other than the operator | `NotOperator()` |
| any write while the register is paused | `Paused()` |

Inputs are validated before anything is written, so a row can never name a
security, a call or a settlement that does not exist: `InvalidPlanHash()`,
`InvalidToken()`, `InvalidSelector()`, `InvalidTxReference()` and
`InvalidReason()` (empty, or longer than the 256 byte `MAX_REASON_BYTES` bound).

The contract holds no ether, has no `payable` function and makes no external
call of any kind. There is no reentrancy surface and nothing to rescue, so no
guard and no rescue hook is added. Checks-effects-interactions still reads top
to bottom in every mutating function: validate, write storage, emit.

## Build and test

```bash
cd contracts
forge build
forge test -vv
```

37 tests, 9 of them fuzz, with 100 percent line, statement, branch and function
coverage on `src/PlanAnchor.sol` (`forge coverage`). They walk the full state
machine in both directions, assert every illegal transition against its exact
custom error, assert `onlyOperator` on all four mutating functions (`anchor`,
`settle`, `abandon`, `setPaused`), and assert the `whenNotPaused` gate on all
three writes it covers, including the paused-then-unpaused path. Boundary fuzz
covers the reason length bound from both sides.

`setPaused(bool)` is the operator-only escape hatch: it flips `paused`, which
`anchor`, `settle` and `abandon` all read through `whenNotPaused`, so a wedged
register can be stopped mid demo without a redeploy. `planOf` and
`anchoredCount` stay open reads either way.

`foundry.toml` pins solc 0.8.24 and `evm_version = "shanghai"`, which is what
Hedera's EVM implements. The pragma is pinned to the same compiler, so the
bytecode a judge builds is the bytecode that was tested.

## Deploy to Hedera testnet (chain 296)

The operator key is the register's only writer, so it never goes on a command
line, into a shell history file or into an environment variable. Import it once
into Foundry's encrypted keystore:

```bash
cast wallet import detent-operator --interactive
```

It prompts for the raw private key and a password, then writes an encrypted JSON
keystore to `~/.foundry/keystores/detent-operator`. Deploy with the account name,
not the key:

```bash
export RPC_URL=https://testnet.hashio.io/api
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --account detent-operator \
  --broadcast \
  --legacy
```

Foundry prompts for the keystore password. `--private-key` and `--mnemonic` are
deliberately not documented here: both put the secret into `argv`, where it is
visible to `ps`, to the shell history file and to any CI log that echoes the
command. The scripts call the no-argument `vm.startBroadcast()` for the same
reason, so no key path exists inside the Solidity either.

Hedera's relay prefers legacy transactions, hence `--legacy`. If Hashio answers
`BUSY`, wait a few seconds and rerun: the deploy is not idempotent, so check
whether the previous attempt actually landed on HashScan first.

## Smoke test (one real interaction)

```bash
export DEPLOYED_CONTRACT=0xYourDeployedAnchor
forge script script/Smoke.s.sol \
  --rpc-url $RPC_URL \
  --account detent-operator \
  --broadcast \
  --legacy
```

It anchors one demo plan hash and settles it, leaving two transactions on
HashScan as proof of a live interaction. The script refuses to broadcast if
`DEPLOYED_CONTRACT` is unset, zero, or has no code on the target network, so a
typo fails locally instead of burning a transaction. It is one-shot: the plan
hash is fixed, so a second run reverts with `AlreadyAnchored`.

Record both transaction hashes under "On chain proof" in the root `README.md`.

## Wiring the frontend

Put the deployed address in `.env.local` as `NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS`
and the chain in `NEXT_PUBLIC_CHAIN_ID` (296). Whoever runs the deploy above
should then verify the contract on Sourcify for chain 296 so HashScan shows the
source. The live deployment is `0x1a393277908834c39D2611Ce9A151474B8Dfea0d` on
chain 296, submitted to Sourcify on 13 September 2026.

The app writes to this contract too, from `lib/anchor.ts`: `anchor` on the lock
step, `settle` or `abandon` on the send step. `onlyOperator` pins the writer to
the deploying address, so `OPERATOR_PRIVATE_KEY` in `.env.local` must be the same
ECDSA key that was imported as `detent-operator` above. It has no
`NEXT_PUBLIC_` prefix and must never get one.

The `Plan` struct the app decodes from `planOf` changed shape in this pass: the
field formerly called `settledAt` is now `closedAt`, because `abandon` writes it
too, and the field order is `token, selector, anchoredAt, anchoredBy, closedAt,
status`. See `tests/contracts-notes.md` for the exact ABI string `lib/anchor.ts`
needs. The deployed contract already has this shape.

Anchoring is read before write: `lib/anchor.ts` calls `planOf` first and reuses
an existing record rather than reverting on `AlreadyAnchored`. A plan hash is
deterministic, so rehearsing the same coupon run twice is a no-op on chain, and
there is no reset entrypoint to undo one.

TESTNET ONLY.
