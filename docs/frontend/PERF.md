# Performance budgets, Wave 3

Owner: the perf agent. Branch `perf/budgets`, from `refactor/main` at `4bd9cb5`,
with `fa0b989` (content pages) and `df9125b` (polish) merged in. Gates from
`03_PLAN.md`: Lighthouse mobile on `/` with Performance at least 80 (target 95),
Accessibility, Best Practices and SEO at 100, LCP under 2.0 s, CLS under 0.05,
TBT under 150 ms, and initial JS for `/` under 300 KB gzip.

## Method

- Production build (`npm run build`, Next 16.3.5, Turbopack), `next start` on a
  local port, seed mode.
- Lighthouse 13.4.1, headless Chrome for Testing, three runs per route and form
  factor, medians reported. Mobile is the default simulated throttling (150 ms
  RTT, 1.6 Mbps, 4x CPU); desktop uses `--preset=desktop`.
- Lighthouse refuses to audit a document that answers 404
  (`ERRORED_DOCUMENT_REQUEST`), so `/nope` has JS and hydration numbers only.
- JS per route: every same origin `<script src>` in the server HTML, fetched and
  compressed with gzip level 9. The `noModule` polyfill chunk (38.6 kB) is
  excluded because modern browsers never download it. This counts more than
  the 223.1 kB the design system agent reported, so compare the before and
  after columns here with each other only.
- Chunk contents: `next experimental-analyze --output`, which ships with Next 16
  and reads the Turbopack module graph. No dev dependency was added.
- The before column is the merged tree before any change of mine. The polish
  merge landed between the before and after runs; it touched `lib/utils.ts`,
  buttons, tables and the record page, not the bundle structure.

## Results

Lighthouse medians, mobile (Performance, LCP, FCP, TBT, CLS):

| Route           | Before                         | After                          |
| --------------- | ------------------------------ | ------------------------------ |
| `/`             | 86, 4.22 s, 1.36 s, 9 ms, 0    | 92, 3.32 s, 1.36 s, 8 ms, 0    |
| `/how-it-works` | 88, 3.91 s, 1.36 s, 4 ms, 0    | 91, 3.52 s, 1.36 s, 8 ms, 0    |
| `/record/0xab…` | 86, 4.14 s, 1.21 s, 18 ms, 0   | 92, 3.37 s, 1.21 s, 8 ms, 0    |

Desktop is 100 on all three routes before and after, with LCP 0.70 to 0.78 s.
Accessibility, Best Practices and SEO are 100 on every run.

LCP element and breakdown from the trace (the text elements load no resource,
so load delay and load time do not apply):

| Route           | Element                                                  | Before TTFB, render delay | After TTFB, render delay |
| --------------- | -------------------------------------------------------- | ------------------------- | ------------------------ |
| `/`             | Register paragraph "1,000,000 tokens across 12 holders…" | 17 ms, 52 ms              | 4 ms, 45 ms              |
| `/how-it-works` | Problem paragraph "Whoever runs a tokenized security…"   | 5 ms, 43 ms               | 4 ms, 41 ms              |
| `/record/0xab…` | Header paragraph, after polish the anchor aside text     | 15 ms, 96 ms              | 8 ms, 49 ms              |

Same origin JS, gzip:

| Route           | Before   | After    |
| --------------- | -------- | -------- |
| `/`             | 341.5 kB | 280.3 kB |
| `/how-it-works` | 279.2 kB | 217.8 kB |
| `/record/0xab…` | 278.5 kB | 216.9 kB |
| `/nope`         | 246.3 kB | 174.5 kB |

Largest chunks still on `/`, gzip, with their main modules: react-dom 73 kB;
the Next router and client 43 kB; the console sections with viem and abitype
35 kB; Base UI floating-ui with the tooltip 29 kB; the Base UI toast region
20 kB; Base UI field and input 15 kB; Base UI popup utilities 15 kB;
tailwind-merge with the button 14 kB; the shell with next-themes and Phosphor
13 kB. The command palette (cmdk, the Radix dialog and zod) is not on the page:
it loads on first open.

React #418 under parallel cold loads (20 loads each of `/`,
`/record/0x` plus 64 `ab`, and `/no-such-page`, 8 concurrent): 0 of 60.

## Causes and fixes

1. **The Motion runtime shipped on every route.** `LazyMotion` and
   `MotionConfig` sat in the layout, the rail's scroll track called `useScroll`,
   `NumberTicker` called `animate()`, and `Reveal`, `Stagger` and `Presence`
   rendered `m.*` components. Together that put motion-dom and framer-motion,
   about 60 kB gzip, in the first load of every route, and a view triggered `m`
   element rendered at opacity 0 in the server HTML until the features arrived.
   Fix: every entrance is now CSS. `Reveal` and `Stagger` use the tw-animate-css
   enter keyframe and the `detent-wipe` keyframe that `app/globals.css` already
   defines, so a mount entrance plays from the server HTML. A view entrance
   uses one IntersectionObserver. `Presence` runs its exit and entrance with the
   same CSS and a 400 ms fallback. `NumberTicker` counts on
   `requestAnimationFrame` with the standard cubic bezier. The scroll track uses
   a passive scroll listener. `MotionProvider` and `features.ts` are deleted and
   nothing imports `motion/react` at runtime any more. The reduced motion block
   in `app/globals.css` still collapses every entrance.
2. **The mobile menu's dialog shipped on every route.** The Sheet (Base UI
   dialog, focus trap, scroll lock) was part of the top bar's first load. Fix:
   `components/shell/mobile-menu-sheet.tsx` loads on the first tap and stays
   mounted so the close animation plays. The trigger is a plain button with
   `aria-haspopup` and `aria-expanded`, and `finalFocus` hands focus back to it.
3. **Simulated LCP is charged for bytes, not for rendering.** In the trace the
   LCP paragraph paints with the first paint (render delay about 45 ms). The
   mobile LCP of 3 to 4 s comes from Lighthouse's simulation counting every
   script and font requested before that paint. That is why removing JS moved
   LCP by 0.9 s without touching the hero.

Behaviour notes for the motion owners:

- A view entrance on an element already on screen at hydration does not play;
  the element stays as the server rendered it. Off screen elements wait and
  play as before.
- A mount `Stagger` takes its delays from the `detent-stagger` rules (40 ms
  steps, capped at 240 ms on the seventh child). A custom `step` applies to view
  staggers, which number nested items in document order.
- `Presence` swaps one child at a time (the old `mode="wait"`). The unused
  `mode` prop is removed.

## Checked and left as is, with the evidence

- **Display font preload.** With `preload: false` on Libre Caslon, mobile `/`
  measured Performance 88, LCP 3.76 s and FCP 1.66 s against 92, 3.32 s and
  1.36 s with the preload, because the first paint waits on the heading face.
  The preload stays. `adjustFontFallback` is on by default for `next/font`, and
  CLS is 0.
- **Font weights and subsets.** Three preloaded files: Caslon 400 (17 kB),
  Caslon 700 (17 kB), Franklin variable (29 kB), latin only. Caslon 700 renders
  the semibold `ErrorState` headings. JetBrains Mono is not preloaded.
- **`optimizePackageImports` for `@phosphor-icons/react` and `@base-ui/react`.**
  Both declare `sideEffects: false` and ship ESM. A build with the option
  produced byte identical JS on every route (280.3, 217.8, 216.9 and 174.5 kB),
  so it is not set.
- **The brand images.** `public/brand/logo.png` (830,670 B, 1024 by 1024) is
  served through `/_next/image` as WebP at the rendered size: 320 B at `w=64` on
  a 375 px phone at 2x, 242 B at `w=48` on desktop. Both copies are
  `loading="lazy"`, neither is preloaded, and only the displayed one is fetched.
- **next-themes.** 1.4 kB in the shell chunk plus its inline script. Not a cost
  worth a change.
- **The command palette.** Already behind `next/dynamic` and mounted on the
  first request.
- **Prefetch on the shell links.** The content routes exist now, so the
  `prefetch={false}` flags on the rail and the footer are removed. Cost, after
  load and at idle: 8 requests and 103 kB on desktop, 2 requests and 23 kB on a
  phone (the menu links sit in the closed sheet). Value: a rail click to
  `/how-it-works` at 150 ms RTT and 1.6 Mbps takes 76 ms with prefetch and
  837 ms without (medians of 7).
- **`app/page.tsx`.** The page is static with `revalidate = 30` and one register
  read; there is no data wait to move behind a Suspense boundary, and a
  boundary here is what caused React #418 before.
- **`next dev` rewriting `CLAUDE.md`.** Reproduced: without `agentRules` in
  `next.config.ts`, starting `next dev` under a coding agent logged "Generated
  CLAUDE.md for AI agents" and modified the tracked file. With
  `agentRules: false` the tree stayed clean. The option is set.

## Gates

| Gate                                  | Value                | Pass |
| ------------------------------------- | -------------------- | ---- |
| Performance, mobile `/`, at least 80  | 92                   | yes  |
| Accessibility, Best Practices, SEO    | 100, 100, 100        | yes  |
| LCP under 2.0 s, mobile `/`           | 3.32 s (simulated)   | no   |
| CLS under 0.05                        | 0                    | yes  |
| TBT under 150 ms                      | 8 ms                 | yes  |
| Initial JS for `/` under 300 kB gzip  | 280.3 kB             | yes  |
| React #418 under parallel cold loads  | 0 of 60              | yes  |

The LCP gate is not met, and it was not met before the redesign either (2.5 s
on Next 15.5, 2.8 s on Next 16). What is left on `/` is mostly first party
console and design system code that other owners hold; the proposals below
take the largest pieces off the first load.

## Public files not referenced by the app

Kept, listed for the owners:

| File                    | Bytes     |
| ----------------------- | --------- |
| `public/demo-video.mp4` | 6,773,457 |
| `public/brand/og.png`   | 542,026   |
| `public/logo.svg`       | 581       |

`public/__farm.txt` (6 B) is not referenced by the app but is the deployment
fingerprint that `docs/REMAINING_WORK.md` keeps on purpose.

## Proposed changes for other owners

These are not applied. Each needs its owner's review and a measurement.

### A. The toast region after hydration (console and ui owners, about 20 kB)

`use-console.ts` only calls `toast.add`, so the manager can live in its own
module and the region can load without server rendering. The first toast always
follows an operator action, long after the region has mounted; a toast added
before that would be dropped, which is worth a test.

```diff
--- /dev/null
+++ b/components/ui/toast-manager.ts
+import { Toast as ToastPrimitive } from "@base-ui/react/toast";
+
+/** The shared manager. Importing it does not load the toast region. */
+export const toast = ToastPrimitive.createToastManager();
```

```diff
--- a/components/ui/toast.tsx
+++ b/components/ui/toast.tsx
@@
-const toast = ToastPrimitive.createToastManager();
+import { toast } from "./toast-manager";
```

```diff
--- a/components/console/use-console.ts
+++ b/components/console/use-console.ts
@@
-import { toast } from "@/components/ui/toast";
+import { toast } from "@/components/ui/toast-manager";
```

```diff
--- a/components/operations-console.tsx
+++ b/components/operations-console.tsx
@@
-import { Toaster } from "@/components/ui/toast";
+import dynamic from "next/dynamic";
+
+const Toaster = dynamic(
+  () => import("@/components/ui/toast").then((mod) => mod.Toaster),
+  { ssr: false },
+);
@@
-    <Toaster>
-      <div className="mx-auto flex w-full max-w-content flex-col gap-10">
+    <>
+      <div className="mx-auto flex w-full max-w-content flex-col gap-10">
@@
-      </div>
-    </Toaster>
+      </div>
+      <Toaster />
+    </>
```

### B. The tooltip popup on demand (design and ui owners, estimated 10 kB)

`HashText` renders a Base UI tooltip on the first screen of the console. The
trigger and the accessible name must stay server rendered; the popup, its
positioner and floating-ui dom and core can load after hydration if
`TooltipContent` moves to its own module. This estimate comes from the analyzer
and is not measured.

```diff
--- /dev/null
+++ b/components/ui/tooltip-content.tsx
+"use client";
+// Move the TooltipContent function from components/ui/tooltip.tsx here,
+// unchanged, as the default export.
```

```diff
--- a/components/design/hash-text.tsx
+++ b/components/design/hash-text.tsx
@@
-import {
-  Tooltip,
-  TooltipContent,
-  TooltipTrigger,
-} from "@/components/ui/tooltip";
+import dynamic from "next/dynamic";
+import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
+
+const TooltipContent = dynamic(() => import("@/components/ui/tooltip-content"), {
+  ssr: false,
+});
```

### C. Prefetch on the console's "How it works" link (console owner)

Same evidence as the shell links: 76 ms against 837 ms for the navigation, one
idle request of about 31 kB. On a phone this link is the only in viewport link
to the page.

```diff
--- a/components/console/console-hero.tsx
+++ b/components/console/console-hero.tsx
@@
-          // prefetch off: the explanation is a separate static page, and a
-          // prefetch on first paint would spend a request the operator did not
-          // ask for.
           <Link
             href="/how-it-works"
-            prefetch={false}
             className={cn(
```

### D. Docs and comments that still name MotionProvider (design system owner)

```diff
--- a/lib/motion.ts
+++ b/lib/motion.ts
@@
- * Every variant set here has a reduced motion reading: MotionProvider sets
- * `reducedMotion="user"`, which drops transform and layout animation for a
- * reader who asked for less motion, and the variants below only ever pair a
- * transform with opacity, so what remains is a plain fade or nothing.
+ * The components in components/motion run these entrances in CSS, and the
+ * reduced motion block in app/globals.css collapses them to a frame. The
+ * variant objects remain for any future Motion component.
```

In `docs/frontend/04_DESIGN_SYSTEM.md`, line 15 should read "CSS keyframes
(tw-animate-css and `detent-wipe`) driven by `components/motion/**`", the
architecture paragraph at line 311 should describe the CSS entrances and the
IntersectionObserver instead of `MotionProvider`, and the `MotionProvider` row
at line 385 should go. In `docs/frontend/01_STACK.md` line 92, `motion` is now
only a type import in `lib/motion.ts` and could be removed from the dependencies
once nothing needs it.

### E. viem on the first load of the console (console owner, structural)

`use-console.ts` calls `buildPlan` in a `useMemo` on the first render, and
`buildPlan` needs `keccak256` and `encodeFunctionData`, so viem (about 12 kB of
the 35 kB console chunk) cannot be deferred without changing when the plan is
computed. Computing the first plan on the server and passing it as a prop would
remove it; that is a contract change, not a performance tweak.

## After Motion

Owner: the Wave 3 motion agent. Branch `feat/motion`, from `refactor/main` at
`410963e`, with `refactor/main` at `dae3ef0` merged in (accessibility fixes and
the visual suite). Same method as above: production build, `next start`, seed
mode, Lighthouse 13.4.1 mobile medians of three runs. The before column was
measured again on the same machine in the same session, because this machine
was noisier than the one behind the tables above; compare the two columns
below with each other only.

Same origin JS, gzip level 9:

| Route           | Before   | After    |
| --------------- | -------- | -------- |
| `/`             | 280.3 kB | 255.0 kB |
| `/how-it-works` | 217.8 kB | 201.2 kB |
| `/record/0xab…` | 216.9 kB | 200.4 kB |
| `/nope`         | 174.5 kB | 186.2 kB |

Lighthouse medians, mobile (Performance with the three runs, LCP, TBT, CLS):

| Route           | Before                    | After                     |
| --------------- | ------------------------- | ------------------------- |
| `/`             | 88 (82/88/88), 3.84 s, 29 ms, 0 | 90 (89/90/90), 3.67 s, 14 ms, 0 |
| `/how-it-works` | 94 (94/90/94), 3.01 s, 7 ms, 0  | 91 (91/91/95), 3.52 s, 7 ms, 0  |
| `/record/0xab…` | 92 (92/92/92), 3.39 s, 11 ms, 0 | 92 (92/92/92), 3.29 s, 7 ms, 0  |

Accessibility, Best Practices and SEO are 100 on every run. The LCP elements
and their render delay (47 to 61 ms) did not change. `/how-it-works` after
matches the 91 and 3.52 s recorded for it after the perf pass; the 3.01 s
before run is the outlier of its set, not a regression of 0.5 s, and its JS
went down by 16.6 kB.

What changed on `/`:

1. Motion is back (`docs/frontend/07_MOTION.md`). Its static floor is about
   11.6 kB gzip on every route: `LazyMotion`'s loader imports
   `setFeatureDefinitions`, which lives in motion-dom's `VisualElement` module
   and pulls the value system and the WAAPI classes that every `m` element
   needs anyway. The `m` primitives and `AnimatePresence` add about 10 kB on the
   pages that use them. `domMax` (about 29 kB) loads after hydration.
2. `m` must come from `motion/react-m`. Imported from `motion/react`, it went
   through that entry's `import * as fm from "framer-motion"` namespace and
   Turbopack shipped the whole library: `/` measured 328.6 kB.
3. Proposal A, applied. Base UI exposes the toast parts only as the `Toast`
   namespace, so the proposed `toast-manager.ts` that imported it still
   shipped the whole region. The manager is now a forwarder that imports the
   region's own manager on the first call, and the region mounts with
   `next/dynamic` after hydration: 11.5 kB off the first load.
4. Proposal B, applied in a stronger form. The `Tooltip` namespace has the same
   problem, so moving only `TooltipContent` saved nothing. `HashText` renders a
   plain focusable span with the same classes, the same accessible name and the
   A11Y-06 hit area, and loads the whole Base UI tooltip module after
   hydration, handing focus to the new trigger if a reader was on the span:
   about 24 kB off `/`, `/how-it-works` and the record page.
5. Proposal C, applied. The console hero's link to `/how-it-works` is
   prefetched. The prefetch runs at idle after load and the Lighthouse numbers
   above include it.
6. Proposal D, applied: the motion sections of `04_DESIGN_SYSTEM.md` and
   `01_STACK.md` and the comment in `lib/motion.ts` describe the setup as built.
7. Proposal E, not applied. It needs the viem free helpers of `lib/plan.ts`
   (`formatMicros`, `formatTokens`, `microsToInput`, `shortHex`, `CHAIN_ID`)
   split from `buildPlan` and `decideTamperedSend`, and the first plan computed
   in `app/page.tsx`; neither file is owned by the console. The estimate stays
   viem 7.1 kB and abitype 5.2 kB. Plan recomputation on a row toggle would
   then import them on demand.

The LCP gate. Mobile LCP on `/` moved from 3.84 s to 3.67 s and is still over
2.0 s. The cause is the one recorded above: the paragraph paints with the
first paint, and Lighthouse's simulation charges LCP for every script and font
requested before it. Taking 25 kB of script off the first load bought about
0.17 s; the rest is React DOM and the Next router (about 115 kB), the console
and shell code, and the three preloaded font files (63 kB). A lower LCP would
need proposal E and fewer preloaded fonts, not less motion.

Checks on the merged result: React #418 in 0 of 60 parallel cold loads; the
end to end suite 72 of 72, including `e2e/a11y-regressions.spec.ts`,
`e2e/axe.spec.ts` and the new `e2e/motion.spec.ts`; `verify.ts` 16 of 16; no
horizontal overflow at 320 or 390 px on any frame through the lock and the
refusal.
