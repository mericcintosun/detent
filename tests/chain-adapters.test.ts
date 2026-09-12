// The two chain facing modules, without a chain.
//
// lib/anchor.ts and lib/hedera.ts both promise the same thing: a missing
// address, a missing key or a relay that will not answer degrades into a
// readable note instead of an exception on the core path. That promise is what
// is tested here. Nothing in this file opens a socket: the unwired branches
// need no transport at all, and the failure branches run against a stubbed
// global fetch that rejects, which is how a dead relay looks from viem.
//
// vitest.config.ts pins the environment empty, so the default state of every
// import below is "not wired". A test that needs another state stubs the
// variable and re-imports the module under vi.resetModules, because
// lib/config.ts reads process.env once at module scope.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HEDERA_RPC_URL } from "@/lib/config";
import { holders } from "@/lib/data";
import { buildPlan } from "@/lib/plan";

/** A published test key. It is never funded and never leaves this process. */
const TEST_OPERATOR_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const TEST_ANCHOR_ADDRESS = "0x00000000000000000000000000000000000004d2";

const planHash = buildPlan({ kind: "coupon", holders }).planHash;

/** Shaped like a real 32 byte transaction hash, which is all settle accepts. */
const PAYOUT_TX_HASH =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

/** Re-import a module with a patched environment, one test at a time. */
async function withEnv<T>(
  env: Record<string, string>,
  load: () => Promise<T>,
): Promise<T> {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  vi.resetModules();
  return load();
}

/** A relay that refuses every call, which is what viem sees when Hashio is down. */
function stubDeadRelay() {
  const dead = vi.fn(async () => {
    throw new Error("relay refused the connection");
  });
  vi.stubGlobal("fetch", dead);
  return dead;
}

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("the anchor when nothing is wired", () => {
  it("says which variable is missing rather than throwing, on all three writes", async () => {
    const { abandonPlan, anchorPlan, settlePlan } =
      await import("@/lib/anchor");

    const receipts = [
      await anchorPlan(planHash, TEST_ANCHOR_ADDRESS, "0xca4ead79"),
      await settlePlan(planHash, PAYOUT_TX_HASH),
      await abandonPlan(planHash, "policy refused the submitted payload"),
    ];

    for (const receipt of receipts) {
      expect(receipt.anchored).toBe(false);
      expect(receipt.transactionHash).toBeUndefined();
      expect(receipt.note).toContain("NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS");
    }
  });

  it("reads back as unwired instead of as an empty record", async () => {
    const { readPlanRecord } = await import("@/lib/anchor");
    const record = await readPlanRecord(planHash);

    expect(record.state).toBe("unwired");
    expect(record.anchoredAt).toBeUndefined();
    expect(record.note).toContain("NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS");
  });

  it("names the operator key when the contract address is set and the key is not", async () => {
    const { anchorPlan } = await withEnv(
      { NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS: TEST_ANCHOR_ADDRESS },
      () => import("@/lib/anchor"),
    );

    const receipt = await anchorPlan(
      planHash,
      TEST_ANCHOR_ADDRESS,
      "0xca4ead79",
    );

    expect(receipt.anchored).toBe(false);
    expect(receipt.note).toContain("OPERATOR_PRIVATE_KEY");
  });

  it("refuses a key that is not a usable ECDSA key without reaching the relay", async () => {
    const relay = stubDeadRelay();
    const { anchorPlan } = await withEnv(
      {
        NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS: TEST_ANCHOR_ADDRESS,
        OPERATOR_PRIVATE_KEY: "0xnot-a-key",
      },
      () => import("@/lib/anchor"),
    );

    const receipt = await anchorPlan(
      planHash,
      TEST_ANCHOR_ADDRESS,
      "0xca4ead79",
    );

    expect(receipt.anchored).toBe(false);
    expect(receipt.note).toContain("not a usable ECDSA key");
    expect(relay).not.toHaveBeenCalled();
  });

  // Regression for audit M4: a reference that was not 32 bytes used to be zero
  // padded and written on chain as if it were a payout transaction.
  it("refuses to settle on anything that is not a real 32 byte transaction hash", async () => {
    const relay = stubDeadRelay();
    const { settlePlan } = await withEnv(
      {
        NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS: TEST_ANCHOR_ADDRESS,
        OPERATOR_PRIVATE_KEY: TEST_OPERATOR_KEY,
      },
      () => import("@/lib/anchor"),
    );

    for (const reference of [undefined, "0xdeadbeef", `0x${"0".repeat(64)}`]) {
      const receipt = await settlePlan(planHash, reference);
      expect(receipt.anchored).toBe(false);
      expect(receipt.transactionHash).toBeUndefined();
      expect(receipt.note).toContain("nothing to settle with");
    }
    expect(relay).not.toHaveBeenCalled();
  });

  it("clamps the abandon reason to between 1 and 256 bytes without splitting a character", async () => {
    const { clampAbandonReason } = await import("@/lib/anchor");
    const encoded = (value: string) => new TextEncoder().encode(value).length;

    expect(encoded(clampAbandonReason("   "))).toBeGreaterThan(0);
    expect(clampAbandonReason("refused")).toBe("refused");
    expect(encoded(clampAbandonReason("a".repeat(300)))).toBe(256);

    const multibyte = clampAbandonReason("\u00e7".repeat(200));
    expect(encoded(multibyte)).toBeLessThanOrEqual(256);
    expect(multibyte).not.toContain("\uFFFD");
  });
});

describe("the anchor when the relay will not answer", () => {
  it("reports an incomplete record and leaves the transaction unaffected", async () => {
    stubDeadRelay();
    const { anchorPlan } = await withEnv(
      {
        NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS: TEST_ANCHOR_ADDRESS,
        OPERATOR_PRIVATE_KEY: TEST_OPERATOR_KEY,
      },
      () => import("@/lib/anchor"),
    );

    const receipt = await anchorPlan(
      planHash,
      TEST_ANCHOR_ADDRESS,
      "0xca4ead79",
    );

    expect(receipt.anchored).toBe(false);
    expect(receipt.transactionHash).toBeUndefined();
    expect(receipt.note).toContain("anchor call did not reach PlanAnchor");
    expect(receipt.note).toContain("transaction itself is unaffected");
  });

  it("names the failing step, so settle and abandon are not confused for anchor", async () => {
    stubDeadRelay();
    const { abandonPlan, settlePlan } = await withEnv(
      {
        NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS: TEST_ANCHOR_ADDRESS,
        OPERATOR_PRIVATE_KEY: TEST_OPERATOR_KEY,
      },
      () => import("@/lib/anchor"),
    );

    expect((await settlePlan(planHash, PAYOUT_TX_HASH)).note).toContain(
      "settle call did not reach",
    );
    expect((await abandonPlan(planHash, "refused")).note).toContain(
      "abandon call did not reach",
    );
  });

  it("reads back as unreadable rather than as a hash the contract never saw", async () => {
    stubDeadRelay();
    const { readPlanRecord } = await withEnv(
      { NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS: TEST_ANCHOR_ADDRESS },
      () => import("@/lib/anchor"),
    );

    const record = await readPlanRecord(planHash);

    expect(record.state).toBe("unreadable");
    expect(record.state).not.toBe("unknown");
    expect(record.note).toContain("relay did not answer");
  });
});

describe("the Hedera chain definition", () => {
  it("is chain 296 with HBAR and the HashScan testnet explorer", async () => {
    const { hederaTestnet } = await import("@/lib/hedera");

    expect(hederaTestnet.id).toBe(296);
    expect(hederaTestnet.nativeCurrency.symbol).toBe("HBAR");
    expect(hederaTestnet.nativeCurrency.decimals).toBe(18);
    expect(hederaTestnet.blockExplorers?.default.url).toBe(
      "https://hashscan.io/testnet",
    );
    expect(hederaTestnet.rpcUrls.default.http[0]).toBe(HEDERA_RPC_URL);
  });

  it("builds every read client against that chain and no other", async () => {
    const relay = stubDeadRelay();
    const { hederaPublicClient } = await import("@/lib/hedera");
    const client = hederaPublicClient();

    expect(client.chain.id).toBe(296);
    expect(client.transport.url).toBe(HEDERA_RPC_URL);
    expect(relay).not.toHaveBeenCalled();
  });
});

describe("the register adapter", () => {
  it("refuses the live read when no token address is configured", async () => {
    const relay = stubDeadRelay();
    const { liveRegisterAdapter } = await import("@/lib/hedera");

    await expect(liveRegisterAdapter.load()).rejects.toThrow(
      "NEXT_PUBLIC_ATS_TOKEN_ADDRESS is not set.",
    );
    expect(relay).not.toHaveBeenCalled();
  });

  it("stays on the cached register in fake mode and never calls the relay", async () => {
    const relay = stubDeadRelay();
    const { getRegisterSnapshot } = await import("@/lib/hedera");

    const snapshot = await getRegisterSnapshot();

    expect(snapshot.source).toBe("seed");
    expect(snapshot.holders).toHaveLength(holders.length);
    expect(snapshot.note).toContain("Cached register");
    expect(relay).not.toHaveBeenCalled();
  });

  it("serves the second read of the same window from the memo", async () => {
    const { getRegisterSnapshot } = await import("@/lib/hedera");

    const first = await getRegisterSnapshot();
    const second = await getRegisterSnapshot();

    expect(second).toBe(first);
  });

  it("takes the live path only when the mode and the token address agree", async () => {
    const fake = await import("@/lib/adapter");
    expect(fake.useLiveRegister()).toBe(false);

    const halfWired = await withEnv(
      { NEXT_PUBLIC_ADAPTER_MODE: "real" },
      () => import("@/lib/adapter"),
    );
    expect(halfWired.useLiveRegister()).toBe(false);

    const wired = await withEnv(
      {
        NEXT_PUBLIC_ADAPTER_MODE: "real",
        NEXT_PUBLIC_ATS_TOKEN_ADDRESS: TEST_ANCHOR_ADDRESS,
      },
      () => import("@/lib/adapter"),
    );
    expect(wired.useLiveRegister()).toBe(true);
  });
});
