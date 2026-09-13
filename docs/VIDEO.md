# The demo video, shot by shot

Derived from `DEMO.md` steps 1 to 6. The current take was recorded on
13 September 2026 from a production build of the redesigned console (the same
commit the live URL deploys), at 1920x1080, with `PlanAnchor` deployed and
`NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS` set, so the record page reads the plan back off
Hedera testnet. The narration is a synthetic macOS voice rendered by the same
Playwright and ffmpeg pipeline the author uses for demo videos.

**Length.** The take that ships, `public/demo-video.mp4`, runs **2:48**, which
is the number `README.md` quotes. It follows nine scenes rather than the shot
plan below, and it misses one of the two marks: the problem is stated by 0:14,
but the refusal lands at about 1:20, not 0:45. Both lengths sit well inside the
cap. The hard cap is **5:00**, set by the
`🪙 Tokenization of Anything` row, which also requires issuance, configuration
and at least one lifecycle operation to be visible. Issuance and configuration
are the ATS equity token and its allowlist, both named in shot 2; the lifecycle
operation is the Q3 coupon distribution, which is shots 3 to 9.

**Two hard marks.** The problem is stated by **0:20**. The refusal is on screen by
**0:45**. Everything else can breathe; those two cannot slip, because a judge who
has not understood the problem by twenty seconds stops watching, and the refusal
is the reason this project exists.

**Audio.** One voice, no music, no captions burned in. Speak the lines below or a
close paraphrase; do not read the screen aloud word for word.

## The shot table

| # | Shot | DEMO step | On-screen action | Spoken line | Start | Seconds |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Cold open on the fold | 1 | `/#register` at the top. Nothing clicked. The masthead wipes in: the window, the security name, the holder line, the badges. | "This is a tokenized equity. The key that pays its coupon can sign anything the contract exposes." | 0:00 | 8 |
| 2 | The register, close | 1 | Cursor over the register note and the two badges. The token address links to HashScan. | "Twelve holders on one partition, three of them held by the compliance module. Today the step before signing is reading an explorer or trusting a script." | 0:08 | 12 |
| 3 | The plan fills | 2 | Press **Distribute quarterly coupon**. Scroll `#plan` so the three oxide red rows and the totals are in frame. | "The coupon run, line by line. Nine of twelve rows draw thirty five thousand four hundred and eight USDC, and the three red rows carry the contract's own reason codes." | 0:20 | 11 |
| 4 | Quorum and lock | 3 | Press **Approve** on both officers, then **Lock this plan to the treasury key**. The compiled policy card fills. | "Two officers, one key quorum. That plan's calldata is now the wallet policy." | 0:31 | 9 |
| 5 | The pinned conditions | 3 | Hover, then tab to, the `data eq` condition in the policy card. The matching part of the call lights up above it. | "Chain, contract, selector, and the whole payload. Everything else stays on default deny." | 0:40 | 3 |
| 6 | One digit | 4 | In `#send`, change the last digit of the amount for the first row. Press **Send edited plan**. | "One digit." | 0:43 | 2 |
| 7 | The refusal | 4 | The oxide banner lands. Hold still on the reason. Do not scroll. | "Refused. It names the condition that failed and the byte where the payload diverged from the plan they approved." | 0:45 | 13 |
| 8 | The untouched plan signs | 5 | Press **Execute the approved plan**. The signed badge and the revoked badge appear. | "Same wallet. Same policy. The plan nobody touched signs, and the policy is revoked on the way out." | 0:58 | 17 |
| 9 | The audit record | 5 | Scroll `#ledger`. Show the plan hash, the payout link and the anchor link. Press **Download the record**. | "Every hash, refusal and receipt from the session, with the payout and the plan anchor on HashScan." | 1:15 | 15 |
| 10 | The permanent record | 6 | Press **Open the permanent record**. `/record/<planHash>` loads. Reload it once. | "This is read straight off the anchor contract with no operator key. Reload it, and the chain still says settled. The record outlives the session." | 1:30 | 20 |
| 11 | Close on the fold | closing | Back to `/#register`. Still frame. | "The preview is not a report sitting next to the signature. The preview is the signing limit, and it exists for exactly one corporate action." | 1:50 | 15 |

**Planned total: 2:05.** Five seconds of tail on shot 11 brings it to 2:10
without touching either hard mark. The recorded take runs 3:01, the extra
fifty-odd seconds spread across the narration rather than landing in one shot, so
both hard marks above still hold and the five minute cap is not close.

## Before the take

- [ ] `npm run demo:reset`, then reload `/` once so the register is warm.
- [ ] Cold private window, 1440px, browser zoom at 100 percent, no extensions
      visible in the chrome.
- [ ] Devtools closed. No localhost in the address bar at any point.
- [ ] `NEXT_PUBLIC_ADAPTER_MODE`, the ATS token address and the Privy keys set if
      the live paths are wired; if they are not, the console says "Cached
      register" and "Treasury key, compiled locally" on screen, and the spoken
      lines above are still true because the same evaluator produces the refusal.
- [ ] The amount to edit picked in advance: the first row of the plan, last digit.

## One dry run, then the take

1. **Dry run.** Walk all eleven shots with the recorder running but the
   microphone off, watching the clock. The two marks to check are the problem at
   0:20 and the refusal at 0:45. If the refusal lands after 0:50, cut shot 2 to
   eight seconds and shot 3 to nine; do not cut shot 7.
2. **Take one.** Full audio, no stopping. A fumbled word is cheaper than a lost
   take.
3. **Re-record slot.** Book time for a second full take immediately after the
   first. Hashio answers BUSY under load and the transaction path is not cached
   the way the register is, so one take in three hits a slow relay through no
   fault of the build. Do not try to patch a slow take by editing; re-record it.

## Fallback if the relay answers BUSY mid-take

The register is cached and will keep rendering. What can stall is anything that
touches the relay: the anchor writes in shots 4 and 8, the HashScan links in shot
9, and the `planOf` read in shot 10. If one of them hangs, finish the take
speaking over a still rather than waiting on the spinner, and cut the still in
during the edit. The stills are the five marked **video fallback** in
`docs/SCREENSHOTS.md`, and none of them has been taken yet: until someone takes
them, the fallback is to hold on the last good frame of the live page.

| Shot | What can stall | Still that covers it | What the voice says over it |
| --- | --- | --- | --- |
| 4 | The anchor write on lock | `policy-installed` | "The plan hash is anchored before the policy opens." |
| 7 | Nothing. The refusal is produced locally before the provider is asked, so it cannot stall. | none needed | as scripted |
| 8 | The broadcast, or the settle write | `signed-receipt` | "Signed under the same policy, then revoked." |
| 9 | The HashScan links resolving | `audit-record` | "The payout and the anchor both land in the record." |
| 10 | The `planOf` read on `/record/<planHash>` | `record-settled` | "Read back off the anchor contract, with no operator key." |

If the relay is down for the whole session, record the take anyway on the cached
path. Every claim in the spoken lines holds: the plan, the refusal, the byte
offset and the audit record are all produced without the relay, and the console
states the degraded source on screen, which is more honest than a recording that
implies a live read it did not make.
