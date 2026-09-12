// The words the console prints and the fallbacks the configuration takes.
//
// None of this needs a network, and all of it decides what an operator reads at
// the worst moment: a refused lock, a rate limit, a misconfigured deploy. The
// module-level constants are re-imported per case with a stubbed environment,
// because they are read once when the module loads.

import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { DetentError, hintFor, isDetentError } from "@/lib/errors";
import { formatTokens, shortHex } from "@/lib/plan";
import { firstIssuePath } from "@/lib/schemas";
import { describeFailure } from "@/lib/wallet-state";
import { cn } from "@/lib/utils";

describe("the failure copy", () => {
  it("names a rejected request and offers no action", () => {
    const view = describeFailure(
      "invalid_input",
      "The request failed validation at rows.",
    );
    expect(view.title).toBe("The request was rejected");
    expect(view.action).toBe("none");
    expect(view.sentence).toBe("The request failed validation at rows.");
  });

  it("offers a retry for any infrastructure answer without its own copy", () => {
    const view = describeFailure("upstream_error", undefined);
    expect(view.title).toBe("The call did not go through");
    expect(view.action).toBe("retry");
    expect(view.sentence.length).toBeGreaterThan(0);
  });

  it("appends the Retry-After wait when the hint does not already give one", () => {
    const view = describeFailure(
      "rate_limited",
      "Too many locks from this address.",
      30,
    );
    expect(view.action).toBe("wait");
    expect(view.sentence).toBe(
      "Too many locks from this address. Try again in 30 seconds.",
    );
  });

  it("does not repeat a wait the server hint already states", () => {
    const hint = "Too many locks, wait 12 seconds.";
    expect(describeFailure("rate_limited", hint, 30).sentence).toBe(hint);
  });

  it("does not invent a wait when the header is missing or unreadable", () => {
    const hint = "Too many locks from this address.";
    expect(describeFailure("rate_limited", hint).sentence).toBe(hint);
    expect(describeFailure("rate_limited", hint, Number.NaN).sentence).toBe(
      hint,
    );
  });
});

describe("the display helpers", () => {
  it("groups whole token counts the way the register prints them", () => {
    expect(formatTokens(1234567)).toBe("1,234,567");
  });

  it("leaves a value short enough to read untouched", () => {
    expect(shortHex("0x1234")).toBe("0x1234");
  });

  it("lets a later utility class win over an earlier one and drops falsy inputs", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm", false, undefined, "font-medium")).toBe(
      "text-sm font-medium",
    );
  });

  it("keeps the head and the tail of a long hex value", () => {
    const address = "0x4b7d0e91c358af260d1e7b04c93f5a68d20e17bc";
    expect(shortHex(address)).toBe(
      `${address.slice(0, 10)}…${address.slice(-6)}`,
    );
    expect(shortHex(address, 6, 4)).toBe(
      `${address.slice(0, 6)}…${address.slice(-4)}`,
    );
  });
});

describe("the schema error path", () => {
  it("falls back to the request body when zod reports no issue", () => {
    expect(firstIssuePath(new z.ZodError([]))).toBe("the request body");
  });

  it("falls back to the request body when the issue has no path", () => {
    const result = z.string().safeParse(42);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(firstIssuePath(result.error)).toBe("the request body");
  });
});

describe("the safe error type", () => {
  it("defaults the message to the code and the hint to the published sentence", () => {
    const error = new DetentError("upstream_error");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("DetentError");
    expect(error.message).toBe("upstream_error");
    expect(error.hint).toBe(hintFor("upstream_error"));
  });

  it("keeps an explicit message and hint", () => {
    const error = new DetentError(
      "policy_denied",
      "denied at byte 481",
      "Send the plan as approved.",
    );
    expect(error.message).toBe("denied at byte 481");
    expect(error.hint).toBe("Send the plan as approved.");
  });

  it("recognises only its own instances", () => {
    expect(isDetentError(new DetentError("parse_failure"))).toBe(true);
    expect(isDetentError(new Error("parse_failure"))).toBe(false);
    expect(isDetentError({ code: "parse_failure", hint: "x" })).toBe(false);
  });
});

describe("the configuration fallbacks", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function chainIdWith(value: string | undefined): Promise<number> {
    vi.resetModules();
    if (value === undefined)
      vi.stubEnv("NEXT_PUBLIC_CHAIN_ID", undefined as unknown as string);
    else vi.stubEnv("NEXT_PUBLIC_CHAIN_ID", value);
    return (await import("@/lib/public-config")).CHAIN_ID;
  }

  it("keeps Hedera testnet when the chain id override is not a positive number", async () => {
    expect(await chainIdWith("abc")).toBe(296);
    expect(await chainIdWith("0")).toBe(296);
    expect(await chainIdWith("-5")).toBe(296);
  });

  it("honours a valid chain id override", async () => {
    expect(await chainIdWith("297")).toBe(297);
  });

  async function broadcastModeWith(value: string): Promise<string> {
    vi.resetModules();
    vi.stubEnv("PRIVY_BROADCAST_MODE", value);
    return (await import("@/lib/config")).PRIVY_BROADCAST_MODE;
  }

  it("pins a rehearsal path only for the two known broadcast modes", async () => {
    expect(await broadcastModeWith("rpc")).toBe("rpc");
    expect(await broadcastModeWith("signature")).toBe("signature");
    expect(await broadcastModeWith("bogus")).toBe("auto");
  });
});
