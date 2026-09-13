# Remaining work

What this refactor pass did not finish, and why. Findings are referenced by the
ids in `docs/AUDIT.md`.

## Blocked on credentials or testnet funds

None of these can be completed from a machine without accounts and keys. Every
code path involved is written and covered by tests without network access; none
of them has been run against a live service.

| Item | What it needs | What to do once it exists |
| --- | --- | --- |
| Deploy `PlanAnchor` to Hedera testnet | A funded Hedera testnet ECDSA account. The official faucet at portal.hedera.com/faucet funds an EVM address with 100 testnet HBAR a day without an account, but it requires a reCAPTCHA and cannot be automated. Deploy plus smoke costs about 1.85 HBAR. | Follow `contracts/README.md` (keystore flow, `forge script ... --legacy`), run `Smoke.s.sol`, then set `NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS` and verify the contract on HashScan. |
| Issue an Asset Tokenization Studio token | A funded Hedera testnet ECDSA key: about 40 to 60 HBAR with tuned gas limits, about 120 HBAR with the SDK default limits. The ATS SDK does not accept a raw private key, so the programmatic path calls the ATS factory contract directly; the fallback is the ATS web app with MetaMask on chain 296. | Deploy the equity through the factory, add the issuer, grant KYC and add each holder to the control list, issue balances on the default partition, then block one holder through the control list and let one KYC lapse. Set `NEXT_PUBLIC_ADAPTER_MODE=real`, `NEXT_PUBLIC_ATS_TOKEN_ADDRESS`, and `NEXT_PUBLIC_ATS_CHECK_FROM_ADDRESS` to a treasury that holds a balance and passes KYC and the control list. |
| Run the Privy server wallet path live | A Privy app, a server wallet, a key quorum with threshold two, and the authorization keys that own them | Set `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_TREASURY_WALLET_ID`, `PRIVY_KEY_QUORUM_ID` and, for an owned wallet or a quorum owned policy, `PRIVY_AUTHORIZATION_KEYS`. Then run lock and send once and confirm the binding, the send and the cleanup against the real API. |
| Static analysis on the contract | `slither` installed | Run it on `contracts/src/PlanAnchor.sol`. Until then the contract rests on 34 tests, 9 of them fuzz, at 100% branch coverage. |

## Decisions that belong to the author

- `SUBMISSION.md` is the prize submission copy and was out of scope for every
  workstream. The audit (H5) records that its commit history claim does not match
  the repository, and that its AI use declaration understates how the project was
  built. Neither line has been changed.
- `HANDOFF.md`, `.farm-delta.md` and several non-English commit messages remain
  in git history. Removing them means rewriting history and force pushing, which
  breaks existing clones and moves the `v0.1-hackathon` tag.
- `public/__farm.txt` was kept. It is the deployment fingerprint that the
  author's deploy verification and link monitoring read to confirm the live
  domain serves this project; removing it makes that tooling report the site as
  the wrong project. It contains only the project name.
- The demo video and the deck still describe a live testnet deployment and
  HashScan links. Both were out of scope, and both should be re-recorded after the
  credential steps above rather than edited before them.
- Nothing has been pushed. `refactor/main` exists only locally.

## Limits of the backend fixes

- The Privy authorization signature is implemented from the published algorithm
  (an RFC 8785 canonical payload signed with ECDSA P-256 over SHA-256), but Privy
  publishes no test vector, so it is verified only against its own public key. A
  quorum of two sends two signatures joined by a comma, which the documentation
  states for the wallet RPC header and not for policy deletion.
- The policy installed in Privy cannot pin the coupon's full calldata, because
  Privy's calldata conditions cannot compare the holder and amount arrays. The
  exact calldata is enforced by the server, which refuses a tampered payload
  before it reaches the wallet. The condition value formats, the body of a real
  policy violation response and how a signed DELETE treats its body are inferred
  from the documentation and have not run against the live engine.
- The lock record, the rate limiter and the idempotency store live in the memory
  of one serverless instance. When a lock and its submit land on different
  instances the submit is refused with `lock_unknown`, and the limiter is a
  mitigation rather than a guarantee. A shared store such as Redis would make
  both correct across instances.
- The approval quorum checks registered, distinct officers but is not
  cryptographic. Real operator authentication is required before the quorum
  can be trusted.
- `OPERATOR_API_TOKEN` is optional. Without it `lock` is public and bounded only
  by the rate limit.

## Deferred technical work

- An intermittent hydration error, React #418, remains on `/` under parallel
  cold loads: 2 in 120 loads after the loading boundaries were removed, down from
  7 in 100. The server HTML body matches the client render and the difference is
  limited to head preload links, which points at a Next.js 15.5 and React 19.3
  race rather than application code. The minified production error carries no
  diff to prove it, so the end to end suite keeps one worker until a development
  React build confirms the cause.
- L10: `public/brand/og.png` and `app/opengraph-image.png` are identical 542 KB
  files, and `public/brand/logo.png` is 830 KB for a mark rendered at 44 px. Keep
  one Open Graph copy and export the logo at its render size. Left untouched
  because the brand assets were out of scope.
- Dependency majors not upgraded: next 16, TypeScript 7, zod 4 (abitype, pulled in
  by viem, still requires zod 3) and vitest beyond 2.1.x. Each carries breaking
  changes and none belongs in a deadline window.
- A dev-only advisory in vitest 2.1.x remains; it does not reach the shipped
  bundle, and the coverage provider needs the same vitest minor.
- `docs/SCREENSHOTS.md` specifies ten fallback screenshots that have not been
  captured.
- Coverage thresholds sit just below today's measured baseline rather than at a
  target. `lib/privy.ts`, `lib/hedera.ts` and `lib/anchor.ts` stay low because
  their remaining branches are the live network paths.

## Development dependency advisories (13 September 2026)

`npm audit --omit=dev` reports 0 vulnerabilities. `npm audit` reports 6 in the
development toolchain, all through vitest 2.1.9 (vitest, @vitest/mocker,
@vitest/coverage-v8, vite, vite-node, esbuild): path traversal and file read in
the Vitest UI server and the Vite dev server, neither of which the test scripts
or CI start. The fix is vitest 5.0.0, three majors up, which needs its own
upgrade pass (config, coverage provider, the postcss override). Not done before
the submission deadline; do it as a separate change and rerun the coverage
thresholds.
