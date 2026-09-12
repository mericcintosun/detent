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
