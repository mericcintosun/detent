// The store seam. This is the only module in the product that owns state
// crossing a request boundary.
//
// Persistence decision: the durable proof is the chain. PlanAnchor holds the
// record of every approved plan, so nothing here has to survive a cold start,
// and no database or KV store is added for state whose lasting copy is already
// on chain. What lives in
// module scope is only what the two requests of one demo cycle need between
// them: the lock held from the approval, the ledger of submissions already
// broadcast, the rate limiter, the anchor write budget and the record memo.
//
// Three properties every map here has, and none of them had before:
//
//   server generated keys  a lock id is 24 random bytes minted here, never a
//                          value the client chose. One visitor can no longer
//                          address, overwrite or pre-seed another visitor's
//                          record on a warm instance.
//   a TTL                  every entry expires. A lock that is never spent is
//                          gone within LOCK_TTL_MS, and with it the policy that
//                          was attached to the treasury wallet.
//   a bounded size         past the ceiling the oldest entry is evicted, so a
//                          loop of requests cannot grow this process without
//                          limit.
//
// The serverless caveat, said out loud: module scope survives warm invocations
// only. A recycled instance loses every map here, and that is now a refusal
// rather than a fallback: a submit whose lock this instance does not hold is
// answered with lock_unknown and the operator locks the plan again. The durable
// record is the chain, not this file. For the same reason the rate limiter and
// the anchor budget are mitigations, not guarantees: they bound one instance,
// and a platform that runs several of them bounds nothing globally.

import { randomBytes } from "node:crypto";
import type { Plan } from "@/lib/plan";
import type { PlanSelection } from "@/lib/schemas";
import {
  ANCHOR_BUDGET_WINDOW_MS,
  ANCHOR_MEMO_MS,
  ANCHOR_WRITE_BUDGET,
  LOCK_TTL_MS,
  LOCK_VAULT_MAX_ENTRIES,
  PLAN_RECORD_MEMO_MAX_ENTRIES,
  PLAN_RECORD_MEMO_MS,
  RATE_LIMIT_MAX_CLIENTS,
  RATE_LIMIT_WINDOW_MS,
  SUBMISSION_LEDGER_MAX_ENTRIES,
  SUBMISSION_TTL_MS,
} from "@/lib/config";
import type {
  AnchorReceipt,
  ApprovedSigner,
  PlanRecord,
  PrivyPolicy,
  SubmitResult,
} from "@/lib/types";

/* --- The primitive --------------------------------------------------------- */

export interface BoundedStoreOptions {
  ttlMs: number;
  maxEntries: number;
  /** Injected in tests so expiry can be exercised without waiting. */
  now?: () => number;
}

export interface BoundedStore<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  delete(key: string): void;
  readonly size: number;
}

/**
 * A Map with an expiry and a ceiling. Insertion order is what Map already
 * guarantees, so the eviction victim is the oldest key without a second index.
 */
export function createBoundedStore<T>(
  options: BoundedStoreOptions,
): BoundedStore<T> {
  const entries = new Map<string, { value: T; expiresAt: number }>();
  const now = options.now ?? (() => Date.now());

  function purge(): void {
    const at = now();
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= at) entries.delete(key);
    }
  }

  return {
    get(key: string): T | undefined {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key: string, value: T): void {
      purge();
      entries.delete(key);
      entries.set(key, { value, expiresAt: now() + options.ttlMs });
      while (entries.size > options.maxEntries) {
        const oldest = entries.keys().next();
        if (oldest.done) break;
        entries.delete(oldest.value);
      }
    },
    delete(key: string): void {
      entries.delete(key);
    },
    get size(): number {
      return entries.size;
    },
  };
}

/* --- The lock -------------------------------------------------------------- */

/**
 * Everything the send needs, held by the server between the two requests. The
 * submit intent reads this record and nothing from the request body decides
 * what the policy says, what the approved calldata is, or who approved it.
 */
export interface LockRecord {
  lockId: string;
  policyId: string;
  policy: PrivyPolicy;
  /** The plan the server derived from the register, not the one the client sent. */
  plan: Plan;
  /** The selection the plan was derived from, so the submit can derive it again. */
  selection: PlanSelection;
  approvedCalldata: `0x${string}`;
  approvedBy: ApprovedSigner[];
  walletId: string;
  /** Whatever the wallet carried in `policy_ids` before the lock, restored on release. */
  previousPolicyIds: string[];
  policyAttached: boolean;
  live: boolean;
  createdAt: number;
  expiresAt: number;
}

export type NewLock = Omit<LockRecord, "lockId" | "createdAt" | "expiresAt">;

const locks = createBoundedStore<LockRecord>({
  ttlMs: LOCK_TTL_MS,
  maxEntries: LOCK_VAULT_MAX_ENTRIES,
});

/** 24 random bytes, minted here. The client never chooses a key in this file. */
function mintLockId(): string {
  return `lok_${randomBytes(24).toString("base64url")}`;
}

export const lockVault = {
  open(record: NewLock): LockRecord {
    const createdAt = Date.now();
    const held: LockRecord = {
      ...record,
      lockId: mintLockId(),
      createdAt,
      expiresAt: createdAt + LOCK_TTL_MS,
    };
    locks.set(held.lockId, held);
    return held;
  },
  recall(lockId: string): LockRecord | undefined {
    return locks.get(lockId);
  },
  release(lockId: string): void {
    locks.delete(lockId);
  },
  get size(): number {
    return locks.size;
  },
};

/* --- The submission ledger ------------------------------------------------- */

const submissions = createBoundedStore<SubmitResult>({
  ttlMs: SUBMISSION_TTL_MS,
  maxEntries: SUBMISSION_LEDGER_MAX_ENTRIES,
});

/**
 * Idempotency for the send, under a key the server derives from the lock id and
 * the submitted calldata. A double click, a retry after a slow answer or a
 * refresh that re-fires the same send returns the result the first call
 * produced instead of broadcasting twice, and no client can name the key of a
 * submission it did not make.
 */
export const submissionLedger = {
  recall(key: string): SubmitResult | undefined {
    return submissions.get(key);
  },
  remember(key: string, result: SubmitResult): void {
    submissions.set(key, result);
  },
};

/* --- The rate limiter ------------------------------------------------------ */

interface Window {
  count: number;
  resetAt: number;
}

const windows = createBoundedStore<Window>({
  ttlMs: RATE_LIMIT_WINDOW_MS,
  maxEntries: RATE_LIMIT_MAX_CLIENTS,
});

export interface RateVerdict {
  allowed: boolean;
  /** Seconds until the window rolls over, for the Retry-After header. */
  retryAfterSeconds: number;
}

/**
 * A fixed window per client address, in this process only. Say it plainly: one
 * instance limiting itself is a mitigation, not a guarantee. A platform that
 * runs several instances multiplies every budget below by the instance count,
 * and a client that rotates addresses is not limited at all. The real control
 * for a deployment that can write is OPERATOR_API_TOKEN.
 */
export const rateLimiter = {
  consume(key: string, limit: number): RateVerdict {
    const now = Date.now();
    const current = windows.get(key);
    if (!current) {
      windows.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (current.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((current.resetAt - now) / 1000),
        ),
      };
    }
    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  },
};

/* --- The anchor guard ------------------------------------------------------ */

const anchorReceipts = createBoundedStore<AnchorReceipt>({
  ttlMs: ANCHOR_MEMO_MS,
  maxEntries: LOCK_VAULT_MAX_ENTRIES,
});

let anchorSpend = { count: 0, resetAt: 0 };

/**
 * One anchor write per server derived plan hash per memo window, and a hard
 * ceiling on writes per process window on top of that. The plan hash is
 * deterministic, so a repeated lock of the same plan reuses the receipt instead
 * of paying gas again.
 */
export const anchorGuard = {
  recall(planHash: string): AnchorReceipt | undefined {
    return anchorReceipts.get(planHash);
  },
  remember(planHash: string, receipt: AnchorReceipt): void {
    anchorReceipts.set(planHash, receipt);
  },
  /** Claim one write from the budget. False means the budget is spent. */
  claimWrite(): boolean {
    const now = Date.now();
    if (now >= anchorSpend.resetAt) {
      anchorSpend = { count: 0, resetAt: now + ANCHOR_BUDGET_WINDOW_MS };
    }
    if (anchorSpend.count >= ANCHOR_WRITE_BUDGET) return false;
    anchorSpend.count += 1;
    return true;
  },
};

/* --- The record memo ------------------------------------------------------- */

const planRecords = createBoundedStore<PlanRecord>({
  ttlMs: PLAN_RECORD_MEMO_MS,
  maxEntries: PLAN_RECORD_MEMO_MAX_ENTRIES,
});

/**
 * A short lived memo for readPlanRecord, so /record/[planHash] cannot turn one
 * relay read per unique hash into an unbounded stream of relay reads. The window
 * is seconds, because a record moves from anchored to settled during a demo and
 * a stale page is worse than a second read.
 */
export const planRecordMemo = {
  recall(planHash: string): PlanRecord | undefined {
    return planRecords.get(planHash);
  },
  remember(planHash: string, record: PlanRecord): void {
    planRecords.set(planHash, record);
  },
};
