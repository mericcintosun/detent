// Server only configuration. Never import this from a "use client" file.
//
// This is the single config home for the product: it re-exports the client safe
// values from lib/public-config.ts and adds the block that reads secrets. Every
// process.env read in the repo lives either here or in lib/public-config.ts, and
// every name read here has a matching line in .env.example.

export type { AdapterMode } from "@/lib/public-config";
export {
  ADAPTER_MODE,
  ATS_TOKEN_ADDRESS,
  CHAIN_ID,
  HASHSCAN_BASE,
  HEDERA_RPC_URL,
  PLAN_ANCHOR_ADDRESS,
} from "@/lib/public-config";

/* --- Privy, server side only ---------------------------------------------- */

export const PRIVY_API_URL = process.env.PRIVY_API_URL ?? "https://api.privy.io";
export const PRIVY_APP_ID = process.env.PRIVY_APP_ID;
export const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
export const PRIVY_TREASURY_WALLET_ID = process.env.PRIVY_TREASURY_WALLET_ID;
export const PRIVY_TREASURY_WALLET_ADDRESS = process.env
  .PRIVY_TREASURY_WALLET_ADDRESS as `0x${string}` | undefined;
export const PRIVY_KEY_QUORUM_ID = process.env.PRIVY_KEY_QUORUM_ID;

export type BroadcastMode = "auto" | "rpc" | "signature";

/**
 * auto asks Privy to broadcast and falls back to signing plus a relay broadcast
 * when Privy refuses chain 296. rpc and signature pin one path for a rehearsal.
 */
export const PRIVY_BROADCAST_MODE: BroadcastMode =
  process.env.PRIVY_BROADCAST_MODE === "rpc"
    ? "rpc"
    : process.env.PRIVY_BROADCAST_MODE === "signature"
      ? "signature"
      : "auto";

/* --- Named constants ------------------------------------------------------ */

/** Two distinct key quorum signers open a policy. */
export const QUORUM_THRESHOLD = 2;

/** Budget for one Privy REST call. */
export const PRIVY_TIMEOUT_MS = 12_000;

/** Budget for one Hashio JSON-RPC call. Hashio answers BUSY under load. */
export const RPC_TIMEOUT_MS = 9_000;

/** Exactly one re-attempt on a timeout or a 5xx. Never a loop. */
export const RETRY_COUNT = 1;

/** Gas ceiling for the raw transaction Detent broadcasts through the relay. */
export const SIGNED_TX_GAS_LIMIT = 1_500_000n;

/** Prefix on every core path log line, so the demo run is greppable. */
export const LOG_PREFIX = "[core]";
