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
import { submissionLedger } from "@/lib/store";
import type { SubmitResult } from "@/lib/types";
import {
  deriveTreasuryKeyState,
  type TreasuryKeyInput,
} from "@/lib/wallet-state";

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

describe("the treasury cover", () => {
  it("blocks the plan when the supplied cover is under the draw", () => {
    const full = buildPlan({ kind: "coupon", holders });
    const short = String(BigInt(full.drawMicros) - 1n);

    const thin = buildPlan({
      kind: "coupon",
      holders,
      treasuryMicros: short,
    });

    expect(thin.treasuryMicros).toBe(short);
    expect(BigInt(thin.headroomMicros)).toBe(-1n);
    expect(thin.blockers.some((entry) => entry.startsWith("Treasury is short"))).toBe(
      true
    );
  });

  it("keeps the seed cover when none is supplied", () => {
    expect(BigInt(plan.headroomMicros)).toBeGreaterThanOrEqual(0n);
    expect(plan.blockers).toEqual([]);
  });
});

describe("the submission ledger", () => {
  it("answers a repeated key with the remembered result", () => {
    const key = `pol_test:${plan.planHash}:approved:${plan.calldata}:auto`;
    const remembered = {
      verdict: { allowed: true, ruleName: "test", reason: "matched" },
      transactionHash: "0xabc",
      policyRevoked: true,
      live: false,
      note: "first call",
      calldata: plan.calldata,
      tampered: false,
      policySource: "held-from-lock",
      planHash: plan.planHash,
    } satisfies SubmitResult;

    expect(submissionLedger.recall(key)).toBeUndefined();
    submissionLedger.remember(key, remembered);
    expect(submissionLedger.recall(key)).toBe(remembered);
    expect(submissionLedger.recall(`${key}:other`)).toBeUndefined();
  });
});

describe("the treasury key state", () => {
  const resting: TreasuryKeyInput = {
    privyLive: true,
    pending: null,
    locked: false,
    settlement: null,
    failure: null,
  };

  const settled = {
    allowed: true,
    transactionHash: "0xfeed",
    policySource: "held-from-lock" as const,
    chainRefused: false,
  };

  it("reads disconnected with no live credentials", () => {
    expect(deriveTreasuryKeyState({ ...resting, privyLive: false })).toBe(
      "disconnected"
    );
  });

  it("reads connecting while the policy install is in flight", () => {
    expect(deriveTreasuryKeyState({ ...resting, pending: "lock" })).toBe(
      "connecting"
    );
  });

  it("reads wrong-network when the chain is refused", () => {
    expect(
      deriveTreasuryKeyState({
        ...resting,
        settlement: { ...settled, transactionHash: undefined, chainRefused: true },
      })
    ).toBe("wrong-network");
    expect(
      deriveTreasuryKeyState({
        ...resting,
        failure: {
          code: "not_configured",
          hint: "Privy refused chain eip155:296 for this wallet.",
        },
      })
    ).toBe("wrong-network");
  });

  it("reads idle when the key is live and nothing is in flight", () => {
    expect(deriveTreasuryKeyState(resting)).toBe("idle");
  });

  it("reads tx-pending while the send is with the wallet", () => {
    expect(
      deriveTreasuryKeyState({ ...resting, pending: "send", locked: true })
    ).toBe("tx-pending");
  });

  it("reads tx-confirmed on an allowed verdict with a hash", () => {
    expect(
      deriveTreasuryKeyState({ ...resting, locked: true, settlement: settled })
    ).toBe("tx-confirmed");
  });

  it("reads tx-rejected when the policy refused the payload", () => {
    expect(
      deriveTreasuryKeyState({
        ...resting,
        locked: true,
        settlement: { ...settled, allowed: false, transactionHash: undefined },
      })
    ).toBe("tx-rejected");
  });

  it("reads tx-failed on an infrastructure code", () => {
    for (const code of ["upstream_error", "upstream_timeout", "parse_failure"] as const) {
      expect(
        deriveTreasuryKeyState({
          ...resting,
          failure: { code, hint: "The provider did not answer." },
        })
      ).toBe("tx-failed");
    }
  });
});
