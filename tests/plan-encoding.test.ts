// The encoding, pinned.
//
// lib/plan.ts is the one place where an operator's preview becomes bytes. Every
// downstream guarantee (the Privy condition, the on chain anchor, the audit
// record) is that byte string, so the tests below compare it against literals
// committed here rather than against anything the code recomputes at run time.
// An accidental change to the ABI, the partition, the canonical hash string or
// the row order fails loudly instead of quietly agreeing with itself.
//
// If one of these literals has to change, the change is the point: say in the
// commit message which encoding moved and why.

import {
  decodeFunctionData,
  parseAbiItem,
  stringToHex,
  toFunctionSelector,
  type Hex,
} from "viem";
import { describe, expect, it } from "vitest";
import { couponMicrosPerToken, holders, recoveryCustodian, security } from "@/lib/data";
import { buildCalldata, buildPlan, selectorFor } from "@/lib/plan";
import { compilePolicy } from "@/lib/privy";

/* --- The committed expectations ------------------------------------------ */

const COUPON_PLAN_HASH: Hex = "0xb43da729424748e5aaa28d8f13a1be304e9a455635c7c8d846726d148e849910";
const COUPON_SELECTOR: Hex = "0xca4ead79";
const COUPON_CALLDATA: Hex =
  "0xca4ead79434c4153532d4100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000000090000000000000000000000007a1f4c0b9e2d8a63c5b0e14f7d2c93ae6b085d410000000000000000000000003c9d02b74e8f15a6d0c2b937e418fa6d05c2b8e7000000000000000000000000b40e7f21c609da3b58e417c2f60ab9d38e51c7040000000000000000000000005f8c1a09d3e26b47f018ca95d3702b6e14f8a0c30000000000000000000000002e60fb95c1d4830a7e62f19b05d3ca84e720f16b000000000000000000000000c73a058e196d2fb04a8530e9c1d762f5a80b3492000000000000000000000000a05f3e814d7092c6b35f8e41d07a2cb963f508e10000000000000000000000006d2907c4fb8e150a3d9725b6ec08f14a70d3928c0000000000000000000000000c94e7a3d582f10b6c49e3d75a018f26b9c40e73000000000000000000000000000000000000000000000000000000000000000900000000000000000000000000000000000000000000000000000001ce4efb9000000000000000000000000000000000000000000000000000000000f32fdc000000000000000000000000000000000000000000000000000000000165d06b0800000000000000000000000000000000000000000000000000000000e0d23eb8000000000000000000000000000000000000000000000000000000012ffbd3000000000000000000000000000000000000000000000000000000000073e4ced800000000000000000000000000000000000000000000000000000000b72671b00000000000000000000000000000000000000000000000000000000082b686400000000000000000000000000000000000000000000000000000000058a972e0";

const FORCED_PLAN_HASH: Hex = "0x6d8ca7cf2c92b1ae4db9cc039ff0be2e1803374ce11c0bb425c391b4c1c0a2bd";
const FORCED_SELECTOR: Hex = "0x8c0dee9c";
const FORCED_CALLDATA: Hex =
  "0x8c0dee9c434c4153532d4100000000000000000000000000000000000000000000000000000000000000000000000000f31b8607ae4c05d29b716a3f80e5d2c917b40a68000000000000000000000000d52f907ab361c40e8d2905b7f31a6c8e240d97b50000000000000000000000000000000000000000000000000000000ee3b78f8000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

/** Written out here on purpose, so the test does not import the ABI it checks. */
const COUPON_ABI = parseAbiItem(
  "function distributeCoupon(bytes32 partition, address[] holders, uint256[] amounts)"
);

const coupon = buildPlan({ kind: "coupon", holders });
const forced = buildPlan({ kind: "forced-transfer", holders });

describe("the plan hash", () => {
  it("is the committed value for the seed coupon plan", () => {
    expect(coupon.planHash).toBe(COUPON_PLAN_HASH);
  });

  it("is the committed value for the seed forced transfer plan", () => {
    expect(forced.planHash).toBe(FORCED_PLAN_HASH);
  });

  it("moves when a single row leaves the plan", () => {
    const withoutFirst = buildPlan({
      kind: "coupon",
      holders,
      deferred: ["h-01"],
    });

    expect(withoutFirst.planHash).not.toBe(COUPON_PLAN_HASH);
  });

  it("ignores the treasury cover, which is not part of what was approved", () => {
    const richer = buildPlan({
      kind: "coupon",
      holders,
      treasuryMicros: String(BigInt(coupon.treasuryMicros) * 2n),
    });

    expect(richer.planHash).toBe(COUPON_PLAN_HASH);
  });
});

describe("the coupon calldata", () => {
  it("is the committed byte string", () => {
    expect(coupon.calldata).toBe(COUPON_CALLDATA);
  });

  it("carries the committed selector, derived from the published signature", () => {
    expect(coupon.selector).toBe(COUPON_SELECTOR);
    expect(selectorFor("coupon")).toBe(toFunctionSelector(COUPON_ABI));
    expect(COUPON_CALLDATA.startsWith(COUPON_SELECTOR)).toBe(true);
  });

  it("decodes back to the partition, addresses and amounts the preview shows", () => {
    const { args } = decodeFunctionData({
      abi: [COUPON_ABI],
      data: COUPON_CALLDATA,
    });
    const [partition, addresses, amounts] = args as [
      Hex,
      readonly `0x${string}`[],
      readonly bigint[],
    ];
    const included = coupon.rows.filter((row) => row.included);

    expect(partition).toBe(stringToHex(security.partition, { size: 32 }));
    expect(addresses.map((address) => address.toLowerCase())).toEqual(
      included.map((row) => row.address.toLowerCase())
    );
    expect(amounts).toEqual(included.map((row) => BigInt(row.amountMicros)));
    expect(amounts).toEqual(
      included.map((row) => BigInt(row.balance) * BigInt(couponMicrosPerToken))
    );
  });

  it("is what the compiled policy pins, so the ALLOW rule is not self referential", () => {
    const policy = compilePolicy(coupon);
    const conditions = policy.rules[0].conditions;
    const exact = conditions.find(
      (condition) => condition.field === "data" && condition.operator === "eq"
    );
    const prefix = conditions.find(
      (condition) => condition.field === "data" && condition.operator === "starts_with"
    );

    expect(exact?.value).toBe(COUPON_CALLDATA);
    expect(prefix?.value).toBe(COUPON_SELECTOR);
  });

  it("is empty when every row is out of the plan", () => {
    const empty = buildPlan({
      kind: "coupon",
      holders,
      deferred: holders.map((holder) => holder.id),
    });

    expect(empty.calldata).toBe("0x");
    expect(empty.blockers).toContain("The plan is empty, nothing would be signed.");
  });
});

describe("the forced transfer calldata", () => {
  it("is the committed byte string and sends the position to the custodian", () => {
    expect(forced.calldata).toBe(FORCED_CALLDATA);
    expect(forced.selector).toBe(FORCED_SELECTOR);
    expect(FORCED_CALLDATA.toLowerCase()).toContain(
      recoveryCustodian.slice(2).toLowerCase()
    );
  });

  it("encodes exactly the one sanctioned holder, never the whole register", () => {
    expect(forced.rows).toHaveLength(1);
    expect(
      buildCalldata("forced-transfer", [
        {
          address: forced.rows[0].address,
          amountMicros: forced.rows[0].amountMicros,
        },
      ])
    ).toBe(FORCED_CALLDATA);
  });
});

describe("hold detection", () => {
  it("marks every holder the compliance module does not clear", () => {
    const expected = holders
      .filter((holder) => holder.compliance !== "clear")
      .map((holder) => holder.id);
    const held = coupon.rows.filter((row) => row.held).map((row) => row.holderId);

    expect(expected.length).toBeGreaterThan(0);
    expect(held).toEqual(expected);
  });

  it("gives every held row a reason an operator can read", () => {
    for (const row of coupon.rows.filter((row) => row.held)) {
      expect(row.holdReason).toBeTruthy();
      expect(row.holdReason).not.toBe(row.legalName);
    }
    for (const row of coupon.rows.filter((row) => !row.held)) {
      expect(row.holdReason).toBeNull();
    }
  });

  it("leaves held rows out of the calldata unless they are forced in", () => {
    const heldAddresses = coupon.rows
      .filter((row) => row.held)
      .map((row) => row.address.slice(2).toLowerCase());

    for (const address of heldAddresses) {
      expect(coupon.calldata.toLowerCase()).not.toContain(address);
    }
  });

  it("blocks the plan when a held row is forced back in", () => {
    const heldId = holders.find((holder) => holder.compliance !== "clear")?.id;
    if (!heldId) throw new Error("the seed register carries no held holder");

    const pushed = buildPlan({ kind: "coupon", holders, forced: [heldId] });
    const pushedRow = pushed.rows.find((row) => row.holderId === heldId);

    expect(pushedRow?.included).toBe(true);
    expect(pushed.blockers.some((entry) => entry.includes("compliance module"))).toBe(
      true
    );
    expect(pushed.calldata).not.toBe(COUPON_CALLDATA);
  });
});
