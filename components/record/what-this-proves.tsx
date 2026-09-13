// What the contract can and cannot back up, from contracts/src/PlanAnchor.sol
// and README.md only. No claim here about a live deployment: the record
// above already says whether this hash was ever anchored.

export function WhatThisProves() {
  return (
    <p className="max-w-measure-lg text-body-sm leading-relaxed text-muted-foreground">
      PlanAnchor holds one fact about a plan hash: whether an operator anchored
      it, against which token and function selector, and when it closed as
      settled or abandoned. Reading it back needs no key, so this page can be
      checked against Hedera testnet at any time. It does not hold the
      plan&apos;s rows, amounts or recipients, and it cannot confirm that a
      later payout actually matches the hash it anchored: that check happens in
      the console, before the treasury key signs.
    </p>
  );
}
