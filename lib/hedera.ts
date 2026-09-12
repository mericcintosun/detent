// Hedera / Asset Tokenization Studio integration.
//
// One entry point, two adapters. When the adapter seam is in real mode and
// NEXT_PUBLIC_ATS_TOKEN_ADDRESS points at an ATS equity token on Hedera testnet,
// liveRegisterAdapter reads the holder set and the compliance verdicts straight
// off chain over the Hashio JSON-RPC relay. Otherwise, and whenever the relay
// answers BUSY (which testnet does under load), getRegisterSnapshot serves the
// cached register from lib/adapter.ts so the console, the plan engine and the
// demo all still work.

import { createPublicClient, defineChain, http, parseAbi, stringToHex } from "viem";
import {
  fakeRegisterAdapter,
  useLiveRegister,
  type RegisterAdapter,
} from "@/lib/adapter";
import {
  holders as seedHolders,
  security,
  type ComplianceState,
  type Holder,
} from "@/lib/data";
import { CHAIN_ID } from "@/lib/plan";
import type { RegisterSnapshot } from "@/lib/types";

export type { RegisterSnapshot };

const RPC_URL =
  process.env.NEXT_PUBLIC_HEDERA_RPC_URL ?? "https://testnet.hashio.io/api";

const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_ATS_TOKEN_ADDRESS as
  | `0x${string}`
  | undefined;

export const hederaTestnet = defineChain({
  id: CHAIN_ID,
  name: "Hedera Testnet",
  nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: {
    default: { name: "HashScan", url: "https://hashscan.io/testnet" },
  },
});

// The slice of the ATS surface Detent actually reads. ERC-1410 for balances by
// partition, ERC-1594 for the compliance verdict on a would-be credit.
const ATS_ABI = parseAbi([
  "function balanceOfByPartition(bytes32 partition, address tokenHolder) view returns (uint256)",
  "function canTransfer(address to, uint256 value, bytes data) view returns (bool, bytes1, bytes32)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

export function hashscanToken(address: string): string {
  return `https://hashscan.io/testnet/contract/${address}`;
}

export function hashscanTransaction(hash: string): string {
  return `https://hashscan.io/testnet/transaction/${hash}`;
}

/** ERC-1594 reason codes map onto the compliance states the plan engine reads. */
function complianceFromCode(code: string): ComplianceState {
  switch (code) {
    case "0x56":
      return "allowlist-expired";
    case "0x57":
      return "kyc-lapsed";
    case "0x54":
      return "sanctions-hold";
    default:
      return "allowlist-expired";
  }
}

/**
 * The on chain path. Throws when the relay refuses, which is what lets
 * getRegisterSnapshot fall back to the cached register.
 */
export const liveRegisterAdapter: RegisterAdapter = {
  mode: "real",
  async load(): Promise<RegisterSnapshot> {
    if (!TOKEN_ADDRESS) {
      throw new Error("NEXT_PUBLIC_ATS_TOKEN_ADDRESS is not set.");
    }

    const client = createPublicClient({
      chain: hederaTestnet,
      transport: http(RPC_URL),
    });

    // TODO: swap this hand-rolled multicall for @hashgraph/asset-tokenization-sdk
    // once the SDK ships a browser-safe read client. The ABI above is the same
    // surface the SDK calls.
    const partitionBytes = stringToHex(security.partition, { size: 32 });

    const live = await Promise.all(
      seedHolders.map(async (holder) => {
        const [balance, verdict] = await Promise.all([
          client.readContract({
            address: TOKEN_ADDRESS,
            abi: ATS_ABI,
            functionName: "balanceOfByPartition",
            args: [partitionBytes, holder.address],
          }),
          client.readContract({
            address: TOKEN_ADDRESS,
            abi: ATS_ABI,
            functionName: "canTransfer",
            args: [holder.address, 1n, "0x"],
          }),
        ]);

        const [allowed, code] = verdict;
        const compliance: ComplianceState = allowed
          ? "clear"
          : complianceFromCode(code);

        return {
          ...holder,
          balance: Number(balance / BigInt(10) ** BigInt(security.decimals)),
          compliance,
          complianceNote: allowed
            ? "Allowlist entry valid, verified on chain."
            : `ATS compliance module refused a test credit, reason code ${code}.`,
        } satisfies Holder;
      })
    );

    const snapshot = await fakeRegisterAdapter.load();
    return {
      ...snapshot,
      source: "hedera-testnet",
      token: { ...security, address: TOKEN_ADDRESS },
      holders: live,
      note: `Live read from ${RPC_URL} at chain ${CHAIN_ID}.`,
    };
  },
};

export async function getRegisterSnapshot(): Promise<RegisterSnapshot> {
  const adapter: RegisterAdapter = useLiveRegister()
    ? liveRegisterAdapter
    : fakeRegisterAdapter;

  try {
    return await adapter.load();
  } catch {
    const fallback = await fakeRegisterAdapter.load();
    return {
      ...fallback,
      note: "Hashio did not answer, falling back to the cached register.",
    };
  }
}
