# 02 Audit

Frontend audit of `refactor/main` after the verification round fixes merged,
12 September 2026. Every count below comes from a command run on that tree, and
every claim about behaviour was checked against the source.

## 1. Route map

| Route or file | Purpose | State |
| --- | --- | --- |
| `/` (`app/page.tsx`) | The operator console: register, plan, policy, send and audit record. Revalidates every 30 seconds | done |
| `/record/[planHash]` | Permanent record read back from PlanAnchor; answers 404 for a malformed hash | done, unwired until an address is configured |
| `POST /api/detent` | The only API: intents `lock` and `submit` | done |
| `not-found.tsx`, `error.tsx` | Not found page and error boundary | done |
| `global-error.tsx` | Root layout error boundary | missing |
| `loading.tsx` | Removed on purpose: a streamed loading boundary sent 200 before `notFound()` and raced hydration | not applicable |
| `/privacy`, `/terms` | | missing |
| `sitemap.ts`, `robots.ts`, `manifest.ts` | | missing |
| `app/icon.svg`, `app/opengraph-image.png` | Favicon and a static Open Graph image | done |

## 2. Component inventory

Usage is the number of files that import the component.

| Component | Files | What it is | Recommendation |
| --- | --- | --- | --- |
| `components/operations-console.tsx` | 1 | The whole console client component | keep; the largest file and the main redesign risk |
| `components/console-states.tsx` | 2 | `TreasuryKeyBanner`, `SendErrorState`, `PlanEmptyState`, `PolicyEmptyState`, `LedgerEmptyState`, `RecordEmptyState` | keep |
| `components/rail.tsx` | 1 | Left rail, brand mark, section links, about and security block | keep |
| `components/section-progress.tsx` | 1 | Marks the section in view with `aria-current` | keep |
| `components/policy-explorer.tsx` | 1 | Explorable policy condition rows | keep |
| `components/plates.tsx` | 2 | The engraved plate visuals, decorative | keep |
| `components/ui/button.tsx` | 8 | CVA button, shadcn style | keep, or replace with the shadcn primitive under Track B |
| `components/ui/card.tsx` | 2 | CVA card | same |
| `components/ui/badge.tsx` | 2 | CVA badge | same |
| `components/ui/input.tsx` | 1 | Input, used by the amount field | same |

There is no duplicated component. The primitives are hand written in the shadcn
style on `class-variance-authority` and `@radix-ui/react-slot`; the shadcn CLI
was never initialised and there is no `components.json`.

## 3. Token audit

| Check | Count | Detail |
| --- | --- | --- |
| Raw colours outside `app/globals.css` | 1 | A comment in `app/page.tsx` quoting React error `#418`; no colour literal in code |
| Inline `style={{` | 0 | |
| Ad hoc `text-[Npx]` sizes | 0 | |
| Arbitrary Tailwind values | 50 | 39 `max-w-[..ch]` reading measures, 5 `grid-cols-[...]` table and layout grids, 3 `leading-[...]`, 2 `min-w-[...]`, 1 `tracking-[...]` |

The reading measures are a deliberate typographic rule and are the strongest
candidate for a named token set; the grid templates belong to the plan and
comparison tables.

## 4. State coverage

| Surface | Loading | Empty | Error | Partial | Offline | Stale | Unauthorized | Success |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Register (`#register`) | server rendered, no skeleton | not applicable, always a snapshot | live read failure falls back to the cached register and says so | per holder cached fallback note (`lib/hedera.ts`) | not distinguished | snapshot time shown, no staleness warning | not applicable | present |
| Plan (`#plan`) | not applicable, computed on the client | `PlanEmptyState` | blockers listed in the table | held rows shown in the plan | not applicable | follows the register | not applicable | present |
| Policy (`#policy`) | lock button pending label | `PolicyEmptyState` | lock failure with a titled message and the next action | not applicable | generic "could not reach the policy endpoint" | lock expiry returns to the lock step | `quorum_not_met` explained | present |
| Send (`#send`) | "Asking the wallet" pending label | not applicable | `SendErrorState` and the refusal in `TreasuryKeyBanner`, announced through a live region | not applicable | generic "could not reach the wallet endpoint" | `lock_unknown` returns to the lock step | not applicable | signed state, synthetic or on chain receipt |
| Audit record (`#ledger`) | not applicable | `LedgerEmptyState` | refusal and failure lines | not applicable | not applicable | not applicable | not applicable | present |
| `/record/[planHash]` | none, boundary removed | `RecordEmptyState` when unwired | 404 for a malformed hash | not applicable | not applicable | read memoised for 15 seconds | not applicable | present |

Gaps: no dedicated offline state, since a network failure shows the same
message as an unreachable endpoint; no staleness warning on the register
snapshot; no skeleton on the record page during a slow relay read.

## 5. Accessibility

| Check | Result |
| --- | --- |
| axe, `/` at rest, 1440 px | 0 violations |
| axe, `/` in the signed state | 0 violations |
| axe, `/record/0xab...ab` and the not found page | 0 violations |
| axe, `/` with reduced motion | 0 violations |
| axe, `/` scanned while the entrance animation runs | 26 serious colour contrast nodes, all mid fade and all gone once it settles |
| Lighthouse Accessibility, mobile and desktop | 100 |
| Images | Every image has `alt=""` with `aria-hidden` or sits in a labelled link |
| Clickable non buttons | 0 |
| Live regions | The key banner announces refusals assertively; status lines are polite |

The transient contrast failure is a measurement artefact, but it means any axe
gate must wait for the entrance animation to finish.

## 6. Performance

| Measure | Value |
| --- | --- |
| First Load JS, `/` | 149 kB, of which 103 kB shared |
| First Load JS, `/record/[planHash]` | 125 kB |
| Lighthouse mobile, `/` | Performance 97, Accessibility 100, Best Practices 100, SEO 100 |
| Lighthouse desktop, `/` | 100 on all four |
| Mobile LCP | 2.5 s, over the 2.0 s budget |
| Mobile CLS, TBT, FCP | 0, 0 ms, 0.8 s |
| Desktop LCP | 0.5 s |

The mobile LCP gap is the one budget miss. The likeliest cause is that the
largest text block begins its entrance animation at zero opacity.

## 7. Gap list

| Item | Status | Reason |
| --- | --- | --- |
| `global-error.tsx` | missing | |
| `/privacy`, `/terms` | missing | |
| `sitemap.ts`, `robots.ts`, `manifest.ts` | missing | |
| Dynamic Open Graph image | not applicable | A static image exists |
| Transaction steps: review, sign, pending, confirmed, failed | present | Inside `#send` |
| Receipts with explorer links | present | Links render only for hashes that exist on chain |
| Network state | present | The fold's status line and the rail name the network and chain id |
| Address display with copy | present | "Copy the address" in the send disclosure |
| Approval flow | present | Two registered officers form the quorum |
| Risk disclosure | present | The send disclosure block names the call, rows, draw and chain |
| Docs link | present | Source and security policy in the rail |
| Fee display | missing | No gas estimate is shown before the send |
| Offline state | missing | See section 4 |
| Wallet connect modal, portfolio, faucet, token selector | not applicable | The treasury wallet is a Privy server wallet; the operator never connects a browser wallet |

## 8. Risks

- **The end to end suite pins the page structure.** Section ids `#send`,
  `#policy` and `#ledger` are queried directly, and these accessible names and
  texts are asserted: "Distribute quarterly coupon", "Court ordered forced
  transfer", "Approve", "Approved", "Lock this plan to the treasury key", "Plan
  locked to the treasury key", "Send edited plan", "Execute the approved plan",
  "Executed, the lock is spent", "Force in", "Back to the console", "Back to the
  audit record", the headings "Detent" and "On chain plan record", and the texts
  "2 of 2 signatures collected.", "Headroom", "Units moved", "default action",
  "DENY", "Refused", "Signature refused", "Policy revoked", "Signed, nothing
  broadcast" and "Synthetic receipt, nothing on chain". A redesign that renames
  one must update `e2e/` in the same change.
- **The identity contract.** `IDENTITY.md` fixes one light theme, sharp radius,
  Libre Caslon Text and Libre Franklin, one keyframe, one brand mark per page,
  and forbids new colour, font, radius or motion values without an amendment. A
  dark theme, Motion, or a shadcn style that is not sharp would each amend it.
- **The API contract.** The console calls only `POST /api/detent` with the
  `lock` and `submit` intents defined in `lib/schemas.ts` and typed in
  `lib/types.ts`. Error codes the console must keep explaining: `lock_unknown`,
  `plan_mismatch`, `plan_blocked`, `quorum_not_met`, `invalid_input` and `429`.
- **Two run modes.** Keyless mode and live mode must both keep working, and the
  fold's status line must keep naming the mode.
- **Hydration.** An intermittent React #418 remains on `/` under parallel cold
  loads, 2 in 120; the end to end suite runs with one worker until it is traced.
- **Caching.** Both pages revalidate every 30 seconds; a redesign that moves
  data into client components changes what the snapshot time means.
