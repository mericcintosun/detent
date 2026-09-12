# Delivery, what a human does at submission time

Submission deadline: **2026-09-16 05:00 UTC**.
The event allows **at most 3 bounties per project**. Two are claimed here and the
third slot is left empty on purpose.

This limit and the opt-in mechanics below come from the event record captured in
`HANDOFF.md`. They are **unverified against the live submission form**, so the
human checks the form itself before pressing submit. Nothing automatic reads this
file: every line under `action:` is a click a person makes.

The implementation side of both rows, with the file and the symbol that answers
each qualification clause, is the **Bounty ledger** section in `README.md`.

## 🪙 Tokenization of Anything

- `entryMode:` opt-in
- `action:` tick the prize checkbox labelled `🪙 Tokenization of Anything`
  (`$6,000, Up to 3 teams: $2,000 each`) on the ETHOnline 2026 submission form.
- `watch:` DEMO steps 1, 5 and 6. Step 1 is the register read off the ATS token,
  step 5 is the payout plus the on chain anchor, step 6 is the permanent record
  read back off `PlanAnchor` at `/record/[planHash]`.
- The Hedera row caps the video at five minutes and requires issuance,
  configuration and at least one lifecycle operation on screen. Issuance is the
  ATS equity token on testnet, configuration is the roles and the allowlist, and
  the lifecycle operation is the Q3 coupon distribution. Aim for two minutes and
  keep all three visible.

## 🏢 Best B2B financial product

- `entryMode:` opt-in
- `action:` tick the prize checkbox labelled `🏢 Best B2B financial product`
  (`$2,500`) on the ETHOnline 2026 submission form.
- `watch:` DEMO steps 3, 4 and 5. Step 3 installs the compiled policy under the
  key quorum of two, step 4 is the refusal with the failed condition and the byte
  offset, step 5 is the signature on the untouched plan and the revoke.
- The write-up must say how Privy made the product possible. The short version to
  expand: without wallet policies there is no way to narrow a general purpose
  treasury key to one corporate action, so the preview would stay a report next
  to the signature instead of becoming the signing limit.

## Neither row is a separate submission

Both bounties are opt-in on the main ETHOnline 2026 project form. Neither is
`separate-submission`, so there is **no second form URL** and **no second
deadline** to track. One submission, two checkboxes, the single deadline at the
top of this file.

## Before submitting

- [ ] Tick both opt-in boxes: `🪙 Tokenization of Anything` and
      `🏢 Best B2B financial product`.
- [ ] Paste the live URL: `https://detent-app.vercel.app`
- [ ] Paste the repo URL.
- [ ] Only if the contract is deployed before submission: put the `PlanAnchor`
      address and the two `Smoke.s.sol` transaction hashes into the deployed
      artefacts table and the "On chain proof" section of `README.md`, and the
      address into `SECURITY.md`. Both files currently state that nothing is
      deployed, which is the honest state, so this item is not a blocker: skip it
      and both documents stay correct.
- [ ] Fill `<ADD_VIDEO_URL>` at the top of `README.md`.
- [ ] Confirm the repo is public.
- [ ] Confirm the commit history is not one commit on the final day. Both prize
      pages call that out.
- [ ] Leave the third bounty slot empty unless time appears. The candidate was
      `🧬 Best Use of ENSv2`, and it was not taken: naming would be cosmetic in
      this product, which that row's own wording rejects.
