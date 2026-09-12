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

import {
  createPublicClient,
  defineChain,
  http,
  parseAbi,
  stringToHex,
  toFunctionSelector,
  type Hex,
  type PublicClient,
} from "viem";
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
  REGISTER_CACHE_MS,
  RETRY_COUNT,
  RPC_TIMEOUT_MS,
  SETTLEMENT_TOKEN_ADDRESS,
} from "@/lib/config";
import {
  holders as seedHolders,
  security,
  treasury,
  type ComplianceState,
  type Holder,
} from "@/lib/data";
import { ATS_CHECK_FROM_ADDRESS, ATS_PARTITION } from "@/lib/public-config";
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

/** A misconfigured live read. Falls back to the cached register, said out loud. */
export class AtsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AtsConfigError";
  }
}

/**
 * ATS `_DEFAULT_PARTITION`, bytes32(uint256(1)), from contracts/constants/values.sol.
 * A single partition token accepts no other partition on its by-partition entry
 * points, so this is the default whenever NEXT_PUBLIC_ATS_PARTITION is empty.
 */
export const ATS_DEFAULT_PARTITION: Hex =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

/**
 * The configured partition as bytes32. Empty is the ATS default partition, a
 * 32 byte hex value is taken as is, anything else is a label such as CLASS-A,
 * right padded the way stringToHex pads it. A label past 32 bytes cannot be a
 * partition, so it is a configuration error rather than a silent truncation.
 */
export function resolveAtsPartition(setting: string | undefined): Hex {
  const value = setting?.trim();
  if (!value) return ATS_DEFAULT_PARTITION;
  if (/^0x[0-9a-fA-F]{64}$/.test(value)) return value.toLowerCase() as Hex;
  if (new TextEncoder().encode(value).length > 32) {
    throw new AtsConfigError(
      `NEXT_PUBLIC_ATS_PARTITION "${value}" is longer than 32 bytes, so it cannot be encoded as a bytes32 partition.`,
    );
  }
  return stringToHex(value, { size: 32 });
}

// The slice of the ATS surface Detent reads, as declared in the ATS v8 sources
// and registered in the equity configuration of the 2026-06-12 testnet BLR:
// IBalanceTrackerByPartition.balanceOfByPartition and
// IComplianceByPartition.canTransferByPartition. The by-partition check is the
// one that works in both partition modes: ComplianceFacet.canTransfer carries
// onlyWithoutMultiPartition and reverts on a multi partition token, while
// canTransferByPartition only validates that the sender holds the partition,
// which the default partition satisfies on a single partition token.
export const ATS_READ_ABI = parseAbi([
  "function balanceOfByPartition(bytes32 _partition, address _tokenHolder) view returns (uint256)",
  "function canTransferByPartition(address _from, address _to, bytes32 _partition, uint256 _value, bytes _data, bytes _operatorData) view returns (bool, bytes1, bytes32)",
]);

// The settlement asset is a plain ERC-20 on the same chain, so its balance read
// is its own tiny surface rather than another entry on the ATS ABI.
const SETTLEMENT_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
]);

/**
 * Every error selector the ATS transfer check can put in its bytes32 reason,
 * copied as signatures from the ATS sources (ICommonErrors, IKyc, IPause,
 * IERC3643Types, IClearingTypes, IERC1410Types, ITransfer, IAllowanceTypes).
 * The selectors are computed from these, never typed by hand.
 */
export const ATS_COMPLIANCE_ERRORS = parseAbi([
  "error AccountIsBlocked(address account)",
  "error InvalidKycStatus()",
  "error IsPaused()",
  "error ComplianceNotAllowed()",
  "error ComplianceCallFailed()",
  "error AddressNotVerified()",
  "error IdentityRegistryCallFailed()",
  "error WalletRecovered()",
  "error ZeroAddressNotAllowed()",
  "error ClearingIsActivated()",
  "error InvalidPartition(address account, bytes32 partition)",
  "error InsufficientBalance(address account, uint256 balance, uint256 value, bytes32 partition)",
  "error InsufficientAllowance(address spender, address from)",
]);

/**
 * The 4 byte selector of an error, from its canonical `Name(type,...)` form.
 * Built by hand from the parsed item on purpose: viem's toFunctionSelector
 * mis-normalises an `error` item and returns a different hash. None of the
 * errors above take tuples, so the flat type list is the canonical signature.
 */
export function errorSelector(
  item: (typeof ATS_COMPLIANCE_ERRORS)[number],
): Hex {
  return toFunctionSelector(
    `${item.name}(${item.inputs.map((input) => input.type).join(",")})`,
  );
}

const ERROR_NAME_BY_SELECTOR = new Map<string, string>(
  ATS_COMPLIANCE_ERRORS.map((item) => [errorSelector(item), item.name]),
);

/** EIP-1066 SUCCESS, which is what ATS returns beside a zero reason. */
const EIP1066_SUCCESS = "0x01";
const ZERO_REASON = `0x${"0".repeat(64)}`;

/** The refusals Detent can name, and the sentence each one gets. */
const HOLD_BY_ERROR: Record<string, { state: ComplianceState; note: string }> =
  {
    AccountIsBlocked: {
      state: "allowlist-expired",
      note: "ATS control list refused a test credit: the holder is not on the allowlist",
    },
    InvalidKycStatus: {
      state: "kyc-lapsed",
      note: "ATS KYC check refused a test credit: no valid KYC grant for the holder",
    },
    IsPaused: {
      state: "paused",
      note: "The ATS token is paused, so no credit can settle to any holder",
    },
    ComplianceNotAllowed: {
      state: "compliance-refused",
      note: "The ERC-3643 compliance contract bound to the token refused a test credit",
    },
  };

export interface TransferVerdict {
  compliance: ComplianceState;
  complianceNote: string;
  statusCode: Hex;
  reasonSelector: Hex;
  errorName?: string;
}

/**
 * Reads the (bool, bytes1, bytes32) an ATS transfer check returns. The bytes1
 * is an EIP-1066 status code and the bytes32 is a 4 byte error selector, left
 * aligned. Only the full success shape is clear: anything else is held, and a
 * refusal Detent cannot name says so with its raw codes.
 */
export function decodeTransferVerdict(
  verdict: readonly [boolean, Hex, Hex],
): TransferVerdict {
  const [allowed, rawStatus, rawReason] = verdict;
  const statusCode = rawStatus.toLowerCase() as Hex;
  const reason = rawReason.toLowerCase();
  const reasonSelector = reason.slice(0, 10) as Hex;

  if (allowed && statusCode === EIP1066_SUCCESS && reason === ZERO_REASON) {
    return {
      compliance: "clear",
      complianceNote: "Allowlist entry valid, verified on chain.",
      statusCode,
      reasonSelector,
    };
  }

  const errorName = ERROR_NAME_BY_SELECTOR.get(reasonSelector);
  const codes = `status ${statusCode}, selector ${reasonSelector}`;
  const hold = !allowed && errorName ? HOLD_BY_ERROR[errorName] : undefined;
  if (hold) {
    return {
      compliance: hold.state,
      complianceNote: `${hold.note} (${errorName}, ${codes}).`,
      statusCode,
      reasonSelector,
      errorName,
    };
  }

  const complianceNote = allowed
    ? `ATS reported the credit as allowed with ${codes}, which is not the success shape, so the holder is held until someone reads it.`
    : errorName
      ? `ATS refused a test credit with ${errorName} (${codes}), which Detent does not map to a hold category, so the holder is held.`
      : `Unrecognised compliance code ${statusCode} / selector ${reasonSelector}. The holder is held until someone reads it.`;
  return {
    compliance: "unrecognised",
    complianceNote,
    statusCode,
    reasonSelector,
    errorName,
  };
}

/** Where a live read points: the token, the sender it checks from, the partition. */
export interface AtsReadTarget {
  token: `0x${string}`;
  from: `0x${string}`;
  partition: Hex;
}

export interface HolderRead {
  holder: Holder;
  read: boolean;
}

/**
 * Two reads per holder: the balance on the partition, and whether the sender
 * could move one base unit to that holder on the same partition. The sender is
 * passed twice, as `_from` and as the eth_call `from`, because ATS also checks
 * msg.sender and its allowance when the two differ.
 *
 * A single holder that fails to read does not throw: that row keeps its seed
 * values and says so, so eleven live rows are not lost to one bad call.
 */
export async function readHolderRows(
  client: PublicClient,
  target: AtsReadTarget,
  holders: Holder[],
): Promise<HolderRead[]> {
  return Promise.all(
    holders.map(async (holder): Promise<HolderRead> => {
      try {
        const [balance, verdict] = await Promise.all([
          client.readContract({
            address: target.token,
            abi: ATS_READ_ABI,
            functionName: "balanceOfByPartition",
            args: [target.partition, holder.address],
          }),
          client.readContract({
            address: target.token,
            abi: ATS_READ_ABI,
            functionName: "canTransferByPartition",
            args: [
              target.from,
              holder.address,
              target.partition,
              1n,
              "0x",
              "0x",
            ],
            account: target.from,
          }),
        ]);

        const decoded = decodeTransferVerdict(verdict);
        return {
          read: true,
          holder: {
            ...holder,
            balance: Number(balance / BigInt(10) ** BigInt(security.decimals)),
            compliance: decoded.compliance,
            complianceNote: decoded.complianceNote,
          },
        };
      } catch (error) {
        console.warn(
          `${LOG_PREFIX} register row unread for ${holder.accountId}:`,
          error instanceof Error ? error.message : "unknown relay failure",
        );
        return {
          read: false,
          holder: {
            ...holder,
            complianceNote: `Not read on chain in this snapshot, showing the cached value. ${holder.complianceNote}`,
          },
        };
      }
    }),
  );
}

/**
 * The on chain path. Throws when the relay refuses outright, which is what lets
 * getRegisterSnapshot fall back to the cached register, and throws an
 * AtsConfigError before any call when the read is not fully configured.
 */
export const liveRegisterAdapter: RegisterAdapter = {
  mode: "real",
  async load(): Promise<RegisterSnapshot> {
    if (!ATS_TOKEN_ADDRESS) {
      throw new AtsConfigError("NEXT_PUBLIC_ATS_TOKEN_ADDRESS is not set.");
    }
    if (!ATS_CHECK_FROM_ADDRESS) {
      throw new AtsConfigError(
        "NEXT_PUBLIC_ATS_CHECK_FROM_ADDRESS is not set or is not a 20 byte address. The compliance read needs a sender that holds the token, has KYC and is on the control list, usually the issuer treasury.",
      );
    }
    const target: AtsReadTarget = {
      token: ATS_TOKEN_ADDRESS,
      from: ATS_CHECK_FROM_ADDRESS,
      partition: resolveAtsPartition(ATS_PARTITION),
    };

    const client = hederaPublicClient();

    // The reads are hand rolled against the ABI declared above rather than
    // taken from @hashgraph/asset-tokenization-sdk. That SDK is not a dependency
    // of this build: it pulls a Hedera SDK client and wallet transports into a
    // Next server bundle for two view calls, and it signs only through a wallet
    // or a custodian, never a plain key. One viem client, one partition, two
    // reads per holder is the whole ATS surface the product uses.
    const results = await readHolderRows(client, target, seedHolders);

    const unread = results.filter((entry) => !entry.read).length;
    if (unread === results.length && results.length > 0) {
      throw new Error("Every holder read failed against the relay.");
    }

    // The treasury cover, read on chain so the headroom under the plan totals
    // is a real number rather than a seed constant. The fallback is here rather
    // than in a comment: no settlement token configured, or a relay that will
    // not answer, keeps treasury.balanceMicros from lib/data.ts and says so in
    // the note.
    let coverMicros = treasury.balanceMicros;
    let coverNote =
      "Treasury cover is the cached figure: NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS is not set.";
    if (SETTLEMENT_TOKEN_ADDRESS) {
      try {
        const balance = await client.readContract({
          address: SETTLEMENT_TOKEN_ADDRESS,
          abi: SETTLEMENT_ABI,
          functionName: "balanceOf",
          args: [treasury.address],
        });
        coverMicros = balance.toString();
        coverNote = `Treasury cover read from ${SETTLEMENT_TOKEN_ADDRESS}.`;
      } catch (error) {
        console.warn(
          `${LOG_PREFIX} treasury cover unread, keeping the cached figure:`,
          error instanceof Error ? error.message : "unknown relay failure",
        );
        coverNote =
          "Treasury cover is the cached figure: the settlement token balance could not be read in this snapshot.";
      }
    }

    const snapshot = await fakeRegisterAdapter.load();
    const readNote = `Live read from ${HEDERA_RPC_URL} at chain ${CHAIN_ID}, partition ${target.partition}, compliance checked from ${target.from}.`;
    const rowNote =
      unread === 0
        ? readNote
        : `${readNote} ${unread} of ${results.length} rows could not be read and show their cached values.`;

    return {
      ...snapshot,
      source: "hedera-testnet",
      token: { ...security, address: target.token },
      treasury: { ...treasury, balanceMicros: coverMicros },
      holders: results.map((entry) => entry.holder),
      note: `${rowNote} ${coverNote}`,
    };
  },
};

/**
 * One snapshot is reused for REGISTER_CACHE_MS. Module scope, so it survives
 * warm invocations only, which is exactly the lifetime it needs: the demo walks
 * the page several times in a row and must not pay 12 holders times three relay
 * reads each time. app/page.tsx sets the matching revalidate window.
 */
let cached: { at: number; snapshot: RegisterSnapshot } | null = null;

export async function getRegisterSnapshot(): Promise<RegisterSnapshot> {
  if (cached && Date.now() - cached.at < REGISTER_CACHE_MS) {
    return cached.snapshot;
  }

  const live = useLiveRegister();
  const adapter: RegisterAdapter = live
    ? liveRegisterAdapter
    : fakeRegisterAdapter;
  const startedAt = Date.now();

  try {
    const snapshot = await adapter.load();
    console.info(
      `${LOG_PREFIX} register read ok: ${snapshot.holders.length} holders, source ${snapshot.source}, ${Date.now() - startedAt}ms`,
    );
    cached = { at: Date.now(), snapshot };
    return snapshot;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown read failure";
    const misconfigured = error instanceof AtsConfigError;
    // The silent fallback is what keeps the demo alive, and it is also what
    // hides a relay failure or a half configured live read, so say which one it
    // was out loud in the server log and in the register note.
    console.error(
      misconfigured
        ? `${LOG_PREFIX} register live read is misconfigured, falling back to the cached register:`
        : `${LOG_PREFIX} register read failed after ${Date.now() - startedAt}ms, falling back to the cached register:`,
      message,
    );
    // Deliberately not cached: a relay that recovers should show on the next
    // navigation rather than after the full REGISTER_CACHE_MS window.
    const fallback = await fakeRegisterAdapter.load();
    return {
      ...fallback,
      note: misconfigured
        ? `Live read not attempted, configuration error: ${message} Showing the cached register.`
        : "Hashio did not answer, falling back to the cached register.",
    };
  }
}
