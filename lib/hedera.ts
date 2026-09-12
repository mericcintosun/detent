// Hedera / Asset Tokenization Studio integration.
//
// One function, two paths. When NEXT_PUBLIC_ATS_TOKEN_ADDRESS points at an ATS
// equity token on Hedera testnet, getRegisterSnapshot reads the holder set and
// the compliance verdicts straight off chain over the Hashio JSON-RPC relay.
// With no address configured (or if the relay answers BUSY, which testnet does
// under load) it falls back to the seed register in lib/data.ts so the console,
// the plan engine and the demo all still work.

import { createPublicClient, defineChain, http, parseAbi, stringToHex } from "viem";
import {
  holders as seedHolders,
  security,
  treasury,
  type ComplianceState,
  type Holder,
  type SecurityToken,
  type TreasuryAccount,
} from "@/lib/data";
import { CHAIN_ID } from "@/lib/plan";

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

export interface RegisterSnapshot {
  source: "hedera-testnet" | "seed";
  token: SecurityToken;
  treasury: TreasuryAccount;
  holders: Holder[];
  fetchedAt: string;
  note: string;
}

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

export async function getRegisterSnapshot(): Promise<RegisterSnapshot> {
  if (!TOKEN_ADDRESS) {
    return {
      source: "seed",
      token: security,
      treasury,
      holders: seedHolders,
      fetchedAt: new Date().toISOString(),
      note: "Seed register. Set NEXT_PUBLIC_ATS_TOKEN_ADDRESS to read the live ATS token.",
    };
  }

  try {
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

    return {
      source: "hedera-testnet",
      token: { ...security, address: TOKEN_ADDRESS },
      treasury,
      holders: live,
      fetchedAt: new Date().toISOString(),
      note: `Live read from ${RPC_URL} at chain ${CHAIN_ID}.`,
    };
  } catch {
    return {
      source: "seed",
      token: security,
      treasury,
      holders: seedHolders,
      fetchedAt: new Date().toISOString(),
      note: "Hashio did not answer, falling back to the cached register.",
    };
  }
}
