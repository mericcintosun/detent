// The backend path, on fixed inputs.
//
// Everything here runs against the seed register in fixtures/register.seed.json
// with no Privy credentials and no PlanAnchor address, so no test in this file
// touches the network. One regression test per finding in docs/AUDIT.md that the
// backend workstream fixed, named by its id.
//
// The route itself is exercised through its exported POST handler with a real
// Request, because the two critical findings (C2, C3) are route behaviour and an
// assertion on a helper would not have caught either of them.

import type { Hex } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/detent/route";
import { holders } from "@/lib/data";
import {
  clampAbandonReason,
  isTransactionHash,
  settlePlan,
} from "@/lib/anchor";
import { buildPlan } from "@/lib/plan";
import {
  policyInstallRequest,
  resolveApprovals,
  submitTransaction,
  syntheticReference,
  walletPolicyPatchRequest,
  walletReadRequest,
  compilePolicy,
} from "@/lib/privy";
import {
  MAX_ROWS,
  detentRequestSchema,
  submitBodySchema,
} from "@/lib/schemas";
import {
  anchorGuard,
  createBoundedStore,
  lockVault,
  planRecordMemo,
  rateLimiter,
} from "@/lib/store";
import type { ApiResponse, PolicyInstallation, SubmitResult } from "@/lib/types";

const plan = buildPlan({ kind: "coupon", holders });
const approvals = ["ops-controller", "risk-officer"];

const includedRows = plan.rows
  .filter((row) => row.included)
  .map((row) => ({ address: row.address, amountMicros: row.amountMicros }));

/** One client bucket per test, so the rate limiter never crosses tests. */
function post(body: unknown, address: string): Promise<Response> {
  return POST(
    new Request("https://detent.test/api/detent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": address,
      },
      body: JSON.stringify(body),
    })
  );
}

async function lock(address: string): Promise<PolicyInstallation> {
  const response = await post(
    { intent: "lock", plan, approvals },
    address
  );
  const payload = (await response.json()) as ApiResponse<PolicyInstallation>;
  if (!payload.ok) {
    throw new Error(`lock failed: ${payload.error} ${payload.hint}`);
  }
  return payload.data;
}

describe("C1, the policy is bound to the wallet", () => {
  it("shapes the attach as a PATCH on the wallet with one policy id", () => {
    const request = walletPolicyPatchRequest("wlt_treasury", ["pol_abc"]);

    expect(request.method).toBe("PATCH");
    expect(request.path).toBe("/v1/wallets/wlt_treasury");
    expect(JSON.parse(request.body ?? "{}")).toEqual({
      policy_ids: ["pol_abc"],
    });
  });

  it("detaches by writing the wallet's previous policy ids back", () => {
    const request = walletPolicyPatchRequest("wlt_treasury", ["pol_house"]);
    expect(JSON.parse(request.body ?? "{}")).toEqual({
      policy_ids: ["pol_house"],
    });

    const cleared = walletPolicyPatchRequest("wlt_treasury", []);
    expect(JSON.parse(cleared.body ?? "{}")).toEqual({ policy_ids: [] });
  });

  it("reads the wallet before the attach, with no body", () => {
    const request = walletReadRequest("wlt_treasury");

    expect(request.method).toBe("GET");
    expect(request.path).toBe("/v1/wallets/wlt_treasury");
    expect(request.body).toBeUndefined();
  });

  it("installs the policy under the key quorum with default_action DENY", () => {
    const request = policyInstallRequest(compilePolicy(plan), "kq_two");
    const body = JSON.parse(request.body ?? "{}") as {
      owner: { key_quorum_id: string };
      default_action: string;
      rules: Array<{ conditions: unknown[] }>;
    };

    expect(request.method).toBe("POST");
    expect(request.path).toBe("/v1/policies");
    expect(body.owner).toEqual({ key_quorum_id: "kq_two" });
    expect(body.default_action).toBe("DENY");
    expect(body.rules[0].conditions).toHaveLength(4);
  });
});

describe("C2, the server holds the authority", () => {
  it("refuses a submit it holds no lock for instead of recompiling", async () => {
    const response = await post(
      {
        intent: "submit",
        lockId: "lok_never_issued_by_this_server",
        submittedRows: includedRows,
      },
      "10.0.0.1"
    );
    const payload = (await response.json()) as ApiResponse<SubmitResult>;

    expect(response.status).toBe(409);
    expect(payload.ok).toBe(false);
    if (!payload.ok) {
      expect(payload.error).toBe("lock_unknown");
      expect(payload.hint).toContain("Lock the plan again");
    }
  });

  it("never accepts a policy or an approved plan from the request body", () => {
    const rejected = submitBodySchema.safeParse({
      intent: "submit",
      policyId: "pol_attacker",
      approvedPlan: plan,
      submittedRows: includedRows,
      tampered: false,
      submissionKey: "anything",
    });
    expect(rejected.success).toBe(false);

    const accepted = submitBodySchema.safeParse({
      intent: "submit",
      lockId: "lok_abc",
      policyId: "pol_attacker",
      approvedPlan: plan,
      tampered: false,
      submittedRows: includedRows,
    });
    expect(accepted.success).toBe(true);
    if (accepted.success) {
      expect(Object.keys(accepted.data).sort()).toEqual([
        "intent",
        "lockId",
        "submittedRows",
      ]);
    }
  });

  it("mints a lock id the caller cannot guess or address", async () => {
    const installation = await lock("10.0.0.2");

    expect(installation.lockId).toMatch(/^lok_[A-Za-z0-9_-]{32}$/);
    expect(installation.lockId).not.toContain(installation.policyId);
    expect(installation.planHash).toBe(plan.planHash);
    expect(lockVault.recall(installation.lockId)?.approvedCalldata).toBe(
      plan.calldata
    );
    expect(lockVault.recall("lok_not_this_one")).toBeUndefined();
  });

  it("refuses a lock whose plan hash is not the one the server derives", async () => {
    const forged = {
      ...plan,
      planHash: `0x${"ab".repeat(32)}` as Hex,
    };
    const response = await post(
      { intent: "lock", plan: forged, approvals },
      "10.0.0.3"
    );
    const payload = (await response.json()) as ApiResponse<PolicyInstallation>;

    expect(response.status).toBe(409);
    if (!payload.ok) {
      expect(payload.error).toBe("plan_mismatch");
    }
  });

  it("refuses a lock whose calldata is not the one the server derives", async () => {
    const forged = {
      ...plan,
      calldata: `${plan.calldata.slice(0, -2)}ff` as Hex,
    };
    const response = await post(
      { intent: "lock", plan: forged, approvals },
      "10.0.0.4"
    );
    const payload = (await response.json()) as ApiResponse<PolicyInstallation>;

    expect(response.status).toBe(409);
    if (!payload.ok) {
      expect(payload.error).toBe("plan_mismatch");
    }
  });
});

describe("C3, the signer set is server side", () => {
  it("refuses two strings that are not registered officers", () => {
    const resolution = resolveApprovals(["a", "b"]);

    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.reason).toContain("approver registry");
      expect(resolution.reason).not.toContain('"a"');
    }
  });

  it("refuses the same officer twice", () => {
    const resolution = resolveApprovals(["ops-controller", "ops-controller"]);

    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.reason).toContain("twice");
    }
  });

  it("refuses a single officer", () => {
    expect(resolveApprovals(["ops-controller"]).ok).toBe(false);
  });

  it("accepts two distinct registered officers and names them", () => {
    const resolution = resolveApprovals(approvals);

    expect(resolution.ok).toBe(true);
    if (resolution.ok) {
      expect(resolution.signers.map((signer) => signer.id)).toEqual([
        "ops-controller",
        "risk-officer",
      ]);
    }
  });

  it("refuses the lock and stores who approved when it opens", async () => {
    const refused = await post(
      { intent: "lock", plan, approvals: ["a", "b"] },
      "10.0.0.5"
    );
    const payload = (await refused.json()) as ApiResponse<PolicyInstallation>;
    expect(refused.status).toBe(409);
    if (!payload.ok) {
      expect(payload.error).toBe("quorum_not_met");
    }

    const installation = await lock("10.0.0.6");
    expect(installation.approvedBy.map((signer) => signer.id)).toEqual([
      "ops-controller",
      "risk-officer",
    ]);
    expect(
      lockVault.recall(installation.lockId)?.approvedBy.map((s) => s.keyId)
    ).toEqual(["key_quorum_signer_a", "key_quorum_signer_b"]);
  });
});

describe("H2, the keyless receipt says it is synthetic", () => {
  it("returns a synthetic receipt and no transaction hash", async () => {
    const result = await submitTransaction({
      policy: compilePolicy(plan),
      policyId: "pol_local",
      walletId: "wlt_local",
      previousPolicyIds: [],
      to: plan.target,
      chainId: plan.chainId,
      planHash: plan.planHash,
      data: plan.calldata,
    });

    expect(result.verdict.allowed).toBe(true);
    expect(result.transactionHash).toBeUndefined();
    expect(result.receipt?.kind).toBe("synthetic");
    if (result.receipt?.kind === "synthetic") {
      expect("transactionHash" in result.receipt).toBe(false);
      expect(result.receipt.reference).toBe(
        syntheticReference(plan.planHash, plan.calldata)
      );
      expect(result.receipt.note).toContain("No key signed this");
    }
  });

  it("no longer derives anything that reads like a hash from the calldata", () => {
    const stub = `0x${plan.calldata.slice(2, 66).padEnd(64, "0")}`;
    expect(syntheticReference(plan.planHash, plan.calldata)).not.toBe(stub);
  });

  it("returns no receipt at all when the payload is refused", async () => {
    const result = await submitTransaction({
      policy: compilePolicy(plan),
      policyId: "pol_local",
      walletId: "wlt_local",
      previousPolicyIds: [],
      to: plan.target,
      chainId: plan.chainId,
      planHash: plan.planHash,
      data: `${plan.calldata.slice(0, -2)}ff` as Hex,
    });

    expect(result.verdict.allowed).toBe(false);
    expect(result.receipt).toBeUndefined();
    expect(result.transactionHash).toBeUndefined();
  });
});

describe("M7, the verdict says which engine decided", () => {
  it("labels a keyless decision as the local mirror", async () => {
    const result = await submitTransaction({
      policy: compilePolicy(plan),
      policyId: "pol_local",
      walletId: "wlt_local",
      previousPolicyIds: [],
      to: plan.target,
      chainId: plan.chainId,
      planHash: plan.planHash,
      data: plan.calldata,
    });

    expect(result.decidedBy).toBe("local-mirror");
    expect(result.live).toBe(false);
  });
});

describe("the send, end to end with no credentials", () => {
  it("allows the approved payload and marks it untampered", async () => {
    const installation = await lock("10.0.1.1");
    const response = await post(
      {
        intent: "submit",
        lockId: installation.lockId,
        submittedRows: includedRows,
        tampered: true,
      },
      "10.0.1.1"
    );
    const payload = (await response.json()) as ApiResponse<SubmitResult>;

    expect(payload.ok).toBe(true);
    if (payload.ok) {
      expect(payload.data.verdict.allowed).toBe(true);
      // M6: the flag is derived from the bytes, not read from the body above.
      expect(payload.data.tampered).toBe(false);
      expect(payload.data.policySource).toBe("held-from-lock");
      expect(payload.data.receipt?.kind).toBe("synthetic");
    }
  });

  it("M6: derives the tampered flag from the submitted bytes", async () => {
    const installation = await lock("10.0.1.2");
    const altered = includedRows.map((row, index) =>
      index === 0
        ? { ...row, amountMicros: String(BigInt(row.amountMicros) + 1n) }
        : row
    );

    const response = await post(
      {
        intent: "submit",
        lockId: installation.lockId,
        submittedRows: altered,
        tampered: false,
      },
      "10.0.1.2"
    );
    const payload = (await response.json()) as ApiResponse<SubmitResult>;

    expect(payload.ok).toBe(true);
    if (payload.ok) {
      expect(payload.data.tampered).toBe(true);
      expect(payload.data.verdict.allowed).toBe(false);
      expect(payload.data.verdict.reason).toContain("diverges at byte");
      expect(payload.data.receipt).toBeUndefined();
    }
  });

  it("answers a repeated send from the ledger without sending again", async () => {
    const installation = await lock("10.0.1.3");
    const send = () =>
      post(
        {
          intent: "submit",
          lockId: installation.lockId,
          submittedRows: includedRows,
        },
        "10.0.1.3"
      );

    const first = (await (await send()).json()) as ApiResponse<SubmitResult>;
    const second = (await (await send()).json()) as ApiResponse<SubmitResult>;

    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.data).toEqual(first.data);
    }
  });
});

describe("H7, blockers are enforced on both intents", () => {
  const held = holders.find((holder) => holder.compliance !== "clear");

  it("refuses a lock that forces a held row back in", async () => {
    expect(held).toBeDefined();
    const forcedPlan = buildPlan({
      kind: "coupon",
      holders,
      forced: [held?.id ?? ""],
    });
    expect(forcedPlan.blockers.length).toBeGreaterThan(0);

    const response = await post(
      {
        intent: "lock",
        plan: forcedPlan,
        selection: { kind: "coupon", deferred: [], forced: [held?.id ?? ""] },
        approvals,
      },
      "10.0.2.1"
    );
    const payload = (await response.json()) as ApiResponse<PolicyInstallation>;

    expect(response.status).toBe(409);
    if (!payload.ok) {
      expect(payload.error).toBe("plan_blocked");
      expect(payload.blockers?.length).toBeGreaterThan(0);
    }
  });

  it("refuses a submit under a lock whose plan carries blockers", async () => {
    const forcedPlan = buildPlan({
      kind: "coupon",
      holders,
      forced: [held?.id ?? ""],
    });

    // Seeded straight into the vault, because the lock intent will not open one:
    // this is the path a blocked row would have taken to payout calldata.
    const seeded = lockVault.open({
      policyId: "pol_seeded",
      policy: compilePolicy(forcedPlan),
      plan: forcedPlan,
      selection: { kind: "coupon", deferred: [], forced: [held?.id ?? ""] },
      approvedCalldata: forcedPlan.calldata,
      approvedBy: [],
      walletId: "wlt_local",
      previousPolicyIds: [],
      policyAttached: false,
      live: false,
    });

    const response = await post(
      {
        intent: "submit",
        lockId: seeded.lockId,
        submittedRows: forcedPlan.rows
          .filter((row) => row.included)
          .map((row) => ({
            address: row.address,
            amountMicros: row.amountMicros,
          })),
      },
      "10.0.2.2"
    );
    const payload = (await response.json()) as ApiResponse<SubmitResult>;

    expect(response.status).toBe(409);
    if (!payload.ok) {
      expect(payload.error).toBe("plan_blocked");
    }
  });
});

describe("H6, the anchor write is idempotent and bounded", () => {
  it("reuses the receipt for a plan hash it already anchored", () => {
    const receipt = {
      anchored: true,
      transactionHash: `0x${"11".repeat(32)}` as Hex,
      note: "anchored once",
    };
    expect(anchorGuard.recall(plan.planHash)).toBeUndefined();
    anchorGuard.remember(plan.planHash, receipt);
    expect(anchorGuard.recall(plan.planHash)).toBe(receipt);
  });

  it("stops claiming writes once the budget for the window is spent", () => {
    let claims = 0;
    while (anchorGuard.claimWrite()) {
      claims += 1;
      if (claims > 1_000) break;
    }
    expect(claims).toBeLessThanOrEqual(25);
    expect(anchorGuard.claimWrite()).toBe(false);
  });
});

describe("H8, the store expires and is bounded", () => {
  it("forgets an entry once its TTL has passed", () => {
    let clock = 0;
    const store = createBoundedStore<string>({
      ttlMs: 100,
      maxEntries: 10,
      now: () => clock,
    });

    store.set("key", "value");
    clock = 99;
    expect(store.get("key")).toBe("value");
    clock = 101;
    expect(store.get("key")).toBeUndefined();
  });

  it("evicts the oldest entry past the ceiling", () => {
    const store = createBoundedStore<number>({ ttlMs: 60_000, maxEntries: 2 });

    store.set("a", 1);
    store.set("b", 2);
    store.set("c", 3);

    expect(store.size).toBe(2);
    expect(store.get("a")).toBeUndefined();
    expect(store.get("c")).toBe(3);
  });

  it("keys the lock vault on values the server minted", () => {
    const first = lockVault.open({
      policyId: "pol_a",
      policy: compilePolicy(plan),
      plan,
      selection: { kind: "coupon", deferred: [], forced: [] },
      approvedCalldata: plan.calldata,
      approvedBy: [],
      walletId: "wlt_local",
      previousPolicyIds: [],
      policyAttached: false,
      live: false,
    });
    const second = lockVault.open({
      policyId: "pol_a",
      policy: compilePolicy(plan),
      plan,
      selection: { kind: "coupon", deferred: [], forced: [] },
      approvedCalldata: plan.calldata,
      approvedBy: [],
      walletId: "wlt_local",
      previousPolicyIds: [],
      policyAttached: false,
      live: false,
    });

    // Same plan, same policy id, two different lock ids: one caller cannot
    // address, overwrite or pre-seed another caller's record.
    expect(first.lockId).not.toBe(second.lockId);
  });
});

describe("M1, request arrays are capped", () => {
  it("rejects a plan with more rows than the cap", () => {
    const row = plan.rows[0];
    const flooded = {
      intent: "lock",
      plan: { ...plan, rows: Array.from({ length: MAX_ROWS + 1 }, () => row) },
      approvals,
    };

    expect(detentRequestSchema.safeParse(flooded).success).toBe(false);
  });

  it("rejects more approvals than the cap", () => {
    const flooded = {
      intent: "lock",
      plan,
      approvals: Array.from({ length: 9 }, (_, index) => `signer-${index}`),
    };

    expect(detentRequestSchema.safeParse(flooded).success).toBe(false);
  });

  it("rejects more submitted rows than the cap", () => {
    const flooded = {
      intent: "submit",
      lockId: "lok_abc",
      submittedRows: Array.from({ length: MAX_ROWS + 1 }, () => includedRows[0]),
    };

    expect(detentRequestSchema.safeParse(flooded).success).toBe(false);
  });
});

describe("M2, the route is rate limited", () => {
  it("refuses past the budget and says how long to wait", () => {
    const key = `test:${Math.random()}`;
    expect(rateLimiter.consume(key, 2).allowed).toBe(true);
    expect(rateLimiter.consume(key, 2).allowed).toBe(true);

    const refused = rateLimiter.consume(key, 2);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("answers the lock intent with 429 past its budget", async () => {
    const address = "10.0.3.1";
    let status = 200;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await post({ intent: "lock", plan, approvals }, address);
      status = response.status;
      if (status === 429) break;
    }

    expect(status).toBe(429);
  });
});

describe("M3, the record read is memoised", () => {
  it("answers a repeated hash from the memo", () => {
    const hash = `0x${"cd".repeat(32)}`;
    const record = { state: "anchored", note: "held" } as const;

    expect(planRecordMemo.recall(hash)).toBeUndefined();
    planRecordMemo.remember(hash, record);
    expect(planRecordMemo.recall(hash)).toBe(record);
  });
});

describe("M4, settle takes a real transaction hash or nothing", () => {
  it("recognises only a 32 byte hash", () => {
    expect(isTransactionHash(`0x${"ab".repeat(32)}`)).toBe(true);
    expect(isTransactionHash("0xabc")).toBe(false);
    expect(isTransactionHash(undefined)).toBe(false);
  });

  it("refuses to settle a short reference instead of padding it", async () => {
    const receipt = await settlePlan(plan.planHash, "0xabc");

    expect(receipt.anchored).toBe(false);
    expect(receipt.note).toContain("nothing to settle with");
    expect(receipt.transactionHash).toBeUndefined();
  });

  it("refuses to settle on a zero word, which the contract reverts on", async () => {
    const receipt = await settlePlan(plan.planHash, `0x${"00".repeat(32)}`);

    expect(receipt.anchored).toBe(false);
    expect(receipt.note).toContain("nothing to settle with");
  });
});

describe("the abandon reason the contract will accept", () => {
  it("never sends an empty reason", () => {
    expect(clampAbandonReason("   ")).toBe("closed without a stated reason");
  });

  it("clamps a long reason to 256 bytes", () => {
    const clamped = clampAbandonReason("x".repeat(400));
    expect(new TextEncoder().encode(clamped).length).toBe(256);
  });

  it("does not cut a multi byte character in half", () => {
    const clamped = clampAbandonReason("é".repeat(200));
    expect(new TextEncoder().encode(clamped).length).toBeLessThanOrEqual(256);
    expect(clamped.endsWith("é")).toBe(true);
  });

  it("passes a normal reason through untouched", () => {
    expect(clampAbandonReason("policy refused the submitted payload")).toBe(
      "policy refused the submitted payload"
    );
  });
});

describe("the plan target follows the live token", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("targets the seed token on the cached register", () => {
    expect(plan.target.toLowerCase()).toBe(
      "0x4b7d0e91c358af260d1e7b04c93f5a68d20e17bc"
    );
  });

  it("targets NEXT_PUBLIC_ATS_TOKEN_ADDRESS in real mode", async () => {
    const live = "0x00000000000000000000000000000000004a1b2c";
    vi.stubEnv("NEXT_PUBLIC_ADAPTER_MODE", "real");
    vi.stubEnv("NEXT_PUBLIC_ATS_TOKEN_ADDRESS", live);
    vi.resetModules();

    const fresh = await import("@/lib/plan");
    const livePlan = fresh.buildPlan({ kind: "coupon", holders });

    expect(fresh.planTarget()).toBe(live);
    expect(livePlan.target).toBe(live);
    // The hash covers the target, so a live plan never collides with a seed one.
    expect(livePlan.planHash).not.toBe(plan.planHash);
  });
});
