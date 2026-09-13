# Remaining work

What this refactor pass did not finish, and why. Findings are referenced by the
ids in `docs/AUDIT.md`.

## Blocked on credentials or testnet funds

None of these can be completed from a machine without accounts and keys. Every
code path involved is written and covered by tests without network access; none
of them has been run against a live service.

| Item | What it needs | What to do once it exists |
| --- | --- | --- |
| Issue an Asset Tokenization Studio token | A funded Hedera testnet ECDSA key: about 40 to 60 HBAR with tuned gas limits, about 120 HBAR with the SDK default limits. The ATS SDK does not accept a raw private key, so the programmatic path calls the ATS factory contract directly; the fallback is the ATS web app with MetaMask on chain 296. | Deploy the equity through the factory, add the issuer, grant KYC and add each holder to the control list, issue balances on the default partition, then block one holder through the control list and let one KYC lapse. Set `NEXT_PUBLIC_ADAPTER_MODE=real`, `NEXT_PUBLIC_ATS_TOKEN_ADDRESS`, and `NEXT_PUBLIC_ATS_CHECK_FROM_ADDRESS` to a treasury that holds a balance and passes KYC and the control list. |
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

- The Privy server wallet path runs live (done 13 September 2026): a two of two
  key quorum owns the treasury wallet and every policy, and the live walk bound
  a policy, had Privy broadcast the approved coupon as
  [`0x0ea98410…`](https://hashscan.io/testnet/transaction/0x0ea98410bcf52005df36892322bcb204f63a7fffb4045d1c518e1ff2f6d94f2f), settled PlanAnchor in
  [`0xaf2aaf4f…`](https://hashscan.io/testnet/transaction/0xaf2aaf4f7792d16ccaf12e10d1d86a3b22d961236fd5eacbbe274b1ac492a470), then detached and revoked the
  policy. The authorization signature, with two signatures joined by a comma, is
  accepted by the live API on the wallet update, the rpc and the policy delete.
- The policy installed in Privy cannot pin the coupon's full calldata, because
  Privy's calldata conditions cannot compare the holder and amount arrays. The
  exact calldata is enforced by the server, which refuses a tampered payload
  before it reaches the wallet. Privy confirmed this live: it rejects an indexed
  array field and signed an edited coupon in a sign-only probe. The coupon
  condition formats and the policy violation body (`400 policy_violation`) are
  verified live; the forced transfer's `uint256` value format is not.
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
