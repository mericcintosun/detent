import { NextResponse } from "next/server";
import { keccak256, toHex } from "viem";
import { abandonPlan, anchorPlan, settlePlan } from "@/lib/anchor";
import {
  EDGE_RATE_LIMIT_MAX_REQUESTS,
  LOCK_RATE_LIMIT_MAX_REQUESTS,
  LOG_PREFIX,
  OPERATOR_API_TOKEN,
  QUORUM_THRESHOLD,
  RATE_LIMIT_MAX_REQUESTS,
} from "@/lib/config";
import { hintFor, isDetentError, type DetentErrorCode } from "@/lib/errors";
import { buildCalldata, buildPlan, type Plan } from "@/lib/plan";
import {
  installPolicy,
  releasePolicy,
  resolveApprovals,
  submitTransaction,
} from "@/lib/privy";
import { getRegisterSnapshot } from "@/lib/register";
import {
  detentRequestSchema,
  firstIssuePath,
  type PlanSelection,
} from "@/lib/schemas";
import { lockVault, rateLimiter, submissionLedger } from "@/lib/store";
import type {
  ApiResponse,
  PolicyInstallation,
  SubmitResult,
} from "@/lib/types";

export const runtime = "nodejs";

// Cross-request state lives in lib/store.ts and nowhere else.
//
// The server holds the authority over what may be signed, and it holds it in two
// places. The lock record in lib/store.ts carries the compiled policy, the
// approved calldata and the officers who approved, under an opaque lock id this
// process minted. The plan itself is rebuilt here from the register snapshot and
// the operator's row selection, and the request is refused when the plan the
// browser sends is not the plan the server derives.
//
// Nothing is ever recompiled from the request body. A submit whose lock this
// instance does not hold (a recycled serverless instance, an expired lock, an id
// that was never issued) is refused with lock_unknown and the operator locks the
// plan again. That is a deliberate behaviour change from v0.1, where a cold
// instance rebuilt the policy out of the approved plan the client echoed back and
// therefore approved whatever the client sent. It is written up in SECURITY.md.

// A lock that expires or is evicted unspent still has a policy bound to the
// treasury wallet on the live path. Put the wallet back and revoke the policy
// then, instead of leaving it attached with no lock left to spend it.
lockVault.onExpire((lock) => {
  if (!lock.live || !lock.policyAttached) return;
  void releasePolicy({
    walletId: lock.walletId,
    policyId: lock.policyId,
    previousPolicyIds: lock.previousPolicyIds,
  })
    .then((release) => {
      console.info(
        `${LOG_PREFIX} expired lock cleaned up: policy ${lock.policyId}, detached ${release.detached}, revoked ${release.revoked}`,
      );
    })
    .catch(() => {
      console.error(
        `${LOG_PREFIX} expired lock cleanup failed: policy ${lock.policyId}`,
      );
    });
});

type Intent = "lock" | "submit";

/** Every failure from this route carries the same envelope: a code and a hint. */
function fail(
  error: DetentErrorCode,
  status: number,
  options?: {
    hint?: string;
    blockers?: string[];
    headers?: HeadersInit;
    /** Set on the two intents, so the failure gets its one server log line. */
    intent?: Intent;
    providerStatus?: number;
  },
) {
  if (options?.intent) {
    // Code and statuses only: never the hint, the body or a header value.
    console.warn(
      `${LOG_PREFIX} ${options.intent} failed: ${error}, http ${status}, provider ${options.providerStatus ?? "none"}`,
    );
  }
  const payload: ApiResponse<never> = {
    ok: false,
    error,
    hint: options?.hint ?? hintFor(error),
    ...(options?.blockers ? { blockers: options.blockers } : {}),
  };
  return NextResponse.json(payload, {
    status,
    ...(options?.headers ? { headers: options.headers } : {}),
  });
}

/** A thrown DetentError keeps its own code; anything else is an upstream error. */
function failFromThrown(thrown: unknown, intent: Intent) {
  if (isDetentError(thrown)) {
    return fail(thrown.code, thrown.code === "upstream_timeout" ? 504 : 502, {
      hint: thrown.hint,
      intent,
      providerStatus: thrown.providerStatus,
    });
  }
  console.error(
    `${LOG_PREFIX} unexpected failure on the core path:`,
    thrown instanceof Error ? thrown.message : "non-error thrown",
  );
  return fail("upstream_error", 502, { intent });
}

/**
 * The address the limiter counts against. Behind Vercel the first entry of
 * x-forwarded-for is the client; with no proxy header there is nothing to read,
 * and every such request shares one bucket rather than escaping the limiter.
 */
function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || "unknown-client";
}

/**
 * The lock intent writes an anchor transaction with the operator key, so a
 * deployment that has a key should gate it. With OPERATOR_API_TOKEN unset the
 * lock stays open, which is the keyless demo posture; with it set the token is
 * compared against the x-detent-operator header.
 */
function operatorTokenAccepted(request: Request): boolean {
  if (!OPERATOR_API_TOKEN) return true;
  const presented = request.headers.get("x-detent-operator");
  return typeof presented === "string" && presented === OPERATOR_API_TOKEN;
}

/**
 * The operator chooses which rows leave the run and which held rows are forced
 * back in, and that is the only part of a plan that legitimately comes from the
 * browser. A client that does not send the selection has it read back off the
 * plan rows, which produces the same two lists for any plan the console built.
 */
function selectionFrom(plan: Plan): PlanSelection {
  return {
    kind: plan.kind,
    deferred: plan.rows
      .filter((row) => !row.held && !row.included)
      .map((row) => row.holderId),
    forced: plan.rows
      .filter((row) => row.held && row.included)
      .map((row) => row.holderId),
  };
}

/**
 * The plan the server is willing to stand behind: built here, from the register
 * snapshot this server reads and the operator's selection, never from the
 * request body. Everything downstream (the policy conditions, the calldata, the
 * anchored hash, the blockers) derives from this object.
 */
async function deriveServerPlan(selection: PlanSelection): Promise<Plan> {
  const snapshot = await getRegisterSnapshot();
  return buildPlan({
    kind: selection.kind,
    deferred: selection.deferred,
    forced: selection.forced,
    holders: snapshot.holders,
    treasuryMicros: snapshot.treasury.balanceMicros,
  });
}

/** The plan hash and the calldata both have to agree, or nothing is locked. */
function planMatches(server: Plan, client: Plan): boolean {
  return (
    server.planHash === client.planHash &&
    server.calldata.toLowerCase() === client.calldata.toLowerCase() &&
    server.target.toLowerCase() === client.target.toLowerCase() &&
    server.chainId === client.chainId
  );
}

const MISMATCH_HINT =
  "The plan in this request is not the plan this server derives from the register, so nothing was locked and nothing was anchored. The register moves under the console, so reload the page, read the plan again and approve it again.";

export async function POST(request: Request) {
  // Counted before the body is read, so malformed JSON and bodies that fail
  // validation spend budget as well. Coarse on purpose: the per intent buckets
  // below still apply to every request that parses.
  const edge = rateLimiter.consume(
    `edge:${clientAddress(request)}`,
    EDGE_RATE_LIMIT_MAX_REQUESTS,
  );
  if (!edge.allowed) {
    return fail("rate_limited", 429, {
      hint: `This address has sent too many requests in the current window. Wait ${edge.retryAfterSeconds} seconds and try again.`,
      headers: { "Retry-After": String(edge.retryAfterSeconds) },
    });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail("invalid_input", 400, {
      hint: "The request body was not valid JSON.",
    });
  }

  const parsed = detentRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("invalid_input", 400, {
      hint: `The request failed validation at ${firstIssuePath(parsed.error)}. Reload the page and rebuild the plan.`,
    });
  }

  const body = parsed.data;

  // One limiter for the whole route, a tighter budget for the intent that can
  // write on chain. Per instance, which is a mitigation and not a guarantee:
  // several instances multiply it and a client that rotates addresses evades it.
  const limit =
    body.intent === "lock"
      ? LOCK_RATE_LIMIT_MAX_REQUESTS
      : RATE_LIMIT_MAX_REQUESTS;
  const verdict = rateLimiter.consume(
    `${body.intent}:${clientAddress(request)}`,
    limit,
  );
  if (!verdict.allowed) {
    return fail("rate_limited", 429, {
      hint: `This address has spent its ${body.intent} budget for the current window. Wait ${verdict.retryAfterSeconds} seconds and try again.`,
      headers: { "Retry-After": String(verdict.retryAfterSeconds) },
    });
  }

  if (body.intent === "lock") {
    if (!operatorTokenAccepted(request)) {
      return fail("unauthorized", 401, {
        hint: "This deployment gates the lock intent with an operator token. Send it in the x-detent-operator header and lock the plan again.",
        intent: "lock",
      });
    }

    const selection = body.selection ?? selectionFrom(body.plan);

    try {
      const plan = await deriveServerPlan(selection);

      if (!planMatches(plan, body.plan)) {
        console.warn(
          `${LOG_PREFIX} plan mismatch on lock: client ${body.plan.planHash}, server ${plan.planHash}`,
        );
        return fail("plan_mismatch", 409, {
          hint: MISMATCH_HINT,
          intent: "lock",
        });
      }

      if (plan.blockers.length > 0) {
        return fail("plan_blocked", 409, {
          blockers: plan.blockers,
          intent: "lock",
        });
      }

      const approvals = resolveApprovals(body.approvals);
      if (!approvals.ok) {
        return fail("quorum_not_met", 409, {
          hint: `${approvals.reason} ${QUORUM_THRESHOLD} distinct officers from the approver registry must approve before the policy is installed on the treasury wallet.`,
          intent: "lock",
        });
      }

      // The plan hash goes on chain before the policy opens, which is the whole
      // claim: what the key may sign was witnessed first. A degraded receipt
      // never fails the lock, it just says what did not happen. The write is
      // idempotent per plan hash and bounded per process window, both in
      // lib/anchor.ts, because this route pays for it with the operator key.
      const anchor = await anchorPlan(
        plan.planHash,
        plan.target,
        plan.selector,
      );

      const installed = await installPolicy(plan, approvals.signers);

      const lock = lockVault.open({
        policyId: installed.policyId,
        policy: installed.policy,
        plan,
        selection,
        approvedCalldata: plan.calldata,
        approvedBy: approvals.signers,
        walletId: installed.walletId,
        previousPolicyIds: installed.previousPolicyIds,
        policyAttached: installed.policyAttached,
        live: installed.live,
      });

      console.info(
        `${LOG_PREFIX} plan locked: ${lock.lockId} holds policy ${installed.policyId} for plan ${plan.planHash}, attached ${installed.policyAttached}, approved by ${approvals.signers.map((signer) => signer.id).join(" and ")}`,
      );

      const response: ApiResponse<PolicyInstallation> = {
        ok: true,
        data: {
          lockId: lock.lockId,
          policyId: installed.policyId,
          policy: installed.policy,
          walletId: installed.walletId,
          quorumThreshold: QUORUM_THRESHOLD,
          approvedBy: approvals.signers,
          policyAttached: installed.policyAttached,
          planHash: plan.planHash,
          expiresAt: new Date(lock.expiresAt).toISOString(),
          live: installed.live,
          note: installed.note,
          anchor,
        },
      };
      return NextResponse.json(response);
    } catch (error) {
      return failFromThrown(error, "lock");
    }
  }

  const { lockId, submittedRows, broadcastPreference } = body;

  // Idempotency before anything else, under a key this server derives from the
  // lock id and the submitted rows. It runs before the lock is recalled because
  // an allowed send spends its lock: a double click, a retry after a slow answer
  // or a refresh that re-fires the same send must get the result the first call
  // produced, not lock_unknown. The lock id is unguessable, so a caller can only
  // replay a submission it already holds the handle for.
  const submissionKey = `${lockId}:${keccak256(
    toHex(
      submittedRows
        .map((row) => `${row.address.toLowerCase()}:${row.amountMicros}`)
        .join("|"),
    ),
  )}`;
  const replayed = submissionLedger.recall(submissionKey);
  if (replayed) {
    console.info(
      `${LOG_PREFIX} submission replayed from the ledger, nothing broadcast`,
    );
    const response: ApiResponse<SubmitResult> = { ok: true, data: replayed };
    return NextResponse.json(response);
  }

  const lock = lockVault.recall(lockId);
  if (!lock) {
    return fail("lock_unknown", 409, { intent: "submit" });
  }

  const calldata: `0x${string}` =
    submittedRows.length > 0
      ? buildCalldata(lock.plan.kind, submittedRows)
      : "0x";

  // Derived here, never read from the request body: the submitted payload either
  // is the approved calldata byte for byte or it is not.
  const tampered =
    calldata.toLowerCase() !== lock.approvedCalldata.toLowerCase();

  try {
    // Re-derived on this intent too, from the same register and the selection
    // held under the lock. A register that moved under an open lock invalidates
    // the approval rather than signing against a stale preview.
    const plan = await deriveServerPlan(lock.selection);
    if (plan.planHash !== lock.plan.planHash) {
      console.warn(
        `${LOG_PREFIX} plan mismatch on submit: locked ${lock.plan.planHash}, server ${plan.planHash}`,
      );
      return fail("plan_mismatch", 409, {
        hint: MISMATCH_HINT,
        intent: "submit",
      });
    }

    // Blockers are enforced on both intents, from the server derived plan. A row
    // the compliance module is holding cannot reach payout calldata through a
    // direct call to this route, whatever the browser believed at lock time.
    if (plan.blockers.length > 0) {
      return fail("plan_blocked", 409, {
        blockers: plan.blockers,
        intent: "submit",
      });
    }

    let result: Awaited<ReturnType<typeof submitTransaction>>;
    try {
      result = await submitTransaction({
        policy: lock.policy,
        policyId: lock.policyId,
        walletId: lock.walletId,
        previousPolicyIds: lock.previousPolicyIds,
        to: plan.target,
        chainId: plan.chainId,
        planHash: plan.planHash,
        data: calldata,
        broadcastPreference,
      });
    } catch (error) {
      // A failed or unknown send already detached and revoked the policy, so
      // the lock has nothing left to send under. Release it without the expiry
      // cleanup, which would only repeat the same two calls.
      if (isDetentError(error) && error.lockSpent) {
        lockVault.release(lock.lockId);
      }
      throw error;
    }

    // A send the wallet allowed spends the lock: the policy is detached and
    // revoked, so there is nothing left to send under. A refusal leaves the lock
    // open on purpose, because the next thing the operator does is send the plan
    // as it was approved.
    if (result.verdict.allowed) {
      lockVault.release(lock.lockId);
    }

    // Close the on chain record either way: settled when the key signed,
    // abandoned when the policy refused the payload. settlePlan takes only a real
    // 32 byte transaction hash, so a synthetic receipt leaves the plan anchored
    // and open rather than closing it on something that is not a transaction.
    const anchor = result.verdict.allowed
      ? await settlePlan(
          plan.planHash,
          result.receipt?.kind === "on-chain"
            ? result.receipt.transactionHash
            : undefined,
        )
      : await abandonPlan(
          plan.planHash,
          "policy refused the submitted payload",
        );

    const data: SubmitResult = {
      ...result,
      calldata,
      tampered,
      policySource: "held-from-lock",
      planHash: plan.planHash,
      anchor,
    };
    submissionLedger.remember(submissionKey, data);

    const response: ApiResponse<SubmitResult> = { ok: true, data };
    return NextResponse.json(response);
  } catch (error) {
    return failFromThrown(error, "submit");
  }
}
