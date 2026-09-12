// Hedera / Asset Tokenization Studio integration.
//
// One entry point, two adapters. When the adapter seam is in real mode and
// NEXT_PUBLIC_ATS_TOKEN_ADDRESS points at an ATS equity token on Hedera testnet,
// liveRegisterAdapter reads the holder set and the compliance verdicts straight
// off chain over the Hashio JSON-RPC relay. Otherwise, and whenever the relay
// answers BUSY (which testnet does under load), getRegisterSnapshot serves the
// cached register from lib/adapter.ts so the console, the plan engine and the
// demo all still work.
//
// Server side only: it reads lib/config.ts. The console imports its HashScan
// links from lib/hashscan.ts instead, which keeps viem and the relay out of the
// browser bundle.

import { createPublicClient, defineChain, http, parseAbi, stringToHex } from "viem";
import {
  fakeRegisterAdapter,
  useLiveRegister,
  type RegisterAdapter,
} from "@/lib/adapter";
import {
  ATS_TOKEN_ADDRESS,
  CHAIN_ID,
  HASHSCAN_BASE,
  HEDERA_RPC_URL,
  LOG_PREFIX,
  RETRY_COUNT,
  RPC_TIMEOUT_MS,
} from "@/lib/config";
import {
  holders as seedHolders,
  security,
  type ComplianceState,
  type Holder,
} from "@/lib/data";
import type { RegisterSnapshot } from "@/lib/types";

export type { RegisterSnapshot };
export { hashscanToken, hashscanTransaction } from "@/lib/hashscan";

export const hederaTestnet = defineChain({
  id: CHAIN_ID,
  name: "Hedera Testnet",
  nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
  rpcUrls: { default: { http: [HEDERA_RPC_URL] } },
  blockExplorers: {
    default: { name: "HashScan", url: HASHSCAN_BASE },
  },
});

/**
 * One client shape for every relay call in the product: the register read here
 * and the raw broadcast in lib/privy.ts. The timeout and the single retry come
 * from lib/config.ts, so Hashio answering BUSY costs one bounded wait, not a
 * hung request.
 */
export function hederaPublicClient() {
  return createPublicClient({
    chain: hederaTestnet,
    transport: http(HEDERA_RPC_URL, {
      timeout: RPC_TIMEOUT_MS,
      retryCount: RETRY_COUNT,
    }),
  });
}

// The slice of the ATS surface Detent actually reads. ERC-1410 for balances by
// partition, ERC-1594 for the compliance verdict on a would-be credit.
const ATS_ABI = parseAbi([
  "function balanceOfByPartition(bytes32 partition, address tokenHolder) view returns (uint256)",
  "function canTransfer(address to, uint256 value, bytes data) view returns (bool, bytes1, bytes32)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

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
 * The on chain path. Throws when the relay refuses outright, which is what lets
 * getRegisterSnapshot fall back to the cached register. A single holder that
 * fails to read does not throw: that row keeps its seed values and says so, so
 * eleven live rows are not lost to one bad call.
 */
export const liveRegisterAdapter: RegisterAdapter = {
  mode: "real",
  async load(): Promise<RegisterSnapshot> {
    if (!ATS_TOKEN_ADDRESS) {
      throw new Error("NEXT_PUBLIC_ATS_TOKEN_ADDRESS is not set.");
    }
    const tokenAddress = ATS_TOKEN_ADDRESS;

    const client = hederaPublicClient();

    // TODO: swap this hand-rolled multicall for @hashgraph/asset-tokenization-sdk
    // once the SDK ships a browser-safe read client. The ABI above is the same
    // surface the SDK calls.
    const partitionBytes = stringToHex(security.partition, { size: 32 });

    const results = await Promise.all(
      seedHolders.map(async (holder): Promise<{ holder: Holder; read: boolean }> => {
        try {
          const [balance, verdict] = await Promise.all([
            client.readContract({
              address: tokenAddress,
              abi: ATS_ABI,
              functionName: "balanceOfByPartition",
              args: [partitionBytes, holder.address],
            }),
            client.readContract({
              address: tokenAddress,
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
            read: true,
            holder: {
              ...holder,
              balance: Number(
                balance / BigInt(10) ** BigInt(security.decimals)
              ),
              compliance,
              complianceNote: allowed
                ? "Allowlist entry valid, verified on chain."
                : `ATS compliance module refused a test credit, reason code ${code}.`,
            },
          };
        } catch (error) {
          console.warn(
            `${LOG_PREFIX} register row unread for ${holder.accountId}:`,
            error instanceof Error ? error.message : "unknown relay failure"
          );
          return {
            read: false,
            holder: {
              ...holder,
              complianceNote: `Not read on chain in this snapshot, showing the cached value. ${holder.complianceNote}`,
            },
          };
        }
      })
    );

    const unread = results.filter((entry) => !entry.read).length;
    if (unread === results.length && results.length > 0) {
      throw new Error("Every holder read failed against the relay.");
    }

    const snapshot = await fakeRegisterAdapter.load();
    return {
      ...snapshot,
      source: "hedera-testnet",
      token: { ...security, address: tokenAddress },
      holders: results.map((entry) => entry.holder),
      note:
        unread === 0
          ? `Live read from ${HEDERA_RPC_URL} at chain ${CHAIN_ID}.`
          : `Live read from ${HEDERA_RPC_URL} at chain ${CHAIN_ID}. ${unread} of ${results.length} rows could not be read and show their cached values.`,
    };
  },
};

export async function getRegisterSnapshot(): Promise<RegisterSnapshot> {
  const live = useLiveRegister();
  const adapter: RegisterAdapter = live
    ? liveRegisterAdapter
    : fakeRegisterAdapter;
  const startedAt = Date.now();

  try {
    const snapshot = await adapter.load();
    console.info(
      `${LOG_PREFIX} register read ok: ${snapshot.holders.length} holders, source ${snapshot.source}, ${Date.now() - startedAt}ms`
    );
    return snapshot;
  } catch (error) {
    // The silent fallback is what keeps the demo alive, and it is also what
    // hides a relay failure while the live read is being wired, so say it out
    // loud in the server log.
    console.error(
      `${LOG_PREFIX} register read failed after ${Date.now() - startedAt}ms, falling back to the cached register:`,
      error instanceof Error ? error.message : "unknown read failure"
    );
    const fallback = await fakeRegisterAdapter.load();
    return {
      ...fallback,
      note: "Hashio did not answer, falling back to the cached register.",
    };
  }
}
