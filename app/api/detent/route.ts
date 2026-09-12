import { NextResponse } from "next/server";
import { buildCalldata, type Plan } from "@/lib/plan";
import {
  compilePolicy,
  installPolicy,
  quorumSatisfied,
  submitTransaction,
} from "@/lib/privy";
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

interface LockBody {
  intent: "lock";
  plan: Plan;
  approvals: string[];
}

interface SubmitBody {
  intent: "submit";
  policyId: string;
  approvedPlan: Plan;
  submittedRows: Array<{ address: `0x${string}`; amountMicros: string }>;
  tampered: boolean;
}

type Body = LockBody | SubmitBody;

/** Every response from this route carries the same envelope. */
function fail(error: string, status: number, blockers?: string[]) {
  const payload: ApiResponse<never> = blockers
    ? { ok: false, error, blockers }
    : { ok: false, error };
  return NextResponse.json(payload, { status });
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return fail("Malformed request body.", 400);
  }

  if (body.intent === "lock") {
    const { plan, approvals } = body;

    if (plan.blockers.length > 0) {
      return fail(
        "The plan still has blockers, nothing can be locked.",
        409,
        plan.blockers
      );
    }

    if (!quorumSatisfied(approvals)) {
      return fail(
        "Key quorum not met. Two distinct signers must approve before the policy is installed.",
        409
      );
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
      return fail(
        error instanceof Error ? error.message : "Policy install failed.",
        502
      );
    }
  }

  if (body.intent === "submit") {
    const { policyId, approvedPlan, submittedRows, tampered } = body;
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
      return fail(
        error instanceof Error ? error.message : "Submission failed.",
        502
      );
    }
  }

  return fail("Unknown intent.", 400);
}
