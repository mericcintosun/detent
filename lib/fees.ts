// The network fee line in the send section.
//
// Two answers and nothing in between. On the keyless local mirror nothing is
// broadcast, so there is no fee to state and the console says exactly that. In
// real mode the figure is a read, never a constant: eth_estimateGas for the
// plan's own calldata and eth_gasPrice, both from the configured JSON-RPC relay,
// multiplied and printed in HBAR with the word "estimate" beside it. A read that
// fails is a failure state, not a guess.
//
// The relay quotes gas prices in weibars, which the Hedera JSON-RPC relay scales
// to 18 decimals so EVM tooling can treat HBAR like ether. So gas times gas
// price is an 18 decimal HBAR amount, converted here with bigint only.
//
// Pure apart from the injected fetch, so the unit tests drive both modes and
// every failure with a mocked fetch and no network.

import type { AdapterMode } from "@/lib/public-config";

/** The sentence the keyless mirror prints instead of a figure. */
export const MIRROR_FEE_SENTENCE = "No fee: local mirror, nothing is broadcast";

/** Decimals of a weibar amount as the JSON-RPC relay reports it. */
const RELAY_DECIMALS = 18n;

/** HBAR is quoted to tinybars, eight decimals. Anything finer is not money. */
const HBAR_DISPLAY_DECIMALS = 8;

export type FeeQuote =
  | { kind: "mirror"; sentence: string }
  | {
      kind: "estimate";
      /** Gas units from eth_estimateGas, decimal string. */
      gas: string;
      /** Weibars per gas from eth_gasPrice, decimal string. */
      gasPrice: string;
      /** gas times gasPrice in weibars, decimal string. */
      feeWei: string;
      /** The same amount in HBAR, for display. */
      hbar: string;
    }
  | { kind: "unavailable"; reason: string };

/** Parses a JSON-RPC quantity (0x prefixed hex) into a bigint, or null. */
export function parseQuantity(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) {
    return null;
  }
  return BigInt(value);
}

/**
 * An 18 decimal weibar amount as HBAR, rounded half up to eight decimals, with
 * trailing zeros trimmed but at least one decimal kept. Never a float.
 */
export function weiToHbar(wei: bigint): string {
  if (wei < 0n) throw new RangeError("a fee cannot be negative");
  const drop = RELAY_DECIMALS - BigInt(HBAR_DISPLAY_DECIMALS);
  const unit = 10n ** drop;
  const rounded = (wei + unit / 2n) / unit;
  const scale = 10n ** BigInt(HBAR_DISPLAY_DECIMALS);
  const whole = rounded / scale;
  const fraction = (rounded % scale)
    .toString()
    .padStart(HBAR_DISPLAY_DECIMALS, "0")
    .replace(/0+$/, "");
  return `${whole}.${fraction || "0"}`;
}

export interface FeeRequest {
  mode: AdapterMode;
  rpcUrl: string;
  from: `0x${string}`;
  to: `0x${string}`;
  data: `0x${string}`;
  fetchImpl?: typeof fetch;
  /** Budget for each of the two reads. */
  timeoutMs?: number;
}

interface RpcAnswer {
  result?: unknown;
  error?: { message?: unknown };
}

async function rpc(
  fetchImpl: typeof fetch,
  url: string,
  method: string,
  params: unknown[],
  timeoutMs: number,
): Promise<bigint> {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`${method} answered HTTP ${response.status}`);
  }
  const body = (await response.json()) as RpcAnswer;
  if (body.error) {
    const message =
      typeof body.error.message === "string"
        ? body.error.message
        : "an error without a message";
    throw new Error(`${method} returned ${message}`);
  }
  const value = parseQuantity(body.result);
  if (value === null) {
    throw new Error(`${method} returned no quantity`);
  }
  return value;
}

/**
 * The fee for sending `data` to `to` from `from`. The mirror answers without a
 * network call; real mode reads both values and multiplies them, and any failed
 * read comes back as `unavailable` with the reason in words.
 */
export async function quoteFee(request: FeeRequest): Promise<FeeQuote> {
  if (request.mode !== "real") {
    return { kind: "mirror", sentence: MIRROR_FEE_SENTENCE };
  }
  const fetchImpl = request.fetchImpl ?? fetch;
  const timeoutMs = request.timeoutMs ?? 9_000;
  try {
    const [gas, gasPrice] = await Promise.all([
      rpc(
        fetchImpl,
        request.rpcUrl,
        "eth_estimateGas",
        [{ from: request.from, to: request.to, data: request.data }],
        timeoutMs,
      ),
      rpc(fetchImpl, request.rpcUrl, "eth_gasPrice", [], timeoutMs),
    ]);
    const feeWei = gas * gasPrice;
    return {
      kind: "estimate",
      gas: gas.toString(),
      gasPrice: gasPrice.toString(),
      feeWei: feeWei.toString(),
      hbar: weiToHbar(feeWei),
    };
  } catch (error) {
    return {
      kind: "unavailable",
      reason:
        error instanceof Error && error.message
          ? `The relay did not return a fee estimate: ${error.message}.`
          : "The relay did not return a fee estimate.",
    };
  }
}

/**
 * Reads the fee route's answer without trusting its shape. Anything that is not
 * one of the three quote kinds is an unavailable estimate.
 */
export function readFeeQuote(value: unknown): FeeQuote {
  const unreadable: FeeQuote = {
    kind: "unavailable",
    reason:
      "The fee endpoint answered with something this build could not read.",
  };
  if (typeof value !== "object" || value === null) return unreadable;
  const envelope = value as Record<string, unknown>;
  if (envelope.ok !== true) {
    return {
      kind: "unavailable",
      reason:
        typeof envelope.hint === "string" ? envelope.hint : unreadable.reason,
    };
  }
  const data = envelope.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== "object") return unreadable;
  if (data.kind === "mirror" && typeof data.sentence === "string") {
    return { kind: "mirror", sentence: data.sentence };
  }
  if (
    data.kind === "estimate" &&
    typeof data.hbar === "string" &&
    typeof data.gas === "string" &&
    typeof data.gasPrice === "string" &&
    typeof data.feeWei === "string"
  ) {
    return {
      kind: "estimate",
      gas: data.gas,
      gasPrice: data.gasPrice,
      feeWei: data.feeWei,
      hbar: data.hbar,
    };
  }
  if (data.kind === "unavailable" && typeof data.reason === "string") {
    return { kind: "unavailable", reason: data.reason };
  }
  return unreadable;
}
