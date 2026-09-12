// What the browser is allowed to claim.
//
// Two of the three findings this file pins are honesty findings rather than
// crashes, so they can only be caught by asserting the absence of something: no
// explorer link under an address Hedera testnet has never seen, no explorer link
// under a hash that was derived from the calldata rather than broadcast. Both
// rendered happily before, and both would render happily again the moment a
// call site forgets to ask where its value came from.
//
// vitest runs with environment "node", so nothing here mounts React. Everything
// asserted is a pure helper or a link builder, which is where the decision
// actually lives.

import { describe, expect, it } from "vitest";
import { fakeRegisterAdapter } from "@/lib/adapter";
import { holders, recoveryCustodian, security, treasury } from "@/lib/data";
import {
  anchorExplorerHref,
  callTargetProvenance,
  isExplorerAddress,
  isExplorerTransactionHash,
  readReceipt,
  registerProvenance,
  tokenExplorerHref,
  transactionExplorerHref,
} from "@/lib/hashscan";
import { buildPlan } from "@/lib/plan";
import { parseEvmAddress } from "@/lib/public-config";
import { deriveTreasuryKeyState, describeFailure } from "@/lib/wallet-state";

const plan = buildPlan({ kind: "coupon", holders });

/** A synthetic reference: 32 bytes, well formed, and still never a transaction. */
const syntheticHash = `0x${plan.calldata.slice(2, 66).padEnd(64, "0")}`;

/** A 32 byte hash that really could be a Hedera testnet transaction. */
const minedHash =
  "0x9f1c0a7d3b5e48f2a6c0d91b7e43f85a2c6d0e17b9438fa5c1d720e63b84af09";

/** A 20 byte address that really could be a deployed contract. */
const deployedAddress = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

describe("H1, explorer links on fixture addresses", () => {
  it("gives the seed register no token link at all", async () => {
    const snapshot = await fakeRegisterAdapter.load();
    expect(snapshot.source).toBe("seed");
    expect(
      tokenExplorerHref(
        snapshot.token.address,
        registerProvenance(snapshot.source)
      )
    ).toBeNull();
  });

  it("refuses a link for every address the seed register carries", async () => {
    const snapshot = await fakeRegisterAdapter.load();
    const provenance = registerProvenance(snapshot.source);
    const fixtureAddresses = [
      security.address,
      treasury.address,
      recoveryCustodian,
      plan.target,
      ...holders.map((holder) => holder.address),
    ];

    for (const address of fixtureAddresses) {
      // Each one is a well formed address. That is the trap: the shape is fine,
      // only the provenance is not, so shape alone can never be the gate.
      expect(isExplorerAddress(address)).toBe(true);
      expect(tokenExplorerHref(address, provenance)).toBeNull();
      expect(transactionExplorerHref(address, provenance)).toBeNull();
    }
  });

  it("keeps the call target unlinked while it is built from the seed constant", () => {
    // lib/plan.ts builds target from the seed literal, so even a live register
    // does not make the destination contract real until the two agree.
    expect(callTargetProvenance(plan.target, security.address, "seed")).toBe(
      "fixture"
    );
    expect(
      callTargetProvenance(plan.target, deployedAddress, "hedera-testnet")
    ).toBe("fixture");
    expect(
      tokenExplorerHref(
        plan.target,
        callTargetProvenance(plan.target, deployedAddress, "hedera-testnet")
      )
    ).toBeNull();
  });

  it("links a live read, and only a live read", () => {
    expect(
      callTargetProvenance(deployedAddress, deployedAddress, "hedera-testnet")
    ).toBe("on-chain");
    expect(tokenExplorerHref(deployedAddress, "on-chain")).toBe(
      `https://hashscan.io/testnet/contract/${deployedAddress}`
    );
    // Case differences are an address, not a different contract.
    expect(
      callTargetProvenance(
        deployedAddress.toUpperCase().replace("0X", "0x"),
        deployedAddress,
        "hedera-testnet"
      )
    ).toBe("on-chain");
  });

  it("treats an unrecognised register source as a fixture", () => {
    expect(registerProvenance("seed")).toBe("fixture");
    expect(registerProvenance("some-future-cache")).toBe("fixture");
    expect(registerProvenance("hedera-testnet")).toBe("on-chain");
  });

  it("refuses anything that is not an address or a hash", () => {
    for (const bad of ["", "0x", "not-an-address", "0x1234", undefined, null]) {
      expect(tokenExplorerHref(bad, "on-chain")).toBeNull();
      expect(transactionExplorerHref(bad, "on-chain")).toBeNull();
    }
    // A 20 byte address is not a 32 byte hash and must never be linked as one.
    expect(isExplorerTransactionHash(deployedAddress)).toBe(false);
    expect(transactionExplorerHref(deployedAddress, "on-chain")).toBeNull();
  });
});

describe("H2, synthetic receipts", () => {
  it("never links the synthetic receipt the keyless path returns", () => {
    // The contract shape from lib/types.ts, ExecutionReceipt.
    const view = readReceipt({
      verdict: { allowed: true },
      receipt: {
        kind: "synthetic",
        reference: syntheticHash,
        note: "Keyless rehearsal.",
      },
      decidedBy: "local-mirror",
      live: false,
    });
    expect(view.kind).toBe("synthetic");
    expect(view.reference).toBe(syntheticHash);
    expect(view.transactionHash).toBeNull();
    expect(view.href).toBeNull();
  });

  it("links an on-chain receipt", () => {
    const view = readReceipt({
      receipt: {
        kind: "on-chain",
        transactionHash: minedHash,
        broadcast: "relay",
        note: "Relayed.",
      },
      transactionHash: minedHash,
      decidedBy: "privy-wallet",
      live: true,
    });
    expect(view.kind).toBe("on-chain");
    expect(view.transactionHash).toBe(minedHash);
    expect(view.reference).toBeNull();
    expect(view.href).toBe(
      `https://hashscan.io/testnet/transaction/${minedHash}`
    );
  });

  it("reports no receipt on a refusal, which carries none", () => {
    const view = readReceipt({
      verdict: { allowed: false },
      decidedBy: "local-mirror",
      live: false,
    });
    expect(view).toEqual({
      kind: "none",
      transactionHash: null,
      reference: null,
      href: null,
    });
  });

  it("never links a stray hash beside a synthetic receipt", () => {
    const view = readReceipt({
      transactionHash: minedHash,
      live: true,
      receipt: { kind: "synthetic", reference: syntheticHash },
    });
    expect(view.kind).toBe("synthetic");
    expect(view.reference).toBe(syntheticHash);
    expect(view.href).toBeNull();
  });

  it("does not link an on-chain receipt whose hash is not a hash", () => {
    const view = readReceipt({
      receipt: { kind: "on-chain", transactionHash: "0x1234" },
    });
    expect(view.kind).toBe("on-chain");
    expect(view.href).toBeNull();
  });

  it("still reads the legacy flat shape without linking a stub", () => {
    const stub = readReceipt({ transactionHash: syntheticHash, live: false });
    expect(stub.kind).toBe("synthetic");
    expect(stub.reference).toBe(syntheticHash);
    expect(stub.href).toBeNull();

    const mined = readReceipt({ transactionHash: minedHash, live: true });
    expect(mined.kind).toBe("on-chain");
    expect(mined.href).not.toBeNull();

    const unnamed = readReceipt({ transactionHash: minedHash });
    expect(unnamed.kind).toBe("synthetic");
    expect(unnamed.href).toBeNull();
  });

  it("reports no receipt rather than guessing", () => {
    for (const value of [null, undefined, "0xdead", 7, {}, { live: true }]) {
      const view = readReceipt(value);
      expect(view.kind).toBe("none");
      expect(view.href).toBeNull();
    }
  });
});

describe("the anchor receipt", () => {
  it("links only a write that actually happened", () => {
    expect(
      anchorExplorerHref({ anchored: true, transactionHash: minedHash })
    ).toBe(`https://hashscan.io/testnet/transaction/${minedHash}`);
    // Anchored in an earlier run: true, but this run sent nothing.
    expect(anchorExplorerHref({ anchored: true })).toBeNull();
    expect(
      anchorExplorerHref({ anchored: false, transactionHash: minedHash })
    ).toBeNull();
    expect(anchorExplorerHref(undefined)).toBeNull();
    expect(anchorExplorerHref(null)).toBeNull();
  });
});

describe("configured addresses", () => {
  it("treats a malformed address exactly like an unset variable", () => {
    expect(parseEvmAddress(undefined)).toBeUndefined();
    expect(parseEvmAddress("")).toBeUndefined();
    expect(parseEvmAddress("0xnothex")).toBeUndefined();
    expect(parseEvmAddress(`${deployedAddress}00`)).toBeUndefined();
    expect(parseEvmAddress(` ${deployedAddress} `)).toBe(deployedAddress);
  });
});

describe("the treasury key state the banner switches on", () => {
  const base = { privyLive: false, pending: null, locked: true, failure: null } as const;

  it("confirms an allowed send with a synthetic receipt, which carries no hash", () => {
    expect(
      deriveTreasuryKeyState({
        ...base,
        settlement: { allowed: true, receiptKind: "synthetic" },
      })
    ).toBe("tx-confirmed");
  });

  it("rejects a refusal and fails an allowed send with no receipt at all", () => {
    expect(
      deriveTreasuryKeyState({
        ...base,
        settlement: { allowed: false, receiptKind: "none" },
      })
    ).toBe("tx-rejected");
    expect(
      deriveTreasuryKeyState({
        ...base,
        settlement: { allowed: true, receiptKind: "none" },
      })
    ).toBe("tx-failed");
  });
});

describe("failures from the locked contract", () => {
  it("sends a cold lock back to the lock step", () => {
    const view = describeFailure("lock_unknown", "");
    expect(view.action).toBe("relock");
    expect(view.sentence).toMatch(/lock the plan again/i);
  });

  it("keeps the server hint for the other 409s", () => {
    for (const code of ["plan_mismatch", "plan_blocked", "quorum_not_met"] as const) {
      const view = describeFailure(code, "Server words.");
      expect(view.sentence).toBe("Server words.");
      expect(view.title.length).toBeGreaterThan(0);
    }
    expect(describeFailure("plan_mismatch", undefined).action).toBe("reload");
    expect(describeFailure("quorum_not_met", undefined).sentence).toMatch(/officers/);
  });

  it("says how long to wait on a 429, once", () => {
    const bare = describeFailure("rate_limited", "Too many requests.", 12);
    expect(bare.action).toBe("wait");
    expect(bare.sentence).toBe("Too many requests. Try again in 12 seconds.");

    const told = describeFailure("rate_limited", "Wait 12 seconds and try again.", 12);
    expect(told.sentence).toBe("Wait 12 seconds and try again.");
  });
});
