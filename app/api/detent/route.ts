import { NextResponse } from "next/server";
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
import type {
  ApiResponse,
  PolicyInstallation,
  PrivyPolicy,
  SubmitResult,
} from "@/lib/types";

export const runtime = "nodejs";

// Policies live here between lock and execution so the submitted payload is
// judged against the policy that was actually approved, not one re-derived from
// whatever the browser sends back. A serverless instance can be recycled between
// the two calls, so submit falls back to recompiling from the approved plan the
// client echoes; the response says which path ran.
// TODO: move this to Privy's own policy read endpoint (GET /v1/policies/{id})
// once the treasury wallet is live, then the fallback disappears.
const vault = new Map<string, { policy: PrivyPolicy; plan: Plan }>();

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
      vault.set(installation.policyId, {
        policy: installation.policy,
        plan,
      });
      const response: ApiResponse<PolicyInstallation> = {
        ok: true,
        data: installation,
      };
      return NextResponse.json(response);
    } catch (error) {
      return failFromThrown(error);
    }
  }

  const { policyId, tampered } = body;
  const approvedPlan: Plan = body.approvedPlan;
  const submittedRows = body.submittedRows;
  const held = vault.get(policyId);
  const policy = held?.policy ?? compilePolicy(approvedPlan);

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
    });

    if (result.verdict.allowed) {
      vault.delete(policyId);
    }

    const data: SubmitResult = {
      ...result,
      calldata,
      tampered,
      policySource: held ? "held-from-lock" : "recompiled-from-approved-plan",
      planHash: approvedPlan.planHash,
    };
    const response: ApiResponse<SubmitResult> = { ok: true, data };
    return NextResponse.json(response);
  } catch (error) {
    return failFromThrown(error);
  }
}
