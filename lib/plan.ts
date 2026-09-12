// The plan engine.
//
// It replays a corporate action against the holder set off chain and produces
// two things: a line by line preview an operator can read, and the exact
// calldata that preview implies. Everything downstream (the Privy policy, the
// audit record, the on chain anchor) is derived from the same object, which is
// the whole point of the product: what you approved is what the key can sign.

import {
  encodeFunctionData,
  keccak256,
  parseAbiItem,
  stringToHex,
  toFunctionSelector,
  toHex,
  type Hex,
} from "viem";
import {
  actions,
  couponMicrosPerToken,
  couponWindow,
  recoveryCustodian,
  security,
  treasury,
  type ActionKind,
  type Holder,
} from "@/lib/data";
import { ADAPTER_MODE, ATS_TOKEN_ADDRESS, CHAIN_ID } from "@/lib/public-config";

export { CHAIN_ID };

/**
 * The contract the plan calls. In real mode with a token address configured
 * that is the live ATS token, the same address the register is read from; the
 * seed fixture address is only the target of the cached register. Read from
 * NEXT_PUBLIC_ values so the console and the API route, which both build the
 * plan, always agree on it, and so the plan hash they each compute matches.
 */
export function planTarget(): `0x${string}` {
  return ADAPTER_MODE === "real" && ATS_TOKEN_ADDRESS
    ? ATS_TOKEN_ADDRESS
    : security.address;
}

const COUPON_ABI = parseAbiItem(
  "function distributeCoupon(bytes32 partition, address[] holders, uint256[] amounts)",
);

const FORCED_TRANSFER_ABI = parseAbiItem(
  "function operatorTransferByPartition(bytes32 partition, address from, address to, uint256 value, bytes data, bytes operatorData) returns (bytes32)",
);

export interface PlanRow {
  holderId: string;
  legalName: string;
  jurisdiction: string;
  accountId: string;
  address: `0x${string}`;
  balance: number;
  /** Settlement amount in micro units, as a decimal string. */
  amountMicros: string;
  held: boolean;
  holdReason: string | null;
  included: boolean;
}

export interface Plan {
  kind: ActionKind;
  label: string;
  authority: string;
  signature: string;
  selector: Hex;
  target: `0x${string}`;
  chainId: number;
  reference: string;
  rows: PlanRow[];
  drawMicros: string;
  treasuryMicros: string;
  headroomMicros: string;
  blockers: string[];
  calldata: Hex;
  planHash: Hex;
}

export interface PlanInput {
  kind: ActionKind;
  /** Clear holders the operator pulled out of this run. */
  deferred?: string[];
  /** Held holders the operator tried to force back in. */
  forced?: string[];
  holders: Holder[];
  /**
   * Settlement asset cover in micro units. The console passes the figure from
   * the register snapshot, which is read on chain when a settlement token is
   * configured. Absent falls back to the seed treasury in lib/data.ts.
   */
  treasuryMicros?: string;
}

const HOLD_LABELS: Record<string, string> = {
  "allowlist-expired": "Allowlist entry expired",
  "kyc-lapsed": "KYC refresh overdue",
  "sanctions-hold": "Sanctions screening hold",
  "compliance-refused": "Compliance contract hold",
};

const partitionBytes32 = stringToHex(security.partition, { size: 32 });

export function buildCalldata(
  kind: ActionKind,
  rows: Array<{ address: `0x${string}`; amountMicros: string }>,
): Hex {
  if (kind === "coupon") {
    return encodeFunctionData({
      abi: [COUPON_ABI],
      functionName: "distributeCoupon",
      args: [
        partitionBytes32,
        rows.map((row) => row.address),
        rows.map((row) => BigInt(row.amountMicros)),
      ],
    });
  }
  const row = rows[0];
  return encodeFunctionData({
    abi: [FORCED_TRANSFER_ABI],
    functionName: "operatorTransferByPartition",
    args: [
      partitionBytes32,
      row.address,
      recoveryCustodian,
      BigInt(row.amountMicros),
      "0x",
      "0x",
    ],
  });
}

export function selectorFor(kind: ActionKind): Hex {
  return toFunctionSelector(
    kind === "coupon" ? COUPON_ABI : FORCED_TRANSFER_ABI,
  );
}

function hashPlan(
  kind: ActionKind,
  target: string,
  rows: Array<{ address: string; amountMicros: string }>,
): Hex {
  const canonical = [
    `detent.v1`,
    kind,
    String(CHAIN_ID),
    target.toLowerCase(),
    couponWindow.reference,
    ...rows.map((row) => `${row.address.toLowerCase()}:${row.amountMicros}`),
  ].join("|");
  return keccak256(toHex(canonical));
}

export function buildPlan({
  kind,
  deferred = [],
  forced = [],
  holders,
  treasuryMicros,
}: PlanInput): Plan {
  const action = actions.find((entry) => entry.kind === kind) ?? actions[0];
  const rows: PlanRow[] = [];

  if (kind === "coupon") {
    for (const holder of holders) {
      const held = isHeldHolder(holder);
      const forcedIn = forced.includes(holder.id);
      rows.push({
        holderId: holder.id,
        legalName: holder.legalName,
        jurisdiction: holder.jurisdiction,
        accountId: holder.accountId,
        address: holder.address,
        balance: holder.balance,
        amountMicros: String(
          BigInt(holder.balance) * BigInt(couponMicrosPerToken),
        ),
        held,
        holdReason: held
          ? `${HOLD_LABELS[holder.compliance] ?? "Compliance hold"}. ${holder.complianceNote}`
          : null,
        included: held ? forcedIn : !deferred.includes(holder.id),
      });
    }
  } else {
    const subject = holders.find(
      (holder) =>
        holder.compliance === "sanctions-hold" ||
        holder.compliance === "compliance-refused",
    );
    if (subject) {
      rows.push({
        holderId: subject.id,
        legalName: subject.legalName,
        jurisdiction: subject.jurisdiction,
        accountId: subject.accountId,
        address: subject.address,
        balance: subject.balance,
        amountMicros: String(
          BigInt(subject.balance) * BigInt(10) ** BigInt(security.decimals),
        ),
        held: false,
        holdReason: null,
        included: !deferred.includes(subject.id),
      });
    }
  }

  const included = rows.filter((row) => row.included);
  const draw =
    kind === "coupon"
      ? included.reduce((total, row) => total + BigInt(row.amountMicros), 0n)
      : 0n;
  const coverMicros = BigInt(treasuryMicros ?? treasury.balanceMicros);
  const headroom = coverMicros - draw;

  const blockers: string[] = [];
  if (included.length === 0) {
    blockers.push("The plan is empty, nothing would be signed.");
  }
  for (const row of included) {
    if (row.held) {
      blockers.push(
        `${row.legalName} is held by the compliance module and cannot be credited.`,
      );
    }
  }
  if (kind === "coupon" && headroom < 0n) {
    blockers.push(
      `Treasury is short ${formatMicros(String(-headroom))} ${treasury.settlementAsset} for this draw.`,
    );
  }

  const target = planTarget();

  const calldataRows = included.map((row) => ({
    address: row.address,
    amountMicros: row.amountMicros,
  }));

  return {
    kind,
    label: action.label,
    authority: action.authority,
    signature: action.signature,
    selector: selectorFor(kind),
    target,
    chainId: CHAIN_ID,
    reference: couponWindow.reference,
    rows,
    drawMicros: String(draw),
    treasuryMicros: String(coverMicros),
    headroomMicros: String(headroom),
    blockers,
    calldata:
      calldataRows.length > 0 ? buildCalldata(kind, calldataRows) : "0x",
    planHash: hashPlan(kind, target, calldataRows),
  };
}

const microFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

/** Render a micro unit string (6 decimals) as a human amount. */
export function formatMicros(micros: string): string {
  const value = BigInt(micros);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / 1_000_000n;
  const fraction = absolute % 1_000_000n;
  const decimal = Number(fraction) / 1_000_000;
  const rendered = microFormatter.format(Number(whole) + decimal);
  return negative ? `-${rendered}` : rendered;
}

export function formatTokens(amount: number): string {
  return new Intl.NumberFormat("en-US").format(amount);
}

export function shortHex(value: string, lead = 10, tail = 6): string {
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

/** A holder the compliance module is holding, whatever action is selected. */
export function isHeldHolder(holder: Pick<Holder, "compliance">): boolean {
  return holder.compliance !== "clear";
}

/**
 * How many holders the register itself reports as held. The masthead states a
 * fact about the register, so it counts holders rather than plan rows: the
 * forced transfer plan carries one row and marks none of them held, which says
 * nothing about the register.
 */
export function registerHeldCount(
  holders: ReadonlyArray<Pick<Holder, "compliance">>,
): number {
  return holders.filter(isHeldHolder).length;
}

/** Micro units (6 decimals) as the plain decimal string the amount field shows. */
export function microsToInput(micros: string): string {
  const value = BigInt(micros);
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n)
    .toString()
    .padStart(6, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export type AmountCheck =
  { ok: true; micros: string } | { ok: false; message: string };

/**
 * Read the operator's amount field. Each way the field can be wrong gets the
 * sentence that names that mistake, so a negative number is never told it has
 * too many decimal places.
 */
export function parseAmountInput(input: string): AmountCheck {
  const trimmed = input.trim();
  if (trimmed === "") {
    return { ok: false, message: "Enter an amount. The field is empty." };
  }
  if (trimmed.startsWith("-")) {
    return {
      ok: false,
      message: "An amount cannot be negative. Enter zero or more.",
    };
  }
  if (trimmed.includes(",")) {
    return {
      ok: false,
      message:
        "Use a dot for decimals and leave out thousands separators, for example 1250.5.",
    };
  }
  if (/^\.\d+$/.test(trimmed)) {
    return {
      ok: false,
      message: "Put a digit before the decimal point, for example 0.5.",
    };
  }
  if (!/^\d+(\.\d*)?$/.test(trimmed)) {
    return {
      ok: false,
      message: "Enter the amount as digits, with at most one decimal point.",
    };
  }
  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > 6) {
    return {
      ok: false,
      message: "Enter an amount with at most six decimal places.",
    };
  }
  return {
    ok: true,
    micros: (
      BigInt(whole) * 1_000_000n +
      BigInt(fraction.padEnd(6, "0") || "0")
    ).toString(),
  };
}

export type TamperDecision =
  | { kind: "invalid"; message: string }
  | { kind: "unchanged"; message: string }
  | { kind: "edited"; micros: string };

/**
 * What "Send edited plan" may do with the field. Only an amount that parses and
 * differs from the approved one is sent: an unchanged amount would be the
 * approved calldata, which the policy allows, and the refusal control must
 * never be the one that spends the lock.
 */
export function decideTamperedSend(
  input: string,
  approvedMicros: string,
): TamperDecision {
  const parsed = parseAmountInput(input);
  if (!parsed.ok) return { kind: "invalid", message: parsed.message };
  if (BigInt(parsed.micros) === BigInt(approvedMicros)) {
    return {
      kind: "unchanged",
      message: `This is the approved amount, ${microsToInput(approvedMicros)}, so nothing was sent and the lock is still open. Change a digit to watch the key refuse it, or press Execute the approved plan to send the plan as approved.`,
    };
  }
  return { kind: "edited", micros: parsed.micros };
}
