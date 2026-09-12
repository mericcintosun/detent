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
target_stack: Next.js 16 App Router + React 19 + TypeScript strict + Tailwind v4 + shadcn/ui + Motion   # DECIDED: upgrade now, adopt shadcn and Motion
shadcn_base: base      # DECIDED: the master prompt default, Base UI
shadcn_style: lyra     # ASSUMPTION: the master prompt maps a sharp, technical, dense surface to Lyra; style string base-lyra
color_mode: both       # DECIDED: light and dark, system aware; IDENTITY.md is amended in Wave 1
brand_colors: see the identity contract below
fonts: Libre Caslon Text display and Libre Franklin body are kept as brand anchors; a mono face for data, hashes and code is proposed in Wave 1   # ASSUMPTION
required_pages: see the page set below
must_keep: the brand mark and one mark per page; the palette as the seed for the new token set; the run mode status line; the demo path's section ids and button labels, or the end to end suite updated in the same change
integrations: none in the browser; server side Privy REST server wallets, Hedera testnet over the Hashio relay, PlanAnchor
languages: [en]
deploy_target: vercel
performance_budget: LCP<2.0s, INP<200ms, CLS<0.05, JS<300KB gz initial (app)
a11y_target: WCAG 2.2 AA
motion_intensity: balanced  # DECIDED: the master prompt default; the motion vocabulary in Section 8 replaces the one keyframe rule
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

## Decisions

Taken by the author on 13 September 2026, following the master prompt in full:

1. Upgrade to Next.js 16 now, in Wave 0, before any design work.
2. Add a dark theme: color mode is light and dark, system aware.
3. Adopt the shadcn CLI on Base UI and Motion.
4. A broader redesign rather than a polish of the existing console.

These amend `IDENTITY.md`: the single theme, the one keyframe rule and the ban on
new colour, font, radius and motion values are superseded by the design system
Wave 1 defines, recorded there as a dated amendment.

## Page set after the decisions

| Route | Purpose | Primary action |
| --- | --- | --- |
| `/` | The operator console | Distribute the quarterly coupon |
| `/record/[planHash]` | The permanent record of one plan | Open it on HashScan when anchored |
| `/how-it-works` | How the preview becomes the signing limit, the architecture and the two sponsors | Open the console |
| `/security` | The security model, what is enforced where, and what is not verified live | Read the source |
| `/faucet` | Funding a Hedera testnet account for the deployment and the ATS token | Open the official faucet |
| `/privacy`, `/terms` | Static legal pages | none |
| `sitemap.ts`, `robots.ts`, `manifest.ts`, `opengraph-image.tsx`, icon set | Universal metadata | none |
| `not-found.tsx`, `error.tsx`, `global-error.tsx`, loading states | Universal states | Back to the console |
| `/design-system` | Living style guide, development only and noindex | none |

ASSUMPTION: `/how-it-works`, `/security` and `/faucet` are new. The console stays
at `/` because the README and the submission send people straight to it.

## Constraints

- The submission deadline is 16 September 2026.
- Upgrading Next.js to 16 is not recommended before the deadline; see `UPGRADE_PLAN.md`.
