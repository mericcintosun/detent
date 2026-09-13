// The fee line and the failure control, pinned.
//
// The fee is never a constant: the mirror states that nothing is broadcast, and
// real mode multiplies two relay reads. Every branch runs here against a mocked
// fetch, so the suite stays offline.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MIRROR_FEE_SENTENCE,
  parseQuantity,
  quoteFee,
  readFeeQuote,
  weiToHbar,
} from "@/lib/fees";
import { failureControlFor } from "@/lib/wallet-state";

const FROM = "0x8b17f0a4c26e39d05b81f74a2c60e93d15b8027a" as const;
const TO = "0x4b7d0e91c358af260d1e7b04c93f5a68d20e17bc" as const;

/** A fetch that answers each JSON-RPC method from the table. */
function relay(answers: Record<string, unknown>, status = 200) {
  return vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const { method } = JSON.parse(String(init?.body)) as { method: string };
    return new Response(JSON.stringify(answers[method]), { status });
  }) as unknown as typeof fetch;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("weibars to HBAR", () => {
  it("converts an 18 decimal amount without floats", () => {
    expect(weiToHbar(10n ** 18n)).toBe("1.0");
    expect(weiToHbar(0n)).toBe("0.0");
    expect(weiToHbar(123_456_789n * 10n ** 10n)).toBe("1.23456789");
    // 1.5 million gas at 530 gwei worth of weibars.
    expect(weiToHbar(1_500_000n * 530_000_000_000n)).toBe("0.795");
  });

  it("rounds half up to tinybars", () => {
    expect(weiToHbar(5n * 10n ** 9n)).toBe("0.00000001");
    expect(weiToHbar(4n * 10n ** 9n)).toBe("0.0");
  });

  it("refuses a negative amount", () => {
    expect(() => weiToHbar(-1n)).toThrow(RangeError);
  });

  it("reads only hex quantities", () => {
    expect(parseQuantity("0x10")).toBe(16n);
    for (const bad of ["16", "0x", "0xzz", 16, null, undefined]) {
      expect(parseQuantity(bad)).toBeNull();
    }
  });
});

describe("quoteFee", () => {
  const request = { rpcUrl: "https://relay.test/api", from: FROM, to: TO };

  it("states the mirror sentence without a network call", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const quote = await quoteFee({
      ...request,
      mode: "fake",
      data: "0x",
      fetchImpl,
    });
    expect(quote).toEqual({ kind: "mirror", sentence: MIRROR_FEE_SENTENCE });
    expect(MIRROR_FEE_SENTENCE).toBe(
      "No fee: local mirror, nothing is broadcast",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("multiplies the relay's gas estimate by its gas price in real mode", async () => {
    const fetchImpl = relay({
      eth_estimateGas: {
        jsonrpc: "2.0",
        id: 1,
        result: `0x${(1_500_000).toString(16)}`,
      },
      eth_gasPrice: {
        jsonrpc: "2.0",
        id: 1,
        result: `0x${(530_000_000_000).toString(16)}`,
      },
    });
    const quote = await quoteFee({
      ...request,
      mode: "real",
      data: "0xabcdef01",
      fetchImpl,
    });
    expect(quote).toEqual({
      kind: "estimate",
      gas: "1500000",
      gasPrice: "530000000000",
      feeWei: "795000000000000000",
      hbar: "0.795",
    });
    const bodies = vi
      .mocked(fetchImpl)
      .mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies.find((b) => b.method === "eth_estimateGas").params).toEqual([
      { from: FROM, to: TO, data: "0xabcdef01" },
    ]);
  });

  it("reports a relay error as unavailable, never as a number", async () => {
    const quote = await quoteFee({
      ...request,
      mode: "real",
      data: "0x",
      fetchImpl: relay({
        eth_estimateGas: { error: { message: "execution reverted" } },
        eth_gasPrice: { result: "0x1" },
      }),
    });
    expect(quote.kind).toBe("unavailable");
    if (quote.kind === "unavailable") {
      expect(quote.reason).toMatch(
        /eth_estimateGas returned execution reverted/,
      );
    }
  });

  it("reports an HTTP failure, a missing quantity and a thrown fetch", async () => {
    const http = await quoteFee({
      ...request,
      mode: "real",
      data: "0x",
      fetchImpl: relay({}, 503),
    });
    expect(http).toMatchObject({ kind: "unavailable" });
    if (http.kind === "unavailable") expect(http.reason).toMatch(/HTTP 503/);

    const empty = await quoteFee({
      ...request,
      mode: "real",
      data: "0x",
      fetchImpl: relay({
        eth_estimateGas: { result: "0x1" },
        eth_gasPrice: { result: null },
      }),
    });
    expect(empty).toMatchObject({ kind: "unavailable" });

    const noMessage = await quoteFee({
      ...request,
      mode: "real",
      data: "0x",
      fetchImpl: relay({
        eth_estimateGas: { error: {} },
        eth_gasPrice: { result: "0x1" },
      }),
    });
    expect(noMessage).toMatchObject({ kind: "unavailable" });

    const thrown = await quoteFee({
      ...request,
      mode: "real",
      data: "0x",
      fetchImpl: vi.fn(async () => {
        throw new Error("");
      }) as unknown as typeof fetch,
    });
    expect(thrown).toEqual({
      kind: "unavailable",
      reason: "The relay did not return a fee estimate.",
    });
  });
});

describe("readFeeQuote", () => {
  it("reads the three quote kinds and nothing else", () => {
    expect(
      readFeeQuote({
        ok: true,
        data: { kind: "mirror", sentence: MIRROR_FEE_SENTENCE },
      }),
    ).toEqual({ kind: "mirror", sentence: MIRROR_FEE_SENTENCE });
    expect(
      readFeeQuote({
        ok: true,
        data: {
          kind: "estimate",
          gas: "1",
          gasPrice: "2",
          feeWei: "2",
          hbar: "0.0",
        },
      }).kind,
    ).toBe("estimate");
    expect(
      readFeeQuote({ ok: true, data: { kind: "unavailable", reason: "x" } }),
    ).toEqual({ kind: "unavailable", reason: "x" });
    expect(readFeeQuote({ ok: false, hint: "Wait." })).toEqual({
      kind: "unavailable",
      reason: "Wait.",
    });
    for (const bad of [
      null,
      "x",
      { ok: false },
      { ok: true },
      { ok: true, data: { kind: "estimate", hbar: 1 } },
    ]) {
      expect(readFeeQuote(bad).kind).toBe("unavailable");
    }
  });
});

describe("POST /api/fee", () => {
  const selection = { kind: "coupon", deferred: [], forced: [] };

  function post(body: unknown, address = "10.9.9.1") {
    return new Request("http://localhost/api/fee", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": address,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  it("answers the mirror sentence on the fake adapter without a relay call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { POST } = await import("@/app/api/fee/route");
    const response = await POST(post({ selection }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      data: { kind: "mirror", sentence: MIRROR_FEE_SENTENCE },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("estimates the server derived plan in real mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADAPTER_MODE", "real");
    const fetchSpy = relay({
      eth_estimateGas: { result: "0x5208" },
      eth_gasPrice: { result: "0x2540be400" },
    });
    vi.stubGlobal("fetch", fetchSpy);
    const { POST } = await import("@/app/api/fee/route");
    const response = await POST(post({ selection }, "10.9.9.2"));
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data).toMatchObject({
      kind: "estimate",
      gas: "21000",
      gasPrice: "10000000000",
    });
    const estimate = vi
      .mocked(fetchSpy)
      .mock.calls.map(([, init]) => JSON.parse(String(init?.body)))
      .find((entry) => entry.method === "eth_estimateGas");
    expect(estimate.params[0].data).toMatch(/^0x[0-9a-f]{8}/);
  });

  it("refuses a malformed body and a missing selection", async () => {
    const { POST } = await import("@/app/api/fee/route");
    expect((await POST(post("{nope", "10.9.9.3"))).status).toBe(400);
    expect((await POST(post({ selection: 7 }, "10.9.9.3"))).status).toBe(400);
    expect((await POST(post(null, "10.9.9.3"))).status).toBe(400);
  });

  it("rate limits one address with Retry-After", async () => {
    const { POST } = await import("@/app/api/fee/route");
    let limited: Response | undefined;
    for (let attempt = 0; attempt < 40 && !limited; attempt += 1) {
      const response = await POST(post({ selection }, "10.9.9.4"));
      if (response.status === 429) limited = response;
    }
    expect(limited).toBeDefined();
    expect(Number(limited?.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});

describe("the control under a failure is data", () => {
  it("maps each action and stage to a label and a run", () => {
    expect(failureControlFor("relock", "send")).toEqual({
      label: "Lock the plan again",
      run: "relock",
    });
    expect(failureControlFor("reload", "lock")).toEqual({
      label: "Reload the page",
      run: "reload",
    });
    expect(failureControlFor("retry", "lock")).toEqual({
      label: "Try the lock again",
      run: "retry-lock",
    });
    expect(failureControlFor("wait", "send")).toEqual({
      label: "Try the send again",
      run: "retry-send",
    });
    expect(failureControlFor("none", "send")).toBeNull();
  });
});
