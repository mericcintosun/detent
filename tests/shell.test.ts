import { describe, expect, it } from "vitest";
import {
  CONSOLE_SECTIONS,
  ETHONLINE_URL,
  FOOTER_NAV,
  isCurrentRoute,
  PRIMARY_NAV,
  SOURCE_URL,
} from "@/components/shell/nav";
import { checkPlanHash } from "@/components/shell/plan-hash";
import { describeRunMode } from "@/components/shell/run-mode";

describe("shell navigation matches docs/frontend/06_CONTRACTS.md section 2", () => {
  it("lists the four primary routes in order", () => {
    expect(PRIMARY_NAV.map((item) => [item.label, item.href])).toEqual([
      ["Console", "/"],
      ["How it works", "/how-it-works"],
      ["Security", "/security"],
      ["Faucet", "/faucet"],
    ]);
  });

  it("links the five console sections by the ids the end to end suite asserts", () => {
    expect(CONSOLE_SECTIONS.map((section) => section.id)).toEqual([
      "register",
      "plan",
      "policy",
      "send",
      "ledger",
    ]);
    expect(CONSOLE_SECTIONS.at(-1)?.label).toBe("Audit record");
  });

  it("carries the footer links and the two external URLs", () => {
    expect(FOOTER_NAV.map((item) => item.href)).toEqual([
      "/privacy",
      "/terms",
      "/security",
    ]);
    expect(SOURCE_URL).toBe("https://github.com/mericcintosun/detent");
    expect(ETHONLINE_URL).toBe("https://ethglobal.com/events/ethonline2026");
  });

  it("marks the console only on / and a content route on its children", () => {
    expect(isCurrentRoute("/", "/")).toBe(true);
    expect(isCurrentRoute(`/record/0x${"ab".repeat(32)}`, "/")).toBe(false);
    expect(isCurrentRoute("/security", "/security")).toBe(true);
    expect(isCurrentRoute("/security/model", "/security")).toBe(true);
    expect(isCurrentRoute("/securityx", "/security")).toBe(false);
  });
});

describe("the run mode status line names both halves", () => {
  it.each([
    [
      false,
      false,
      "mirror",
      "Local mirror",
      "Local mirror register, local mirror signer",
    ],
    [
      true,
      false,
      "mirror",
      "Partly live",
      "Live register, local mirror signer",
    ],
    [
      false,
      true,
      "mirror",
      "Partly live",
      "Local mirror register, live Privy signer",
    ],
    [true, true, "live", "Live", "Live register, live Privy signer"],
  ])(
    "register %s, signer %s",
    (registerLive, signerLive, mode, label, line) => {
      const copy = describeRunMode({ registerLive, signerLive });
      expect(copy.mode).toBe(mode);
      expect(copy.label).toBe(label);
      expect(copy.line).toBe(line);
    },
  );
});

describe("the palette's record lookup", () => {
  const valid = `0x${"ab".repeat(32)}`;

  it("accepts a plan hash and trims around it", () => {
    expect(checkPlanHash(`  ${valid} `)).toEqual({ ok: true, value: valid });
    expect(checkPlanHash(`0x${"AB".repeat(32)}`).ok).toBe(true);
  });

  it.each([
    ["", /Paste a plan hash/],
    ["abcd", /starts with a lowercase 0x/],
    [`0X${"ab".repeat(32)}`, /starts with a lowercase 0x/],
    [`0x${"zz".repeat(32)}`, /only hexadecimal characters/],
    ["0x1234", /this one has 4/],
    [`0x${"ab".repeat(32)}00`, /this one has 66/],
  ])("refuses %j with a specific message", (input, message) => {
    const check = checkPlanHash(input);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.message).toMatch(message);
  });
});
