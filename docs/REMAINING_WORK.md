# Remaining work

What this refactor pass did not finish, and why. Findings are referenced by the
ids in `docs/AUDIT.md`.

## Blocked on credentials or testnet funds

None of these can be completed from a machine without accounts and keys. Every
code path involved is written and covered by tests without network access; none
of them has been run against a live service.

| Item | What it needs | What to do once it exists |
| --- | --- | --- |
| Deploy `PlanAnchor` to Hedera testnet | A funded Hedera testnet ECDSA account | Follow `contracts/README.md` (keystore flow, `forge script ... --legacy`), run `Smoke.s.sol`, then set `NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS` and verify the contract on HashScan. |
| Issue an Asset Tokenization Studio token | A Hedera testnet account with ATS access | Issue and configure the equity token, then set `NEXT_PUBLIC_ATS_TOKEN_ADDRESS` and `NEXT_PUBLIC_ADAPTER_MODE=real` so the register reads live. |
| Run the Privy server wallet path live | A Privy app, a server wallet and a key quorum with threshold two | Set `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_TREASURY_WALLET_ID` and `PRIVY_KEY_QUORUM_ID`, then run lock and send once and confirm the policy binding against the real API. |
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

## Deferred technical work

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
  target. `lib/privy.ts` and `lib/hedera.ts` stay low because their remaining
  branches are the live network paths.
