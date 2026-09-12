# PlanAnchor interface changes, for whoever owns `lib/anchor.ts`

Written by the contracts workstream on branch `refactor/contracts`. The contract
is not deployed anywhere, so the interface was still free to change. Nothing
here breaks a live consumer, but `lib/anchor.ts` will not decode a `planOf`
response correctly until it is updated.

## 1. The `Plan` struct was renamed and reordered

`abandon` used to write a field called `settledAt`, which claimed a settlement
on the one path that is not a settlement (audit L3). The field is now
`closedAt` and it means "the block at which the plan reached a terminal state,
settled or abandoned; zero while the plan is open".

The fields were also reordered so the struct packs into two storage slots
instead of three (audit L4), which took `anchor` from 140,079 to 118,229 gas and
`planOf` from 9,022 to 7,072.

`lib/anchor.ts:36` currently declares:

```ts
"struct Plan { address token; bytes4 selector; address anchoredBy; uint64 anchoredAt; uint64 settledAt; uint8 status; }",
```

It must become:

```ts
"struct Plan { address token; bytes4 selector; uint64 anchoredAt; address anchoredBy; uint64 closedAt; uint8 status; }",
```

The `OnChainPlan` interface at `lib/anchor.ts:120` and the `plan.settledAt` read
at `lib/anchor.ts:196` need the same rename. `lib/types.ts:75` and the "Settled
at" row at `app/record/[planHash]/page.tsx:122` are display-side names and can
stay as they are or follow; nothing on chain depends on them. A row that is
abandoned now has an honest close timestamp, so that row could read "Closed at"
instead of "Settled at".

The function signatures of `anchor`, `settle`, `abandon`, `planOf`,
`anchoredCount`, `setPaused`, `operator` and `paused` are all unchanged. Only
the struct the ABI carries changed, so every call site keeps its arguments.

## 2. New reverts the app can now hit

Every external input is validated before anything is written. Five new custom
errors exist, and two of them sit on paths the app currently takes:

- `InvalidTxReference()` on `settle` when `txReference` is `bytes32(0)`.
  `settlePlan` builds its reference by right-padding whatever string it was
  given (`lib/anchor.ts:289-292`). When `txReference` is undefined or empty that
  padding produces exactly 64 zeros, which the contract now rejects. That is the
  correct outcome, since a settled row with a zero reference names no
  transaction (this is audit M4 seen from the contract side), but the app should
  stop before sending: if there is no real transaction hash, close the plan with
  `abandon` or leave it open rather than settling it with a made-up reference.
- `InvalidReason()` on `abandon` when `reason` is empty or longer than 256
  bytes. `abandonPlan` passes the caller's string through untouched, so trim and
  bound it, or substitute a default such as "refused by the treasury key".

The other three fire only on arguments the app does not currently produce:
`InvalidPlanHash()` (zero plan hash), `InvalidToken()` (zero token address,
audit L2) and `InvalidSelector()` (zero selector).

Error selectors, for decoding a revert in the UI:

| Error | Selector |
| --- | --- |
| `NotOperator()` | `0x7c214f04` |
| `AlreadyAnchored()` | `0xa0094ce3` |
| `NotAnchored()` | `0x0c4ba7e5` |
| `Paused()` | `0x9e87fac8` |
| `InvalidPlanHash()` | `0xb5a5ae4f` |
| `InvalidToken()` | `0xc1ab6dc1` |
| `InvalidSelector()` | `0x7352d91c` |
| `InvalidTxReference()` | `0x7d2b669d` |
| `InvalidReason()` | `0xdee26e4c` |

Recompute with `cast sig "InvalidToken()"` if you want to check one.

## 3. The documented deploy flow no longer takes a private key

`contracts/README.md` used to pass `--private-key $FARM_EVM_PRIVATE_KEY` to
`forge script`, which puts the operator key in `argv`, in the shell history and
in any CI log that echoes the command. It now documents
`cast wallet import detent-operator --interactive` plus `--account
detent-operator`. If any root document, runbook or CI job repeats the old
`--private-key` line, it needs the same change. `OPERATOR_PRIVATE_KEY` in
`.env.local` is a separate thing and stays as it is; it is read by the Next.js
server at runtime, not by a command line.

## 4. Left for another workstream

`contracts/cache/` is untracked Foundry build output and is not in the root
`.gitignore`, which the contracts workstream does not own (audit L11). The file
already ignores `out/` on line 3, which is what covers `contracts/out`; it needs
one more line, `cache/`, next to it. Until then `git status` on a clean checkout
shows `contracts/cache/` as untracked after the first `forge build`.
