// The API route, end to end.
//
// App Router handlers are plain functions, so POST is imported and invoked with
// a constructed Request. No server, no network: vitest.config.ts pins the Privy
// and PlanAnchor environment empty, which puts lib/privy.ts on its local mirror
// and lib/anchor.ts on its unwired path.
//
// The server derives the plan from the register snapshot, so the snapshot is
// read through a thin mock of lib/register.ts that delegates to the real seed
// register. A test that needs the register to move under an open lock patches
// the treasury cover for one call; nothing else about the snapshot is faked.
//
// Every call carries its own client address, because the route rate limits per
// address and a shared bucket would make one test depend on how many calls the
// tests before it made.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/detent/route";
import { holders } from "@/lib/data";
import { buildPlan, type Plan } from "@/lib/plan";
import type * as RegisterModule from "@/lib/register";
import type { ApiResponse, PolicyInstallation, SubmitResult } from "@/lib/types";

const register = vi.hoisted(() => ({ treasuryMicros: undefined as string | undefined }));

vi.mock("@/lib/register", async (importOriginal) => {
  const actual = await importOriginal<typeof RegisterModule>();
  return {
    ...actual,
    async getRegisterSnapshot() {
      const snapshot = await actual.getRegisterSnapshot();
      return register.treasuryMicros === undefined
        ? snapshot
        : {
            ...snapshot,
            treasury: { ...snapshot.treasury, balanceMicros: register.treasuryMicros },
          };
    },
  };
});

const approvals = ["ops-controller", "risk-officer"];
const plan = buildPlan({ kind: "coupon", holders });
const clearSelection = { kind: "coupon" as const, deferred: [], forced: [] };

/** A plan that forces a compliance held holder back into the payout rows. */
const blockedSelection = { kind: "coupon" as const, deferred: [], forced: ["h-05"] };
const blockedPlan = buildPlan({ kind: "coupon", holders, forced: ["h-05"] });

let clientCounter = 0;

function post(body: unknown, address = `198.51.100.${++clientCounter}`): Promise<Response> {
  return POST(
    new Request("http://detent.test/api/detent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": address },
      body: JSON.stringify(body),
    })
  );
}

function rowsOf(source: Plan) {
  return source.rows
    .filter((row) => row.included)
    .map((row) => ({ address: row.address, amountMicros: row.amountMicros }));
}

/** The approved rows with the last amount moved by one micro unit. */
function tamperedRowsOf(source: Plan) {
  const rows = rowsOf(source);
  return rows.map((row, index) =>
    index === rows.length - 1
      ? { ...row, amountMicros: String(BigInt(row.amountMicros) + 1n) }
      : row
  );
}

async function lock(
  body: Record<string, unknown> = {},
  address?: string
): Promise<{ status: number; payload: ApiResponse<PolicyInstallation> }> {
  const response = await post(
    { intent: "lock", plan, selection: clearSelection, approvals, ...body },
    address
  );
  return { status: response.status, payload: await response.json() };
}

async function lockId(): Promise<string> {
  const { payload } = await lock();
  if (!payload.ok) throw new Error(`lock failed: ${payload.error}`);
  return payload.data.lockId;
}

async function submit(
  id: string,
  submittedRows: ReturnType<typeof rowsOf>
): Promise<{ status: number; payload: ApiResponse<SubmitResult> }> {
  const response = await post({ intent: "submit", lockId: id, submittedRows });
  return { status: response.status, payload: await response.json() };
}

// The route narrates the core path on console.info and console.warn. That is
// wanted in a demo and noise in a test report. Errors are left alone: an
// unexpected one should be visible in the run.
beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  register.treasuryMicros = undefined;
  vi.restoreAllMocks();
});

describe("the lock intent", () => {
  it("answers an approved plan with a server minted lock and a policy that pins the calldata", async () => {
    const { status, payload } = await lock();

    expect(status).toBe(200);
    if (!payload.ok) throw new Error(`lock failed: ${payload.error}`);

    const rule = payload.data.policy.rules[0];
    const exact = rule.conditions.find(
      (condition) => condition.field === "data" && condition.operator === "eq"
    );

    expect(payload.data.policy.default_action).toBe("DENY");
    expect(exact?.value).toBe(plan.calldata);
    expect(payload.data.planHash).toBe(plan.planHash);
    expect(payload.data.approvedBy.map((signer) => signer.id)).toEqual(approvals);
    expect(payload.data.lockId.length).toBeGreaterThan(0);
    expect(payload.data.lockId).not.toContain(plan.planHash.slice(2, 10));
  });

  it("mints a different lock id for every lock of the same plan", async () => {
    expect(await lockId()).not.toBe(await lockId());
  });

  it("reports what the anchor did instead of failing the lock when PlanAnchor is unwired", async () => {
    const { payload } = await lock();
    if (!payload.ok) throw new Error(`lock failed: ${payload.error}`);

    expect(payload.data.anchor?.anchored).toBe(false);
    expect(payload.data.anchor?.transactionHash).toBeUndefined();
    expect(payload.data.anchor?.note).toContain("not wired");
  });

  it("refuses a plan that still carries blockers and names them", async () => {
    const { status, payload } = await lock({
      plan: blockedPlan,
      selection: blockedSelection,
    });

    expect(status).toBe(409);
    if (payload.ok) throw new Error("a blocked plan must not lock");
    expect(payload.error).toBe("plan_blocked");
    expect(payload.blockers?.join(" ")).toContain("held by the compliance module");
  });

  it("refuses a plan the server does not derive from the register", async () => {
    // The last calldata byte of the seed plan is 0xe0, so this changes one byte.
    const forged = { ...plan, calldata: `${plan.calldata.slice(0, -2)}ff` as const };
    expect(forged.calldata).not.toBe(plan.calldata);
    const { status, payload } = await lock({ plan: forged });

    expect(status).toBe(409);
    if (payload.ok) throw new Error("a forged plan must not lock");
    expect(payload.error).toBe("plan_mismatch");
  });

  it("refuses the same officer twice as a quorum", async () => {
    const { status, payload } = await lock({
      approvals: ["ops-controller", "ops-controller"],
    });

    expect(status).toBe(409);
    if (payload.ok) throw new Error("one officer must not open the policy");
    expect(payload.error).toBe("quorum_not_met");
  });

  // Regression for audit C3: any two distinct strings used to open the lock.
  it("refuses approvals that do not name officers in the registry (audit C3)", async () => {
    const { status, payload } = await lock({ approvals: ["a", "b"] });

    expect(status).toBe(409);
    if (payload.ok) throw new Error("unregistered approvers must not open the policy");
    expect(payload.error).toBe("quorum_not_met");
  });

  // Regression for audit H6: the lock writes on chain with the operator key, so
  // one address looping on it is cut off and told when to come back.
  it("rate limits repeated locks from one address and says when to retry (audit H6)", async () => {
    const address = "203.0.113.77";
    const statuses: number[] = [];
    let last: Response | undefined;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      last = await post(
        { intent: "lock", plan, selection: clearSelection, approvals },
        address
      );
      statuses.push(last.status);
    }

    expect(statuses[0]).toBe(200);
    expect(statuses.at(-1)).toBe(429);
    expect(Number(last?.headers.get("Retry-After"))).toBeGreaterThan(0);
    const payload: ApiResponse<never> = await last!.json();
    if (payload.ok) throw new Error("a limited request must not succeed");
    expect(payload.error).toBe("rate_limited");
  });
});

describe("the submit intent", () => {
  it("signs the approved payload and says the receipt is synthetic when no key signed", async () => {
    const { status, payload } = await submit(await lockId(), rowsOf(plan));

    expect(status).toBe(200);
    if (!payload.ok) throw new Error(`submit failed: ${payload.error}`);
    expect(payload.data.verdict.allowed).toBe(true);
    expect(payload.data.calldata).toBe(plan.calldata);
    expect(payload.data.planHash).toBe(plan.planHash);
    expect(payload.data.tampered).toBe(false);
    expect(payload.data.policySource).toBe("held-from-lock");
    expect(payload.data.decidedBy).toBe("local-mirror");
    expect(payload.data.receipt?.kind).toBe("synthetic");
    expect(payload.data.transactionHash).toBeUndefined();
  });

  it("does not settle the on chain record on a synthetic receipt", async () => {
    const { payload } = await submit(await lockId(), rowsOf(plan));
    if (!payload.ok) throw new Error(`submit failed: ${payload.error}`);

    expect(payload.data.anchor?.anchored).toBe(false);
    expect(payload.data.anchor?.note).toContain("nothing to settle with");
  });

  it("refuses one altered byte, derives the tampered flag itself and signs nothing", async () => {
    const { status, payload } = await submit(await lockId(), tamperedRowsOf(plan));

    expect(status).toBe(200);
    if (!payload.ok) throw new Error(`submit failed: ${payload.error}`);
    expect(payload.data.verdict.allowed).toBe(false);
    expect(payload.data.tampered).toBe(true);
    expect(payload.data.receipt).toBeUndefined();
    expect(payload.data.transactionHash).toBeUndefined();
    expect(payload.data.verdict.reason).toContain("byte");
  });

  it("leaves the lock open after a refusal so the approved plan can still be sent", async () => {
    const id = await lockId();

    const refused = await submit(id, tamperedRowsOf(plan));
    const retried = await submit(id, rowsOf(plan));

    if (!refused.payload.ok || !retried.payload.ok) throw new Error("submit failed");
    expect(refused.payload.data.verdict.allowed).toBe(false);
    expect(retried.payload.data.verdict.allowed).toBe(true);
  });

  it("spends the lock on an allowed send, so a second payload finds no lock", async () => {
    const id = await lockId();

    const allowed = await submit(id, rowsOf(plan));
    const afterwards = await submit(id, tamperedRowsOf(plan));

    if (!allowed.payload.ok) throw new Error("submit failed");
    expect(allowed.payload.data.verdict.allowed).toBe(true);
    expect(afterwards.status).toBe(409);
    if (afterwards.payload.ok) throw new Error("a spent lock must not sign again");
    expect(afterwards.payload.error).toBe("lock_unknown");
  });

  it("answers a repeated submission from the ledger rather than sending twice", async () => {
    const id = await lockId();

    const first = await submit(id, rowsOf(plan));
    const second = await submit(id, rowsOf(plan));

    if (!first.payload.ok || !second.payload.ok) throw new Error("submit failed");
    expect(second.payload.data).toEqual(first.payload.data);
  });

  // Regression for audit C2: a cold vault used to recompile the policy from the
  // plan the client echoed, which approved whatever the client sent.
  it("fails closed with lock_unknown when the server holds no lock for the id (audit C2)", async () => {
    const { status, payload } = await submit("lock_never_issued", rowsOf(plan));

    expect(status).toBe(409);
    if (payload.ok) throw new Error("an unknown lock must not sign");
    expect(payload.error).toBe("lock_unknown");
  });

  // Regression for audit H7: blockers were checked on lock and never on submit.
  it("refuses a compliance held row at submit because no lock can be opened for it (audit H7)", async () => {
    const refusedAtLock = await lock({ plan: blockedPlan, selection: blockedSelection });
    expect(refusedAtLock.status).toBe(409);

    const { status, payload } = await submit("lock_never_issued", rowsOf(blockedPlan));

    expect(status).toBe(409);
    if (payload.ok) throw new Error("a blocked row must not reach payout calldata");
    expect(payload.error).toBe("lock_unknown");
  });

  it("refuses at submit with plan_blocked when blockers appear under an open lock (audit H7)", async () => {
    const id = await lockId();
    register.treasuryMicros = "1";

    const { status, payload } = await submit(id, rowsOf(plan));

    expect(status).toBe(409);
    if (payload.ok) throw new Error("a plan that became blocked must not sign");
    expect(payload.error).toBe("plan_blocked");
    expect(payload.blockers?.join(" ")).toContain("Treasury is short");
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
    const responses = [
      await post({ intent: "lock", plan, approvals: [] }),
      await post({ intent: "submit", lockId: "lock_never_issued", submittedRows: [] }),
    ];

    for (const response of responses) {
      const payload: ApiResponse<never> = await response.json();
      if (payload.ok) throw new Error("these requests must fail");
      expect(Object.keys(payload).sort()).toEqual(["error", "hint", "ok"]);
      // A stack frame, not the word "at": an indented "at " line, or a
      // (file:line:column) location.
      expect(payload.hint).not.toMatch(/^\s+at\s/m);
      expect(payload.hint).not.toMatch(/\([^()\s]+:\d+:\d+\)/);
    }
  });
});
