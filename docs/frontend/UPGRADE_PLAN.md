# Upgrade plan: Next.js 15.5 to 16

Repo state read on 2026-09-12 (read-only, no edits made):
- `package.json`: `"next": "^15.4.5"`, `"react": "^19.1.0"`, `"react-dom": "^19.1.0"`, `"eslint-config-next": "^15.5.25"`, `"tailwindcss": "^4.1.11"`, `"@tailwindcss/postcss": "^4.1.11"`.
- Actually installed in `node_modules`: next 15.5.25, react 19.3.0, tailwindcss 4.3.3.
- No `middleware.ts` / `proxy.ts` file exists.
- `app/` tree: `page.tsx`, `record/[planHash]/page.tsx` + `loading.tsx`, `api/detent/route.ts`, `error.tsx`, `loading.tsx`, `not-found.tsx`, `layout.tsx`, `globals.css`, `icon.svg`, `opengraph-image.png`.
- `app/record/[planHash]/page.tsx:57` already types `params: Promise<{ planHash: string }>`: async params already adopted.
- `app/record/[planHash]/page.tsx:31` and `app/page.tsx:11` both have `export const revalidate = 30`.
- `app/api/detent/route.ts:33` has `export const runtime = "nodejs"`.
- No `unstable_` API usage anywhere in `app/`, `components/`, `lib/`.
- Only one raw `fetch(` call, in `lib/privy.ts:239`, to the Privy API: no explicit `cache`/`next.revalidate` options seen in the excerpt checked.
- `next/image` used in `components/plates.tsx` and `components/rail.tsx`; no `images` block in `next.config.ts` (all defaults).
- `next.config.ts` only sets `outputFileTracingRoot: process.cwd()`: nothing else custom (no experimental flags, no webpack/turbopack overrides).

## Risk list (file, what changes/breaks, fix, codemod coverage)

| # | File(s) | What changes in Next 16 | Concrete fix | `@next/codemod` coverage |
|---|---|---|---|---|
| 1 | (repo-wide) | Node.js minimum becomes 20.9+ (was 18 in old Next). | Non-issue here: this machine runs Node v24.15.0. Just pin CI to Node ≥20.9. | N/A, not a code change |
| 2 | `app/record/[planHash]/page.tsx` | Sync `params`/`searchParams` access is removed in 16 (must be async). | Already done: `params: Promise<{ planHash: string }>` is present. Zero work. | Covered by `next-async-request-api` codemod, not needed here |
| 3 | `app/page.tsx:11`, `app/record/[planHash]/page.tsx:31` (`revalidate = 30`) | Next 16's Cache Components model (`cacheComponents: true`) replaces the old implicit ISR/ `revalidate` segment export model with opt-in `"use cache"` + `cacheLife` profiles. `revalidate` itself is not removed in 16 by default (Cache Components is opt-in), but if this repo later turns on `cacheComponents`, both `revalidate` exports stop having their old meaning and pages must switch to `"use cache"` with an explicit `cacheLife`. | Do NOT enable `cacheComponents` in this pass. If/when adopted, wrap the two cached routes in `"use cache"` + `cacheLife('minutes')`-equivalent profile, and test both under the new model. | Not automatically codemodded: Vercel ships a Skill/agent prompt for this (`github.com/vercel/next.js/tree/canary/skills/next-cache-components-adoption`), not a mechanical codemod |
| 4 | `app/api/detent/route.ts:33` (`runtime = "nodejs"`) | No breaking change to this export in 16. | No action needed. | N/A |
| 5 | (no `middleware.ts` present) | `middleware.ts` → `proxy.ts` rename; `middleware.ts` still works but is deprecated, will be removed in a future major. | Nothing to migrate: this repo has no middleware file at all. | `next-middleware-to-proxy` codemod exists for other repos, N/A here |
| 6 | `lib/privy.ts:239` (`fetch(...)`) | Next 16 keeps the "no implicit fetch caching" behavior introduced in 15; nothing new breaks here by default. Only relevant if Cache Components is later turned on (server fetches inside a `"use cache"` scope need an explicit cache policy). | No action for a straight 15→16 bump. Revisit only if adopting Cache Components. | N/A |
| 7 | `components/plates.tsx`, `components/rail.tsx` (`next/image`) | `images.minimumCacheTTL` default 60s→4h, `images.qualities` default full range→`[75]` (quality prop coerced to nearest allowed value), `images.imageSizes` drops `16`, `images.dangerouslyAllowLocalIP` now blocks local IP optimization by default, `images.maximumRedirects` default unlimited→3. `next/image` local `src` with query strings now requires `images.localPatterns`. | Since `next.config.ts` has no custom `images` block, all of these are silent behavior changes, not breakage: worth a visual smoke test of both image usages after upgrade, but no code change required unless a `quality` prop outside `[75]` was being relied on (grep found none, both usages should be checked directly for a `quality=` prop as a follow-up). | Not codemodded: behavior-only change, verify by eye |
| 8 | `eslint.config.mjs`, `package.json` (`eslint-config-next`) | `@next/eslint-plugin-next` now defaults to ESLint Flat Config (this repo already uses `eslint.config.mjs`, i.e. flat config, so likely already compatible). `next lint` command is removed entirely in 16 (must use `eslint` or `biome` directly). | `package.json`'s `"lint": "eslint ."` already bypasses `next lint`, so this repo is already unaffected. Bump `eslint-config-next` to the 16.x line to match. | `next-lint-to-eslint-cli` codemod exists for repos still using `next lint`, N/A here |
| 9 | (repo-wide) | Default bundler switches to Turbopack for `next build`/`next dev`. | No custom webpack config exists in this repo (nothing found), so this should be a low-risk default flip. Still worth one full `next build` under 16 to confirm no Turbopack-specific regression before the deadline. | N/A, behavior default change |
| 10 | (repo-wide) | Automatic `scroll-behavior: smooth` on `<html>` is removed by default. | `app/layout.tsx` does not set `data-scroll-behavior`, so if any part of the current UX (e.g. anchor-link navigation in the rail/section-progress components) relied on native smooth scroll, it will silently become instant-jump after the upgrade. Check `components/section-progress.tsx` and `components/rail.tsx` (both handle in-page navigation) and add `data-scroll-behavior="smooth"` to the `<html>` tag in `app/layout.tsx` if smooth scroll is desired. | Not codemodded, manual check needed: flagged as the single most likely silent visual regression for this specific repo |
| 11 | `package.json` (`tailwindcss: ^4.1.11`, installed 4.3.3) | Not a Next-version risk, but worth folding into the same upgrade pass: Tailwind is already on v4 with CSS-first config (`app/globals.css` already uses `@theme inline`), so no Tailwind migration work is needed regardless of the Next bump. | No action. | N/A |
| 12 | `package-lock.json` / `overrides.postcss` | `"overrides": { "postcss": "^8.5.28" }` exists for a vitest/PostCSS plugin-shape conflict (documented in `postcss.config.mjs` comment). Unrelated to Next 16 but worth re-testing `npm test` after any dependency bump since this override was a fragile fix. | Re-run `npm test` after the bump; no code change expected. | N/A |

## Codemod command to use if this upgrade proceeds

```bash
npx @next/codemod@canary upgrade latest
```
This is the automated path Next.js documents (https://nextjs.org/blog/next-16). Given the risk table above, the codemod's real value here is limited: this repo has already done most of the manual prep (async params, no middleware, flat ESLint config, Tailwind v4 already). The main residual work is manual: (a) decide on Cache Components adoption (recommend: skip for now, see below), (b) spot-check `next/image` output for the two used images, (c) add `data-scroll-behavior="smooth"` if smooth scroll is desired, (d) one full `next build` + `npm test` + `npm run test:e2e` pass on 16.

## Recommendation

The submission deadline is 16 September 2026; this assessment was made on 12 September.

**Do not upgrade to Next 16 before the deadline.** Reasoning:

1. This repo's actual exposure to breaking changes is unusually low (async params already done, no middleware, no custom images config, no `next lint`, Tailwind already v4, no `unstable_` API usage): which means the upgrade is *low risk*, not *zero cost*. The remaining cost is verification time: a full `next build`, full Playwright e2e suite, and a visual pass on image rendering and any smooth-scroll-dependent UI, on a project whose whole differentiator is exact visual/motion fidelity to `IDENTITY.md`.
2. Turbopack becoming the default bundler, revalidate/image default changes, and the new terminal/log output are all "should be fine" items until they aren't, in the same 96 hours the team also needs for the rest of the hackathon deadline crunch (submission polish, demo recording, judging preparation).
3. The one item that would actually be worth adopting even under deadline pressure: Cache Components / Instant Navigations for snappier navigation on `/` and `/record/[planHash]`: is explicitly opt-in and its own blog post frames it as still stabilizing (Preview as of the June 2026 post). Turning it on this close to a deadline risks the `revalidate = 30` pages behaving differently in ways that are hard to fully test in 4 days.
4. Staying on Next 15.5.25 (Maintenance LTS, security-patched until Oct 2026) costs nothing for a submission due Sept 16: there is no security or feature gap that matters before then.

**If there is spare time after the submission is locked**, upgrade in this order: bump `next`/`eslint-config-next` to 16.x with the codemod → run full test suite → smoke-test images and scroll behavior → only then evaluate `cacheComponents`/`partialPrefetching` as a separate, later change, not bundled with the version bump.
