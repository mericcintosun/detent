// Server only configuration. Never import this from a "use client" file.
//
// This is the single config home for the product: it re-exports the client safe
// values from lib/public-config.ts and adds the block that reads secrets. Every
// process.env read in the repo lives either here or in lib/public-config.ts, and
// every name read here has a matching line in .env.example.
//
// One exception, added in Phase 4: app/layout.tsx reads NEXT_PUBLIC_SITE_URL
// inline for metadataBase, because Next evaluates that at module scope in the
// root layout. It has its own line in .env.example. Move it here if a second
// reader ever appears.

export type { AdapterMode } from "@/lib/public-config";
export {
  ADAPTER_MODE,
  ATS_TOKEN_ADDRESS,
  CHAIN_ID,
  HASHSCAN_BASE,
  HEDERA_RPC_URL,
  PLAN_ANCHOR_ADDRESS,
  SETTLEMENT_TOKEN_ADDRESS,
} from "@/lib/public-config";

/* --- Privy, server side only ---------------------------------------------- */

export const PRIVY_API_URL =
  process.env.PRIVY_API_URL ?? "https://api.privy.io";
export const PRIVY_APP_ID = process.env.PRIVY_APP_ID;
export const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
export const PRIVY_TREASURY_WALLET_ID = process.env.PRIVY_TREASURY_WALLET_ID;
export const PRIVY_TREASURY_WALLET_ADDRESS = process.env
  .PRIVY_TREASURY_WALLET_ADDRESS as `0x${string}` | undefined;
export const PRIVY_KEY_QUORUM_ID = process.env.PRIVY_KEY_QUORUM_ID;

/**
 * Authorization private keys, `wallet-auth:` prefix included, comma separated.
 * Each one signs the wallet update, the wallet rpc and the policy delete, and the
 * signatures travel comma separated in privy-authorization-signature, which is
 * how a wallet or policy owned by a key quorum is satisfied. Empty means no
 * request is signed, which only works for resources without an owner. No
 * NEXT_PUBLIC_ prefix: these are keys and never reach a browser bundle.
 */
export const PRIVY_AUTHORIZATION_KEYS: readonly string[] = (
  process.env.PRIVY_AUTHORIZATION_KEYS ?? ""
)
  .split(",")
  .map((entry) => entry.trim())
  .filter((entry) => entry.length > 0);

/* --- The lock gate, server side only -------------------------------------- */

/**
 * When set, the lock intent requires this token in the `x-detent-operator`
 * header. The lock writes an anchor transaction with the operator key, so on any
 * deployment that has an operator key this value should be set as well. Unset
 * leaves the lock open, which is the keyless demo posture: then the only things
 * standing between a visitor and the operator account are the rate limiter and
 * the anchor write budget below, and both are per instance.
 */
export const OPERATOR_API_TOKEN = process.env.OPERATOR_API_TOKEN;

/* --- PlanAnchor, server side only ----------------------------------------- */

/**
 * The ECDSA key that deployed PlanAnchor. The contract's onlyOperator modifier
 * pins the operator to the deployer, so anchoring from the app needs that same
 * key. No NEXT_PUBLIC_ prefix on purpose: it never reaches a browser bundle, and
 * lib/anchor.ts is the only module that uses it.
 */
export const OPERATOR_PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY as
  `0x${string}` | undefined;

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

/**
 * How long one register snapshot is reused. Twelve holders times three reads
 * over Hashio is not a cost to pay on every navigation, and the demo walks the
 * page more than once. Paired with `export const revalidate = 30` in
 * app/page.tsx, so the page cache and the module memo expire together.
 */
export const REGISTER_CACHE_MS = 30_000;

/** Gas ceiling for the raw transaction Detent broadcasts through the relay. */
export const SIGNED_TX_GAS_LIMIT = 1_500_000n;

/**
 * How long a lock stays usable. A lock holds the compiled policy and the
 * approved calldata, so this is also how long a policy can sit attached to the
 * treasury wallet before the operator has to approve the plan again.
 */
export const LOCK_TTL_MS: number = (() => {
  const ceiling = 15 * 60_000;
  const configured = Number(process.env.DETENT_LOCK_TTL_MS);
  // Only ever shorter than the default, never below five seconds: a rehearsal of
  // the expiry cleanup should not need a fifteen minute wait.
  return Number.isFinite(configured) && configured >= 5_000
    ? Math.min(configured, ceiling)
    : ceiling;
})();

/**
 * How often expired locks are swept, so an abandoned lock's policy is detached
 * and revoked on time rather than on the next request that touches the vault.
 */
export const LOCK_SWEEP_INTERVAL_MS = Math.min(60_000, LOCK_TTL_MS);

/** Hard ceiling on held locks. The oldest entry is evicted past this. */
export const LOCK_VAULT_MAX_ENTRIES = 200;

/** How long a completed send is answered from the ledger instead of re-sent. */
export const SUBMISSION_TTL_MS = 30 * 60_000;

/** Hard ceiling on remembered submissions. */
export const SUBMISSION_LEDGER_MAX_ENTRIES = 500;

/** Rate limit window and budget per client address, for the whole route. */
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 30;

/** The tighter budget for the lock intent, which is the intent that can write. */
export const LOCK_RATE_LIMIT_MAX_REQUESTS = 6;

/**
 * The coarse budget counted before the body is parsed, so a malformed or invalid
 * request spends budget too instead of slipping past the per intent limiter.
 */
export const EDGE_RATE_LIMIT_MAX_REQUESTS = 60;

/** How many distinct client addresses the limiter tracks before it evicts. */
export const RATE_LIMIT_MAX_CLIENTS = 2_000;

/**
 * Anchor writes this process will pay for inside one budget window. The lock is
 * idempotent per server derived plan hash, so a normal demo spends one write per
 * distinct plan; this is the backstop for everything that is not normal.
 */
export const ANCHOR_WRITE_BUDGET = 25;
export const ANCHOR_BUDGET_WINDOW_MS = 60 * 60_000;

/** How long one anchor receipt is reused for the same plan hash. */
export const ANCHOR_MEMO_MS = 10 * 60_000;

/** How long one PlanAnchor read is reused, and how many hashes are memoised. */
export const PLAN_RECORD_MEMO_MS = 15_000;
export const PLAN_RECORD_MEMO_MAX_ENTRIES = 200;

/** Prefix on every core path log line, so the demo run is greppable. */
export const LOG_PREFIX = "[core]";
