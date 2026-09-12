// The API route, end to end.
//
// App Router handlers are plain functions, so POST is imported and invoked with
// a constructed Request. No server, no network: vitest.config.ts pins the Privy
// and PlanAnchor environment empty, which puts lib/privy.ts on its local
// evaluation path and lib/anchor.ts on its unwired path.
//
// Every test here is named for the guarantee it protects rather than for the
// code that happens to provide it today, because the route's contract is being
// reworked. Two of them describe a gap the audit already recorded and say so in
// their names.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/detent/route";
import { holders } from "@/lib/data";
import { buildPlan, type Plan } from "@/lib/plan";
import type { ApiResponse, PolicyInstallation, SubmitResult } from "@/lib/types";

const approvals = ["ops-controller", "risk-officer"];
const plan = buildPlan({ kind: "coupon", holders });

/** A plan that forces a compliance held holder back into the payout rows. */
const blockedPlan = buildPlan({
  kind: "coupon",
  holders,
  forced: ["h-05"],
});

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://detent.test/api/detent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

function rowsOf(source: Plan) {
  return source.rows
    .filter((row) => row.included)
    .map((row) => ({ address: row.address, amountMicros: row.amountMicros }));
}

async function lock(body: {
  plan: Plan;
  approvals: string[];
}): Promise<{ status: number; payload: ApiResponse<PolicyInstallation> }> {
  const response = await post({ intent: "lock", ...body });
  return { status: response.status, payload: await response.json() };
}

async function submit(body: {
  policyId: string;
  approvedPlan: Plan;
  submittedRows: ReturnType<typeof rowsOf>;
  tampered: boolean;
  submissionKey: string;
}): Promise<{ status: number; payload: ApiResponse<SubmitResult> }> {
  const response = await post({ intent: "submit", ...body });
  return { status: response.status, payload: await response.json() };
}

// The route narrates the core path on console.info. That is wanted in a demo
// and noise in a test report, so it is silenced here and nowhere else. Errors
// are left alone: an unexpected one should be visible in the run.
beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the lock intent", () => {
  it("answers an approved plan with a policy that pins the approved calldata", async () => {
    const { status, payload } = await lock({ plan, approvals });

    expect(status).toBe(200);
    if (!payload.ok) throw new Error(`lock failed: ${payload.error}`);

    const rule = payload.data.policy.rules[0];
    const exact = rule.conditions.find(
      (condition) => condition.field === "data" && condition.operator === "eq"
    );

    expect(payload.data.policy.default_action).toBe("DENY");
    expect(rule.action).toBe("ALLOW");
    expect(exact?.value).toBe(plan.calldata);
    expect(payload.data.quorumThreshold).toBe(2);
    expect(payload.data.policyId.length).toBeGreaterThan(0);
  });

  it("reports what the anchor did instead of failing the lock when PlanAnchor is unwired", async () => {
    const { payload } = await lock({ plan, approvals });
    if (!payload.ok) throw new Error(`lock failed: ${payload.error}`);

    expect(payload.data.anchor?.anchored).toBe(false);
    expect(payload.data.anchor?.transactionHash).toBeUndefined();
    expect(payload.data.anchor?.note).toContain("not wired");
  });

  it("refuses a plan that still carries blockers and names them", async () => {
    const { status, payload } = await lock({ plan: blockedPlan, approvals });

    expect(status).toBe(409);
    if (payload.ok) throw new Error("a blocked plan must not lock");
    expect(payload.error).toBe("plan_blocked");
    expect(payload.blockers?.join(" ")).toContain("held by the compliance module");
  });

  it("refuses the same signer twice as a quorum", async () => {
    const { status, payload } = await lock({
      plan,
      approvals: ["ops-controller", "ops-controller"],
    });

    expect(status).toBe(409);
    if (payload.ok) throw new Error("one signer must not open the policy");
    expect(payload.error).toBe("quorum_not_met");
  });
});

describe("the submit intent", () => {
  it("signs the payload that matches the approved plan and closes the record", async () => {
    const locked = await lock({ plan, approvals });
    if (!locked.payload.ok) throw new Error("lock failed");

    const { status, payload } = await submit({
      policyId: locked.payload.data.policyId,
      approvedPlan: plan,
      submittedRows: rowsOf(plan),
      tampered: false,
      submissionKey: "happy-submit",
    });

    expect(status).toBe(200);
    if (!payload.ok) throw new Error(`submit failed: ${payload.error}`);
    expect(payload.data.verdict.allowed).toBe(true);
    expect(payload.data.calldata).toBe(plan.calldata);
    expect(payload.data.planHash).toBe(plan.planHash);
    expect(payload.data.transactionHash).toBeDefined();
    expect(payload.data.policySource).toBe("held-from-lock");
    expect(payload.data.anchor?.note).toContain("not wired");
  });

  it("refuses one altered byte and broadcasts nothing", async () => {
    const locked = await lock({ plan, approvals });
    if (!locked.payload.ok) throw new Error("lock failed");

    const rows = rowsOf(plan);
    const tamperedRows = rows.map((row, index) =>
      index === rows.length - 1
        ? { ...row, amountMicros: String(BigInt(row.amountMicros) + 1n) }
        : row
    );

    const { status, payload } = await submit({
      policyId: locked.payload.data.policyId,
      approvedPlan: plan,
      submittedRows: tamperedRows,
      tampered: true,
      submissionKey: "tampered-submit",
    });

    expect(status).toBe(200);
    if (!payload.ok) throw new Error(`submit failed: ${payload.error}`);
    expect(payload.data.verdict.allowed).toBe(false);
    expect(payload.data.transactionHash).toBeUndefined();
    expect(payload.data.calldata).not.toBe(plan.calldata);
    expect(payload.data.verdict.reason).toContain("byte");
    expect(payload.data.verdict.reason).toContain("default_action DENY");
  });

  it("answers a repeated submission key from the ledger rather than sending twice", async () => {
    const locked = await lock({ plan, approvals });
    if (!locked.payload.ok) throw new Error("lock failed");

    const request = {
      policyId: locked.payload.data.policyId,
      approvedPlan: plan,
      submittedRows: rowsOf(plan),
      tampered: false,
      submissionKey: "replayed-submit",
    };

    const first = await submit(request);
    const second = await submit(request);

    if (!first.payload.ok || !second.payload.ok) throw new Error("submit failed");
    expect(second.payload.data).toEqual(first.payload.data);
  });

  // Audit C2. The route recompiles the policy from the plan the client echoes
  // when the vault is cold, so an unknown policy id still evaluates. The
  // backend workstream is making this path fail closed; when it does, this
  // test must be rewritten to expect a refusal.
  it("says the policy was recompiled when the vault never held it (audit C2, open)", async () => {
    const { payload } = await submit({
      policyId: "pol_never_installed",
      approvedPlan: plan,
      submittedRows: rowsOf(plan),
      tampered: false,
      submissionKey: "cold-vault-submit",
    });

    if (!payload.ok) throw new Error(`submit failed: ${payload.error}`);
    expect(payload.data.policySource).toBe("recompiled-from-approved-plan");
  });

  // Audit H7. blockers are checked on lock and not on submit, so a compliance
  // held row reaches payout calldata through a direct call. This test records
  // that gap so the fix is visible as a failing test rather than as a silent
  // change; when submit starts checking blockers, expect a 409 plan_blocked.
  it("does not yet refuse a plan whose blockers stopped the lock (audit H7, open)", async () => {
    const refusedAtLock = await lock({ plan: blockedPlan, approvals });
    expect(refusedAtLock.status).toBe(409);

    const { status, payload } = await submit({
      policyId: "pol_never_installed",
      approvedPlan: blockedPlan,
      submittedRows: rowsOf(blockedPlan),
      tampered: false,
      submissionKey: "blocked-row-submit",
    });

    expect(status).toBe(200);
    if (!payload.ok) throw new Error("submit answered an error envelope");
    expect(payload.data.verdict.allowed).toBe(true);
    expect(blockedPlan.blockers.length).toBeGreaterThan(0);
  });
});

describe("the edge of the route", () => {
  it("rejects a body that is not JSON without touching the core path", async () => {
    const response = await POST(
      new Request("http://detent.test/api/detent", {
        method: "POST",
        body: "{ this is not json",
      })
    );
    const payload: ApiResponse<never> = await response.json();

    expect(response.status).toBe(400);
    if (payload.ok) throw new Error("malformed JSON must not be accepted");
    expect(payload.error).toBe("invalid_input");
    expect(payload.hint).toContain("valid JSON");
  });

  it("rejects an unknown intent and names the field that failed", async () => {
    const response = await post({ intent: "drain", plan, approvals });
    const payload: ApiResponse<never> = await response.json();

    expect(response.status).toBe(400);
    if (payload.ok) throw new Error("an unknown intent must not be accepted");
    expect(payload.error).toBe("invalid_input");
    expect(payload.hint).toContain("intent");
  });

  it("names the offending row when a lock body carries a malformed address", async () => {
    const broken = {
      ...plan,
      rows: plan.rows.map((row, index) =>
        index === 2 ? { ...row, address: "0xnope" } : row
      ),
    };

    const response = await post({ intent: "lock", plan: broken, approvals });
    const payload: ApiResponse<never> = await response.json();

    expect(response.status).toBe(400);
    if (payload.ok) throw new Error("a malformed address must not be accepted");
    expect(payload.hint).toContain("plan.rows.2.address");
  });

  it("never answers a failure with a provider body or a stack trace", async () => {
    const response = await post({ intent: "lock", plan, approvals: [] });
    const payload: ApiResponse<never> = await response.json();

    if (payload.ok) throw new Error("an empty quorum must not lock");
    expect(Object.keys(payload).sort()).toEqual(["error", "hint", "ok"]);
    expect(payload.hint).not.toContain("at ");
  });
});
