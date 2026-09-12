// HashScan URL helpers, and the one rule that governs them.
//
// An explorer link is a claim: it says the thing beside it exists on the chain
// the explorer indexes. Two values in this product cannot back that claim.
//
//   1. The cached register in lib/data.ts carries seed addresses. Hedera testnet
//      answers eth_getCode = 0x for them and HashScan renders a 404, so the
//      token address, and the call target derived from it, are fixtures until a
//      live read replaces them.
//   2. With no Privy credentials the send path returns a receipt derived from
//      the first 32 bytes of the calldata rather than from a broadcast. That
//      hash is synthetic; no transaction carrying it was ever mined.
//
// So the builders below do not take an address, they take an address and where
// it came from, and they return null whenever the provenance cannot back the
// link. A call site that forgets to ask the question cannot get a URL by
// accident, which is the whole point: an empty explorer page is worse than no
// link at all.
//
// These functions read one client safe constant. Keeping them out of
// lib/hedera.ts keeps the client graph free of viem, the adapter and any secret.

import { HASHSCAN_BASE } from "@/lib/public-config";

/** Where a value on screen came from. Only `on-chain` earns an explorer link. */
export type ValueProvenance = "on-chain" | "fixture" | "synthetic";

/** 20 bytes of hex. HashScan indexes nothing else under /contract or /account. */
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

/** 32 bytes of hex. */
const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export function isExplorerAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && ADDRESS_PATTERN.test(value);
}

export function isExplorerTransactionHash(
  value: unknown
): value is `0x${string}` {
  return typeof value === "string" && TX_HASH_PATTERN.test(value);
}

/**
 * Raw URL builders.
 *
 * @internal Do not render these directly. They answer "what would the URL be",
 * not "may this be a link", and lib/hedera.ts re-exports both by name. Every
 * rendered link goes through tokenExplorerHref or transactionExplorerHref.
 */
export function hashscanToken(address: string): string {
  return `${HASHSCAN_BASE}/contract/${address}`;
}

/** @internal See hashscanToken. */
export function hashscanTransaction(hash: string): string {
  return `${HASHSCAN_BASE}/transaction/${hash}`;
}

/**
 * The explorer URL for a contract address, or null when there must not be a
 * link: a seed fixture, a synthetic value, or anything that is not 20 bytes of
 * hex. The caller prints the address as plain text in the null case.
 */
export function tokenExplorerHref(
  address: string | undefined | null,
  provenance: ValueProvenance
): string | null {
  if (provenance !== "on-chain") return null;
  if (!isExplorerAddress(address)) return null;
  return hashscanToken(address);
}

/** The same rule for a transaction hash. */
export function transactionExplorerHref(
  hash: string | undefined | null,
  provenance: ValueProvenance
): string | null {
  if (provenance !== "on-chain") return null;
  if (!isExplorerTransactionHash(hash)) return null;
  return hashscanTransaction(hash);
}

/**
 * The register's own answer to the question. `hedera-testnet` is the only source
 * in RegisterSnapshot that was actually read off chain; `seed` is
 * fixtures/register.seed.json, and so is anything a future source adds until it
 * says otherwise here.
 */
export function registerProvenance(source: string): ValueProvenance {
  return source === "hedera-testnet" ? "on-chain" : "fixture";
}

/**
 * The provenance of the call target the send card prints.
 *
 * lib/plan.ts builds `target` from the seed constant rather than from the
 * snapshot, so a live register does not by itself make the target real: the two
 * addresses have to agree before the target can be said to have been read off
 * chain. When they disagree the target is still a fixture and gets no link.
 */
export function callTargetProvenance(
  target: string,
  registerTokenAddress: string,
  source: string
): ValueProvenance {
  if (registerProvenance(source) !== "on-chain") return "fixture";
  return target.toLowerCase() === registerTokenAddress.toLowerCase()
    ? "on-chain"
    : "fixture";
}

/* --- Receipts ------------------------------------------------------------- */

/**
 * What a send came back with: a hash a block explorer can resolve, a hash this
 * build derived from the calldata, or no hash at all.
 */
export type ReceiptKind = "on-chain" | "synthetic" | "none";

export interface ReceiptView {
  kind: ReceiptKind;
  /** The hash to print, synthetic or not, or null when there is none. */
  transactionHash: string | null;
  /** The explorer URL, non-null only for an on-chain receipt. */
  href: string | null;
}

const SYNTHETIC_WORDS = new Set([
  "synthetic",
  "stub",
  "stubbed",
  "simulated",
  "local",
  "derived",
  "fake",
]);

const ON_CHAIN_WORDS = new Set([
  "on-chain",
  "onchain",
  "on_chain",
  "chain",
  "broadcast",
  "broadcasted",
  "live",
  "mined",
]);

/** The keys a typed receipt may use to name itself, in the order they are read. */
const KIND_KEYS = [
  "kind",
  "receiptKind",
  "type",
  "receiptType",
  "source",
  "receiptSource",
  "hashSource",
  "transactionHashKind",
  "transactionSource",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function kindFromWord(value: unknown): "on-chain" | "synthetic" | null {
  if (typeof value !== "string") return null;
  const word = value.trim().toLowerCase();
  if (SYNTHETIC_WORDS.has(word)) return "synthetic";
  if (ON_CHAIN_WORDS.has(word)) return "on-chain";
  return null;
}

function kindFromRecord(
  record: Record<string, unknown>
): "on-chain" | "synthetic" | null {
  for (const key of KIND_KEYS) {
    const named = kindFromWord(record[key]);
    if (named !== null) return named;
  }
  if (record.synthetic === true || record.stub === true) return "synthetic";
  if (record.synthetic === false || record.onChain === true) return "on-chain";
  return null;
}

function hashFromRecord(record: Record<string, unknown>): string | null {
  for (const candidate of [record.transactionHash, record.hash, record.txHash]) {
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
  }
  return null;
}

/**
 * Read a send result without trusting its shape, and decide whether its hash may
 * be linked.
 *
 * The API is moving from an untyped `{ transactionHash, live }` to a receipt
 * that names itself, so this reads both and is deliberately unopinionated about
 * which one arrives:
 *
 *   1. a nested `receipt` object, whose `kind` (or `type`, `source`, or a
 *      boolean `synthetic`) decides it, and whose own hash wins;
 *   2. the same discriminators at the top level;
 *   3. failing both, the old shape's `live` boolean.
 *
 * Anything that names neither is treated as synthetic. That is the safe default
 * for this product: a link that should not exist is a false claim on screen,
 * while a missing link on a real hash is only a missing convenience.
 */
export function readReceipt(value: unknown): ReceiptView {
  const none: ReceiptView = { kind: "none", transactionHash: null, href: null };
  if (!isRecord(value)) return none;

  const nested = isRecord(value.receipt) ? value.receipt : null;

  const transactionHash =
    (nested ? hashFromRecord(nested) : null) ?? hashFromRecord(value);
  if (transactionHash === null) return none;

  // Narrower than ReceiptKind on purpose: "none" is already returned above, so
  // everything from here has a hash and only has to be told apart.
  let kind: "on-chain" | "synthetic" | null = nested
    ? kindFromRecord(nested)
    : null;
  if (kind === null) kind = kindFromRecord(value);
  if (kind === null) kind = value.live === true ? "on-chain" : "synthetic";

  return {
    kind,
    transactionHash,
    href: transactionExplorerHref(transactionHash, kind),
  };
}

/**
 * The anchor's receipt. lib/anchor.ts only fills `transactionHash` after a real
 * writeContract, so `anchored` alone does not earn a link: an already anchored
 * hash from an earlier run reports `anchored: true` with no hash of its own.
 */
export function anchorExplorerHref(
  anchor: { anchored: boolean; transactionHash?: string } | null | undefined
): string | null {
  if (!anchor || !anchor.anchored) return null;
  return transactionExplorerHref(anchor.transactionHash, "on-chain");
}
