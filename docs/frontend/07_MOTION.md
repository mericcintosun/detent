# Motion

Owner: the Wave 3 motion agent. Branch `feat/motion`, from `refactor/main` at
`410963e`. This document is the inventory of every animated element, the way
Motion is loaded, and what it costs. The tokens themselves are in
`lib/motion.ts` and section 8 of `04_DESIGN_SYSTEM.md`.

## 1. The rule

Motion for React (`motion` 13.2.0) is the engine for interaction and for
anything that enters after the first paint. CSS keeps the first paint. Nothing
on a server rendered first screen is hidden until JavaScript runs: a mount
entrance that is part of the server HTML plays in CSS from the HTML, a view
entrance renders visible and only hides once Motion knows the element is off
screen, and every Motion state change is purposeful and at most 600 ms.

## 2. Loading strategy

- `components/motion/motion-provider.tsx` sits in `app/layout.tsx`:
  `MotionConfig reducedMotion="user"` around `LazyMotion strict`, with
  `features={() => import("./features").then((mod) => mod.default)}`.
  LazyMotion starts that import in an effect, so the animation, gesture and
  layout features (`domMax`) arrive after hydration.
- Only `m` components are used, imported as `import * as m from
  "motion/react-m"` and read by static member (`m.div`, or a fixed tag map).
  Never import `m` from `motion/react`: that entry builds its `m` export from
  `import * as fm from "framer-motion"`, a namespace of the whole library, and
  Turbopack then ships all of it. That one import cost 38 kB gzip on `/`.
  `motion.*` components throw under `strict`.
- Hooks and components that only exist on the barrel (`LazyMotion`,
  `MotionConfig`, `AnimatePresence`, `useInView`, `useReducedMotionConfig`)
  come from `motion/react`, which reaches them through `export *` and tree
  shakes.
- `NumberTicker` imports `animate` from `components/motion/animate-number.ts`
  with a dynamic import on the first change of an amount.
- `useClientMount()` (`components/motion/use-client-mount.ts`) tells a
  component whether it mounted after hydration. It reads a
  `useSyncExternalStore` server snapshot, which hydration always uses, so the
  answer is the same in the server HTML and the first client render whatever
  Suspense boundaries sit above. Server rendered mount entrances use CSS;
  client mounted ones use Motion.
- The floor: `LazyMotion`'s loader imports `setFeatureDefinitions` from
  motion-dom, which lives in `render/VisualElement.mjs` and pulls the value
  system and the WAAPI animation classes. Every `m` element needs that module
  anyway, so about 11.6 kB gzip of Motion is in the first load of every route,
  including the 404.

## 3. Reduced motion

Two layers. `MotionConfig reducedMotion="user"` makes every transform and
layout animation jump. Opacity and clip-path are not transforms, so each
entrance variant also reads `custom={{ reduced }}` (from
`useReducedMotionConfig`) and collapses to a 200 ms fade with an instant clip.
`custom` is never rendered, so the server HTML is the same for every reader.
The CSS entrances keep the reduced motion block in `app/globals.css`, which
collapses them to a frame. The e2e spec `e2e/motion.spec.ts` samples the send
card on every frame through a refusal and asserts it never moves with reduced
motion.

## 4. Inventory

Durations and easings are the tokens in `lib/motion.ts`. "Reduced" is what a
reader with `prefers-reduced-motion: reduce` sees.

| Element | File | Trigger | Motion | Engine | Reduced |
| --- | --- | --- | --- | --- | --- |
| Console hero (status line, h1, promise) | `components/console/console-hero.tsx` via `Reveal variant="wipe" trigger="mount"` | first paint | `detent-wipe`, `duration.wipe` 600 ms, `easing.wipe`, starts at 35 percent opacity | CSS | a frame |
| Content page headers (how it works, security, faucet, privacy, terms, record) | `app/*/page.tsx` via `Reveal wipe mount` | first paint | same wipe | CSS | a frame |
| Record timeline | `components/record/record-timeline.tsx` via `Stagger mount` | first paint | tw-animate rise, `duration.slow`, `easing.emphasized`, `detent-stagger` 40 ms steps capped at 240 ms | CSS | a frame |
| Register note, band plates | `detent-enter`, `.detent-band` classes | first paint, scroll timeline | wipe, scroll driven where supported | CSS | a frame |
| Three steps, architecture diagram | `app/how-it-works/page.tsx`, `components/content/architecture-diagram.tsx` via `Stagger` (view) | a share scrolls into view | rise, `transition.slow`, `staggerChildren` 40 ms | Motion | fade, `duration.base` |
| Any `Reveal` with `trigger="view"` | `components/motion/reveal.tsx` | a fifth in view | the named variant | Motion | fade |
| Client mounted `Reveal` (the compiled policy after a lock, a client navigation) | `components/console/policy-section.tsx` and pages | mount after hydration | the named variant, `delay` honoured | Motion | fade |
| Treasury key banner content | `components/console-states.tsx` via `Presence` | key state changes | fade out `transition.exit` 120 ms, then fade in `transition.base` 200 ms, `mode="wait"` | Motion (`AnimatePresence`) | same fade |
| Settlement block (signed or refused) | `components/console/send-section.tsx` via `Presence variant="rise"` | a send returns | rise in `transition.slow` 320 ms, out `transition.exit` | Motion | fade |
| Lock rule | `components/console/send-section.tsx`, `data-slot="lock-rule"` | a plan is locked | gold 2 px rule, `scaleX` 0 to 1 on `transition.wipe`; retracts on `transition.exit` when refused or released | Motion | appears at once |
| Refusal knock | `components/console/send-section.tsx`, `data-slot="send-knock"` | the wallet refuses | `x` keyframes 0, -6, 0, -3, 0 px over `duration.slow` 320 ms, `easing.standard`; leftward only so a full-width card never widens the page; two identical labels so each refusal plays | Motion | no movement; the oxide ring and the alert carry it |
| Step badges | `components/console/step-badge.tsx` | a step changes state | word swaps with `AnimatePresence mode="popLayout"`, in on `spring.snappy`, out on `transition.exit`; badge width follows on `spring.layout` | Motion (`layout`) | fade, width jumps |
| Audit record entries | `components/console/ledger-section.tsx` via `Stagger mount` (client) and `StaggerItem layout` | an entry is written | new entry rises in, older entries slide down on `spring.layout` | Motion (`layout`) | fade, positions jump |
| Draw and headroom amounts | `components/console/plan-section.tsx` via `NumberTicker` | a row is held, forced in, deferred or restored | counts from the old value over `duration.slow` on `easing.standard` | Motion (`animate`, loaded on first change) | value jumps |
| Press feedback | `pressable` on the row toggle, "Send edited plan" and "Execute the approved plan" | pointer down | `scale` 0.97 on `spring.snappy` | Motion (`whileTap`) | none |
| Toasts | `components/ui/toast.tsx`, mounted by `components/operations-console.tsx` after hydration | a toast is added or dismissed | Base UI data-starting and ending style transitions, 500 ms `cubic-bezier(0.22, 1, 0.36, 1)` | CSS (Base UI owns the unmount timing) | a frame |
| Overlays (sheet, dialog, command palette, tooltip) | `components/ui/**` | open and close | tw-animate `zoom-in-95` and fade, the `scaleIn` reading | CSS | a frame |

Not animated on purpose: the register table rows (a row toggle changes the
amount, the strike-through and the ticker, and a moving row in a scrolling
table would hide which one changed), focus rings, and the run mode status line
text (it is a live region and its words must not be delayed).

## 5. Measured cost

See section 6 of `PERF.md` for the Lighthouse runs. Same origin JS per route,
gzip level 9, noModule polyfill excluded, before is `refactor/main` at `410963e`:

| Route | Before | After |
| --- | --- | --- |
| `/` | 280.3 kB | 254.9 kB |
| `/how-it-works` | 217.8 kB | 201.2 kB |
| `/record/0xab…` | 216.9 kB | 200.4 kB |
| `/nope` | 174.5 kB | 186.2 kB |

What moved on `/`: Motion's static floor and the `m` primitives came in; the
toast region (proposal A), the whole Base UI tooltip with floating-ui
(proposal B, see `PERF.md`) left the first load. The 404 has no tooltip to
give back, so it carries the Motion floor as a net increase.

Loaded after the first paint, measured on `/` in a browser (every script
fetched beyond the server HTML's own list, gzip level 9):

| When | What | Gzip |
| --- | --- | --- |
| After hydration, idle | Motion features (`domMax`: animation, gestures, layout, drag) | about 29 kB in two chunks |
| After hydration, idle | The Base UI tooltip and floating-ui for `HashText` | about 24 kB |
| After hydration, idle | The toast region | 11.5 kB |
| After hydration, idle | Shared runtime pieces of the above | about 26 kB |
| First amount change | `animate` for `NumberTicker` | 3.6 kB |

In total 90.2 kB arrives after hydration and 3.6 kB on the first change. None
of it is requested before the first paint, so none of it counts toward the
simulated largest contentful paint.

## 6. Adding motion

- Use a primitive from `@/components/motion` or a variant from `lib/motion.ts`.
  A new value is a token change in `lib/motion.ts`, mirrored in
  `app/globals.css` when CSS needs it, and a row in section 4.
- Import `m` from `motion/react-m`. `tests/motion.test.ts` fails on a `motion.`
  component and on a static import of the animation engine.
- Never give a server rendered element an `initial` that hides it. Use
  `initial={false}` and animate on a state change, or use CSS for the first
  paint.
- A transform is dropped for reduced motion automatically; anything else reads
  `useMotionCustom()` and collapses to a fade.
