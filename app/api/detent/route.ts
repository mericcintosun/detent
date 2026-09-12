import { NextResponse } from "next/server";
import { buildCalldata, type Plan } from "@/lib/plan";
import {
  compilePolicy,
  installPolicy,
  quorumSatisfied,
  submitTransaction,
  type PrivyPolicy,
} from "@/lib/privy";

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

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (body.intent === "lock") {
    const { plan, approvals } = body;

    if (plan.blockers.length > 0) {
      return NextResponse.json(
        {
          error: "The plan still has blockers, nothing can be locked.",
          blockers: plan.blockers,
        },
        { status: 409 }
      );
    }

    if (!quorumSatisfied(approvals)) {
      return NextResponse.json(
        {
          error:
            "Key quorum not met. Two distinct signers must approve before the policy is installed.",
        },
        { status: 409 }
      );
    }

    try {
      const installation = await installPolicy(plan, approvals);
      vault.set(installation.policyId, {
        policy: installation.policy,
        plan,
      });
      return NextResponse.json(installation);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Policy install failed." },
        { status: 502 }
      );
    }
  }

  if (body.intent === "submit") {
    const { policyId, approvedPlan, submittedRows, tampered } = body;
    const held = vault.get(policyId);
    const policy = held?.policy ?? compilePolicy(approvedPlan);

    const calldata =
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

      return NextResponse.json({
        ...result,
        calldata,
        tampered,
        policySource: held ? "held-from-lock" : "recompiled-from-approved-plan",
        planHash: approvedPlan.planHash,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Submission failed." },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ error: "Unknown intent." }, { status: 400 });
}
