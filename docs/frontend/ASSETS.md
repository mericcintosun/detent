# Assets

Wave 3 asset inventory, gap list and generation prompts. The generator is
ChatGPT image generation: this file and `lib/assets.ts` are the only two
things this workstream owns. Neither touches `components/`, `app/` or
`public/`, so every "planned" row below is a prompt waiting for someone to run
it, export the result and place the file; nothing here is wired into a page.

## 1. Inventory

| Asset | Size | Format | File size | Used by | Dark mode | Alt at usage site |
| --- | --- | --- | --- | --- | --- | --- |
| `public/brand/logo.png` | 1024x1024 | PNG, opaque, no alpha | 811 KB | `components/shell/brand-mark.tsx`, `app/icon.tsx`, `app/apple-icon.tsx`, `app/opengraph-image.tsx` | No. The file bakes in an opaque bone (`#f4f1ea`) square background, so the dark theme prints a visible light box around the mark. Not proposed for a fix here: LOGO_POLICY is raster-only and forbids a new or amended mark, and this is the one mark the policy protects. | `alt=""` at every site (decorative, the wordmark sits next to it in text) |
| `public/brand/plate-plan.svg` | 160x120 | SVG, flat shapes | 1.3 KB | `app/how-it-works/page.tsx`, `components/console-states.tsx` | CSS filter only (`dark:opacity-80 dark:mix-blend-lighten dark:hue-rotate-180 dark:invert` in `components/plates.tsx`), not a native dark asset | `alt=""` + `aria-hidden` (decorative, correct: the sentence beside it carries the meaning) |
| `public/brand/plate-policy.svg` | 160x120 | SVG | 575 B | same two files | same CSS filter | same |
| `public/brand/plate-refusal.svg` | 160x120 | SVG | 931 B | `app/how-it-works/page.tsx` | same CSS filter | same |
| `public/brand/plate-register.svg` | 160x120 | SVG | 1.4 KB | `components/console-states.tsx` | same CSS filter | same |
| `public/brand/plate-record.svg` | 160x120 | SVG | 911 B | `components/console-states.tsx` | same CSS filter | same |
| `public/illustrations/ledger-rule.svg` | 120x36 | SVG | 244 B | `app/globals.css`, the `.detent-ruled` background image only, no React consumer | Redrawn from tokens in dark mode, not filtered (see `04_DESIGN_SYSTEM.md` section 10) | n/a, CSS background |

Orphaned, found during this pass, not part of the registry because nothing
imports them and adding a dead file to a registry meant for future imports
would misrepresent it: `public/brand/og.png` (1200x630, 542 KB, the old stock
wax-seal preview image `app/opengraph-image.tsx`'s own header comment says it
replaces), `public/logo.svg` (480x140 wordmark, zero references anywhere in
`app/`, `components/` or `lib/`), `public/demo-video.mp4` (6.8 MB, zero
references). Recommend a cleanup pass; out of fence for this workstream, since
it owns only `ASSETS.md` and `lib/assets.ts`.

Documentation drift, not fixed here because this workstream does not own
`04_DESIGN_SYSTEM.md`: its section 10 states "the engraved plates ... under
`public/` are rasters painted on parchment." All five are flat-shape SVGs
(rectangles and lines on the IDENTITY.md palette), not rasters. The registry
below describes them as they actually are.

## 2. Gap list

Evaluated against `05_IA.md`'s page set. Approved rows get a prompt in
section 3 and a `planned` row in `lib/assets.ts`; rejected rows get one line
of reason and nothing else.

### Approved

1. **Dark-theme companions for `plate-plan`, `plate-policy`, `plate-refusal`.**
   These three carry the CSS invert/hue-rotate/mix-blend filter in
   `components/plates.tsx`, which recolours the plate's own palette rather
   than drawing it in the dark tokens `04_DESIGN_SYSTEM.md` defines. A native
   dark asset reads correctly instead of an approximated colour swap, and
   these three are the ones rendered largest and earliest, in the
   `/how-it-works` three-step strip on the first screen of that page.
2. **An illustration for `/record/[planHash]`'s unknown-hash state.** Its
   three empty states (`components/record/record-empty-states.tsx`) render a
   bare `Callout` with no icon at all, unlike every structurally identical
   `EmptyState` in the console (`PlanEmptyState`, `PolicyEmptyState`,
   `LedgerEmptyState` in `components/console-states.tsx`), which all carry a
   `Plate`. A judge who pastes an unfamiliar or made-up hash into this public,
   read-only page lands on plain text; a plate matching the family gives the
   same instant "nothing here" recognition the console already uses. Shipped
   with its own dark companion from the start, so this new pair never needs
   the CSS-filter workaround the other five plates carry.

### Rejected

1. **A plate for the `/how-it-works` architecture section.** Rejected: that
   section already renders `ArchitectureDiagram`
   (`components/content/architecture-diagram.tsx`), six labelled cards with a
   connector glyph and a mono source citation per step, in full from design
   primitives. A companion raster would duplicate what the diagram already
   states, not clarify it, and the master prompt's own qualifier is "only if
   the HTML diagram needs a companion." It does not.
2. **A faucet step illustration.** Rejected: `/faucet` is a linear sequence of
   a terminal command, a link to an external faucet and a table of env var
   names. There is no concept to depict that helps a reader run
   `cast wallet import` or paste a variable name; an illustration here would
   be decorative filler against a page that is entirely reference text.
3. **A hero texture for the console fold.** Rejected: IDENTITY.md's D11
   museum direction and `components/plates.tsx`'s own comment ("no gradient
   and no glow") commit this product to flat, ruled surfaces, and the fold
   already carries its full content (the run-mode status line, the `h1`, the
   promise and the badge row, in that order since the Phase 6 and Phase 9
   amendments). A texture would sit behind that content without helping a
   reader decide anything, competing with the one thing the fold exists to
   state quickly.

## 3. Generation prompts

Every prompt below targets the exact flat, engraved-ledger style already
shipped: square corners throughout, no gradients, no drop shadows, no glow, no
photographic texture, no text characters, no logos, no people. Composition and
line weight are copied from the existing SVGs' geometry so the dark variant
reads as the same plate, not a new design. Post-process every export from a
2000x1500 PNG source down to the shipped size with an ordinary image tool
(`sips`, `magick`, or an online converter); ChatGPT image generation does not
itself produce WebP.

### `plate-plan-dark`

- **Subject.** The same ledger-table plate as `plate-plan.svg`: a header row
  with three short accent tick marks, two rows of solid redacted text bars in
  two columns separated by hairline dividers, a thicker accent rule below the
  rows, and one closing accent figure block bottom right.
- **Composition.** 4:3 frame. An inset hairline rectangle border sits about 8
  percent in from every edge. Inside it: the header bar spans the full width
  near the top; two content rows follow, each split into a left bar (roughly
  twice the width of the right bar) with a hairline rule between the rows; a
  thicker accent rule crosses just under the second row; the accent figure
  block sits bottom right, clear of the border.
- **Palette (dark).** Ground and card fill `#191713`. Frame hairline and row
  dividers `#33302a`. Header bar fill `#33302a`. Redacted text bars `#f0ece4`.
  Accent ticks, the thicker rule and the closing figure block `#d2ac54`.
- **Aspect ratio and export size.** 4:3. Export at 640x480 (4x the 160x120
  size `components/plates.tsx` renders at, at least 2x as required).
- **Background.** Opaque, filled edge to edge with the dark card colour above;
  no transparency.
- **Negative instructions.** No text, no numerals, no logos or wordmarks, no
  faces or figures, no gradients, no drop shadow, no glow, no rounded corners,
  no parchment or paper texture.
- **Post-processing.** Export the PNG source at 2000x1500, downscale to
  640x480, save as WebP at quality 80 to 85, target under 25 KB. Ship at
  `public/brand/plate-plan-dark.webp`. Alt text (for whichever component wires
  it in): "The dark-theme companion to plate-plan: the same header, row and
  total-rule composition redrawn on the dark card ground with dark-theme
  gold, ink and oxide tokens instead of a CSS filter." Rendered as decorative
  (`alt=""`, `aria-hidden="true"`) at every current plate usage site, since
  the adjoining sentence already carries the meaning.

### `plate-policy-dark`

- **Subject.** The same lock glyph as `plate-policy.svg`: a large open ring,
  like three quarters of a circle, crossed at its open end by a small solid
  pennant shape, with one solid bar and a short hairline tick to its left.
- **Composition.** 4:3 frame, same inset hairline border as above. The ring
  sits right of centre, its opening facing left; the pennant overlaps the
  ring's open ends; the solid bar and hairline tick sit at mid-height, left of
  the ring, clear of the border.
- **Palette (dark).** Ground and card fill `#191713`. Frame hairline `#33302a`.
  The ring `#d2ac54`, stroked, not filled. The pennant `#dc785f`, filled. The
  solid bar `#f0ece4`. The hairline tick `#33302a`.
- **Aspect ratio and export size.** 4:3, 640x480 minimum.
- **Background.** Opaque dark card fill, no transparency.
- **Negative instructions.** Same list as `plate-plan-dark`: no text, no
  logos, no faces, no gradients, no shadow, no glow, no rounded corners, no
  texture.
- **Post-processing.** Same pipeline as `plate-plan-dark`. Ship at
  `public/brand/plate-policy-dark.webp`, target under 25 KB. Alt text: "The
  dark-theme companion to plate-policy: the same lock-ring and pennant glyph
  redrawn on the dark card ground with dark-theme gold and oxide tokens
  instead of a CSS filter." Rendered decorative at every current usage site,
  same reasoning as above.

### `plate-refusal-dark`

- **Subject.** The same flagged-row plate as `plate-refusal.svg`: one header
  bar, then a shaded band containing two short solid bars and one full-width
  thick bar beneath them, then a footer bar.
- **Composition.** 4:3 frame, same inset border. Header bar near the top;
  directly below it the shaded band spans the full inner width and roughly a
  fifth of the inner height, holding the two short bars side by side near its
  top and the full-width thick bar along its bottom edge; the footer bar sits
  clear below the band, near the bottom of the frame.
- **Palette (dark).** Ground and card fill `#191713`. Frame hairline `#33302a`.
  Header and footer bars `#f0ece4`. The shaded band fill `#33302a`. The two
  short bars and the full-width thick bar `#dc785f`.
- **Aspect ratio and export size.** 4:3, 640x480 minimum.
- **Background.** Opaque dark card fill, no transparency.
- **Negative instructions.** Same list as `plate-plan-dark`.
- **Post-processing.** Same pipeline. Ship at
  `public/brand/plate-refusal-dark.webp`, target under 25 KB. Alt text: "The
  dark-theme companion to plate-refusal: the same flagged-row composition
  redrawn on the dark card ground with dark-theme oxide and ink tokens
  instead of a CSS filter." Rendered decorative at every current usage site.

### `plate-record-unknown` (light) and `plate-record-unknown-dark`

- **Subject.** A new plate for the same family: the header composition of
  `plate-record.svg` (two solid header bars over a rule), but the body holds
  one dashed, unfilled hairline row instead of any solid bar, ending in an
  open ring drawn with a dashed stroke and no fill, in place of
  `plate-record`'s solid gold-and-oxide seal. It should read as a ledger line
  that was never written, not as a broken or damaged version of the record
  plate.
- **Composition.** 4:3 frame, same inset hairline border as every plate
  above. Two header bars near the top, left and right, over a full-width
  hairline rule. Below the rule, a single dashed hairline row spans most of
  the inner width at mid-height. The open ring sits in the lower half,
  centred, roughly a third of the frame's height across, drawn as a dashed
  stroke with no fill and no inner shapes.
- **Palette, light.** Ground and card fill `#ece7dc` (parchment). Frame
  hairline and the dashed row `#e2dccd` (bone-shadow). Header bars `#191713`
  (ink). The full-width rule `#ad8c3a` (gold). The dashed ring stroke `#ad8c3a`
  (gold), at roughly half the opacity of a solid gold stroke elsewhere in the
  set, to read as open rather than closed.
- **Palette, dark.** Ground and card fill `#191713`. Frame hairline and the
  dashed row `#33302a`. Header bars `#f0ece4`. The full-width rule `#d2ac54`.
  The dashed ring stroke `#d2ac54` at the same reduced opacity relationship as
  the light variant.
- **Aspect ratio and export size.** 4:3, 640x480 minimum for each of the two
  variants.
- **Background.** Opaque, filled edge to edge with the respective ground
  colour above; no transparency in either variant.
- **Negative instructions.** No text, no numerals, no logos or wordmarks, no
  faces or figures, no gradients, no drop shadow, no glow, no rounded corners,
  no parchment or paper texture beyond the flat fill colour itself.
- **Post-processing.** Export each PNG source at 2000x1500, downscale to
  640x480, save as WebP at quality 80 to 85, target under 25 KB each. Ship at
  `public/brand/plate-record-unknown.webp` and
  `public/brand/plate-record-unknown-dark.webp`. Alt text, light: "An engraved
  plate for a plan hash PlanAnchor has never seen: the same header and frame
  as plate-record, but the body carries one dashed, unfilled hairline row and
  an open, dashed seal ring in place of the closed gold-and-oxide seal,
  reading as a ledger line that was never written." Alt text, dark: the same
  sentence, redrawn on the dark card ground with dark-theme tokens. Unlike the
  other four assets in this section, this pair is not marked decorative in
  the registry: `components/record/record-empty-states.tsx` currently gives
  `UnknownRecordState` no icon and no accessible name for one, so whoever
  wires this in should decide deliberately whether it stays decorative
  (`alt=""`, `aria-hidden="true"`, matching every other plate) or carries its
  alt text for real, rather than inheriting a default either way.

## 4. How to add one

1. Pick the row's prompt from section 3 (or write a new one following the
   same subject, composition, palette, aspect ratio, background and negative
   instructions structure) and run it through ChatGPT image generation.
2. Check the result against the style bible at the top of section 3: flat
   fills, square corners, no gradient, no shadow, no glow, no texture, no
   text. Regenerate rather than hand-edit a result that drifts, since a
   hand-patched image will not match the next plate generated from the same
   prompt.
3. Export: downscale the source to the size the prompt names, save as WebP
   (add an AVIF alongside it only if the WebP does not clear its target file
   size), and confirm the file size against the prompt's target.
4. Place the file at the exact path the registry row already names under
   `public/brand/`.
5. In `lib/assets.ts`, flip that row's `status` from `"planned"` to
   `"present"`, and correct `width`/`height` if the final export differs from
   the plan.
6. Run `npm run test` (or `npx vitest run tests/assets.test.ts`). The
   present-asset existence check now passes for that row; a row left
   `"planned"` with the file already on disk fails the sanity check in the
   other direction, so the flip is not optional.
7. Wire the path into the page or component that needs it. That step belongs
   to whichever workstream owns that file, not to this one: this registry
   documents the asset, it does not import it anywhere.
