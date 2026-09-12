// PlanAnchor, the on chain half of the audit record.
//
// Three calls, one per moment in the demo: anchor the approved plan hash before
// the wallet policy opens, settle it when the treasury key signs, abandon it
// when the policy refuses the payload. HashScan then carries the same sequence
// the console shows.
//
// Read before write, everywhere. A plan hash is deterministic, so the second
// run of the same demo would hit AlreadyAnchored and revert. Each function reads
// planOf first and returns the existing record instead of sending anything,
// which is what makes the walk repeatable in front of an audience.
//
// Nothing here throws. A missing OPERATOR_PRIVATE_KEY, a missing
// PLAN_ANCHOR_ADDRESS or a relay that will not answer comes back as a receipt
// with anchored false and a note, because the anchor must never be the reason a
// send fails.
//
// Server side only: it reads OPERATOR_PRIVATE_KEY through lib/config.ts. Never
// import this from a client component.

import { createWalletClient, http, parseAbi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  HEDERA_RPC_URL,
  LOG_PREFIX,
  OPERATOR_PRIVATE_KEY,
  PLAN_ANCHOR_ADDRESS,
  RETRY_COUNT,
  RPC_TIMEOUT_MS,
  SIGNED_TX_GAS_LIMIT,
} from "@/lib/config";
import { hederaPublicClient, hederaTestnet } from "@/lib/hedera";
import { anchorGuard, planRecordMemo } from "@/lib/store";
import type { AnchorReceipt, PlanRecord, PlanRecordState } from "@/lib/types";

const ANCHOR_ABI = parseAbi([
  "struct Plan { address token; bytes4 selector; uint64 anchoredAt; address anchoredBy; uint64 closedAt; uint8 status; }",
  "function anchor(bytes32 planHash, address token, bytes4 selector)",
  "function settle(bytes32 planHash, bytes32 txReference)",
  "function abandon(bytes32 planHash, string reason)",
  "function planOf(bytes32 planHash) view returns (Plan)",
]);

/** Mirrors PlanAnchor.Status, which the ABI carries as a uint8. */
const STATUS_UNKNOWN = 0;
const STATUS_ANCHORED = 1;
const STATUS_SETTLED = 2;
const STATUS_ABANDONED = 3;

type Configured = {
  address: `0x${string}`;
  account: ReturnType<typeof privateKeyToAccount>;
};

/**
 * The two values the anchor cannot run without. Returning a note rather than
 * throwing is the whole degradation contract of this module.
 */
function configured(): Configured | { missing: string } {
  if (!PLAN_ANCHOR_ADDRESS) {
    return {
      missing:
        "PlanAnchor is not wired: set NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS to the deployed contract.",
    };
  }
  if (!OPERATOR_PRIVATE_KEY) {
    return {
      missing:
        "PlanAnchor is not wired: set OPERATOR_PRIVATE_KEY to the key that deployed the contract.",
    };
  }
  try {
    return {
      address: PLAN_ANCHOR_ADDRESS,
      account: privateKeyToAccount(OPERATOR_PRIVATE_KEY),
    };
  } catch {
    return {
      missing:
        "OPERATOR_PRIVATE_KEY is not a usable ECDSA key, so nothing was anchored.",
    };
  }
}

function isMissing(
  value: Configured | { missing: string }
): value is { missing: string } {
  return "missing" in value;
}

/** Legacy transactions on purpose: the Hedera relay rejects the typed ones. */
function walletFor(setup: Configured) {
  return createWalletClient({
    account: setup.account,
    chain: hederaTestnet,
    transport: http(HEDERA_RPC_URL, {
      timeout: RPC_TIMEOUT_MS,
      retryCount: RETRY_COUNT,
    }),
  });
}

async function statusOf(
  setup: Configured,
  planHash: Hex
): Promise<number> {
  const record = await hederaPublicClient().readContract({
    address: setup.address,
    abi: ANCHOR_ABI,
    functionName: "planOf",
    args: [planHash],
  });
  // The struct comes back as an object; only the status field is load bearing
  // here, and it is a uint8 whether viem widens it to a bigint or not.
  const { status } = record as unknown as { status: number | bigint };
  return Number(status);
}

/* --- The read path -------------------------------------------------------- */

/** The struct planOf returns, as the ABI declares it. */
interface OnChainPlan {
  token: `0x${string}`;
  selector: Hex;
  anchoredAt: bigint | number;
  anchoredBy: `0x${string}`;
  /**
   * The moment the plan reached a terminal state, settled or abandoned. Zero
   * while the plan is still open. The field is `closedAt` rather than
   * `settledAt` because an abandoned plan is closed too, and the struct is
   * ordered the way PlanAnchor packs it.
   */
  closedAt: bigint | number;
  status: number | bigint;
}

/** A uint64 second count, or nothing when the contract holds a zero. */
function isoFromSeconds(value: bigint | number): string | undefined {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  return new Date(seconds * 1000).toISOString();
}

function stateFromStatus(status: number): PlanRecordState {
  switch (status) {
    case STATUS_ANCHORED:
      return "anchored";
    case STATUS_SETTLED:
      return "settled";
    case STATUS_ABANDONED:
      return "abandoned";
    default:
      return "unknown";
  }
}

/**
 * Read one plan hash back off the chain. `planOf` is a view call, so this needs
 * no operator key and no wallet client: only the contract address. That is what
 * lets /record/[planHash] render on a deployment that can read but not write.
 *
 * Like everything else here it never throws. A missing address is `unwired`, a
 * relay that will not answer is `unreadable`, and a hash the contract has never
 * seen is `unknown`.
 */
export async function readPlanRecord(planHash: Hex): Promise<PlanRecord> {
  if (!PLAN_ANCHOR_ADDRESS) {
    return {
      state: "unwired",
      note: "PlanAnchor is not wired: set NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS to the deployed contract and reload.",
    };
  }

  // One relay read per hash per memo window, bounded in lib/store.ts. Without
  // this, /record/[planHash] turns a page anyone can request into one contract
  // read per request, for as many distinct hashes as the caller cares to type.
  // The window is seconds, because a record moves from anchored to settled
  // during a demo and a stale page is worse than paying for a second read.
  const memoised = planRecordMemo.recall(planHash);
  if (memoised) return memoised;

  try {
    const result = await hederaPublicClient().readContract({
      address: PLAN_ANCHOR_ADDRESS,
      abi: ANCHOR_ABI,
      functionName: "planOf",
      args: [planHash],
    });
    const plan = result as unknown as OnChainPlan;
    const state = stateFromStatus(Number(plan.status));

    if (state === "unknown") {
      const record: PlanRecord = {
        state,
        note: "PlanAnchor has never seen this plan hash, so there is no record to show yet.",
      };
      planRecordMemo.remember(planHash, record);
      return record;
    }

    const record: PlanRecord = {
      state,
      note:
        state === "settled"
          ? "The plan was anchored before the policy opened and closed as settled once the payout landed."
          : state === "abandoned"
            ? "The plan was anchored and then closed as abandoned, so the refused run left a complete record."
            : "The plan is anchored and still open. It closes when the treasury key either signs or refuses.",
      token: plan.token,
      selector: plan.selector,
      anchoredBy: plan.anchoredBy,
      anchoredAt: isoFromSeconds(plan.anchoredAt),
      closedAt: isoFromSeconds(plan.closedAt),
    };
    planRecordMemo.remember(planHash, record);
    return record;
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "unknown relay failure";
    console.error(`${LOG_PREFIX} anchor read failed:`, detail);
    return {
      state: "unreadable",
      note: "The Hedera relay did not answer the planOf call, so the record could not be read this time.",
    };
  }
}

/* --- The write path ------------------------------------------------------- */

function relayFailure(step: string, error: unknown): AnchorReceipt {
  const detail =
    error instanceof Error ? error.message : "unknown relay failure";
  console.error(`${LOG_PREFIX} anchor ${step} failed:`, detail);
  return {
    anchored: false,
    note: `The ${step} call did not reach PlanAnchor, so the on chain record is incomplete for this run. The transaction itself is unaffected.`,
  };
}

/**
 * Record the plan hash before the policy opens. An already anchored hash is the
 * normal case on a repeat run, and it sends nothing.
 */
export async function anchorPlan(
  planHash: Hex,
  token: `0x${string}`,
  selector: Hex
): Promise<AnchorReceipt> {
  const setup = configured();
  if (isMissing(setup)) return { anchored: false, note: setup.missing };

  // Idempotent per server derived plan hash, before the relay is touched. The
  // lock intent writes here, the plan hash is deterministic, and the caller no
  // longer chooses it: a repeated lock of the same plan reuses this receipt
  // instead of paying gas again.
  const remembered = anchorGuard.recall(planHash);
  if (remembered) return remembered;

  try {
    const status = await statusOf(setup, planHash);
    if (status !== STATUS_UNKNOWN) {
      const receipt: AnchorReceipt = {
        anchored: true,
        note: "Already anchored in an earlier run, reusing the existing record.",
      };
      anchorGuard.remember(planHash, receipt);
      return receipt;
    }

    // The backstop behind the idempotency: a bounded number of anchor writes per
    // process window, so a caller that keeps producing distinct plan hashes
    // cannot keep spending the operator account. Per instance only, like every
    // other limit in this build.
    if (!anchorGuard.claimWrite()) {
      return {
        anchored: false,
        note: "The anchor write budget for this window is spent, so the plan hash was not written on chain. The lock itself is unaffected.",
      };
    }

    const hash = await walletFor(setup).writeContract({
      address: setup.address,
      abi: ANCHOR_ABI,
      functionName: "anchor",
      args: [planHash, token, selector],
      type: "legacy",
      gas: SIGNED_TX_GAS_LIMIT,
    });
    console.info(`${LOG_PREFIX} plan anchored: ${planHash} in ${hash}`);
    const receipt: AnchorReceipt = {
      anchored: true,
      transactionHash: hash,
      note: "Plan hash anchored on chain before the policy opened.",
    };
    anchorGuard.remember(planHash, receipt);
    return receipt;
  } catch (error) {
    return relayFailure("anchor", error);
  }
}

/** A real 32 byte transaction hash, which is the only thing settle may carry. */
export function isTransactionHash(
  value: string | undefined
): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}

/** PlanAnchor reverts with InvalidTxReference on bytes32(0). */
function isZeroWord(value: string): boolean {
  return /^0x0{64}$/.test(value);
}

/** Close the plan as settled once the treasury transaction is in. */
export async function settlePlan(
  planHash: Hex,
  txReference?: string
): Promise<AnchorReceipt> {
  // The settle argument is a bytes32 reference to the payout transaction, and it
  // goes on chain as if it were one. Anything that is not a real 32 byte
  // transaction hash is refused rather than zero padded into something that
  // reads like one: a send with no broadcast behind it leaves the plan anchored
  // and open, which is the truth.
  if (!isTransactionHash(txReference) || isZeroWord(txReference)) {
    return {
      anchored: false,
      note: "No transaction hash came back from this send, so there is nothing to settle with. The plan stays anchored and open rather than closing on a reference that is not a transaction.",
    };
  }

  const setup = configured();
  if (isMissing(setup)) return { anchored: false, note: setup.missing };

  try {
    const status = await statusOf(setup, planHash);
    if (status === STATUS_SETTLED) {
      return {
        anchored: true,
        note: "Already settled in an earlier run, reusing the existing record.",
      };
    }
    if (status !== STATUS_ANCHORED) {
      return {
        anchored: false,
        note:
          status === STATUS_ABANDONED
            ? "This plan hash is closed as abandoned on chain, so it was not settled."
            : "This plan hash was never anchored on chain, so there was nothing to settle.",
      };
    }

    const reference: Hex = txReference;

    const hash = await walletFor(setup).writeContract({
      address: setup.address,
      abi: ANCHOR_ABI,
      functionName: "settle",
      args: [planHash, reference],
      type: "legacy",
      gas: SIGNED_TX_GAS_LIMIT,
    });
    console.info(`${LOG_PREFIX} plan settled: ${planHash} in ${hash}`);
    return {
      anchored: true,
      transactionHash: hash,
      note: "Plan closed as settled on chain, carrying the payout reference.",
    };
  } catch (error) {
    return relayFailure("settle", error);
  }
}

/**
 * PlanAnchor reverts with InvalidReason on an empty reason or one longer than
 * 256 bytes, so the reason is clamped here rather than sent to fail on chain.
 * The count is bytes, not characters: a multi-byte reason must not be cut in the
 * middle of a code point either.
 */
const MAX_ABANDON_REASON_BYTES = 256;
const DEFAULT_ABANDON_REASON = "closed without a stated reason";

export function clampAbandonReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length === 0) return DEFAULT_ABANDON_REASON;

  const encoded = new TextEncoder().encode(trimmed);
  if (encoded.length <= MAX_ABANDON_REASON_BYTES) return trimmed;

  const decoder = new TextDecoder("utf-8", { fatal: false });
  return decoder
    .decode(encoded.slice(0, MAX_ABANDON_REASON_BYTES))
    .replace(/\uFFFD+$/, "");
}

/** Close the plan as abandoned when the policy refused the payload. */
export async function abandonPlan(
  planHash: Hex,
  reason: string
): Promise<AnchorReceipt> {
  const stated = clampAbandonReason(reason);
  const setup = configured();
  if (isMissing(setup)) return { anchored: false, note: setup.missing };

  try {
    const status = await statusOf(setup, planHash);
    if (status === STATUS_ABANDONED) {
      return {
        anchored: true,
        note: "Already closed as abandoned in an earlier run, reusing the existing record.",
      };
    }
    if (status !== STATUS_ANCHORED) {
      return {
        anchored: false,
        note:
          status === STATUS_SETTLED
            ? "This plan hash is already settled on chain, so the refusal did not reopen it."
            : "This plan hash was never anchored on chain, so there was nothing to abandon.",
      };
    }

    const hash = await walletFor(setup).writeContract({
      address: setup.address,
      abi: ANCHOR_ABI,
      functionName: "abandon",
      args: [planHash, stated],
      type: "legacy",
      gas: SIGNED_TX_GAS_LIMIT,
    });
    console.info(`${LOG_PREFIX} plan abandoned: ${planHash} in ${hash}`);
    return {
      anchored: true,
      transactionHash: hash,
      note: `Plan closed as abandoned on chain: ${stated}.`,
    };
  } catch (error) {
    return relayFailure("abandon", error);
  }
}
