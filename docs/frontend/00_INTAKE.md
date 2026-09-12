# 00 Intake

Inferred from the repository on 12 September 2026. `ASSUMPTION` marks an
inference below 80 percent confidence. `DECISION NEEDED` marks a value where the
master prompt's default conflicts with an existing project contract; those are
the open questions at the end.

## Inferred intake

```yaml
project_name: Detent
one_line_purpose: Operator console for tokenized securities that previews a corporate action line by line and locks the treasury wallet to exactly that transaction
project_type: web3-dapp            # one operator console plus a permanent record route; no marketing site, auth or settings
primary_users: Fund administrators and issuer operations leads running coupon distributions and forced transfers. In under 30 seconds they need to see who is held and why, approve the plan, and send it under a lock. Hackathon judges are the second audience and need the same path in under a minute.
brand_personality: precise, sober, archival    # ASSUMPTION: read from the IDENTITY.md direction and the product copy
reference_products: none recorded              # ASSUMPTION: the visual direction is governed by IDENTITY.md
existing_stack: Next.js 15.5.25 App Router, React 19.3, TypeScript strict, Tailwind CSS 4.3 with CSS first config, hand written shadcn style primitives on class-variance-authority and @radix-ui/react-slot without the shadcn CLI, no animation library, next/font/google, zod, viem, vitest, Playwright, Foundry
target_stack: Next.js App Router + React 19 + TypeScript strict + Tailwind v4 + shadcn/ui + Motion   # DECISION NEEDED: questions 1 and 3
shadcn_base: radix     # ASSUMPTION: matches the only primitive already installed; Base UI is the shadcn default since July 2026
shadcn_style: lyra     # ASSUMPTION: the sharp, technical style closest to RADIUS sharp
color_mode: light      # DECISION NEEDED: the prompt default is both, IDENTITY.md defines one theme
brand_colors: see the identity contract below
fonts: Libre Caslon Text display, Libre Franklin body, no mono
required_pages: see the page set below
must_keep: IDENTITY.md and its append only amendments; one brand mark per page; the section ids and button labels the end to end suite and the demo depend on
integrations: none in the browser; server side Privy REST server wallets, Hedera testnet over the Hashio relay, PlanAnchor
languages: [en]
deploy_target: vercel
performance_budget: LCP<2.0s, INP<200ms, CLS<0.05, JS<300KB gz initial (app)
a11y_target: WCAG 2.2 AA
motion_intensity: minimal   # DECISION NEEDED: IDENTITY.md allows one keyframe, the prompt default is balanced
asset_generator: chatgpt
```

## Identity contract

Copied from the head of `IDENTITY.md`. Every amendment since Phase 2 records
that no new colour, font, radius or motion value was introduced.

```
DIRECTION: D11 museum
GROUND: #f4f1ea bone
SURFACE: #ece7dc parchment
LINE: #e2dccd bone-shadow
INK: #191713
ACCENT: #ad8c3a gold
SECOND: #9c3b2a oxide-red
OK: #2e7d4f
WARN: #bf8477
BAD: #9c3b2a
FONT_DISPLAY: F8 Libre Caslon Text
FONT_BODY: Libre Franklin
FONT_MONO: none
ARCHETYPE: L6 rail
MOTION: M4 wipe, prefix detent-
RADIUS: sharp
HEADER: solid ground, border-r hairline, persistent left rail
LOGO_POLICY: raster-only
```

## Page set

| Route | State | Note |
| --- | --- | --- |
| `/` | exists | The operator console: register, plan, policy, send and audit record |
| `/record/[planHash]` | exists | Permanent record read back from PlanAnchor, unwired until an address is configured |
| `not-found.tsx`, `error.tsx` | exist | |
| `global-error.tsx` | missing | |
| `/privacy`, `/terms` | missing | ASSUMPTION: short static pages suit a public deployment |
| `sitemap.ts`, `robots.ts`, `manifest.ts` | missing | |
| `opengraph-image.tsx` | missing | A static `app/opengraph-image.png` exists |
| Wallet connect modal, `/portfolio`, `/faucet`, token selector | not applicable | The treasury wallet is a Privy server wallet and the operator never connects a browser wallet, which the README states deliberately |
| Transaction steps, receipts with explorer links, network state | exist inside `/` | Explorer links render only for addresses and hashes that exist on chain |

## Constraints

- The submission deadline is 16 September 2026.
- Upgrading Next.js to 16 is not recommended before the deadline; see `UPGRADE_PLAN.md`.

## Open questions

1. Keep Next.js 15.5 until after the submission, or upgrade to 16 now?
2. Keep the single light theme IDENTITY.md defines, or add a dark theme, which means amending the identity contract?
3. Keep the hand written primitives and the one `detent-wipe` keyframe, or adopt the shadcn CLI and Motion, which adds dependencies and motion values the contract currently forbids?
4. Before the deadline, polish the existing console and add the missing universal pages, or redesign more broadly?
