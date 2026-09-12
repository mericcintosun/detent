# Screenshots, the wish list

**None of the ten shots below has been taken. `docs/screenshots/` does not exist
in this repository, and no page in the repository links to one.** This file is a
list of what to capture, not a manifest of what is here, and it stays that way
until a human takes the shots and commits them.

Plain text on purpose. `README.md` must not reference an image file that is not
in the repo, so nothing here is linked from anywhere until a human has actually
taken the shot and committed it.

Take them in one sitting, in a cold private window against
**https://detent-app.vercel.app**, at 1440px wide with the browser at 100 percent
zoom and devtools closed. The five marked **video fallback** are the ones
`docs/VIDEO.md` cuts in if the Hashio relay stalls mid-take, so those five are
the ones that actually matter. Put them in `docs/screenshots/` with exactly the
names in the first column.

| Name | Route and state | What must be in frame | Why |
| --- | --- | --- | --- |
| `fold` | `/` at the top, nothing clicked | The masthead: the window eyebrow, the security name, the holder line, both badges, the register note | The first thing a judge sees. Also the submission form's cover image if one is asked for. |
| `plan-filled` | `/#plan` after picking the coupon run | The plan header, at least the three oxide red held rows with their reason text, and the totals band with the headroom | DEMO step 2, and the compliance reason codes that answer the Hedera row |
| `policy-installed` | `/#policy` after locking | The policy card with the call strip and the four conditions over `default_action DENY` | DEMO step 3. **Video fallback for shot 4.** |
| `policy-explored` | `/#policy`, pointer resting on the `data eq` condition | The lit fragment in the call strip above and the gloss under the condition | The one frame that shows the pin rather than asserting it |
| `refusal` | `/#send` right after **Send edited plan** | The oxide banner with the failed condition and the byte offset, with the edited amount still visible in the field above | DEMO step 4. The single most important still in the set. |
| `signed-receipt` | `/#send` after **Execute the approved plan** | The signed badge, the policy revoked badge and the HashScan link | DEMO step 5. **Video fallback for shot 8.** |
| `audit-record` | `/#ledger` with a full session behind it | At least three entries, with the payout link and the plan anchor link both present | DEMO step 5. **Video fallback for shot 9.** |
| `record-settled` | `/record/<planHash>` after a full walk | State reads settled, the token and selector matching the plan, both timestamps in UTC | DEMO step 6. **Video fallback for shot 10.** Needs the anchor deployed and `NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS` set; until then this route renders its documented unwired state, which is not the shot. |
| `mobile-fold` | `/` at 390px | The rail bar with the section links and the masthead directly under it | Proof the console leads on a phone |
| `mobile-refusal` | `/#send` at 390px after the refusal | The oxide banner and the tamper field in one frame | The wow moment at phone width |

## Notes

- Do not annotate, crop to a device frame, or add a drop shadow. A flat capture
  of the real page is the point.
- PNG, not JPEG. The palette is flat colour on bone and JPEG will ring the
  hairlines.
- Nothing in this list is referenced from `README.md`. If a shot is later added
  to the README, commit the file first and check the link resolves on GitHub.
- `public/brand/og.png` and `app/opengraph-image.png` already exist and are the
  link preview image. Neither is in this list and neither needs retaking.
