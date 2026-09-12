# 01 Stack

Frontend stack verification for Detent, September 2026.

Method: every row was checked live against the npm registry (`npm view`) or an official
source (nextjs.org, react.dev, tailwindcss.com, ui.shadcn.com, motion.dev, base-ui.com)
on 2026-09-12. Nothing below is from training-data memory alone.

## 1. Environment and registry versions (raw command output)

| Tool / package | Command | Result |
|---|---|---|
| Node.js | `node -v` | v24.15.0 |
| npm | `npm -v` | 11.12.1 |
| next | `npm view next version` | 16.3.5 |
| next dist-tags | `npm view next dist-tags` | latest 16.3.5, canary 16.4.0-canary.27, preview 16.3.0-preview.10, backport 15.5.25, rc 15.0.0-rc.1, beta 16.0.0-beta.0 |
| react | `npm view react version` | 19.3.0 |
| tailwindcss | `npm view tailwindcss version` | 4.3.3 |
| shadcn (CLI) | `npm view shadcn version` | 4.21.0 |
| motion | `npm view motion version` | 13.2.0 |
| framer-motion | `npm view framer-motion version` | 13.2.0 (identical version to `motion`, confirms it is now a republished alias) |
| lucide-react | `npm view lucide-react version` | 1.45.0 |
| sonner | `npm view sonner version` | 2.0.8 |
| @base-ui-components/react | `npm view @base-ui-components/react version` | 1.0.0-rc.0, and `npm view @base-ui-components/react deprecated` → "Package was renamed to @base-ui/react" |
| @base-ui/react (current name) | `npm view @base-ui/react version` | 1.8.0 (published 2026-09-04) |
| next-themes | `npm view next-themes version` | 0.4.6 |
| eslint-plugin-jsx-a11y | `npm view eslint-plugin-jsx-a11y version` | 6.10.2 |
| @next/bundle-analyzer | `npm view @next/bundle-analyzer version` | 16.3.5 (versioned in lockstep with `next`) |
| unlighthouse | `npm view unlighthouse version` | 0.18.0 |
| @playwright/test | `npm view @playwright/test version` | 1.63.0 |

`npx shadcn@latest --help` (run inside the scratchpad folder, not inside detent) prints exactly:
```
Commands:
  init|create [options] [components...]  initialize your project and install dependencies
  apply [options] [preset]               apply a preset to an existing project
  add [options] [components...]          add a component to your project
  diff [options] [component]             [DEPRECATED] Use `add [component] --diff` instead.
  docs [options] <components...>         get docs, api references and usage examples for components
  view [options] <items...>              view items from the registry
  search|list [options] [registries...]  search items from registries
  migrate [options] [migration] [path]   run a migration.
  eject [options]                        inline shadcn/tailwind.css and remove the shadcn dependency
  info [options]                         get information about your project
  build [options] [registry]             build components for a shadcn registry
  mcp [options]                          MCP server and configuration commands
  preset                                 manage presets
  registry                               manage registries
  help [command]                         display help for command
```

## 2. Claim-by-claim verdicts

| # | Claim | Verdict | Source |
|---|---|---|---|
| 1 | Next.js 16 is Active LTS, 15.x is Maintenance LTS | TRUE | https://nextjs.org/support-policy (16.x Active LTS since Oct 21 2025; 15.x Maintenance LTS since Oct 21 2025, releases from Oct 21 2024) |
| 2 | React Compiler stable in Next 16 | TRUE, with nuance: stable but NOT enabled by default | https://nextjs.org/blog/next-16 ("`reactCompiler` ... promoted from experimental to stable ... not enabled by default") |
| 3 | Cache Components and `use cache` in Next 16 | TRUE | https://nextjs.org/blog/next-16 ("Cache Components ... new `\"use cache\"` directive ... entirely opt-in", enabled via `cacheComponents: true`) |
| 4 | "Instant Navigations & Partial Prefetching" shipped in 16.3+ | TRUE, but was still Preview as of the source post (16.3 Preview, June 25 2026); confirm it graduated to stable in the 16.3.x line you install | https://nextjs.org/blog/next-16-3-instant-navigations (gated behind `cacheComponents: true` + `partialPrefetching: true`) |
| 5 | Tailwind v4 CSS-first config (`@theme`, `@theme inline`, `@custom-variant dark`), OKLCH defaults | TRUE | https://tailwindcss.com/docs/upgrade-guide (JS config no longer auto-detected; `@theme` blocks with `oklch(...)` values shown as the canonical example) |
| 6 | shadcn CLI v4 commands: `init, add, create, migrate, preset, apply, eject` | TRUE, but incomplete: the live `--help` also lists `diff` (deprecated), `docs`, `view`, `search\|list`, `info`, `build`, `mcp`, `registry` | live `npx shadcn@latest --help` output above |
| 7 | Base UI is the default primitive layer since July 2026 | TRUE | https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default ("Starting today, Base UI is the default component library in shadcn/ui"); Radix is not deprecated, still fully supported |
| 8 | The eight style names: vega, nova, maia, lyra, mira, luma, rhea, sera | TRUE | confirmed directly against the live shadcn schema (`ui.shadcn.com/schema.json`) and cross-checked with the changelog entries introducing each style (2026-03 Luma, 2026-04 Sera, 2026-05 Rhea, plus Vega/Nova/Maia/Lyra/Mira earlier) |
| 9 | `components.json` style string format `{base}-{style}` | TRUE, and more specific than the prompt states: it is `{primitive}-{style}`, with three primitive prefixes, not one. Live schema enum is exactly: `default`, `new-york` (both legacy/deprecated), then `radix-vega/nova/maia/lyra/mira/luma/sera/rhea`, `base-vega/nova/maia/lyra/mira/luma/sera/rhea`, `aria-vega/nova/maia/lyra/mira/luma/sera/rhea` | https://ui.shadcn.com/schema.json |
| 10 | `data-slot` attributes | TRUE | shadcn maintainer statement ("For the v4 upgrade, all primitives will have the data-slot attribute") at https://x.com/shadcn/status/1886456699831378007, and current component docs (e.g. https://ui.shadcn.com/docs/components/base/card, https://ui.shadcn.com/docs/components/base/input-group) show `data-slot="card"`, `data-slot="input-group-control"`, etc. |
| 11 | A newer Toast component supersedes sonner | UNVERIFIED / likely overstated. TRUE that a new Base-UI-native Toast component exists (https://ui.shadcn.com/docs/changelog/2026-07-toast: "A new Toast component is now available for Base UI projects... supports actions, status types, promises, stacking, and swipe dismissal"). Could NOT find an official statement that Sonner is deprecated or superseded: the Sonner component page is still live and separately documented. Treat "supersedes sonner" as unconfirmed; verify directly on `ui.shadcn.com/docs/components/base/toast` and `.../sonner` before dropping sonner from the plan. |
| 12 | Component names: `empty`, `field`, `spinner`, `input-group`, `button-group`, `item`, `kbd` | TRUE (component list includes Empty, Field/Empty Field, Spinner, Input Group, Button Group, Item, Kbd) | https://ui.shadcn.com/docs/components (component index) |
| 13 | Motion package `motion`, import `motion/react` | TRUE | https://motion.dev/docs/react-upgrade-guide ("uninstall `framer-motion` and install `motion`" then "swap imports from `\"framer-motion\"` to `\"motion/react\"`") |
| 14 | `framer-motion` deprecated alias | TRUE, functionally: still published (13.2.0, same version as `motion`) and works, described industry-wide as a maintained but deprecated re-export; the motion.dev upgrade guide itself frames it as something to migrate away from rather than using the word "deprecated" verbatim in the fetched excerpt: treat the exact word "deprecated" as UNVERIFIED against that one page even though the practical behavior (alias, install-time redirect) is confirmed by version parity on npm | https://motion.dev/docs/react-upgrade-guide, https://www.npmjs.com/package/framer-motion |
| 15 | `animateView()` for the View Transition API | TRUE, name is slightly off: the documented API is `AnimateView` (a React component / `animateView` function), described as "Motion's wrapper around the browser's native View Transition API" | https://motion.dev/docs/react-animate-view and https://motion.dev/docs/animate-view |
| 16 | `useReducedMotion` | TRUE (present in `motion/react`, standard accessibility hook, unchanged behavior) | https://motion.dev (react-upgrade-guide references it as carried over unchanged) |

## 3. Net correction list (things the master prompt got wrong or overstated)

- "Toast supersedes sonner": not confirmed anywhere official; Sonner's docs page is still live. Do not delete sonner from a plan on this claim alone.
- "shadcn CLI v4 commands: init, add, create, migrate, preset, apply, eject": real, but the list is incomplete (missing `diff`, `docs`, `view`, `search|list`, `info`, `build`, `mcp`, `registry`).
- "@base-ui-components/react" is not the current package name: it is deprecated and renamed to `@base-ui/react` (current 1.8.0). Any install instructions must use the new name.
- The `components.json` style format is not a single `{base}-{style}` axis: it is three axes (`radix-`, `base-`, `aria-`) times eight style names, plus two legacy values (`default`, `new-york`).
- "framer-motion deprecated alias" is true in spirit (same version, install-time redirect, publicly discouraged for new code) but the literal word "deprecated" was not found verbatim on the motion.dev upgrade guide page fetched: flagged as a minor wording overstatement, not a factual error.
- "Instant Navigations & Partial Prefetching in 16.3+": true, but note the primary source (nextjs.org/blog/next-16-3-instant-navigations) is dated as a 16.3 **Preview** post (June 25, 2026); by the registry's `latest` of 16.3.5 today the feature should be in a stable minor, but this was not independently re-verified against the 16.3.5 stable changelog: treat the exact stabilization point as UNVERIFIED down to the patch version.

## 4. Dependencies

Added in Wave 1 (design system), 13 September 2026. Versions are the ones in
`package.json` after install.

| Package | Version | Why |
| --- | --- | --- |
| `@base-ui/react` | 1.8.0 | The primitive layer under every shadcn `base-*` component: dialog, menu, tooltip, toast, tabs, switch, toggle, scroll area. The default shadcn base since July 2026 |
| `@phosphor-icons/react` | 2.1.10 | The icon library the `base-lyra` style generates against. It has a server safe entry (`/ssr`), so icons in server components add no client code |
| `cmdk` | 1.1.1 | The shadcn `command` component, the Cmd K palette in `05_IA.md` |
| `motion` | 13.2.0 | Motion for React, imported from `motion/react`. Loaded through `LazyMotion` with `domAnimation` on a dynamic import, so only the `m` components ship up front |
| `next-themes` | 0.4.6 | Light, dark and system themes with no flash: it writes the theme class before hydration |
| `tw-animate-css` | 1.4.0 | CSS only. The enter and exit utilities (`animate-in`, `fade-in-0`, `zoom-in-95`) the shadcn overlays use |

Removed: `@radix-ui/react-slot`, which only served `asChild` on the hand written
button.

Considered and not added:

- `cn` 0.3.0, which `shadcn init` now writes into `lib/utils.ts` as a replacement
  for clsx plus tailwind-merge. It was published the day before and is at 0.3.
  `lib/utils.ts` keeps clsx and tailwind-merge, which were already installed and
  are what every shadcn component expects from `cn()`.
- `sonner` 2.0.8. The Base UI Toast covers the same needs (types, actions,
  promises, stacking, swipe) on the same primitive layer as the other overlays,
  with no extra package.
- `shadcn` as a runtime dependency. `init` adds it for `shadcn/tailwind.css`;
  `shadcn eject` inlined the part the components use (the `data-*` state
  variants and `no-scrollbar`) into `app/globals.css` and removed the package.
