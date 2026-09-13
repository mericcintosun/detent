# QA report, Wave 4

Owner: the qa agent. Branch `test/visual`, from `refactor/main` at `410963e`.
Every number in the gate table comes from a run on 13 September 2026 in the
worktree, unless the row says otherwise. The a11y fix and motion branches were
still open during this wave, so the visual baselines describe `410963e` and
will be regenerated after those merges (see "Updating baselines").

## Gates

The gate list is the one in `03_PLAN.md`.

| Gate | Command | Result | Status |
| --- | --- | --- | --- |
| Typecheck | `npx tsc --noEmit` | 0 errors | pass |
| Lint | `npm run lint` | 0 errors, 0 warnings | pass |
| Format | `npx prettier --check .` | all files formatted | pass |
| Unit tests and coverage thresholds | `npm run test:coverage` | 18 files, 370 tests; statements 87.27, branches 89.64, functions 95.91, lines 87.27 (floors 69, 87, 82, 69) | pass |
| Production build, no new warnings | `npm run build` | exit 0, no warning lines in the log | pass |
| End to end suite, axe included | `npm run test:e2e` | 57 passed, 0 failed, 0 flaky | pass |
| Axe, zero serious and critical | inside `e2e/axe.spec.ts` | 16 checks (8 routes, 2 themes) green | pass |
| Visual regression, 3 widths, 2 themes | `npm run test:visual` | 80 passed, 4 skipped by design, 0 diffs on 2 reruns | pass |
| Lighthouse mobile `/`, Performance at least 80 | from PERF.md | 92 | pass, from PERF.md, to be re-measured after the motion merge |
| Accessibility, Best Practices, SEO at 100 | from PERF.md | 100, 100, 100 | pass, from PERF.md, to be re-measured after the motion merge |
| LCP under 2.0 s, mobile `/` | from PERF.md | 3.32 s simulated | fail, from PERF.md, to be re-measured after the motion merge |
| Initial JS for `/` under 300 kB gzip | from PERF.md | 280.3 kB | pass, from PERF.md, to be re-measured after the motion merge |

The build logs `[core] submit failed: lock_unknown` and `lock failed:
quorum_not_met` lines during the e2e run. They come from the API contract tests
that send a request without a lock or without a quorum on purpose.

## Lighthouse

From PERF.md, to be re-measured after the motion merge. Mobile medians of
three runs, Lighthouse 13.4.1, simulated throttling.

| Route | Performance | LCP | FCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- |
| `/` | 92 | 3.32 s | 1.36 s | 8 ms | 0 |
| `/how-it-works` | 91 | 3.52 s | 1.36 s | 8 ms | 0 |
| `/record/0xab…` | 92 | 3.37 s | 1.21 s | 8 ms | 0 |

Desktop is 100 on all three. Accessibility, Best Practices and SEO are 100 on
every run. The LCP gate is not met and was not met before the redesign either;
PERF.md explains that the simulated LCP is charged for script and font bytes,
not for rendering, and lists proposals A to E for the owners.

## Accessibility findings

Status from A11Y_AUDIT.md at `f963bbd`. The a11y fix branch was open during
this wave and its result is not merged, so every finding is still open here.

| Id | Finding | Severity | Owner | Status |
| --- | --- | --- | --- | --- |
| A11Y-01 | Forced colors strip every focus indicator | blocker | `app/globals.css` | open, fix branch in progress |
| A11Y-02 | `/` overflows horizontally at 320 px | blocker | `components/ui/button-variants.ts`, `components/console/policy-section.tsx` | open, fix branch in progress |
| A11Y-03 | Base UI dialogs leak focus on the second loop | should fix | `components/ui/sheet.tsx`, `components/shell/command-palette-dialog.tsx` | open |
| A11Y-04 | Hash tooltip partly overlaps the next row's button | should fix | `components/ui/tooltip.tsx` | open |
| A11Y-05 | Table headers have no `scope` | nice to have | `components/ui/table.tsx` | open |
| A11Y-06 | Hash tooltip triggers are 17 px tall | nice to have | `components/design/hash-text.tsx`, `components/design/address-text.tsx` | open |

Axe itself reports zero serious or critical findings on every route in both
themes (the e2e row above).

## Visual regression suite

### Layout

- `playwright.visual.config.ts`: its own port (3125, overridable with
  `VISUAL_PORT`), builds and starts the app like the e2e config, Chromium only,
  `reducedMotion: "reduce"`, `timezoneId: "UTC"`, `locale: "en-US"`,
  `deviceScaleFactor: 1`, `animations: "disabled"`, `caret: "hide"`, no
  retries.
- Six projects: `375-light`, `375-dark`, `768-light`, `768-dark`,
  `1440-light`, `1440-dark`. The theme is the emulated
  `prefers-color-scheme`, which next-themes follows under its `system` default.
- Baselines: `tests/visual/__screenshots__/<project>/<spec>/<name>.png`.
- `tests/visual/pages.visual.ts`: full page captures of `/`, `/how-it-works`,
  `/security`, `/faucet`, `/privacy`, `/terms`, `/record/0x` plus 64 `ab`, and
  `/no-such-page` (asserted as a 404; the 404 console line is allowed only in
  that test). 8 per project, 48 in total.
- `tests/visual/demo.visual.ts`: the demo states on `/`, driven by the helpers
  in `e2e/console.ts`. Approved and locked are clipped to `#policy`, edited send
  refused and approved send signed to `#send`, and the open command palette is
  a viewport capture. 5 per project, 30 in total. The open mobile Sheet is
  captured at 375 only, 2 in total; the other four projects skip it.
- Both specs import `test` from `e2e/fixtures.ts`, so each test has its own
  `x-forwarded-for` address and fails on a console error, a page error or a
  same origin 5xx.
- `npm run test:visual` and `npm run test:visual:update` were added to
  `package.json`; no other line of that file changed.

80 baseline files, 18 MB in total (about 3 MB per project), under the 25 MB
budget, so the scope was not reduced.

### Masks and pinned time

`tests/visual/helpers.ts` masks only the elements that print a time:

| Element | Source | Why |
| --- | --- | --- |
| `#register time`, the register note's "Snapshot" value | `components/console/register-section.tsx` | the server stamps `fetchedAt` on each read, and the page revalidates every 30 s, so two requests a minute apart print different seconds; the first baseline run showed 04:36:10 in light and 04:36:41 in dark |
| `[data-slot="stale-banner"] time` | `components/design/states.tsx` | relative age, "12 minutes ago" |
| `#ledger li time` | `components/console/ledger-section.tsx` | wall clock HH:MM:SS of each audit entry |
| `#record time` | `components/record/record-timeline.tsx` | anchored and closed timestamps; absent in seed mode, masked so a live build cannot leak them |

A mask does not stop a layout change, so the browser clock is also pinned with
`page.clock.setFixedTime` at 2020-01-01T00:00:00Z before the first navigation.
The snapshot is always newer than that, so the stale banner can never appear
on one run and not the next. No whole section is masked.

`tests/visual/screenshot.css` (the `stylePath`) hides the toast viewport, a
fixed overlay whose toasts time out on their own clock, and the Next dev
portal. The section clips also hide the sticky top bar: a section taller than
the viewport is captured by scrolling, and without this the bar was painted
across the middle of the 375 and 768 `#send` clips.

### Stability

`settle()` waits for network idle, `document.fonts.ready`, every image switched
to eager and decoded, one scroll through the page so no view entrance is
caught at zero opacity, and two animation frames. Sequence on the final code:
`test:visual:update` (80 written), then `test:visual` twice, 80 passed and 0
diffs both times. An earlier pair of reruns on the first baselines was also
green, 0 diffs; the baselines were regenerated after that only to add the
snapshot mask and the sticky bar rule, not because of a diff.

### Threshold

`maxDiffPixelRatio: 0.002`, 0.2 percent of a capture. On the tallest baseline
(375 by 7,079 px) that is about 5,300 pixels, roughly the anti aliasing drift
of glyph edges between two machines on the same Chromium build; on a 1440 by
900 viewport it is 2,600 pixels. A moved button, a changed colour token or a
lost section changes far more than that. Reruns on this machine measured 0
differing pixels, so the threshold is headroom for other machines, not cover
for flakiness.

## Visible issues in the baselines

Reviewed: `/` and the record page at 375 and 1440 in both themes, and every
demo clip at 375, plus the 768 `#send` clips and the 1440 palette and locked
clips.

| Id | Where | What | Owner |
| --- | --- | --- | --- |
| QA-01 | `/`, 375 px, both themes, Policy section | The "Key quorum, threshold two" and "Compiled wallet policy" cards run about 10 px past the right edge of the content column (their right border sits near x 365 while the rest of the page stops at 355). Same area as A11Y-02; likely the same min-content floor from the full width lock button. | `components/console/policy-section.tsx` |
| QA-02 | `/`, 375 px, plan table | In held rows the hold pill and the reason are cut off by the pinned Row column ("KYC lapse", "Allowlist entry l"). The table scrolls sideways by design and says so, but the reason, the one sentence explaining the hold, is clipped on first view. | `components/console/plan-section.tsx` |
| QA-03 | `/record/0x…`, 375 px, both themes | The copy button for the plan hash wraps to its own line under the two line hash, away from the value it copies. | `components/record/plan-hash.tsx` |
| QA-04 | `/`, 1440 px | Large empty bands between sections (about 150 to 200 px between Plan and Policy, Send and Audit record) against the tighter record page. A rhythm question, not a defect. | `components/design/section.tsx` |

No theme defect was seen: dark and light baselines match in layout, the
contrast of held rows, pills and the DENY label reads correctly in both.

## Manual cross checks for the author

Not run by this wave. Each needs a real browser or device.

| Check | Status |
| --- | --- |
| Safari (macOS) smoke: `/`, the full demo, the palette, the record page, both themes | not run |
| Firefox smoke: same path | not run |
| Real phone (iOS Safari and Android Chrome): demo at phone width, Sheet, sticky bar, plan table sideways scroll | not run |
| VoiceOver pass on macOS: landmarks, status line announcements, refusal alert, palette and Sheet | not run |

## Updating baselines

```sh
npm run test:visual:update   # rebuilds, starts on 3125, rewrites all 80 files
npm run test:visual          # run twice; both must pass with 0 diffs
```

Set `VISUAL_PORT` to use another port. Review the changed PNGs in the diff (or
the HTML report in `playwright-report/visual`) before committing them. To
regenerate one project, add `--project=375-dark`; for one spec, add its path.
Regenerate after the a11y fix and motion merges, since both change pixels.

## Proposed CI job

Not added: `.github/**` is outside this wave. Proposed addition to
`.github/workflows/ci.yml`:

```yaml
  visual:
    name: Visual regression
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - name: Check out the repository
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm

      - name: Install from the lockfile
        run: npm ci

      - name: Install Chromium for Playwright
        run: npx playwright install --with-deps chromium

      - name: Run the visual suite
        run: npm run test:visual

      - name: Upload the visual report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: visual-report
          path: |
            playwright-report/visual/
            test-results/visual/
          retention-days: 14
```

The baselines were captured on macOS. Linux renders fonts differently, so the
first CI run will fail on every file. Either regenerate the baselines once
inside the Playwright Docker image (`mcr.microsoft.com/playwright:v1.63.0-noble`)
and commit those, or run this job in that same image so local and CI captures
come from one renderer.

## Known limits

- Baselines are macOS Chromium only; see the CI note above. No WebKit or
  Firefox capture.
- Seed mode only. Live register reads, Privy receipts and anchored records
  render states these baselines do not cover (the record masks exist for them).
- The demo is captured with the coupon action; the court ordered forced
  transfer is covered by e2e, not by a baseline.
- Reduced motion is on, so the baselines show end states, never an entrance.
  Motion regressions need the motion branch's own checks.
- Hover and focus states, the 1024 px breakpoint, the 320 px reflow case, and
  forced colors are not captured.
- The clock is pinned, so a regression that only shows with a stale snapshot
  (the stale banner) is not captured.
- Lighthouse and the a11y findings are copied from PERF.md and A11Y_AUDIT.md,
  not re-measured in this wave.
