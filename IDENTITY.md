# IDENTITY (contract; every later phase obeys this file)

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
DIFFERS_FROM: Checked the three ledger entries (Event Contracts Hackathon, perennis, stele). All three run the navy-void ground family, so every near-black navy row and the whole dark-ground band came off the menu. All three run a teal accent inside hue band 150-215, so that band came off. All three set type in the system sans stack, so system-only and Inter/Geist type voices came off. All three use the hero-split archetype with a fake console card, so that archetype came off, and A0 is banned outright. All three animate with glow-pulse plus reveal stagger, so those motion values came off. What is left and chosen: D11 museum on bone, gold hue 43, Libre Caslon Text display, L6 rail, M4 wipe. Zero shared axes with the most recent entry.

## Why

A shareholder register is a record, so the product is dressed as one: wide margins, hairline rules, wide-tracked small caps over each column, the way a transfer agent's ledger page reads. Gold is spent on the rules and the one primary control, and oxide red is spent only on the refused row, so the moment the treasury key rejects a tampered payout is the single loudest thing on screen. The rail archetype fits because Detent is not a landing page with a demo behind it, it is the operator's console, so the shell itself is the product.

## Amendments (append-only; later phases add dated lines here, never edit the block above)

2026-09-12, Phase 2. The send section's failure surface is now the same oxide-red bordered paragraph carrying one hint sentence, with the plan blockers listed under it as plain oxide-red lines when the error code is plan_blocked. No new colour, radius, font or motion value: the list reuses the treatment the plan table already gives its blockers.

2026-09-12, Phase 3. One new recurring surface, the treasury key banner at the top of the send section: a bordered block carrying a detent-label line over one paragraph, bordered border-border while the key is resting or waiting, border-ok when the payload was signed and border-bad only on the refusal. No new colour, radius, font or motion value: it is the treatment the settlement block already uses, given a fixed place so the key's state does not appear and disappear. The empty states and the send failure now end in an outline Button rather than a sentence.

2026-09-12, Phase 4. The console masthead no longer carries a second raster. `public/brand/og.png` is gone from `components/operations-console.tsx` and a bordered register note block takes its place: `border border-border bg-card p-4`, a `detent-label` heading, a `dl` carrying the snapshot time, the register source, the partition and the settlement asset, ending in `snapshot.note`, and it keeps `detent-enter`. LOGO_POLICY is now satisfied strictly: exactly one brand mark per page, inside the rail's brand link. No new colour, radius, font or motion value, since every treatment here is one the console already used.

2026-09-12, Phase 5. Two recurring surfaces, both reusing treatments the shell already had. First, the send disclosure block under the treasury key banner in the send section: `border border-border bg-card p-4`, a `detent-label` heading over one sentence naming the call, the row count, the draw and the chain, ending in a row that carries the destination contract truncated and linked plus a ghost Button copy control. It is the register note block's treatment, given a second home. Second, the rail's network `dl` is now the About and Security block: the same `detent-label` terms, small muted text and hairline underlined links, with rows added for the chain id, the anchor contract and the security policy link. No new colour, radius, font or motion value, and still exactly one brand mark per page.
