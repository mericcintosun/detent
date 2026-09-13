# 06 Contracts

What every Wave 2 agent builds against. Written by the orchestrator after the
design system merge (refactor/main 869a521). If a contract here is wrong or
missing, stop and report; do not work around it in a page.

## 1. Sources of truth

| Concern | Source |
| --- | --- |
| Tokens, type, spacing, radius, elevation, motion values | `docs/frontend/04_DESIGN_SYSTEM.md`, `app/globals.css`, `lib/motion.ts` |
| Primitives | `@/components/ui/*`, `@/components/design`, `@/components/motion` |
| Routes, navigation, page purposes | `docs/frontend/05_IA.md` |
| Product facts and numbers | `lib/data.ts`, `lib/public-config.ts`, `lib/config.ts`, `README.md`, `SECURITY.md`, `contracts/src/PlanAnchor.sol` |
| API | `POST /api/detent` as implemented in `app/api/detent/route.ts`; unchanged in this redesign |

No page defines a colour, font, spacing, radius, shadow or motion value. No
arbitrary Tailwind value unless `04_DESIGN_SYSTEM.md` section 2 allows it. No
inline `style` except Motion props. No new dependency: if one is essential,
report it and the orchestrator adds it.

## 2. Shell contract (owned by app-shell)

`app/layout.tsx` renders, in order: skip link to `#main`, the site header or rail,
`<main id="main" tabIndex={-1}>` wrapping `children`, the site footer, and a
global offline banner. Pages render only their content: no `<main>`, no page
level footer, no theme toggle, no global nav.

- Desktop (lg and up): a persistent left rail, the Detent archetype. It carries
  the mark, primary navigation (Console `/`, How it works, Security, Faucet), the
  run mode status line, on `/` the console section navigation (Register, Plan,
  Policy, Send, Audit record, linking `#register` `#plan` `#policy` `#send`
  `#ledger`), the theme toggle and the command palette trigger.
- Below lg: a sticky top bar with the mark, the run mode pill, the palette
  trigger and a menu button opening a `Sheet` with the same items.
- Run mode: the shell reads `ADAPTER_MODE` and `isPrivyLive()` on the server and
  shows one status line naming the mode: live register or local mirror, live
  Privy signer or local mirror signer. A boolean crosses to the client, never a
  server module.
- Command palette (Cmd K and Ctrl K): primary routes, the five console sections
  (navigates to `/#id` from other routes), open a record by plan hash (validated
  with `planHashSchema` from `@/lib/schemas`), theme light, dark, system, copy the
  token and anchor addresses when configured.
- Footer: Privacy, Terms, Security, Source on GitHub
  (`https://github.com/mericcintosun/detent`), ETHOnline 2026
  (`https://ethglobal.com/events/ethonline2026`), "Built for ETHOnline 2026 on
  Hedera testnet, chain 296."
- The about and security rows live on `/security`; the shell does not repeat
  them.
- Universal states: `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`.
  No `loading.tsx` on `/` or `/record/[planHash]`: measured on Next 16, a loading
  boundary there turns the record 404 into a 200. Static content routes do not
  need one either.

## 3. Page template

Every route: a `metadata` export with a title (the layout template appends
"| Detent") and a description, `alternates.canonical`, one `h1`, a `PageHeader`
from `@/components/design`, `Section` for each section with an `id` and a heading,
one hero `Reveal` and at most one `Stagger` per section from
`@/components/motion`, both themes, 375, 768, 1024 and 1440 px without horizontal
scroll, a logical tab order, and visible focus.

## 4. Console contract (owned by page-console)

`/` is the console. The explanatory "Why it exists" block, the three step strip
and the simulator comparison move to `/how-it-works` (page-content); the console
page keeps a compact hero naming the product in one sentence and linking to
`/how-it-works`. The `#brief` id disappears.

The demo path and end to end suite depend on these; keep them exactly, or change
the spec in the same commit:

- Section ids `register`, `plan`, `policy`, `send`, `ledger`.
- Buttons and names: "Distribute quarterly coupon", "Court ordered forced
  transfer", regex names `/^Distribute quarterly coupon, \d+ rows$/` and
  `/^Court ordered forced transfer, \d+ rows$/`, "Approve", "Approved", "Lock
  this plan to the treasury key", "Plan locked to the treasury key", "Send edited
  plan", "Execute the approved plan", "Executed, the lock is spent", "Force in",
  "Back to the console", "Back to the audit record".
- Texts: "2 of 2 signatures collected.", "Headroom", "Units moved", "default
  action", "DENY", "Refused", "Signature refused", "Policy revoked", "Signed,
  nothing broadcast", "Synthetic receipt, nothing on chain".
- Headings "Detent" (h1 on `/`) and "On chain plan record" (h1 on the record).

New console states, all from real data only:

- Stale: the snapshot carries its read time; past twice `REGISTER_CACHE_MS`
  show `StaleBanner` with a reload action.
- Offline: sending is disabled while `navigator.onLine` is false, with
  `OfflineNotice` next to the send controls.
- Fee: in real mode show the estimate from a server read (`eth_estimateGas` and
  `eth_gasPrice` on the configured relay, in HBAR, labelled as an estimate); in
  the fake adapter state "No fee: local mirror, nothing is broadcast". Never a
  hard coded number.
- Loading, empty, error, partial states per section using `LoadingState`,
  `EmptyState`, `ErrorState`.
- The toast region is mounted inside the console subtree, not the shell.

`components/operations-console.tsx` may be split into `components/console/**`;
the `react-hooks/refs` disable added in Wave 0 must be removed by fixing
`failureControl`.

## 5. Record contract (owned by page-record)

`/record/[planHash]` keeps `notFound()` for invalid hashes via `planHashSchema`
(HTTP 404 asserted by `e2e/routes.spec.ts`), `revalidate = 30`, the h1 "On chain
plan record", the "Back to the audit record" link to `/#ledger` ("Back to the
console" belongs to the not-found page), and `readPlanRecord` from
`@/lib/anchor` as its only data source. States: anchored, settled, abandoned,
unknown (the `RecordEmptyState` path), anchor not configured, read failed.
Hashes and addresses through `HashText`/`AddressText`, explorer links through
`HashScanLink`, timestamps in UTC.

## 6. Content contract (owned by page-content)

`/how-it-works`, `/security`, `/faucet`, `/privacy`, `/terms` are static server
pages. Every claim must be traceable to the sources in section 1; anything not
verified live (the Privy path, on chain deployment) is stated as such, exactly as
`README.md` and `SECURITY.md` do. External URLs must be verified to resolve
before they ship. Privacy states what the code actually does: theme choice in
`localStorage`, the rate limiter keeping client addresses in memory, no cookies,
no analytics; verify each by reading the code.

## 7. End to end ownership

| Spec | Owner |
| --- | --- |
| `e2e/demo-flow.spec.ts`, `e2e/accessibility.spec.ts`, `e2e/mobile.spec.ts`, `e2e/console.ts`, `e2e/fixtures.ts` | page-console |
| `e2e/routes.spec.ts` | app-shell (record assertions coordinated with page-record through the report) |
| `e2e/content.spec.ts` (new) | page-content |
| `e2e/api-contract.spec.ts`, `playwright.config.ts` | orchestrator |

## 8. Merge order and gates

Shell, console, record, content. Each branch must pass, on its own:
`npx tsc --noEmit`, `npm run lint`, `npx prettier --check .`,
`npm run test:coverage`, `npm run build` without warnings, `npm run test:e2e`,
axe with zero serious or critical findings in light and dark, and screenshots at
375 and 1440 px in both themes that the agent has looked at.
