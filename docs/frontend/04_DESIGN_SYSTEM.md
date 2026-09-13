# 04 Design system

The Detent design system, built in Wave 1 on 13 September 2026. Every Wave 2 page
builds from what this file lists and nothing else. `/design-system` renders all of
it live; it is served in development and in production only when the server runs
with `DETENT_DESIGN_SYSTEM=1`, and it is never indexed.

## 1. Foundations

| Layer | Choice | Where |
| --- | --- | --- |
| Primitives | shadcn CLI 4.21.0, style `base-lyra` on Base UI 1.8.0 | `components.json`, `components/ui/**` |
| Styling | Tailwind CSS 4, CSS first, OKLCH tokens | `app/globals.css` |
| Theme | next-themes 0.4.6, class on `<html>`, system default | `components/theme-provider.tsx`, `components/theme-toggle.tsx` |
| Motion | motion 13.2.0 from `motion/react`, `LazyMotion` plus `m.*` | `lib/motion.ts`, `components/motion/**` |
| Icons | Phosphor 2.1.10, the Lyra default | `@phosphor-icons/react` in client files, `@phosphor-icons/react/ssr` in server files |
| Class merging | `cn()` on clsx and tailwind-merge | `lib/utils.ts` |

Why Lyra: the product is a dense, ruled operator console and Lyra is the sharp,
technical shadcn style (square corners, compact controls, hairline rings). The
style string `base-lyra` exists in the live schema; the CLI takes it as
`init --base base --preset lyra`. Three Lyra defaults are overridden because they
conflict with Detent contracts: controls are 44px tall instead of 32px (touch
target on the demo path), text is `text-sm` instead of `text-xs`, and the heading
face is Libre Caslon Text instead of the mono face Lyra sets on `<html>`.

## 2. Rules

1. No raw colour anywhere outside `app/globals.css`. Use the semantic utilities
   (`bg-card`, `text-destructive`, `border-hold-refused`).
2. No arbitrary Tailwind value except: CSS variable shorthands
   (`z-(--z-modal)`, `duration-(--duration-fast)`), grid templates for tables and
   two column layouts (`grid-cols-[12rem_minmax(0,1fr)]`), and the ones inside
   `components/ui/**` inherited from shadcn. Reading widths use
   `max-w-measure-*`, never `max-w-[..ch]`.
3. No inline `style` except on Motion components, where Motion writes it.
4. Every interactive element comes from `components/ui` or `components/design`.
5. Colour is never the only signal. A status always has a word next to it.
6. Navigation is a link, never a Button: put `buttonVariants()` on `<a>` or
   `<Link>`, imported from `@/components/ui/button-variants`.
7. A change to a token updates `components/design/tokens.ts`;
   `tests/design-system.test.ts` fails otherwise, and fails if any published pair
   drops below AA.

## 3. Colour tokens

Light reproduces the IDENTITY.md palette exactly (bone ground, parchment card,
bone-shadow line, ink, gold primary, oxide destructive, ok success). Dark is
derived, not inverted: the ground is a warm near-black from ink (hue 80, chroma
0.006), foregrounds are bone, and gold, oxide, green and the new blue are lifted
to L 0.68 to 0.78 so they read as text on the dark ground. Card and popover get
lighter in dark mode, so elevation reads without a shadow.

Status tokens have three roles. The bare token (`--success`) is safe as text on
background, card, popover and its own muted surface. `-foreground` is text on a
solid fill of the token. `-muted` is the tinted surface for pills and callouts.
`--warning` is a deepened version of the brand warn `#bf8477`, which measures 2.9:1
as text and survives only as a seed. `--info` is a new archival ink blue, and
`--mirror` is a deep gold for the keyless local mirror mode. `--border` is
decorative and is exempt from 1.4.11; `--input` and `--ring` clear 3:1.

| Token | Light | Dark |
| --- | --- | --- |
| `--background` | `oklch(0.959 0.01 87.5)` | `oklch(0.165 0.006 80)` |
| `--foreground` | `oklch(0.205 0.008 84.6)` | `oklch(0.945 0.012 87)` |
| `--card` | `oklch(0.929 0.016 86.4)` | `oklch(0.205 0.008 82)` |
| `--card-foreground` | `oklch(0.205 0.008 84.6)` | `oklch(0.945 0.012 87)` |
| `--popover` | `oklch(0.975 0.007 87.5)` | `oklch(0.235 0.009 82)` |
| `--popover-foreground` | `oklch(0.205 0.008 84.6)` | `oklch(0.945 0.012 87)` |
| `--primary` | `oklch(0.655 0.107 86.9)` | `oklch(0.76 0.115 86)` |
| `--primary-foreground` | `oklch(0.205 0.008 84.6)` | `oklch(0.165 0.006 80)` |
| `--secondary` | `oklch(0.895 0.021 88.7)` | `oklch(0.275 0.01 84)` |
| `--secondary-foreground` | `oklch(0.205 0.008 84.6)` | `oklch(0.945 0.012 87)` |
| `--muted` | `oklch(0.895 0.021 88.7)` | `oklch(0.275 0.01 84)` |
| `--muted-foreground` | `oklch(0.45 0.015 85)` | `oklch(0.76 0.018 85)` |
| `--accent` | `oklch(0.895 0.021 88.7)` | `oklch(0.275 0.01 84)` |
| `--accent-foreground` | `oklch(0.205 0.008 84.6)` | `oklch(0.945 0.012 87)` |
| `--destructive` | `oklch(0.485 0.133 32.1)` | `oklch(0.68 0.13 35)` |
| `--destructive-foreground` | `oklch(0.959 0.01 87.5)` | `oklch(0.165 0.006 80)` |
| `--destructive-muted` | `oklch(0.915 0.03 35)` | `oklch(0.26 0.045 35)` |
| `--success` | `oklch(0.47 0.095 154.6)` | `oklch(0.72 0.1 155)` |
| `--success-foreground` | `oklch(0.959 0.01 87.5)` | `oklch(0.165 0.006 80)` |
| `--success-muted` | `oklch(0.915 0.03 155)` | `oklch(0.26 0.04 155)` |
| `--warning` | `oklch(0.5 0.09 40)` | `oklch(0.76 0.075 45)` |
| `--warning-foreground` | `oklch(0.959 0.01 87.5)` | `oklch(0.165 0.006 80)` |
| `--warning-muted` | `oklch(0.915 0.035 45)` | `oklch(0.26 0.04 45)` |
| `--info` | `oklch(0.47 0.07 235)` | `oklch(0.74 0.06 235)` |
| `--info-foreground` | `oklch(0.959 0.01 87.5)` | `oklch(0.165 0.006 80)` |
| `--info-muted` | `oklch(0.915 0.02 235)` | `oklch(0.26 0.03 235)` |
| `--mirror` | `oklch(0.5 0.09 80)` | `oklch(0.78 0.1 86)` |
| `--mirror-foreground` | `oklch(0.959 0.01 87.5)` | `oklch(0.165 0.006 80)` |
| `--mirror-muted` | `oklch(0.915 0.035 86)` | `oklch(0.265 0.04 86)` |
| `--border` | `oklch(0.87 0.022 88)` | `oklch(0.31 0.012 84)` |
| `--input` | `oklch(0.6 0.03 85)` | `oklch(0.52 0.02 85)` |
| `--ring` | `oklch(0.52 0.09 85)` | `oklch(0.72 0.1 86)` |
| `--hairline` | `oklch(0.655 0.107 86.9)` | `oklch(0.62 0.1 86)` |
| `--chart-1` | `oklch(0.58 0.1 85)` | `oklch(0.76 0.115 86)` |
| `--chart-2` | `oklch(0.485 0.133 32.1)` | `oklch(0.68 0.13 35)` |
| `--chart-3` | `oklch(0.47 0.095 154.6)` | `oklch(0.72 0.1 155)` |
| `--chart-4` | `oklch(0.47 0.07 235)` | `oklch(0.74 0.06 235)` |
| `--chart-5` | `oklch(0.45 0.015 85)` | `oklch(0.76 0.018 85)` |

Also declared: `--scrim` (behind dialogs and sheets, ink at 32 percent in light,
near-black at 62 percent in dark), the brand seeds `--brand-*`, and the sidebar
set (`--sidebar`, `--sidebar-foreground`, `--sidebar-primary`,
`--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`,
`--sidebar-border`, `--sidebar-ring`), which alias background, foreground,
primary, accent, border and ring.

### Detent domain tokens

Aliases of the status set, so a status change reaches every pill at once. Each has
a `-muted` surface.

| Utility root | Alias of | Meaning |
| --- | --- | --- |
| `mode-live` | success | Live mode: the real register, Privy and Hedera |
| `mode-mirror` | mirror | Keyless mode: seed register and the local policy mirror |
| `hold-lapsed` | warning | `allowlist-expired`, `kyc-lapsed` |
| `hold-refused` | destructive | `sanctions-hold`, `compliance-refused`, `unrecognised` |
| `hold-paused` | info | `paused` |
| `receipt-onchain` | success | A transaction hash HashScan resolves |
| `receipt-synthetic` | mirror | A derived reference, nothing on chain |
| `ok`, `warn`, `bad` | success, warning, destructive | Names the console already used, kept |

## 4. Contrast (WCAG 2.2 AA)

Computed from the OKLCH values in `components/design/tokens.ts` (OKLab to linear
sRGB, WCAG relative luminance). Text needs 4.5:1; field boundaries, focus rings
and chart marks need 3:1. Light: 52 of 52 pass, lowest text 4.71, lowest UI 3.20.
Dark: 52 of 52 pass, lowest text 5.19, lowest UI 3.25.

| Foreground | Background | Use | Needs | Light | Dark |
| --- | --- | --- | --- | --- | --- |
| `foreground` | `background` | body text, tooltip | 4.5 | 15.90 pass | 16.41 pass |
| `card-foreground` | `card` | card text | 4.5 | 14.53 pass | 15.26 pass |
| `popover-foreground` | `popover` | menus, dialogs, toasts | 4.5 | 16.67 pass | 14.20 pass |
| `foreground` | `muted` | text on a muted row | 4.5 | 13.09 pass | 12.63 pass |
| `muted-foreground` | `background` | secondary text, labels | 4.5 | 6.61 pass | 8.97 pass |
| `muted-foreground` | `card` | labels inside cards | 4.5 | 6.04 pass | 8.34 pass |
| `muted-foreground` | `popover` | descriptions in overlays | 4.5 | 6.92 pass | 7.77 pass |
| `muted-foreground` | `muted` | kbd, skeleton captions | 4.5 | 5.44 pass | 6.91 pass |
| `primary-foreground` | `primary` | primary button | 4.5 | 5.62 pass | 8.93 pass |
| `secondary-foreground` | `secondary` | secondary button | 4.5 | 13.09 pass | 12.63 pass |
| `accent-foreground` | `accent` | hovered menu item | 4.5 | 13.09 pass | 12.63 pass |
| `destructive-foreground` | `destructive` | solid destructive fill | 4.5 | 6.06 pass | 6.34 pass |
| `destructive` | `background` | destructive text on the ground | 4.5 | 6.06 pass | 6.34 pass |
| `destructive` | `card` | destructive text in a card | 4.5 | 5.54 pass | 5.90 pass |
| `destructive` | `popover` | destructive text in an overlay | 4.5 | 6.35 pass | 5.49 pass |
| `destructive` | `destructive-muted` | destructive pill and callout | 4.5 | 5.26 pass | 5.19 pass |
| `success-foreground` | `success` | solid success fill | 4.5 | 5.78 pass | 8.11 pass |
| `success` | `background` | success text on the ground | 4.5 | 5.78 pass | 8.11 pass |
| `success` | `card` | success text in a card | 4.5 | 5.28 pass | 7.54 pass |
| `success` | `popover` | success text in an overlay | 4.5 | 6.06 pass | 7.02 pass |
| `success` | `success-muted` | success pill and callout | 4.5 | 5.12 pass | 6.45 pass |
| `warning-foreground` | `warning` | solid warning fill | 4.5 | 5.53 pass | 8.77 pass |
| `warning` | `background` | warning text on the ground | 4.5 | 5.53 pass | 8.77 pass |
| `warning` | `card` | warning text in a card | 4.5 | 5.06 pass | 8.15 pass |
| `warning` | `popover` | warning text in an overlay | 4.5 | 5.80 pass | 7.59 pass |
| `warning` | `warning-muted` | warning pill and callout | 4.5 | 4.80 pass | 7.15 pass |
| `info-foreground` | `info` | solid info fill | 4.5 | 5.97 pass | 8.46 pass |
| `info` | `background` | info text on the ground | 4.5 | 5.97 pass | 8.46 pass |
| `info` | `card` | info text in a card | 4.5 | 5.46 pass | 7.86 pass |
| `info` | `popover` | info text in an overlay | 4.5 | 6.26 pass | 7.32 pass |
| `info` | `info-muted` | info pill and callout | 4.5 | 5.25 pass | 6.79 pass |
| `mirror-foreground` | `mirror` | solid mirror fill | 4.5 | 5.39 pass | 9.59 pass |
| `mirror` | `background` | mirror text on the ground | 4.5 | 5.39 pass | 9.59 pass |
| `mirror` | `card` | mirror text in a card | 4.5 | 4.92 pass | 8.92 pass |
| `mirror` | `popover` | mirror text in an overlay | 4.5 | 5.64 pass | 8.30 pass |
| `mirror` | `mirror-muted` | mirror pill and callout | 4.5 | 4.71 pass | 7.63 pass |
| `input` | `background` | field boundary | 3.0 | 3.51 pass | 3.50 pass |
| `input` | `card` | field boundary in a card | 3.0 | 3.20 pass | 3.25 pass |
| `ring` | `background` | focus ring | 3.0 | 4.92 pass | 7.74 pass |
| `ring` | `card` | focus ring in a card | 3.0 | 4.50 pass | 7.19 pass |
| `ring` | `muted` | focus ring on a muted row | 3.0 | 4.05 pass | 5.95 pass |
| `ring` | `popover` | focus ring in an overlay | 3.0 | 5.16 pass | 6.69 pass |
| `chart-1` | `background` | chart series 1 | 3.0 | 3.83 pass | 8.93 pass |
| `chart-1` | `card` | chart series 1 in a card | 3.0 | 3.50 pass | 8.30 pass |
| `chart-2` | `background` | chart series 2 | 3.0 | 6.06 pass | 6.34 pass |
| `chart-2` | `card` | chart series 2 in a card | 3.0 | 5.54 pass | 5.90 pass |
| `chart-3` | `background` | chart series 3 | 3.0 | 5.78 pass | 8.11 pass |
| `chart-3` | `card` | chart series 3 in a card | 3.0 | 5.28 pass | 7.54 pass |
| `chart-4` | `background` | chart series 4 | 3.0 | 5.97 pass | 8.46 pass |
| `chart-4` | `card` | chart series 4 in a card | 3.0 | 5.46 pass | 7.86 pass |
| `chart-5` | `background` | chart series 5 | 3.0 | 6.61 pass | 8.97 pass |
| `chart-5` | `card` | chart series 5 in a card | 3.0 | 6.04 pass | 8.34 pass |

Not in the table on purpose: the gold `primary` fill against the ground (2.83:1).
A primary button is identified by its ink label at 5.6:1, and WCAG 1.4.11 does not
require a button fill to contrast with its surroundings.

## 5. Typography

| Face | Role | Loading |
| --- | --- | --- |
| Libre Caslon Text 400, 700 | `font-display`, `font-heading`, every h1 and h2 | next/font, latin, swap, preloaded |
| Libre Franklin (variable) | `font-sans`, the body | next/font, latin, swap, preloaded |
| JetBrains Mono (variable) | `font-mono`: hashes, addresses, amounts, code | next/font, latin, swap, not preloaded |

JetBrains Mono: variable, a slashed zero and distinct `1 l I`, which is what a
reader comparing two 64 character hashes needs; IBM Plex Mono ships static
weights only through next/font. It is not preloaded because no mono text is the
largest element on a first screen.

Fluid scale. Each step sets size, line height and tracking together.

| Utility | Size | Line height | Tracking | Use |
| --- | --- | --- | --- | --- |
| `text-display` | clamp(2.5rem, 1.8rem + 3.5vw, 4.5rem) | 1.02 | -0.025em | Marketing moments only |
| `text-headline` | clamp(2rem, 1.6rem + 2vw, 3.25rem) | 1.08 | -0.02em | The page h1 |
| `text-title` | clamp(1.625rem, 1.4rem + 1.1vw, 2.25rem) | 1.15 | -0.015em | Section h2, stat figures |
| `text-heading` | clamp(1.25rem, 1.15rem + 0.5vw, 1.5rem) | 1.3 | -0.005em | h3, card and dialog titles |
| `text-lead` | clamp(1.0625rem, 1rem + 0.35vw, 1.25rem) | 1.55 | 0 | The promise under an h1 |
| `text-body` | 1rem | 1.65 | 0 | Running text |
| `text-body-sm` | 0.875rem | 1.55 | 0 | Dense text, descriptions |
| `text-caption` | 0.75rem | 1.45 | 0.01em | Notes, mono values |
| `text-label` / `.detent-label` | 0.6875rem | 1.35 | 0.16em | Wide-tracked small caps over columns |

`amount` is a utility for figures: tabular, lining, slashed zero.

## 6. Space, measure, radius, elevation, stacking, breakpoints

| Token | Value | Utility |
| --- | --- | --- |
| Base step | 0.25rem | `p-4`, `gap-6` |
| `--spacing-touch` | 2.75rem | `min-h-touch`, `size-touch` |
| `--spacing-gutter` | clamp(1.25rem, 0.9rem + 1.6vw, 3rem) | `px-gutter` |
| `--spacing-section` | clamp(3rem, 2rem + 4vw, 6rem) | `py-section` |
| `--container-content` | 72rem | `max-w-content` |
| `--container-page` | 90rem | `max-w-page` |

Reading measures replace the 39 ad hoc `max-w-[..ch]` values. Wave 2 maps them
when it rewrites each page:

| Utility | Value | Replaces |
| --- | --- | --- |
| `max-w-measure-2xs` | 28ch | 28ch |
| `max-w-measure-xs` | 48ch | 46ch, 48ch |
| `max-w-measure-sm` | 56ch | 52ch, 56ch |
| `max-w-measure-md` | 64ch | 62ch |
| `max-w-measure-lg` | 72ch | 68ch, 70ch, 72ch |
| `max-w-measure-xl` | 78ch | 76ch, 78ch |

Radius is sharp. Components default to `rounded-none`.

| Utility | Value |
| --- | --- |
| `rounded-xs` | 1px |
| `rounded-sm` | 2px (`--radius`) |
| `rounded-md` | 3px |
| `rounded-lg` | 4px |
| `rounded-xl` and above | 6px, the ceiling |

Elevation. Light: a hairline plus a warm ink shadow. Dark: a faint bone edge plus
a black shadow, and the surface itself gets lighter.

| Utility | Level | Use |
| --- | --- | --- |
| `shadow-xs` | 1 | Sticky rows |
| `shadow-sm` | 2 | Raised cards |
| `shadow-md`, `shadow-lg` | 3 | Menus, popovers |
| `shadow-xl`, `shadow-2xl` | 4 | Dialogs, sheets, toasts |

Stacking: `--z-base` 0, `--z-raised` 10, `--z-sticky` 20, `--z-rail` 30,
`--z-overlay` 40, `--z-modal` 50, `--z-popover` 60, `--z-toast` 70, `--z-tooltip`
80. Use as `z-(--z-modal)`.

Breakpoints: Tailwind defaults plus `xs` at 23.4375rem (375px). Design for 375,
768, 1024 and 1440.

## 7. Theming

`ThemeProvider` wraps the app in `app/layout.tsx`: `attribute="class"`,
`defaultTheme="system"`, `enableSystem`, `enableColorScheme`,
`disableTransitionOnChange`. next-themes writes the class before first paint, so
there is no flash, and `<html>` carries `suppressHydrationWarning` for that one
attribute. `color-scheme` is set by the `:root` and `.dark` blocks and by
next-themes. The dark variant is `@custom-variant dark (&:where(.dark, .dark *))`.

`ThemeToggle` (`@/components/theme-toggle`) is a labelled radio group of three
buttons (light, dark, system), each a tab stop with an accessible name. Nothing is
marked checked until mount, so server and client markup match. Measured after the
change: 0 React #418 errors in 60 cold loads (`/`, a record URL and a 404, 20
each, 8 concurrent).

## 8. Motion

Tokens in `lib/motion.ts`, mirrored by CSS variables:

| Token | Value |
| --- | --- |
| `duration.instant` / `--duration-instant` | 0 |
| `duration.fast` / `--duration-fast` | 120ms |
| `duration.base` / `--duration-base` | 200ms |
| `duration.slow` / `--duration-slow` | 320ms |
| `duration.wipe` / `--duration-wipe` | 600ms |
| `easing.standard` / `ease-standard` | cubic-bezier(0.2, 0, 0, 1) |
| `easing.emphasized` / `ease-emphasized` | cubic-bezier(0.3, 0, 0, 1) |
| `easing.exit` / `ease-exit` | cubic-bezier(0.4, 0, 1, 1) |
| `easing.wipe` / `ease-wipe` | cubic-bezier(0.65, 0, 0.35, 1) |
| `spring.snappy` | stiffness 520, damping 38, mass 0.7 |
| `spring.gentle` | stiffness 260, damping 30, mass 1 |
| `spring.layout` | stiffness 380, damping 36, mass 0.9 |
| `STAGGER_STEP` | 40ms |

Variants: `fade`, `rise`, `wipe` (the Detent clip-path reveal, starting at 35
percent opacity like the keyframe), `scaleIn` for overlays, and
`staggerContainer(step)`. Each has `hidden`, `visible` and `exit`.

Architecture: `MotionProvider` (in the layout) is `MotionConfig
reducedMotion="user"` around `LazyMotion strict`, and loads `domAnimation`
through a dynamic import, so the animation engine is not in the first load
bundle. Use `m.*`, never `motion.*` (strict mode throws). With reduced motion,
transforms drop and only opacity animates; the CSS reduced motion block collapses
`tw-animate-css` overlay animations and the `detent-*` classes to a frame.

The CSS `detent-wipe` keyframe, `detent-enter`, `detent-stagger` and `detent-band`
are kept working for server rendered markup. Wave 2 may migrate a consumer to
`Reveal` or `Stagger`; remove a class only when its last consumer is gone.

Layout transitions: `domAnimation` has no layout animation. A page that needs
`layout` props swaps the provider's feature import for `domMax` and records the
bundle cost.

## 9. Component catalogue

### `components/ui` (shadcn base-lyra, adapted)

| Import | Use for |
| --- | --- |
| `Button` from `@/components/ui/button` | Actions. Variants `default`, `secondary`, `outline`, `ghost`, `destructive` (the refusal, the loudest control), `link`. Sizes `xs`, `sm`, `default`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`. There is no `asChild`: use `render` for Base UI triggers |
| `buttonVariants` from `@/components/ui/button-variants` | Button styling on `<a>` and `<Link>`; callable from server components |
| `Badge`, `badgeVariants` (`@/components/ui/badge-variants`) | Neutral tags. For run mode, hold and receipt use `StatusPill` |
| `Card` and parts | Hairline panels. `size="sm"` for dense groups |
| `Input`, `Textarea`, `Label`, `InputGroup` | Fields, 44px tall |
| `Separator` | A hairline between groups |
| `Tooltip` | Names a control or reveals a truncated value. Never the only place for information |
| `Dialog` | A decision that blocks: confirm a send |
| `Sheet` | Mobile navigation and side panels |
| `DropdownMenu` | Secondary actions on a row or record |
| `Command` (with `CommandDialog`) | The Cmd K palette |
| `Tabs` | Switching views of the same object |
| `Table` | Tabular data. The container scrolls sideways and is focusable |
| `Skeleton` | Only through `LoadingState`, unless a layout needs a custom shape |
| `Alert` | A message attached to a control or form |
| `Progress` | Signatures collected, a known fraction |
| `ScrollArea` | A bounded scrolling list |
| `Toaster`, `toast` from `@/components/ui/toast` | Passing confirmations (copied, sent). Base UI Toast, not sonner |
| `Switch`, `Toggle`, `ToggleGroup` | Binary settings and segmented choices |
| `Breadcrumb` | The record page trail |
| `Kbd`, `KbdGroup` | Keyboard shortcuts |

Toast: the Base UI Toast was chosen over sonner because it is the same primitive
layer as every other overlay (one focus, portal and stacking model), it supports
actions, promises and swipe dismissal, and it adds no dependency. `Toaster` is not
mounted in the layout: taking it out cut the gzipped script on `/` by 33 kB. The shell
mounts it around the subtree that first needs a toast.

### `components/design` (import from `@/components/design`)

| Component | Use for |
| --- | --- |
| `PageHeader` | The one h1 of a page, its eyebrow (status line), promise, actions and meta |
| `Section` | A labelled region with an anchor id; the heading gets `${id}-heading` |
| `StatGroup`, `Stat` | Headline figures in a hairline grid, with tone |
| `KeyValueList`, `KeyValue` (alias `DataRow`) | Ledger rows of term and value; `mono` for hashes |
| `HashText` | A truncated hash with the full value in a tooltip, in the accessible name, and a copy control |
| `AddressText` | An address, 0x plus four and the last four, copy, optional HashScan link |
| `CopyButton` | Copy with a visible check and a polite announcement, failures announced |
| `StatusPill`, `runModeFromAdapter` | Run mode (`live`, `mirror`), hold (every `ComplianceState`), receipt (`on-chain`, `synthetic`, `none`) |
| `EmptyState` | Nothing yet, and the one action that fills it |
| `ErrorState` | A failure; `live` for one the reader just caused; `code` shows the API error code |
| `LoadingState` | Skeleton rows or a block with a polite status label; never fake numbers |
| `StaleBanner` | Data older than it should be. The caller passes the age, the component never reads the clock |
| `OfflineBanner`, `OfflineNotice` | The offline message; the banner appears only after hydration |
| `Callout` | A static note: neutral, info, success, warning, destructive, mirror |
| `CodeBlock` | Calldata and code, focusable horizontal scroll, copy |
| `ExternalLink`, `HashScanLink` | Links that leave Detent, with the new tab announcement |

### `components/motion` (import from `@/components/motion`)

| Component | Use for |
| --- | --- |
| `MotionProvider` | Mounted once in the layout |
| `Reveal` | One entrance, on view or on mount. Never `rise` or `fade` on the LCP element |
| `Stagger`, `StaggerItem` | Lists entering in 40ms steps |
| `Presence` | Mount and unmount with an exit, or swap content by `presenceKey` |
| `NumberTicker` | An amount that counts on change. Renders the final value first, so no hydration or LCP cost; screen readers get the final value only |

## 10. Changes Wave 2 must know

- `Button` has no `asChild`. The five link call sites now use `buttonVariants()`
  from `@/components/ui/button-variants`; labels and roles are unchanged.
- `buttonVariants` and `badgeVariants` moved out of the client component files.
- `Badge` renders a `<span>`, not a `<div>`.
- `Card` padding comes from `--card-spacing` (1.5rem, 1rem at `size="sm"`).
- A global `* { border-color: var(--border) }` is in the base layer, so a bare
  `border-t` draws the hairline.
- `text-primary` is gold text at 2.83:1; do not use it for text. The `link`
  variant uses ink with a gold underline.
- The engraved plates and the ledger rule under `public/` are rasters painted on
  parchment. In dark mode `.detent-ruled` is redrawn from tokens; the plates are
  not, and read as light cards on the dark ground.
