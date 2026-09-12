// The store seam. This is the only module in the product that owns state
// crossing a request boundary.
//
// Persistence decision, decided in Phase 3 and recorded in HANDOFF.md: the
// step's proof IS the chain. PlanAnchor holds the durable record of every
// approved plan, so nothing here has to survive a cold start. What lives in
// module scope is only what the two requests of one demo cycle need between
// them: the compiled policy held from the lock, and the ledger of submissions
// already broadcast.
//
// Rejected: a KV blob (an Upstash account, a token and a dependency for state
// whose durable copy is already on chain, and whose warm-instance fallback,
// recompiling the policy from the approved plan the client echoes, is already
// written and tested), and Postgres (nothing in the five DEMO.md steps filters
// or joins anything; the register is 12 rows read from a contract).
//
// The serverless caveat, said out loud: module scope survives warm invocations
// only. A recycled instance loses both maps, which is why the submit path
// recompiles the policy from the approved plan and says so in policySource, and
// why the durable record is the chain rather than this file.

import type { Plan } from "@/lib/plan";
import type { PrivyPolicy, SubmitResult } from "@/lib/types";

export interface VaultEntry {
  policy: PrivyPolicy;
  plan: Plan;
}

const policies = new Map<string, VaultEntry>();

/** The compiled policy, held between the lock and the send of the same plan. */
export const policyVault = {
  hold(policyId: string, entry: VaultEntry): void {
    policies.set(policyId, entry);
  },
  recall(policyId: string): VaultEntry | undefined {
    return policies.get(policyId);
  },
  release(policyId: string): void {
    policies.delete(policyId);
  },
};

const submissions = new Map<string, SubmitResult>();

/**
 * Idempotency for the send. The console derives one key per distinct submission
 * (policy, plan hash, tampered or not, calldata), so a double click or a retry
 * returns the result the first call produced instead of broadcasting twice.
 */
export const submissionLedger = {
  recall(key: string): SubmitResult | undefined {
    return submissions.get(key);
  },
  remember(key: string, result: SubmitResult): void {
    submissions.set(key, result);
  },
};
