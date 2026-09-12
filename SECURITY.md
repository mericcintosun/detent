# Security

What Detent touches, what it asks of a visitor, and where every value in this
file comes from. Testnet only. Nothing here is audited; this is a hackathon
build, written between 2026-09-12 and the ETHOnline 2026 deadline.

## 1. Contracts and chain

| Value | Where it is read |
| --- | --- |
| Chain | Hedera testnet, chain id 296 (`CHAIN_ID` in `lib/public-config.ts`, from `NEXT_PUBLIC_CHAIN_ID`) |
| RPC | `https://testnet.hashio.io/api` (`HEDERA_RPC_URL`, from `NEXT_PUBLIC_HEDERA_RPC_URL`) |
| Explorer | `https://hashscan.io/testnet` (`HASHSCAN_BASE`, a constant, not configuration) |

**`PlanAnchor`.** The only Solidity in this repo,
`contracts/src/PlanAnchor.sol`. It records the hash of an approved plan before
the treasury key signs and closes it as settled or abandoned afterwards. Its
address is read from `NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS`, falling back to
`NEXT_PUBLIC_CONTRACT_ADDRESS`, in `lib/public-config.ts`
(`PLAN_ANCHOR_ADDRESS`). That module is the only reader of either name, and no
anchor address is ever a literal in code.

`PlanAnchor` was not deployed for this submission, so this file quotes no
address and the `On chain proof` section of `README.md` quotes none either. The
human writes the address in here by hand after the contract deploy step runs,
because that step rewrites only `.env.local` and `README.md`.

**The equity token.** The ATS equity token address comes from
`NEXT_PUBLIC_ATS_TOKEN_ADDRESS`. With it empty the console serves the cached
register instead of reading on chain, and says so in the register note.

**The addresses in `lib/data.ts`.** Twelve holder addresses, the token and the
treasury account are seed register fixture values, read from
`fixtures/register.seed.json`. They are labelled as a fixture wherever they are
rendered (the masthead badge reads "Cached register"), they are not the
property of anyone, and `lib/data.ts` is the one documented place in the repo
where an address may be written out as a literal.

**Write access.** `anchor`, `settle`, `abandon` and `setPaused` are all
`onlyOperator`, pinned in the constructor to the deploying address. The app
writes them with `OPERATOR_PRIVATE_KEY`, read only in `lib/config.ts` and used
only in `lib/anchor.ts`. It has no `NEXT_PUBLIC_` prefix and must never get
one. `planOf` and `anchoredCount` are open reads, which is what lets
`/record/[planHash]` render with no key at all.

**The escape hatch.** `setPaused(bool)` flips `paused`, which the three writing
functions read through `whenNotPaused`. The operator can stop writes to the
register during a live demo without redeploying. The contract holds no value,
so there is no withdraw and no sweep to add beside it.

## 2. Wallet permissions this dapp ever requests

**None from a browser wallet.** Detent installs no browser wallet connector,
requests no accounts, and asks no visitor to sign anything. Opening the live URL
with MetaMask installed produces no popup and no connect prompt, because there
is no code path that could raise one.

This is a property of the build, not a promise. `@privy-io/react-auth` is
deliberately not installed (see `README.md`, "Best B2B financial product,
answered"): the Privy surface used here is the REST server wallet API. These
greps over the repo are the evidence:

| Grep | Result |
| --- | --- |
| `eth_requestAccounts` | no hit anywhere |
| `window.ethereum` | no hit anywhere |
| `wallet_switchEthereumChain` | no hit anywhere |
| `personal_sign` | no hit anywhere |
| `eth_sign` | hits only `lib/privy.ts`, the server-side string `eth_signTransaction` in `walletRpc` and `signAndRelay`, plus prose in `README.md` |
| `connect(` | no hit in `app/`, `components/` or `lib/` |
| `@privy-io/react-auth` | no hit in `package.json`, `app/`, `components/` or `lib/`. Every hit in the repo is prose saying it is not installed: `README.md`, this file and `SUBMISSION.md` |

So the browser-wallet hygiene rules verify vacuously. There is no connect flow
to get right, no chain switch prompt to handle and no signature request to
scope, because there is no browser wallet in this product at all.

**The two keys that do exist**, both server side, neither ever in a browser
bundle:

- The **Privy server wallet**, reached from `lib/privy.ts` over
  `POST /v1/wallets/{id}/rpc`. It signs under a single-use policy compiled by
  `compileWirePolicy` in the same file, owned by a key quorum through
  `owner_id` (`PRIVY_KEY_QUORUM_ID`), bound to the wallet through `policy_ids`,
  and detached and revoked by `releasePolicy` once the lock is spent: sent,
  failed, timed out or expired.
- The **Privy authorization keys** in `PRIVY_AUTHORIZATION_KEYS`, read only in
  `lib/config.ts` and used only by `authorizationSignature` in `lib/privy.ts` to
  sign the wallet update, the wallet rpc and the policy delete. No
  `NEXT_PUBLIC_` prefix, and a key that does not parse is refused without being
  echoed.
- **`OPERATOR_PRIVATE_KEY`**, which writes `PlanAnchor` from `lib/anchor.ts`.

No key-like string is reachable from the client. `PRIVY_APP_ID`,
`PRIVY_APP_SECRET` and `OPERATOR_PRIVATE_KEY` are read in `lib/config.ts` and
nowhere else, and `lib/config.ts` is imported only by `lib/privy.ts`,
`lib/hedera.ts`, `lib/anchor.ts` and `app/api/detent/route.ts`. No file under
`components/` imports any of them. The only data path out of the browser is
`fetch("/api/detent", ...)` in `components/operations-console.tsx`, answered by
`app/api/detent/route.ts` in this repo; there is no `<form>` element anywhere
and no third-party endpoint is called from the browser. Every URL the app
fetches is https.

## 3. Approvals and spenders

**There is no ERC-20 approval anywhere in this repo, bounded or otherwise, and
no spender address.** `approve` and `type(uint256).max` do not appear in
`contracts/`, and no approval call site exists in `app/`, `components/` or
`lib/`. So there is nothing to revoke and no allowance to inspect after the
demo. Saying the allowance is "bounded" would imply one exists.

What is bounded instead is the signing surface, and it is bounded in two places
that are not equally strong.

**The server check pins the exact calldata.** `compilePolicy` in `lib/privy.ts`
turns the approved plan into the policy the console shows: one ALLOW rule with
four conditions, `chain_id eq` 296, `to eq` the target contract, `data
starts_with` the function selector and `data eq` the full approved calldata,
byte for byte. `submitTransaction` evaluates every submitted payload against it,
on the live path too, and a payload that is not the approved calldata is refused
by this server before the wallet is asked. That refusal is labelled
`decidedBy: "local-mirror"`.

**The wallet policy cannot pin the exact calldata, and this file will not claim
it does.** Privy's policy engine
(https://docs.privy.io/controls/policies/overview) exposes only `to`, `value`
and `chain_id` on `ethereum_transaction`. Calldata is matched through
`ethereum_calldata`, which decodes arguments against an ABI and compares them
one by one; there is no condition on the raw bytes and no documented operator
for an array argument. So `compileWirePolicy`, which is what is actually
installed, pins:

1. `ethereum_transaction.chain_id eq` 296.
2. `ethereum_transaction.to eq` the plan's target contract.
3. `ethereum_calldata.<function>.partition eq` the approved partition, which also
   pins the function.
4. For a forced transfer only: `from`, `to` and `value`, the remaining scalar
   arguments.

For a coupon the holder list and the amounts are arrays, so the wallet policy
does not constrain them. A caller who held the app secret and called Privy
directly could have the treasury sign a `distributeCoupon` to the same contract
and partition with other holders or amounts while a lock is open. Detent's own
route never sends such a payload, but the guarantee for those two arguments is
this server's, not Privy's. The same conditions are written for
`eth_sendTransaction` and `eth_signTransaction`, because the relay fallback
signs. The wire policy has no `default_action` field: Privy denies whatever no
rule allows. None of these conditions has been evaluated by the real Privy
engine, so the value formats (checksum case of an address, hex for a `uint256`)
are this build's best reading of the reference, and a mismatch fails closed as a
refused send.

**Where the limit is enforced.** A compiled policy constrains nothing until it is
bound to the wallet. `installPolicy` in `lib/privy.ts` reads the treasury wallet
(`GET /v1/wallets/{wallet_id}`), creates the policy (`POST /v1/policies`, owned
by the key quorum through `owner_id`) and then writes its id into the wallet's
`policy_ids` with `PATCH /v1/wallets/{wallet_id}`. Privy documents at most one
policy per wallet and a PATCH that replaces the whole list, so the previous list
is kept in the lock and written back when the lock is spent, before
`revokePolicy` deletes the policy. If the attach does not take, the lock fails
and the policy is detached and revoked on the way out: an unbound policy is an
unconstrained key.

**Every exit cleans up.** A send that lands, a send that fails, a send that times
out, an attach that is refused and a lock that expires unspent all write the
wallet's previous `policy_ids` back and delete the policy, on a best effort
basis, and log one line with the outcome. A failed or unknown send also spends
the lock, so it cannot be re-sent under a policy that is already gone. Expiry is
swept on a timer in the process that holds the lock; a serverless instance that
is recycled before the sweep runs loses the lock and its cleanup together, and
the policy then has to be removed in the Privy dashboard.

**No write is repeated blind.** Policy creation and the wallet rpc each carry
one `privy-idempotency-key` per logical operation, and the single retry after a
timeout or a 5xx reuses it (https://docs.privy.io/api-reference/idempotency-keys).
A send that still gets no answer is reported as unknown, with the instruction to
check the treasury wallet on HashScan, never as failed.

**Owned wallets and policies.** When `PRIVY_AUTHORIZATION_KEYS` is set, the wallet
update, the wallet rpc and the policy delete carry a
`privy-authorization-signature` built as the direct implementation guide
describes
(https://docs.privy.io/controls/authorization-keys/using-owners/sign/direct-implementation):
an RFC 8785 canonical payload of version, method, url, body and the `privy-`
headers, signed with ECDSA P-256 over SHA-256, base64 DER, one signature per key,
comma separated. Privy publishes no test vector, so the tests verify each
signature against its own public key and the canonical form against the payload
printed in the guide. A policy owned by a threshold two quorum needs two
authorization keys of that quorum in the variable.

**Not verified live.** No Privy credentials exist in this environment. Every
Privy call is covered by offline tests of its exact request, and by a dry run
against a local mock that enforces the published request shapes, the owner
signature and idempotency. Neither is a run against Privy.

## 4. What the API route trusts, and what it does not

`POST /api/detent` has two intents, `lock` and `submit`.

**The server holds the authority.** `lock` rebuilds the plan from the register
snapshot this server reads and the operator's row selection, and refuses with
`plan_mismatch` when the plan hash, the calldata, the target or the chain in the
request differ from what it derives. It stores the compiled policy, the approved
calldata, the plan and the approving officers under a lock id minted from 24
random bytes, and returns that id. `submit` presents the lock id and nothing
else that decides anything: the policy, the approved calldata and the target all
come from the server's record, the plan is derived again and must still match,
and the `tampered` flag is computed by comparing the submitted calldata with the
approved calldata. Blockers are enforced on both intents from the server derived
plan.

**Intentional behaviour change on cold instances.** Earlier builds recompiled
the policy from the plan in the request body when the in-memory record was gone,
so on a recycled serverless instance every condition derived from attacker input
and evaluation always allowed. That fallback is removed. A submit this instance
holds no lock for (recycled, expired after 15 minutes, or never issued) is
refused with `lock_unknown`, and the operator locks the plan again. On a
serverless platform that can route the two requests to different instances this
refusal will happen in normal use; it is the price of not signing what the client
dictates.

**The approval quorum is a registry check, not authentication.** Approvals are
officer ids resolved against the approver registry in `lib/data.ts`. Each must
name a registered officer, no officer counts twice, and two are required. Who
approved is stored in the lock record. There is no session, no login and no
signature over an approval, so anyone who can reach the route can name both
officer ids. This closes the earlier hole where any two distinct strings opened
the lock. It does not prove that an officer approved anything.

**Bounds on a public route.** Every array and string in a request is capped in
`lib/schemas.ts` (500 rows, 8 approvals). A per address fixed window limiter in
`lib/store.ts` allows 30 requests a minute and 6 locks a minute. Every
cross-request map has a TTL and a size ceiling with oldest-first eviction, and
every key is minted or derived by the server. The anchor write in `lock` is
idempotent per server derived plan hash and capped at 25 writes an hour per
process, and `/record/[planHash]` reads are memoised for 15 seconds. All of these
live in one process: they bound one instance, a platform running several
instances multiplies them, and a client that rotates addresses evades the
limiter. They are mitigations, not guarantees.

**Gating the write.** When `OPERATOR_API_TOKEN` is set, `lock` requires it in the
`x-detent-operator` header and answers `401 unauthorized` otherwise. Set it on
any deployment that also has `OPERATOR_PRIVATE_KEY`. With it unset the lock is
open, which is the keyless demo posture.

**Receipts.** A send the key actually signed returns
`receipt: { kind: "on-chain", transactionHash, broadcast, note }`. The keyless
path returns `receipt: { kind: "synthetic", reference, note }` with no
`transactionHash` anywhere: the reference is keccak256 over the plan hash and the
calldata, it is not a transaction, and `settlePlan` refuses to write anything on
chain that is not a real 32 byte transaction hash. A refused send has no receipt.

## 5. Source

- Repository: `https://github.com/mericcintosun/detent`
- Live: `https://detent-app.vercel.app`, served over https by Vercel, no mixed
  content: every fetch in the app is https or a same-origin relative path.
- Report a problem by opening an issue on the repository. This is a testnet
  hackathon build with no user funds at risk; there is no bounty programme.
