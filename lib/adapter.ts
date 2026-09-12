// The adapter seam.
//
// Every register read in the product goes through a RegisterAdapter, so the
// phase that brings the live Asset Tokenization Studio token online swaps the
// implementation behind this interface and touches nothing else. The mode is
// read once in lib/public-config.ts from NEXT_PUBLIC_ADAPTER_MODE and defaults
// to "fake", which serves the cached register and evaluates the compiled policy
// locally.
//
// This module reads no secret: the Privy side of the seam is isPrivyLive() in
// lib/privy.ts, which reads lib/config.ts. That split is what keeps the client
// bundle free of PRIVY_APP_SECRET, because the console imports this graph.
//
// This module must not import lib/hedera.ts or lib/privy.ts: both of them import
// this file, so the reverse direction would cycle.

import { holders as seedHolders, security, treasury } from "@/lib/data";
import { ADAPTER_MODE, ATS_TOKEN_ADDRESS } from "@/lib/public-config";
import type { RegisterSnapshot } from "@/lib/types";

export type { AdapterMode } from "@/lib/public-config";
export { ADAPTER_MODE };

export interface RegisterAdapter {
  mode: "fake" | "real";
  load(): Promise<RegisterSnapshot>;
}

/** The cached register. Deterministic apart from the snapshot timestamp. */
export const fakeRegisterAdapter: RegisterAdapter = {
  mode: "fake",
  async load(): Promise<RegisterSnapshot> {
    return {
      source: "seed",
      token: security,
      treasury,
      holders: seedHolders,
      fetchedAt: new Date().toISOString(),
      note: "Cached register from fixtures/register.seed.json. Set NEXT_PUBLIC_ADAPTER_MODE=real with a token address to read the live ATS token.",
    };
  },
};

/** True only when the real mode is on and a token address is configured. */
export function useLiveRegister(): boolean {
  return ADAPTER_MODE === "real" && Boolean(ATS_TOKEN_ADDRESS);
}
