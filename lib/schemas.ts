// The edge. Everything arriving from the browser or from a provider is parsed
// here before any other logic touches it.
//
// The plan schema mirrors the Plan interface in lib/plan.ts field for field, so
// the API route can assign a parsed body straight into a Plan and let the
// compiler check the mirror. Runtime only, no environment reads, so the test
// suite can import this file directly.

import { z } from "zod";

/* --- Caps -----------------------------------------------------------------
 *
 * Every array and every string that arrives from a browser is bounded here.
 * The numbers are generous for the demo (the seed register is twelve rows) and
 * sane for a server: past these, encodeFunctionData and keccak256 would be
 * asked to chew on whatever the caller felt like sending. Literals rather than
 * environment reads, because this module stays runtime only so the test suite
 * can import it directly.
 */

/** Holders in one plan, and rows in one submitted payload. */
export const MAX_ROWS = 500;
/** Approvals in one lock request. The registry has two officers. */
export const MAX_APPROVALS = 8;
/** Any single identifier or label. */
export const MAX_LABEL_LENGTH = 200;
/** A decimal micro amount, as digits. */
export const MAX_MICROS_LENGTH = 40;
/** A hex payload, in characters. 500 rows of coupon calldata is well under this. */
export const MAX_HEX_LENGTH = 200_000;
/** Blocker sentences carried back in a lock request. */
export const MAX_BLOCKERS = 64;

/** Any 0x prefixed hex payload, including "0x" for an empty plan. */
export const hexSchema = z.custom<`0x${string}`>(
  (value) =>
    typeof value === "string" &&
    value.length <= MAX_HEX_LENGTH &&
    /^0x[0-9a-fA-F]*$/.test(value),
  { message: "expected a 0x prefixed hex string within the size cap" },
);

/** A 20 byte EVM address. */
export const addressSchema = z.custom<`0x${string}`>(
  (value) => typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value),
  { message: "expected a 20 byte 0x address" },
);

/**
 * A 32 byte plan hash: 0x plus exactly 64 hex characters. The record route parses
 * its path segment with this, so a hand typed URL is a 404 rather than a relay
 * call with a malformed argument.
 */
export const planHashSchema = z.custom<`0x${string}`>(
  (value) => typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value),
  { message: "expected a 32 byte 0x plan hash" },
);

/** Settlement amounts travel as decimal digit strings, never as numbers. */
export const microsSchema = z
  .string()
  .max(MAX_MICROS_LENGTH)
  .regex(/^\d+$/, "expected a decimal micro amount with digits only");

/** One identifier or short label from the browser, always bounded. */
export const labelSchema = z.string().min(1).max(MAX_LABEL_LENGTH);

export const planRowSchema = z.object({
  holderId: labelSchema,
  legalName: labelSchema,
  jurisdiction: labelSchema,
  accountId: labelSchema,
  address: addressSchema,
  balance: z.number().finite(),
  amountMicros: microsSchema,
  held: z.boolean(),
  holdReason: z
    .string()
    .max(MAX_LABEL_LENGTH * 4)
    .nullable(),
  included: z.boolean(),
});

export const actionKindSchema = z.enum(["coupon", "forced-transfer"]);

export const planSchema = z.object({
  kind: actionKindSchema,
  label: labelSchema,
  authority: labelSchema,
  signature: labelSchema,
  selector: hexSchema,
  target: addressSchema,
  chainId: z.number().int().positive(),
  reference: labelSchema,
  rows: z.array(planRowSchema).max(MAX_ROWS),
  drawMicros: microsSchema,
  treasuryMicros: microsSchema,
  headroomMicros: z
    .string()
    .max(MAX_MICROS_LENGTH + 1)
    .regex(/^-?\d+$/, "expected a decimal amount"),
  blockers: z.array(z.string().max(MAX_LABEL_LENGTH * 4)).max(MAX_BLOCKERS),
  calldata: hexSchema,
  planHash: planHashSchema,
});

export const submittedRowSchema = z.object({
  address: addressSchema,
  amountMicros: microsSchema,
});

/**
 * Which rows the operator pulled out of the run and which held rows they tried
 * to force back in. This is the only part of a plan the operator actually
 * chooses, so it is the only part the server takes from the request: everything
 * else is re-derived from the register snapshot. Optional, because a client that
 * does not send it has its selection read back off the plan rows instead.
 */
export const selectionSchema = z.object({
  kind: actionKindSchema,
  deferred: z.array(labelSchema).max(MAX_ROWS),
  forced: z.array(labelSchema).max(MAX_ROWS),
});

export const lockBodySchema = z.object({
  intent: z.literal("lock"),
  /**
   * The preview the operator read. It is not trusted: the server rebuilds the
   * plan from the register and refuses the lock when the two do not agree on
   * the plan hash and the calldata.
   */
  plan: planSchema,
  selection: selectionSchema.optional(),
  approvals: z.array(labelSchema).min(1).max(MAX_APPROVALS),
});

export const submitBodySchema = z.object({
  intent: z.literal("submit"),
  /**
   * The opaque handle the lock returned. The server holds the compiled policy
   * and the approved calldata under it; a submit the server has no record for
   * is refused rather than rebuilt from the request body.
   */
  lockId: labelSchema,
  /**
   * What the operator is actually sending, which is the one thing the tamper
   * demo is allowed to change. The server compares it against the approved
   * calldata it holds and derives the tampered flag from that comparison.
   */
  submittedRows: z.array(submittedRowSchema).max(MAX_ROWS),
  /**
   * Set by the wrong-network action in components/console-states.tsx to force
   * the sign and relay path for this one send. Absent means the server's
   * PRIVY_BROADCAST_MODE decides, which is the normal case.
   */
  broadcastPreference: z.enum(["auto", "signature"]).optional(),
});

/** The operator's row selection, which is the only part of a plan the browser chooses. */
export type PlanSelection = z.infer<typeof selectionSchema>;

export const detentRequestSchema = z.discriminatedUnion("intent", [
  lockBodySchema,
  submitBodySchema,
]);

export type DetentRequest = z.infer<typeof detentRequestSchema>;

/* --- Provider responses --------------------------------------------------- */

/** POST /v1/policies. Only the id is load bearing. */
export const privyPolicyResponseSchema = z.object({
  id: z.string().min(1),
});

/**
 * GET and PATCH /v1/wallets/{wallet_id}. `policy_ids` is the field that binds a
 * policy to the wallet, which is what makes Privy rather than this app the thing
 * that refuses. Privy documents at most one policy per wallet and a PATCH that
 * replaces the whole list, so the previous contents are read before the attach
 * and written back on the detach.
 */
export const privyWalletResponseSchema = z.object({
  id: z.string().min(1),
  address: z.string().optional(),
  chain_type: z.string().optional(),
  policy_ids: z.array(z.string()).optional(),
  owner_id: z.string().nullish(),
});

/** POST /v1/wallets/{id}/rpc. Privy nests the result under data. */
export const privyRpcResponseSchema = z.object({
  method: z.string().optional(),
  data: z
    .object({
      hash: z.string().optional(),
      signed_transaction: z.string().optional(),
      transaction_id: z.string().optional(),
    })
    .optional(),
});

/** The first failing field path, for a hint that names what the edge rejected. */
export function firstIssuePath(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "the request body";
  return issue.path.length > 0 ? issue.path.join(".") : "the request body";
}
