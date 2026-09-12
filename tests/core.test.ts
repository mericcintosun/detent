// The core path, on fixed inputs.
//
// Everything here runs against the seed register in fixtures/register.seed.json,
// so the plan is never empty and the calldata is deterministic. No network, no
// environment values: these are the two mechanisms the product is judged on, the
// edge validation and the policy evaluation.

import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import { holders } from "@/lib/data";
import { buildPlan } from "@/lib/plan";
import { compilePolicy, evaluatePolicy, quorumSatisfied } from "@/lib/privy";
import { firstIssuePath, lockBodySchema } from "@/lib/schemas";

const plan = buildPlan({ kind: "coupon", holders });
const policy = compilePolicy(plan);
const approvals = ["ops-controller", "risk-officer"];

/** Flip the final byte of a hex payload, which is the demo's tampered row. */
function flipLastByte(payload: Hex): Hex {
  const tail = payload.slice(-2);
  return `${payload.slice(0, -2)}${tail === "00" ? "01" : "00"}` as Hex;
}

describe("the edge", () => {
  it("parses a valid lock body", () => {
    expect(holders.length).toBeGreaterThan(0);
    expect(plan.rows.length).toBe(holders.length);

    const result = lockBodySchema.safeParse({
      intent: "lock",
      plan,
      approvals,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a malformed holder address and names the row", () => {
    const broken = {
      ...plan,
      rows: plan.rows.map((row, index) =>
        index === 0 ? { ...row, address: "0xnot-an-address" } : row
      ),
    };

    const result = lockBodySchema.safeParse({
      intent: "lock",
      plan: broken,
      approvals,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstIssuePath(result.error)).toBe("plan.rows.0.address");
    }
  });
});

describe("the compiled policy", () => {
  it("allows the approved calldata", () => {
    const verdict = evaluatePolicy(policy, {
      to: plan.target,
      chainId: plan.chainId,
      data: plan.calldata,
    });

    expect(verdict.allowed).toBe(true);
    expect(verdict.ruleName).toBe(policy.rules[0].name);
  });

  it("denies one altered byte and names the offset", () => {
    const tampered = flipLastByte(plan.calldata);
    const expectedOffset = (plan.calldata.length - 4) / 2;

    const verdict = evaluatePolicy(policy, {
      to: plan.target,
      chainId: plan.chainId,
      data: tampered,
    });

    expect(verdict.allowed).toBe(false);
    expect(verdict.failedCondition?.field).toBe("data");
    expect(verdict.failedCondition?.operator).toBe("eq");
    expect(verdict.reason).toContain(`byte ${expectedOffset}`);
  });

  it("denies a wrong chain id on the chain_id condition", () => {
    const verdict = evaluatePolicy(policy, {
      to: plan.target,
      chainId: plan.chainId + 1,
      data: plan.calldata,
    });

    expect(verdict.allowed).toBe(false);
    expect(verdict.failedCondition?.field).toBe("chain_id");
    expect(verdict.reason).toContain("default_action DENY");
  });
});

describe("the key quorum", () => {
  it("does not count the same signer twice", () => {
    expect(quorumSatisfied(["a", "a"])).toBe(false);
  });

  it("opens on two distinct signers", () => {
    expect(quorumSatisfied(["a", "b"])).toBe(true);
  });
});
