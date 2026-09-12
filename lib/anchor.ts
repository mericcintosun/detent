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
import type { AnchorReceipt } from "@/lib/types";

const ANCHOR_ABI = parseAbi([
  "struct Plan { address token; bytes4 selector; address anchoredBy; uint64 anchoredAt; uint64 settledAt; uint8 status; }",
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

  try {
    const status = await statusOf(setup, planHash);
    if (status !== STATUS_UNKNOWN) {
      return {
        anchored: true,
        note: "Already anchored in an earlier run, reusing the existing record.",
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
    return {
      anchored: true,
      transactionHash: hash,
      note: "Plan hash anchored on chain before the policy opened.",
    };
  } catch (error) {
    return relayFailure("anchor", error);
  }
}

/** Close the plan as settled once the treasury transaction is in. */
export async function settlePlan(
  planHash: Hex,
  txReference?: string
): Promise<AnchorReceipt> {
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

    // The settle argument is a bytes32 reference to the payout transaction.
    // A local stub receipt is not 32 bytes, so pad it rather than reverting.
    const reference = (
      txReference && /^0x[0-9a-fA-F]{64}$/.test(txReference)
        ? txReference
        : `0x${(txReference ?? "").replace(/^0x/, "").padEnd(64, "0").slice(0, 64)}`
    ) as Hex;

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

/** Close the plan as abandoned when the policy refused the payload. */
export async function abandonPlan(
  planHash: Hex,
  reason: string
): Promise<AnchorReceipt> {
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
      args: [planHash, reason],
      type: "legacy",
      gas: SIGNED_TX_GAS_LIMIT,
    });
    console.info(`${LOG_PREFIX} plan abandoned: ${planHash} in ${hash}`);
    return {
      anchored: true,
      transactionHash: hash,
      note: `Plan closed as abandoned on chain: ${reason}.`,
    };
  } catch (error) {
    return relayFailure("abandon", error);
  }
}
