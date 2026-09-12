// Client safe configuration.
//
// Every value here comes from a NEXT_PUBLIC_ variable, so this module is safe to
// pull into a browser bundle: nothing it reads is a secret. The server only half
// (Privy credentials, wallet ids, timeouts) lives in lib/config.ts, which
// re-exports everything below so server code has a single import.
//
// Next inlines NEXT_PUBLIC_ variables at build time only when they are written
// out in full, so each read below spells the whole name.

export type AdapterMode = "fake" | "real";

/** fake serves the cached register, real reads the ATS token over Hashio. */
export const ADAPTER_MODE: AdapterMode =
  process.env.NEXT_PUBLIC_ADAPTER_MODE === "real" ? "real" : "fake";

/** Hedera testnet. */
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 296);

/** JSON-RPC relay used for both the register read and the raw broadcast. */
export const HEDERA_RPC_URL =
  process.env.NEXT_PUBLIC_HEDERA_RPC_URL ?? "https://testnet.hashio.io/api";

/** The ATS equity token. Empty means the cached register. */
export const ATS_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_ATS_TOKEN_ADDRESS as
  | `0x${string}`
  | undefined;

/**
 * The testnet settlement token whose balanceOf funds the coupon draw. Empty
 * means the treasury cover stays on the seed figure in lib/data.ts and the
 * register note says so.
 */
export const SETTLEMENT_TOKEN_ADDRESS = process.env
  .NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS as `0x${string}` | undefined;

/**
 * PlanAnchor. The contract deploy step writes NEXT_PUBLIC_CONTRACT_ADDRESS, the
 * handoff calls it NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS, so read both and never a
 * literal address.
 */
export const PLAN_ANCHOR_ADDRESS = (process.env
  .NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS ??
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS) as `0x${string}` | undefined;

/** Explorer root for chain 296. Constant on purpose: it is not configuration. */
export const HASHSCAN_BASE = "https://hashscan.io/testnet";
