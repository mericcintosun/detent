// The register entry point.
//
// One name for "give me the holder set", so the page never reaches into the
// Hedera integration directly. lib/hedera.ts stays the implementation (the live
// adapter, the cached fallback, the memo); this file is the door, which keeps
// the page's import graph one module wide and gives a later phase somewhere to
// put a second source without editing the page.
//
// Server side only, like lib/hedera.ts itself.

export { getRegisterSnapshot } from "@/lib/hedera";
export type { RegisterSnapshot } from "@/lib/types";

// The second thing the page has to state above the fold, beside where the
// register came from: whether the key that signs is a real Privy server wallet
// or the local evaluator. It travels through this door for the same reason the
// snapshot does, so app/page.tsx never imports lib/privy.ts by name and the
// console keeps receiving a boolean rather than a module.
export { isPrivyLive } from "@/lib/privy";
