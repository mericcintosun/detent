// Regressions for the defects an exploratory browser pass found on the console:
// the amount field's messages, the refusal control that could sign, the
// masthead's held count, and the record route's 404 decision.

import { describe, expect, it } from "vitest";
import { holders } from "@/lib/data";
import {
  buildPlan,
  decideTamperedSend,
  microsToInput,
  parseAmountInput,
  registerHeldCount,
} from "@/lib/plan";
import { planHashSchema } from "@/lib/schemas";
import { describePolicyRelease } from "@/lib/wallet-state";

describe("the amount field names the mistake it found", () => {
  const cases: [string, RegExp][] = [
    ["", /field is empty/i],
    ["   ", /field is empty/i],
    ["-5", /cannot be negative/i],
    ["-0.5", /cannot be negative/i],
    ["abc", /as digits/i],
    ["1.2.3", /as digits/i],
    ["1e5", /as digits/i],
    ["7,756.25", /dot for decimals/i],
    [".5", /digit before the decimal point/i],
    ["1.123456789012", /six decimal places/i],
  ];

  it.each(cases)("refuses %j with its own sentence", (input, pattern) => {
    const result = parseAmountInput(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(pattern);
  });

  it("gives every mistake a different sentence", () => {
    const messages = new Set(
      ["", "-5", "abc", "7,756.25", ".5", "1.1234567"].map((input) => {
        const result = parseAmountInput(input);
        return result.ok ? "ok" : result.message;
      }),
    );
    expect(messages.size).toBe(6);
  });

  it("reads well formed amounts as micro units", () => {
    expect(parseAmountInput("7756.25")).toEqual({
      ok: true,
      micros: "7756250000",
    });
    expect(parseAmountInput(" 7756.250 ")).toEqual({
      ok: true,
      micros: "7756250000",
    });
    expect(parseAmountInput("5.")).toEqual({ ok: true, micros: "5000000" });
    expect(parseAmountInput("0.000001")).toEqual({ ok: true, micros: "1" });
    expect(parseAmountInput("99999999999999999999999999999999")).toMatchObject({
      ok: true,
    });
  });

  it("round trips through the display form", () => {
    expect(microsToInput("7756250000")).toBe("7756.25");
    expect(microsToInput("63950000000")).toBe("63950");
  });
});

describe("the refusal control never sends the approved amount", () => {
  const approved = "7756250000";

  it.each(["7756.25", "7756.250", " 7756.25", "7756.250000", "007756.25"])(
    "sends nothing for %j, which normalises to the approved amount",
    (input) => {
      const decision = decideTamperedSend(input, approved);
      expect(decision.kind).toBe("unchanged");
      if (decision.kind === "unchanged") {
        expect(decision.message).toMatch(/nothing was sent/i);
        expect(decision.message).toMatch(/Execute the approved plan/);
      }
    },
  );

  it("sends an amount that differs by one digit", () => {
    expect(decideTamperedSend("7756.26", approved)).toEqual({
      kind: "edited",
      micros: "7756260000",
    });
  });

  it("sends nothing for an unreadable amount either", () => {
    expect(decideTamperedSend("abc", approved).kind).toBe("invalid");
    expect(decideTamperedSend("", approved).kind).toBe("invalid");
  });
});

describe("the masthead's held count describes the register", () => {
  it("does not change with the selected corporate action", () => {
    const expected = holders.filter((h) => h.compliance !== "clear").length;
    expect(expected).toBeGreaterThan(0);
    expect(registerHeldCount(holders)).toBe(expected);

    const coupon = buildPlan({ kind: "coupon", holders });
    const forced = buildPlan({ kind: "forced-transfer", holders });
    // The two plans disagree about held rows, which is why the masthead must
    // not count them.
    expect(coupon.rows.filter((row) => row.held).length).toBe(expected);
    expect(forced.rows.filter((row) => row.held).length).toBe(0);
    expect(registerHeldCount(holders)).toBe(expected);
  });
});

describe("the record route answers 404 for a malformed plan hash", () => {
  // app/record/[planHash]/page.tsx calls notFound() exactly when this schema
  // refuses the segment, and with no loading boundary above it that is a real
  // 404 status rather than a 200 carrying the not-found body.
  it.each([
    "0x123",
    "0x1234",
    "not-hex",
    "nothex",
    `0X${"AB".repeat(32)}`,
    `0x${"ab".repeat(31)}`,
    `0x${"ab".repeat(32)}00`,
    `0x${"zz".repeat(32)}`,
    "",
  ])("refuses %j", (segment) => {
    expect(planHashSchema.safeParse(segment).success).toBe(false);
  });

  it.each([`0x${"ab".repeat(32)}`, `0x${"AB".repeat(32)}`])(
    "accepts %j",
    (segment) => {
      expect(planHashSchema.safeParse(segment).success).toBe(true);
    },
  );
});

describe("the audit entry says what the send did to the policy", () => {
  const ids = { policyId: "pol_local_b43da729", lockId: "lok_1" };

  it("never claims a revoke on the keyless path", () => {
    const sentence = describePolicyRelease({
      installedOnWallet: false,
      policyDetached: false,
      policyRevoked: false,
      ...ids,
    });
    expect(sentence).not.toMatch(/ revoked,/);
    expect(sentence).toMatch(/nothing to detach or revoke/);
    expect(sentence).toMatch(/Local lock lok_1 is closed/);
  });

  it("reports a completed live release", () => {
    expect(
      describePolicyRelease({
        installedOnWallet: true,
        policyDetached: true,
        policyRevoked: true,
        ...ids,
      }),
    ).toBe(
      "Policy pol_local_b43da729 detached from the treasury wallet and revoked, lock lok_1 spent.",
    );
  });

  it("names the step that did not go through on a live wallet", () => {
    expect(
      describePolicyRelease({
        installedOnWallet: true,
        policyDetached: true,
        policyRevoked: false,
        ...ids,
      }),
    ).toMatch(
      /detached from the treasury wallet, but not revoked; finish it in the Privy dashboard/,
    );
    expect(
      describePolicyRelease({
        installedOnWallet: true,
        policyDetached: false,
        policyRevoked: false,
        ...ids,
      }),
    ).toMatch(/was not detached from the wallet or revoked/);
  });
});
