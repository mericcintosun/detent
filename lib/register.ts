// The register entry point.
//
// One name for "give me the holder set", so the page never reaches into the
// Hedera integration directly. lib/hedera.ts stays the implementation (the live
// adapter, the cached fallback, the memo); this file is the door, which keeps
// the page's import graph one module wide and gives a later phase somewhere to
// put a second source without editing the page.
//
// Server side only, like lib/hedera.ts itself.

import { REGISTER_CACHE_MS } from "@/lib/config";
import type { RegisterSnapshot } from "@/lib/types";

export { getRegisterSnapshot } from "@/lib/hedera";
export type { RegisterSnapshot } from "@/lib/types";

// The second thing the page has to state above the fold, beside where the
// register came from: whether the key that signs is a real Privy server wallet
// or the local evaluator. It travels through this door for the same reason the
// snapshot does, so app/page.tsx never imports lib/privy.ts by name and the
// console keeps receiving a boolean rather than a module.
export { isPrivyLive } from "@/lib/privy";

// The snapshot's read time, and how old it may get before the console says so.
// fetchedAt is stamped by the adapter at the moment of the read, and a reused
// snapshot keeps the stamp of the read it came from, so the page can hand the
// console one honest time. Past twice the reuse window the page has missed at
// least one refresh and the console shows a stale banner.
export { REGISTER_CACHE_MS };

/** How old a snapshot may be before it is called stale, in milliseconds. */
export const REGISTER_STALE_AFTER_MS = 2 * REGISTER_CACHE_MS;

/** When this snapshot was read off its source, as ISO 8601. */
export function snapshotReadAt(snapshot: RegisterSnapshot): string {
  return snapshot.fetchedAt;
}
