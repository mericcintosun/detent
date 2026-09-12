// The live ATS register read, without a network.
//
// Every eth_call below is answered by a viem custom transport that decodes the
// calldata against the ATS ABI and returns an ABI encoded result, so these
// tests pin the exact wire shape lib/hedera.ts sends to a real ATS token: the
// function selector, the explicit sender, the partition bytes32, and how the
// (bool, bytes1, bytes32) verdict becomes a compliance state.

import {
  createPublicClient,
  custom,
  decodeFunctionData,
  encodeErrorResult,
  encodeFunctionResult,
  keccak256,
  pad,
  stringToHex,
  toBytes,
  toFunctionSelector,
  type Hex,
} from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { holders } from "@/lib/data";
import {
  ATS_COMPLIANCE_ERRORS,
  ATS_DEFAULT_PARTITION,
  ATS_READ_ABI,
  decodeTransferVerdict,
  errorSelector,
  hederaTestnet,
  readHolderRows,
  resolveAtsPartition,
} from "@/lib/hedera";

const TOKEN = "0x00000000000000000000000000000000000a75e1" as const;
const FROM = "0x8b17f0a4c26e39d05b81f74a2c60e93d15b8027a" as const;

const SUCCESS = "0x01" as Hex;
const DISALLOWED = "0x10" as Hex;
const PAUSED = "0x42" as Hex;
const ZERO = pad("0x", { size: 32 });

function selectorOf(name: string): Hex {
  const item = ATS_COMPLIANCE_ERRORS.find((entry) => entry.name === name);
  if (!item) throw new Error(`no ATS error named ${name}`);
  return errorSelector(item);
}

/** A selector left aligned in bytes32, the way ATS returns its reason. */
function reasonFor(name: string): Hex {
  return pad(selectorOf(name), { dir: "right", size: 32 });
}

type Verdict = readonly [boolean, Hex, Hex];

interface RecordedCall {
  from?: string;
  functionName: string;
  selector: string;
  args: readonly unknown[];
}

/** A client whose relay answers from a verdict table keyed by holder address. */
function mockClient(
  verdicts: Record<string, Verdict>,
  balances: Record<string, bigint> = {},
) {
  const calls: RecordedCall[] = [];
  const client = createPublicClient({
    chain: hederaTestnet,
    transport: custom({
      async request({ method, params }) {
        if (method === "eth_chainId") return "0x128";
        if (method !== "eth_call") throw new Error(`unexpected ${method}`);
        const [call] = params as [{ from?: string; to: string; data: Hex }];
        const decoded = decodeFunctionData({
          abi: ATS_READ_ABI,
          data: call.data,
        });
        calls.push({
          from: call.from,
          functionName: decoded.functionName,
          selector: call.data.slice(0, 10),
          args: decoded.args ?? [],
        });
        if (decoded.functionName === "balanceOfByPartition") {
          const holder = (decoded.args[1] as string).toLowerCase();
          return encodeFunctionResult({
            abi: ATS_READ_ABI,
            functionName: "balanceOfByPartition",
            result: balances[holder] ?? 0n,
          });
        }
        const to = (decoded.args[1] as string).toLowerCase();
        return encodeFunctionResult({
          abi: ATS_READ_ABI,
          functionName: "canTransferByPartition",
          result: verdicts[to] ?? [true, SUCCESS, ZERO],
        });
      },
    }),
  });
  return { client, calls };
}

const target = { token: TOKEN, from: FROM, partition: ATS_DEFAULT_PARTITION };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("ATS error selectors", () => {
  it("are computed from the ATS signatures and match what solc emits", () => {
    expect(selectorOf("AccountIsBlocked")).toBe(
      keccak256(toBytes("AccountIsBlocked(address)")).slice(0, 10),
    );
    expect(selectorOf("InvalidKycStatus")).toBe(
      keccak256(toBytes("InvalidKycStatus()")).slice(0, 10),
    );
    for (const item of ATS_COMPLIANCE_ERRORS) {
      const args = item.inputs.map((input) =>
        input.type === "address" ? FROM : input.type === "bytes32" ? ZERO : 0n,
      );
      const encoded = encodeErrorResult({
        abi: [item],
        errorName: item.name,
        args,
      } as Parameters<typeof encodeErrorResult>[0]);
      expect(errorSelector(item)).toBe(encoded.slice(0, 10));
    }
  });
});

describe("partition configuration", () => {
  it("defaults to the ATS single partition value 0x00..01", () => {
    expect(resolveAtsPartition(undefined)).toBe(ATS_DEFAULT_PARTITION);
    expect(resolveAtsPartition("  ")).toBe(ATS_DEFAULT_PARTITION);
    expect(BigInt(ATS_DEFAULT_PARTITION)).toBe(1n);
  });

  it("encodes a label as bytes32 and takes a 32 byte hex value as is", () => {
    expect(resolveAtsPartition("CLASS-A")).toBe(
      stringToHex("CLASS-A", { size: 32 }),
    );
    const raw = `0x${"AB".repeat(32)}`;
    expect(resolveAtsPartition(raw)).toBe(raw.toLowerCase());
  });

  it("refuses a label that cannot fit in bytes32", () => {
    expect(() => resolveAtsPartition("X".repeat(33))).toThrow(
      "longer than 32 bytes",
    );
  });
});

describe("the per holder read", () => {
  it("calls the by-partition functions with the explicit sender and partition", async () => {
    const { client, calls } = mockClient({});
    await readHolderRows(client, target, holders.slice(0, 1));

    const check = calls.find(
      (c) => c.functionName === "canTransferByPartition",
    );
    const balance = calls.find(
      (c) => c.functionName === "balanceOfByPartition",
    );
    expect(check?.selector).toBe(
      toFunctionSelector(
        "canTransferByPartition(address,address,bytes32,uint256,bytes,bytes)",
      ),
    );
    expect(balance?.selector).toBe(
      toFunctionSelector("balanceOfByPartition(bytes32,address)"),
    );
    expect(check?.from?.toLowerCase()).toBe(FROM);
    expect((check?.args[0] as string).toLowerCase()).toBe(FROM);
    expect((check?.args[1] as string).toLowerCase()).toBe(holders[0].address);
    expect(check?.args[2]).toBe(ATS_DEFAULT_PARTITION);
    expect(balance?.args[0]).toBe(ATS_DEFAULT_PARTITION);
  });

  it("sends a configured label partition to both reads", async () => {
    const { client, calls } = mockClient({});
    const partition = resolveAtsPartition("CLASS-A");
    await readHolderRows(client, { ...target, partition }, holders.slice(0, 1));

    expect(calls).toHaveLength(2);
    for (const call of calls) {
      const value =
        call.functionName === "balanceOfByPartition"
          ? call.args[0]
          : call.args[2];
      expect(value).toBe(stringToHex("CLASS-A", { size: 32 }));
    }
  });

  it("maps success, allowlist, KYC and an unknown code onto honest rows", async () => {
    const [clear, blocked, lapsed, odd] = holders;
    const { client } = mockClient(
      {
        [blocked.address]: [false, DISALLOWED, reasonFor("AccountIsBlocked")],
        [lapsed.address]: [false, DISALLOWED, reasonFor("InvalidKycStatus")],
        [odd.address]: [
          false,
          "0x99",
          pad("0xdeadbeef", { dir: "right", size: 32 }),
        ],
      },
      { [clear.address]: 182_500_000_000n },
    );

    const rows = await readHolderRows(client, target, [
      clear,
      blocked,
      lapsed,
      odd,
    ]);

    expect(rows.every((row) => row.read)).toBe(true);
    expect(rows[0].holder.compliance).toBe("clear");
    expect(rows[0].holder.balance).toBe(182_500);
    expect(rows[1].holder.compliance).toBe("allowlist-expired");
    expect(rows[1].holder.complianceNote).toContain("AccountIsBlocked");
    expect(rows[2].holder.compliance).toBe("kyc-lapsed");
    expect(rows[2].holder.complianceNote).toContain("InvalidKycStatus");
    expect(rows[3].holder.compliance).toBe("unrecognised");
    expect(rows[3].holder.complianceNote).toBe(
      "Unrecognised compliance code 0x99 / selector 0xdeadbeef. The holder is held until someone reads it.",
    );
  });

  it("keeps a row on its seed values when that one read fails", async () => {
    const client = createPublicClient({
      chain: hederaTestnet,
      transport: custom(
        {
          async request() {
            throw new Error("BUSY");
          },
        },
        { retryCount: 0 },
      ),
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const [row] = await readHolderRows(client, target, holders.slice(0, 1));
    expect(row.read).toBe(false);
    expect(row.holder.compliance).toBe(holders[0].compliance);
    expect(row.holder.complianceNote).toContain("Not read on chain");
  });
});

describe("the verdict decoder", () => {
  it("is clear only for the full success shape", () => {
    expect(decodeTransferVerdict([true, SUCCESS, ZERO]).compliance).toBe(
      "clear",
    );
    const halfSuccess = decodeTransferVerdict([true, DISALLOWED, ZERO]);
    expect(halfSuccess.compliance).toBe("unrecognised");
    expect(halfSuccess.complianceNote).toContain("not the success shape");
    expect(decodeTransferVerdict([false, SUCCESS, ZERO]).compliance).not.toBe(
      "clear",
    );
  });

  it("names a pause, an ERC-3643 refusal and a known unmapped error", () => {
    expect(
      decodeTransferVerdict([false, PAUSED, reasonFor("IsPaused")]).compliance,
    ).toBe("paused");
    expect(
      decodeTransferVerdict([
        false,
        DISALLOWED,
        reasonFor("ComplianceNotAllowed"),
      ]).compliance,
    ).toBe("sanctions-hold");
    const recovered = decodeTransferVerdict([
      false,
      "0x16",
      reasonFor("WalletRecovered"),
    ]);
    expect(recovered.compliance).toBe("unrecognised");
    expect(recovered.errorName).toBe("WalletRecovered");
    expect(recovered.complianceNote).toContain("does not map");
  });
});

describe("configuration errors", () => {
  function stubDeadRelay() {
    const relay = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    vi.stubGlobal("fetch", relay);
    return relay;
  }

  async function loadWith(env: Record<string, string>) {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    vi.resetModules();
    return import("@/lib/hedera");
  }

  it("refuses the live read without a sender and never calls the relay", async () => {
    const relay = stubDeadRelay();
    const { liveRegisterAdapter } = await loadWith({
      NEXT_PUBLIC_ADAPTER_MODE: "real",
      NEXT_PUBLIC_ATS_TOKEN_ADDRESS: TOKEN,
      NEXT_PUBLIC_ATS_CHECK_FROM_ADDRESS: "",
    });

    await expect(liveRegisterAdapter.load()).rejects.toMatchObject({
      name: "AtsConfigError",
      message: expect.stringContaining("NEXT_PUBLIC_ATS_CHECK_FROM_ADDRESS"),
    });
    expect(relay).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("falls back to the cached register and says it was configuration", async () => {
    const relay = stubDeadRelay();
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { getRegisterSnapshot } = await loadWith({
      NEXT_PUBLIC_ADAPTER_MODE: "real",
      NEXT_PUBLIC_ATS_TOKEN_ADDRESS: TOKEN,
      NEXT_PUBLIC_ATS_CHECK_FROM_ADDRESS: "not-an-address",
    });

    const snapshot = await getRegisterSnapshot();

    expect(snapshot.source).toBe("seed");
    expect(snapshot.holders).toHaveLength(holders.length);
    expect(snapshot.note).toContain("configuration error");
    expect(logged.mock.calls[0]?.[0]).toContain("misconfigured");
    expect(relay).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("refuses an over long partition label before any call", async () => {
    const relay = stubDeadRelay();
    const { liveRegisterAdapter } = await loadWith({
      NEXT_PUBLIC_ADAPTER_MODE: "real",
      NEXT_PUBLIC_ATS_TOKEN_ADDRESS: TOKEN,
      NEXT_PUBLIC_ATS_CHECK_FROM_ADDRESS: FROM,
      NEXT_PUBLIC_ATS_PARTITION: "P".repeat(40),
    });

    await expect(liveRegisterAdapter.load()).rejects.toThrow(
      "longer than 32 bytes",
    );
    expect(relay).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
