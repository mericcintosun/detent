# A11Y audit, Wave 3

Read-only accessibility audit of `refactor/main` at `f963bbd`, run from a
production build (`npm run build && npx next start -p 3290`) against every
merged route. Scope: what `e2e/axe.spec.ts` and `e2e/accessibility.spec.ts`
already gate (axe with zero serious/critical findings in both themes, and one
keyboard walk of the demo) does not cover on its own: WCAG 2.2's new criteria,
reflow, text spacing, forced colors, reduced motion, screen reader semantics
beyond a single axe pass, and a wider keyboard walk (palette, sheet, theme
toggle, copy buttons, record page, row actions).

Tooling: Playwright (`chromium`) driven from throwaway `.mts` scripts under
`/private/tmp/claude-501/-Users-mericcintosun-farm-hackathon/b4de55c5-a48f-42ff-b908-1450b8c859db/scratchpad/wave3/a11y/`,
each browser context given a unique `x-forwarded-for` header. Screenshots are
saved next to the scripts, under `screenshots/`. This document is the only
thing kept from that scratch work; the scripts and screenshots are not part of
the repository.

No source file was changed to produce this report.

## Summary

| Severity | Count |
| --- | --- |
| Blocker (fails AA) | 2 |
| Should fix | 3 |
| Nice to have | 2 |
| Not applicable (justified) | 3 |
| Passed checks | 14 categories, listed in full below |

---

## Findings

### A11Y-01: Forced colors strip every focus indicator (blocker)

- **WCAG:** 2.4.7 Focus Visible (AA), and the forced-colors corollary of 1.4.11
  Non-text Contrast (AA). Windows High Contrast Mode / `forced-colors: active`
  is a real assistive setting, not a decorative theme.
- **Page/width/theme:** every route, every width, both the light and dark
  base themes (forced colors overrides both). Reproduced on `/`.
- **Evidence:** every focus style in the app is a `box-shadow` ring
  (`focus-visible:ring-2 focus-visible:ring-ring`) paired with an
  unconditional `outline-none`. Chromium's forced-colors mode computes
  `box-shadow` to `none` unless the element opts out with
  `forced-color-adjust: none`, and nothing in the codebase does
  (`grep -rn "forced-colors" .` returns zero matches anywhere, including
  `app/globals.css`). Measured on the first tab stop after the skip link:

  | | `outline` | `box-shadow` |
  | --- | --- | --- |
  | Normal colors | `oklab(...) none 1px` (no visible outline either) | `...0 0 0 2px lab(95..) , 0 0 0 4px lab(44..), ...` (the visible ring) |
  | `forced-colors: active` | `rgba(5,0,73,0.8) none 1px` (`outline-style: none`) | `none` |

  Screenshots at `screenshots/normal-colors-focus-visible.png` (a solid gold
  ring around the mobile menu button) versus
  `screenshots/forced-colors-focus-missing.png` (the same tab stop, same
  page, same viewport, no ring, no outline, nothing) make this visible
  directly. Also captured: `screenshots/forced-colors-light.png` and
  `screenshots/forced-colors-dark.png`, full-page, for the rest of the
  console.
- **What still works under forced colors:** every `StatusPill` and `Badge`
  render with `forced-color-adjust: auto` (24/24 sampled), so holds, run mode
  and receipts keep a system-colored border and their text label, which is
  what a forced-colors user actually needs from those (see A11Y-P-08 below).
  This finding is specifically about the focus ring, not the status system.
- **Severity:** blocker. A user running forced colors, tabbing this console
  to fill in a plan, cannot see which control has focus anywhere in the app.
- **Owner:** `app/globals.css` (design-system, `03_PLAN.md` ownership table).
  The pattern is repeated by every consumer of `buttonVariants`
  (`components/ui/button-variants.ts:16`, unconditional `outline-none`) and
  by hand-rolled links (e.g. `components/shell/primary-nav.tsx:39`), so a
  single global rule is cheaper than editing every call site.
- **Proposed diff** (`app/globals.css`, inside the existing `@layer base`
  block that already sets `* { @apply border-border outline-ring/50; }`):

  ```css
  @layer base {
    /* ...existing rules... */

    /* box-shadow rings compute to `none` under forced colors; restore a
       native outline, which the OS re-colors and is guaranteed to render. */
    @media (forced-colors: active) {
      *:focus-visible {
        outline: 2px solid CanvasText;
        outline-offset: 2px;
      }
    }
  }
  ```

  This is additive and low risk: it only paints anything when the OS is
  already stripping author color, so it cannot regress the normal-colors
  focus ring already covered by `e2e/accessibility.spec.ts`.

### A11Y-02: Reflow: the console overflows horizontally at 320 CSS px (blocker)

- **WCAG:** 1.4.10 Reflow (AA).
- **Page/width/theme:** `/` only, 320 px viewport, both light and dark
  (identical, since the cause is layout, not color).
- **Evidence:** `document.documentElement.scrollWidth` measured 365 px against
  a 320 px viewport (45 px / 14% of real two-dimensional scroll), confirmed by
  full-page screenshots at `screenshots/reflow320-_-light.png` and
  `...-dark.png` (both render 365 px wide). Isolation testing (hiding one
  subtree at a time and re-measuring `scrollWidth`) traced it to the Policy
  section:
  - Hiding the "Lock this plan to the treasury key" button alone
    (`components/console/policy-section.tsx:101-116`, `size="lg"
    className="w-full"`) drops the page from 365 px to 346 px. `Button`'s
    base classes force `whitespace-nowrap`
    (`components/ui/button-variants.ts:16`), so at 320 px this 34-character
    label cannot wrap and sets a min-content floor wider than the card can
    give it, which cascades up through the Policy `Card`, the
    `grid gap-6 lg:grid-cols-2` wrapper, the `Section`, and the page.
  - A second, smaller contributor remains inside the "Compiled wallet
    policy" card's empty state (346 px alone, still 26 px over budget); I
    did not fully trace this second source inside the audit window, the
    isolation narrows it to `PolicyEmptyState`
    (`components/console-states.tsx:306`) but not to a single leaf.
  - The other six routes (`/how-it-works`, `/security`, `/faucet`,
    `/privacy`, `/terms`, `/record/[hash]`) do **not** overflow at 320 px;
    this is specific to the console's long CTA labels.
  - The plan table itself (which does overflow, to 789 px) is correctly
    exempt: it is wrapped in a `role="region"` scroller with `overflow-x:
    auto` (`components/console/plan-section.tsx:170-176`), matching the
    "data tables may scroll sideways" carve-out, and does not leak into the
    document's own scroll width.
  - Methodology note on the "1280 px at 400% zoom" half of this check:
    I tried emulating it with the non-standard CSS `zoom` property on
    `<html>`, but that property scales layout inside the same 1280 px
    layout viewport rather than shrinking the layout viewport itself, so it
    reports overflow on every route trivially (an artifact, not a finding , 
    e.g. `document.documentElement.clientWidth` stayed `1280` after
    `zoom: 4` was applied, when a genuine 400% desktop zoom would report a
    `320`-equivalent effective viewport). A 1280 px window at 400% zoom is
    the same effective CSS-pixel viewport as testing directly at 320 px
    (this is also WCAG's own worked example), which the 320 px test above
    already covers correctly, so I have not double-counted the zoom
    artifacts as separate findings. Raw (discarded) numbers are not
    reproduced here since they would overstate the problem.
- **Severity:** blocker. Real, two-dimensional scrolling of ordinary page
  content at 320 px, not a table or a code block.
- **Owner:** `components/ui/button-variants.ts` (design-system) for the base
  `whitespace-nowrap`; `components/console/policy-section.tsx` (page-console)
  for the specific button and the still-untraced second contributor.
- **Proposed diff** (smallest fix for the traced 19 px; does not by itself
  clear the full 45 px, see above):

  ```diff
  --- a/components/console/policy-section.tsx
  +++ b/components/console/policy-section.tsx
  @@
               size="lg"
  -            className="w-full"
  +            className="w-full whitespace-normal text-center"
  ```

  A global fix (dropping `whitespace-nowrap` from `size="lg"` specifically,
  since only the full-width, long-label CTAs on this console use it) would
  need design-system sign-off since it touches the shared button contract in
  `06_CONTRACTS.md` ("controls are 44px tall... kept from Detent" section of
  `04_DESIGN_SYSTEM.md`).

### A11Y-03: Base UI dialogs leak keyboard focus to the page behind them (should fix)

- **Relevant to:** the ARIA APG modal dialog pattern's focus-containment
  expectation, which underlies 4.1.2 Name, Role, Value (AA) for a
  `role="dialog"`, a screen reader user is told "dialog" and reasonably
  expects Tab to stay inside it while it is open.
- **Page/width/theme:** the command palette (`/`, 1280 px, Cmd/Ctrl+K) and
  the mobile menu Sheet (`/`, 375 px). Not theme-dependent.
- **Evidence:** tabbing through either overlay reaches Base UI's own
  `data-base-ui-focus-guard` sentinel span (an intentional, invisible,
  `tabindex="0"` element at the edge of the trap, whose job is to bounce
  focus back inside). The **first** time it is reached, it correctly bounces
  focus back into the dialog. The **second** time, in both overlays, it does
  not: focus lands on `<body>`, and the next Tab reaches real page content
  behind the still-open, still-scrimmed overlay (`document.body.style
  .overflow` is still `"hidden"`, confirming the dialog considers itself
  open). Full trace, command palette (only two real stops: the search input,
  then the guard, since palette items are arrow-key/`option` navigated, not
  Tab-stopped, itself correct per the combobox pattern):

  ```
  0  INPUT (search)              inside: true
  1  SPAN  (focus-guard)         inside: false (expected sentinel)
  2  INPUT (search)              inside: true   <- correct bounce-back
  3  SPAN  (focus-guard)         inside: false (expected sentinel)
  4  BODY                        inside: false  <- escape, unexpected
  5  A "Skip to content"         inside: false  <- now tabbing the page behind the scrim
  ```

  Same shape in the Sheet, after all 12 legitimate stops (nav links, console
  section links, source link, three theme radios, the close button):
  stop 13 is the guard (expected), stop 14 is `<body>`, stop 15 is
  "Skip to content" on the page behind the sheet. Screenshot of the open
  sheet at `screenshots/sheet-open-375.png`; full stop-by-stop dump kept in
  the audit scratch scripts (`07-keyboard.mts` and the ad hoc
  `sheet_debug.mts`/`palette_trap2.mts` traces run alongside it).
- **What still works:** `Escape` correctly closes both overlays and returns
  focus to the trigger (verified separately, passes below), so this is not a
  keyboard trap in the 2.1.2 sense and there is always a way out. The bug is
  the opposite: the trap is too weak, not too strong.
- **Severity:** should fix. Reproducible in two out of two overlay
  components, same shape both times, which points at the shared primitive
  rather than app code, but it takes a deliberate two loops around a short
  list to trigger, so I am not calling it a blocker.
- **Owner:** `components/ui/sheet.tsx` and
  `components/shell/command-palette-dialog.tsx` (both consume
  `@base-ui/react/dialog`'s focus-guard mechanism; `components/ui/**` is
  design-system's file per `03_PLAN.md`, but the behavior lives in the
  `@base-ui/react` dependency version pinned in `package.json`). No small
  diff is proposed: this needs either a Base UI version bump/patch or an
  app-level `onKeyDown` Tab interceptor as a workaround, which is a judgment
  call for the owning agent, not a one-line fix.

### A11Y-04: A stray tooltip can partially overlap the next row's button (should fix, narrow)

- **WCAG:** 2.4.11 Focus Not Obscured (Minimum) (AA). Read narrowly: this SC
  only requires the focused component not be **entirely** hidden, which
  never happened here (see occlusion counts below), so this is reported as
  a should-fix quality issue adjacent to the SC, not a certain AA failure.
- **Page/width/theme:** `/`, the plan table, 375 px and 1440 px, light theme
  (positioning is not color-dependent; not re-verified in dark).
- **Evidence:** point-sampling `document.elementsFromPoint` at each focused
  element's four corners and center (the correct way to check 2.4.11, a
  bounding-box-only check gives false positives, see the skip link note
  below) found the same shape at both widths: after a `HashText`/
  `AddressText` tooltip opens (hover or focus) and the user tabs onward, the
  floating tooltip panel (`components/ui/tooltip.tsx`, `side="top"
  sideOffset={4}`, default Base UI collision handling) can still be
  animating/positioned over part of the next row's "Force in"/"Defer" button
  or, at 1440 px, over the row's own "Copy the ... contract" button, 1 to 3
  of 5 sampled points touched, never all 5. Screenshot:
  `screenshots/focus-obscured-_-375-26.png` shows the tooltip bubble
  overlapping the corner of a "Force in" button in the row below it.
  98 tab-stop instances were flagged across `/` at 375 px and 1440 px, all
  the same root cause (HashText/AddressText tooltip overlap), none elsewhere.
- **False positive ruled out first:** the very first pass of this check used
  bounding-box containment against `position: sticky/fixed` ancestors and
  flagged the skip link as "obscured" by the sticky top bar on every content
  page. That was wrong: the skip link's `focus:z-(--z-tooltip)` (80) paints
  above the top bar's `z-(--z-sticky)` (20), so it is not actually covered;
  the rect-only check does not see paint order. Switching to
  `elementsFromPoint` fixed this and it is **not** in the findings below , 
  see A11Y-P-01.
- **Severity:** should fix, not blocker, given the SC's own "not entirely
  hidden" wording and the partial (never full) occlusion measured.
- **Owner:** `components/ui/tooltip.tsx` (design-system) for the Positioner's
  collision handling, consumed by `components/design/hash-text.tsx` and
  `components/design/address-text.tsx` (also design-system), inside
  `components/console/plan-section.tsx` (page-console) rows.

### A11Y-05: Table column headers have no explicit `scope` (nice to have)

- **WCAG:** adjacent to 1.3.1 Info and Relationships (A); not itself a
  failure for a table this simple (one header row, no row headers, no
  spanning cells), where browsers and screen readers reliably infer column
  headers by position without `scope`.
- **Page:** `/` (the plan table, 5 columns: Holder, Account, Position,
  Coupon due/Units moved, Row) and `/how-it-works` (a 3-column tool
  comparison table).
- **Evidence:** `components/ui/table.tsx`'s `TableHead` renders a bare `<th>`
  with no `scope` attribute, and no call site passes one.
- **Severity:** nice to have. Zero-risk, one-line fix that removes any doubt
  for older or less common assistive tech.
- **Owner:** `components/ui/table.tsx` (design-system).
- **Proposed diff:**

  ```diff
  --- a/components/ui/table.tsx
  +++ b/components/ui/table.tsx
  @@ function TableHead
     <th
       data-slot="table-head"
  +    scope={props.scope ?? "col"}
       className={cn(
         "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
         className,
       )}
       {...props}
     />
  ```

  (Ordering matters: `{...props}` must stay last so a caller can still
  override `scope` explicitly for a future row-header use.)

### A11Y-06: `HashText`/`AddressText` tooltip triggers are under 24 CSS px tall (nice to have, likely exempt)

- **WCAG:** 2.5.8 Target Size (Minimum) (AA), but this SC applies to
  pointer-activated targets, and this element has no pointer activation.
- **Page/width:** `/`, 375 px. 16 instances measured, all 17 px tall
  (single line of `text-caption`), widths 81-168 px.
- **Evidence:** `components/design/hash-text.tsx`'s `TooltipTrigger` renders
  a `<span tabIndex={0}>` with no `onClick`; it only discloses the full value
  on hover or keyboard focus (the tooltip), and the separate, correctly
  44px-and-up `CopyButton` sits right next to it for the actual pointer
  action. Per the Understanding doc for 2.5.8, a target is something a
  pointer *activates*; a hover-only disclosure trigger is closer to plain
  text than to a control, which is why I am not calling this a finding
  against the SC itself.
- **Also checked and correctly exempt:** `/how-it-works`'s "the security
  model" inline text link (121 x 17 px), 2.5.8 explicitly excepts a target
  "in a sentence or block of text," which this is.
- **Severity:** nice to have. Recommend a small height bump regardless,
  since it costs nothing and removes the ambiguity for future auditors.
- **Owner:** `components/design/hash-text.tsx`,
  `components/design/address-text.tsx` (design-system).
- **Proposed diff** (adds height without changing the visual line):

  ```diff
  --- a/components/design/hash-text.tsx
  +++ b/components/design/hash-text.tsx
  @@
             render={
               <span
                 tabIndex={0}
  -              className="amount min-w-0 truncate font-mono text-caption text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
  +              className="amount min-h-6 min-w-0 items-center truncate font-mono text-caption text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
               />
             }
  ```

---

## Not applicable

- **2.5.7 Dragging Movements:** Detent has no drag-and-drop, slider, or
  reorder interaction anywhere in the merged pages. Not applicable.
- **3.2.6 Consistent Help:** the product has no repeated help/contact
  mechanism (no support link, chat, or contact form appears on more than one
  page in a way that could be inconsistently placed). The footer's "Security"
  and "Source on GitHub" links are identical and identically placed on every
  page (verified by tab-order walk on `/` and `/record/[hash]`, same stops in
  the same order), so even read generously this passes; there is just not
  enough of a "help" surface for the SC to bite.
- **3.3.7 Redundant Entry:** the one editable field in the demo (the amount
  input in Send) is edited in place, once; the flow never asks the operator
  to re-type information the system already collected earlier in the same
  process. Not applicable.

## Passed checks

Each of these was tested with the tooling above, not assumed from reading
`06_CONTRACTS.md`'s claims.

1. **Focus not obscured, general case (2.4.11):** 90+ tab stops sampled per
   route/width with `elementsFromPoint`, both 375 and 1440 px. The only real
   occlusion found is A11Y-04; the sticky top bar and the rail never obscure
   a focused control, including the skip link (see the false-positive note
   in A11Y-04).
2. **Target size (2.5.8):** every button, link and form control sampled at
   375 px is at least 24x24 px except the two exempt/near-exempt cases in
   A11Y-06. `buttonVariants`' smallest sizes (`xs`: 32px, `icon-xs`: 32x32,
   `icon-sm`: 36x36) all clear the 24px floor.
3. **Reflow at 320 px, six of seven routes:** `/how-it-works`, `/security`,
   `/faucet`, `/privacy`, `/terms`, `/record/[hash]` have zero horizontal
   overflow at 320 px in both themes.
4. **Text spacing (1.4.12):** the WCAG bookmarklet CSS (line-height 1.5,
   letter-spacing 0.12em, word-spacing 0.16em, paragraph spacing 2em)
   injected on all 7 routes x 2 themes produces zero clipped or overlapping
   text. Full-page screenshots for all 14 combinations saved
   (`screenshots/textspacing-*.png`); `/` at that spacing was inspected in
   full and every section (Register, Plan, Policy, Send, Audit record)
   reflows cleanly with more line height, not less.
5. **Forced colors, status system:** all 24 sampled `StatusPill`/`Badge`
   instances (run mode, hold reasons, receipt kinds, step badges) render
   with `forced-color-adjust: auto`, so they take the system palette and
   keep their border and text label. See A11Y-01 for the one real forced
   colors problem (focus rings).
6. **Reduced motion, on:** reloading `/` with `reducedMotion: "reduce"` and
   sampling 400 elements' position/opacity/transform 700ms after
   `domcontentloaded` shows zero movement.
7. **Reduced motion, off (content not hidden mid-animation):** sampling the
   `#console-status` live region and the `h1` mid-entrance-animation (no
   `reducedMotion` override) shows neither is `aria-hidden`, `display:
   none`, or `visibility: hidden` at any point; both are in the
   accessibility tree from first paint.
8. **Landmarks:** exactly one `banner`, one `main`, one `contentinfo` per
   `getByRole` (the real accessible-role computation, which correctly
   downgrades `PageHeader`'s `<header>` inside `<main>` to a non-banner and
   removes the off-breakpoint rail/top-bar header from the tree via
   `display: none`) on every one of the 7 routes, at both 1280 and 375 px.
   An earlier DOM-only `querySelectorAll("header")` pass over-counted to 3
   and is not reproduced as a finding; the role-based check is the correct
   one and it passes.
9. **Navigation labelling:** every `<nav>` carries an accessible name
   (`aria-label="Primary"`, the console's `aria-labelledby` to its own "On
   this page" caption, the breadcrumb).
10. **Heading outline:** exactly one `h1` per route, no skipped heading
    level, on all 7 routes.
11. **`aria-current`:** present and correct on `/`'s primary nav (`"page"`)
    and console-section nav (`"location"`).
12. **Live regions:** `#console-status` is `role="status" aria-live="polite"`
    from first render; the refusal banner is `role="alert"` (assertive by
    role); `CopyButton` and the palette's copy actions announce through a
    `role="status" aria-live="polite"` `sr-only` span, verified end to end
    with a real clipboard permission grant and keyboard activation (Enter on
    a focused copy button produces the "Copied the ..." text in that region).
13. **Keyboard walk:**
    - Skip link: first Tab stop, `Enter` moves focus to `#main`.
    - Command palette: `Ctrl/Cmd+K` opens it (flaked once under a 200ms
      wait in the scripted run; a 300ms wait and a direct
      `getByRole('dialog', {name:'Command palette'})` reproduce "open and
      visible" reliably, so this is scripting timing, not a product issue).
      An invalid plan hash (`"not-a-hash"`) is rejected with a
      `role="alert"` message ("A plan hash starts with a lowercase 0x.").
      `Escape` closes the palette and returns focus to exactly the control
      that had it before opening.
    - Mobile Sheet: opens from the menu button, `Escape` closes it and
      returns focus to the menu button exactly. (Its focus-trap strength is
      A11Y-03, a separate, narrower issue from open/close/return.)
    - Theme toggle: focusing the "Dark theme" radio and pressing `Enter`
      flips `<html class>` to include `dark`.
    - Copy buttons: keyboard-activatable, announce success (see 12).
    - The demo's row actions: tabbing to a "Force in" button and pressing
      `Enter` flips it to "Hold again" **with focus retained on the same
      logical control** across the re-render (same for "Defer" ->
      "Restore"). Neither action was previously exercised by
      `e2e/accessibility.spec.ts`, which only walks the coupon happy path.
    - The full 7-step demo keyboard walk (register -> plan -> approve x2 ->
      lock -> edit -> refused send -> execute) already has a dedicated,
      passing spec (`e2e/accessibility.spec.ts`); re-run locally during this
      audit to confirm it still passes on this build, not re-litigated here.
    - Record page: 20-stop tab order is exactly rail nav, palette trigger,
      theme toggle x3, page content ("Copy the plan hash", "Back to the
      audit record"), footer links, then wraps, logical, matches visual
      order, no dead stops.
14. **Colour is not the only signal (1.4.1):** `/` rendered with
    `filter: grayscale(100%)` (`screenshots/grayscale-plan-section.png`)
    still clearly distinguishes held rows (shaded background band, the row
    action label itself changes from "Defer" to "Force in", a status pill
    with a text label, and a one-sentence reason) from included rows, purely
    from shape and text, with zero reliance on hue. Run mode and receipt
    kind pills were already confirmed text-labelled by source reading
    (`components/design/status-pill.tsx`) and appear as bordered,
    text-labelled boxes under both grayscale and forced colors.

## Screenshots referenced above

All under the audit's scratch `screenshots/` folder (not part of the repo):
`normal-colors-focus-visible.png`, `forced-colors-focus-missing.png`,
`forced-colors-light.png`, `forced-colors-dark.png`,
`reflow320-_-light.png`, `reflow320-_-dark.png`,
`focus-obscured-_-375-26.png` (and 97 siblings, same shape),
`textspacing-*.png` (14 files), `sheet-open-375.png`,
`palette-invalid-hash.png`, `grayscale-plan-section.png`.
