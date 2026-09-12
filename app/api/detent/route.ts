import { NextResponse } from "next/server";
import { abandonPlan, anchorPlan, settlePlan } from "@/lib/anchor";
import { LOG_PREFIX } from "@/lib/config";
import {
  hintFor,
  isDetentError,
  type DetentErrorCode,
} from "@/lib/errors";
import { buildCalldata, type Plan } from "@/lib/plan";
import {
  compilePolicy,
  installPolicy,
  quorumSatisfied,
  submitTransaction,
} from "@/lib/privy";
import { detentRequestSchema, firstIssuePath } from "@/lib/schemas";
import { policyVault, submissionLedger } from "@/lib/store";
import type {
  ApiResponse,
  PolicyInstallation,
  PrivyPolicy,
  SubmitResult,
} from "@/lib/types";

export const runtime = "nodejs";

// Cross-request state lives in lib/store.ts and nowhere else. policyVault holds
// the compiled policy between the lock and the send so the submitted payload is
// judged against the policy that was actually approved, not one re-derived from
// whatever the browser sends back. A serverless instance can be recycled between
// the two calls, so submit falls back to recompiling from the approved plan the
// client echoes; the response says which path ran.
// TODO: move the vault to Privy's own policy read endpoint (GET /v1/policies/{id})
// once the treasury wallet is live, then the fallback disappears.

/** Every failure from this route carries the same envelope: a code and a hint. */
function fail(
  error: DetentErrorCode,
  status: number,
  options?: { hint?: string; blockers?: string[] }
) {
  const payload: ApiResponse<never> = {
    ok: false,
    error,
    hint: options?.hint ?? hintFor(error),
    ...(options?.blockers ? { blockers: options.blockers } : {}),
  };
  return NextResponse.json(payload, { status });
}

/** A thrown DetentError keeps its own code; anything else is an upstream error. */
function failFromThrown(thrown: unknown) {
  if (isDetentError(thrown)) {
    return fail(thrown.code, thrown.code === "upstream_timeout" ? 504 : 502, {
      hint: thrown.hint,
    });
  }
  console.error(
    `${LOG_PREFIX} unexpected failure on the core path:`,
    thrown instanceof Error ? thrown.message : "non-error thrown"
  );
  return fail("upstream_error", 502);
}

export async function POST(request: Request) {
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

  if (body.intent === "lock") {
    const plan: Plan = body.plan;
    const approvals = body.approvals;

    if (plan.blockers.length > 0) {
      return fail("plan_blocked", 409, { blockers: plan.blockers });
    }

    if (!quorumSatisfied(approvals)) {
      return fail("quorum_not_met", 409);
    }

    try {
      const installation = await installPolicy(plan, approvals);
      policyVault.hold(installation.policyId, {
        policy: installation.policy,
        plan,
      });

      // The plan hash goes on chain before the policy opens, which is the whole
      // claim: what the key may sign was witnessed first. A degraded receipt
      // never fails the lock, it just says what did not happen.
      const anchor = await anchorPlan(plan.planHash, plan.target, plan.selector);

      const response: ApiResponse<PolicyInstallation> = {
        ok: true,
        data: { ...installation, anchor },
      };
      return NextResponse.json(response);
    } catch (error) {
      return failFromThrown(error);
    }
  }

  const { policyId, tampered, submissionKey, broadcastPreference } = body;
  const approvedPlan: Plan = body.approvedPlan;
  const submittedRows = body.submittedRows;

  // Idempotency before anything is broadcast. A double click, a retry after a
  // slow answer, or a refresh that re-fires the same send all land here and get
  // the result the first call produced.
  const replayed = submissionLedger.recall(submissionKey);
  if (replayed) {
    console.info(
      `${LOG_PREFIX} submission replayed from the ledger: ${submissionKey}, nothing broadcast`
    );
    const response: ApiResponse<SubmitResult> = { ok: true, data: replayed };
    return NextResponse.json(response);
  }

  const held = policyVault.recall(policyId);
  const policy: PrivyPolicy = held?.policy ?? compilePolicy(approvedPlan);

  const calldata: `0x${string}` =
    submittedRows.length > 0
      ? buildCalldata(approvedPlan.kind, submittedRows)
      : "0x";

  try {
    const result = await submitTransaction({
      policy,
      policyId,
      to: approvedPlan.target,
      chainId: approvedPlan.chainId,
      data: calldata,
      broadcastPreference,
    });

    if (result.verdict.allowed) {
      policyVault.release(policyId);
    }

    // Close the on chain record either way: settled when the key signed,
    // abandoned when the policy refused the payload.
    const anchor = result.verdict.allowed
      ? await settlePlan(approvedPlan.planHash, result.transactionHash)
      : await abandonPlan(
          approvedPlan.planHash,
          "policy refused the submitted payload"
        );

    const data: SubmitResult = {
      ...result,
      calldata,
      tampered,
      policySource: held ? "held-from-lock" : "recompiled-from-approved-plan",
      planHash: approvedPlan.planHash,
      anchor,
    };
    submissionLedger.remember(submissionKey, data);

    const response: ApiResponse<SubmitResult> = { ok: true, data };
    return NextResponse.json(response);
  } catch (error) {
    return failFromThrown(error);
  }
}
