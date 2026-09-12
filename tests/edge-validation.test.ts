// The edge, at its boundaries.
//
// lib/schemas.ts is the only thing standing between a request body and the
// plan engine, the policy compiler and the anchor. tests/core.test.ts covers
// the happy parse and one malformed address; this file covers the shapes that
// are easy to get wrong: the digit-string amounts, the hex widths, the missing
// and mistyped fields, the path a hint is built from, and the one boundary the
// audit says is absent.

import { describe, expect, it } from "vitest";
import { holders } from "@/lib/data";
import { buildPlan } from "@/lib/plan";
import {
  addressSchema,
  detentRequestSchema,
  firstIssuePath,
  hexSchema,
  microsSchema,
  planHashSchema,
  planSchema,
  submitBodySchema,
} from "@/lib/schemas";

const plan = buildPlan({ kind: "coupon", holders });
const approvals = ["ops-controller", "risk-officer"];

/** The path the API route would put in its hint for this body. */
function pathFor(body: unknown): string {
  const result = detentRequestSchema.safeParse(body);
  if (result.success) throw new Error("the body parsed, so there is no path");
  return firstIssuePath(result.error);
}

describe("the amount format", () => {
  it("accepts only decimal digit strings, never numbers or signs", () => {
    expect(microsSchema.safeParse("0").success).toBe(true);
    expect(microsSchema.safeParse("35408875000").success).toBe(true);
    expect(microsSchema.safeParse("-1").success).toBe(false);
    expect(microsSchema.safeParse("1.5").success).toBe(false);
    expect(microsSchema.safeParse("1e9").success).toBe(false);
    expect(microsSchema.safeParse("").success).toBe(false);
    expect(microsSchema.safeParse(42).success).toBe(false);
  });

  it("allows the headroom alone to be negative, because a short treasury is a state", () => {
    const short = buildPlan({
      kind: "coupon",
      holders,
      treasuryMicros: "1",
    });

    expect(short.headroomMicros.startsWith("-")).toBe(true);
    expect(planSchema.safeParse(short).success).toBe(true);
  });
});

describe("the hex widths", () => {
  it("takes an empty payload as hex but not as an address or a plan hash", () => {
    expect(hexSchema.safeParse("0x").success).toBe(true);
    expect(addressSchema.safeParse("0x").success).toBe(false);
    expect(planHashSchema.safeParse("0x").success).toBe(false);
  });

  it("rejects an address that is one nibble short or one nibble long", () => {
    const body = "7a1f4c0b9e2d8a63c5b0e14f7d2c93ae6b085d41";

    expect(addressSchema.safeParse(`0x${body}`).success).toBe(true);
    expect(addressSchema.safeParse(`0x${body.slice(1)}`).success).toBe(false);
    expect(addressSchema.safeParse(`0x${body}a`).success).toBe(false);
    expect(addressSchema.safeParse(body).success).toBe(false);
  });

  it("accepts a checksummed address, because the wire carries both cases", () => {
    expect(
      addressSchema.safeParse("0x7A1F4c0B9e2D8a63C5b0E14f7D2C93Ae6b085D41").success
    ).toBe(true);
  });

  it("holds the plan hash to exactly 32 bytes, which is what the record route parses", () => {
    expect(planHashSchema.safeParse(plan.planHash).success).toBe(true);
    expect(planHashSchema.safeParse(`${plan.planHash}00`).success).toBe(false);
    expect(planHashSchema.safeParse(plan.planHash.slice(0, -2)).success).toBe(false);
    expect(planHashSchema.safeParse("0xzz").success).toBe(false);
  });

  it("rejects a non hex character inside an otherwise well formed payload", () => {
    expect(hexSchema.safeParse("0xca4ead7g").success).toBe(false);
  });
});

describe("the hint path", () => {
  it("names the row and the field of the first failure, not just the request", () => {
    expect(
      pathFor({
        intent: "lock",
        plan: {
          ...plan,
          rows: plan.rows.map((row, index) =>
            index === 4 ? { ...row, amountMicros: "1.5" } : row
          ),
        },
        approvals,
      })
    ).toBe("plan.rows.4.amountMicros");
  });

  it("names a missing top level field", () => {
    expect(pathFor({ intent: "lock", plan })).toBe("approvals");
  });

  it("names a mistyped field rather than the whole plan", () => {
    expect(
      pathFor({
        intent: "lock",
        plan: {
          ...plan,
          rows: plan.rows.map((row, index) =>
            index === 0 ? { ...row, balance: "182500" } : row
          ),
        },
        approvals,
      })
    ).toBe("plan.rows.0.balance");
  });

  it("names the discriminator when the intent is unknown or absent", () => {
    expect(pathFor({ intent: "drain", plan, approvals })).toBe("intent");
    expect(pathFor({ plan, approvals })).toBe("intent");
  });

  it("falls back to the request body when the failure has no path", () => {
    expect(pathFor("not an object at all")).toBe("the request body");
    expect(pathFor(null)).toBe("the request body");
  });
});

describe("the submit body", () => {
  const base = {
    intent: "submit" as const,
    policyId: "pol_local_b43da729",
    approvedPlan: plan,
    submittedRows: [{ address: plan.rows[0].address, amountMicros: "1" }],
    tampered: false,
    submissionKey: "key-1",
  };

  it("parses the shape the console sends", () => {
    expect(submitBodySchema.safeParse(base).success).toBe(true);
  });

  it("requires an idempotency key, so a retry cannot broadcast twice by omission", () => {
    expect(pathFor({ ...base, submissionKey: undefined })).toBe("submissionKey");
    expect(pathFor({ ...base, submissionKey: "" })).toBe("submissionKey");
  });

  it("requires the tampered flag to be a boolean and the policy id to be present", () => {
    expect(pathFor({ ...base, tampered: "yes" })).toBe("tampered");
    expect(pathFor({ ...base, policyId: "" })).toBe("policyId");
  });

  it("treats the broadcast preference as optional and closed to unknown values", () => {
    expect(submitBodySchema.safeParse({ ...base, broadcastPreference: "signature" }).success).toBe(
      true
    );
    expect(pathFor({ ...base, broadcastPreference: "carrier-pigeon" })).toBe(
      "broadcastPreference"
    );
  });

  it("accepts an empty row set, which is the send-nothing case the route encodes as 0x", () => {
    expect(submitBodySchema.safeParse({ ...base, submittedRows: [] }).success).toBe(
      true
    );
  });

  // Audit M1. Neither rows nor submittedRows carries a maximum, so a large
  // payload reaches encodeFunctionData and keccak256 unbounded. This test
  // records the boundary that is missing; when a .max() lands on the arrays,
  // it must be rewritten to expect a refusal at that limit.
  it("puts no ceiling on the row count today (audit M1, open)", () => {
    const many = Array.from({ length: 5_000 }, () => ({
      address: plan.rows[0].address,
      amountMicros: "1",
    }));

    expect(submitBodySchema.safeParse({ ...base, submittedRows: many }).success).toBe(
      true
    );
  });
});
