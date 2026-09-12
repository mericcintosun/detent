// The edge. Everything arriving from the browser or from a provider is parsed
// here before any other logic touches it.
//
// The plan schema mirrors the Plan interface in lib/plan.ts field for field, so
// the API route can assign a parsed body straight into a Plan and let the
// compiler check the mirror. Runtime only, no environment reads, so the test
// suite can import this file directly.

import { z } from "zod";

/** Any 0x prefixed hex payload, including "0x" for an empty plan. */
export const hexSchema = z.custom<`0x${string}`>(
  (value) => typeof value === "string" && /^0x[0-9a-fA-F]*$/.test(value),
  { message: "expected a 0x prefixed hex string" }
);

/** A 20 byte EVM address. */
export const addressSchema = z.custom<`0x${string}`>(
  (value) => typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value),
  { message: "expected a 20 byte 0x address" }
);

/** Settlement amounts travel as decimal digit strings, never as numbers. */
export const microsSchema = z
  .string()
  .regex(/^\d+$/, "expected a decimal micro amount with digits only");

export const planRowSchema = z.object({
  holderId: z.string().min(1),
  legalName: z.string().min(1),
  jurisdiction: z.string().min(1),
  accountId: z.string().min(1),
  address: addressSchema,
  balance: z.number(),
  amountMicros: microsSchema,
  held: z.boolean(),
  holdReason: z.string().nullable(),
  included: z.boolean(),
});

export const planSchema = z.object({
  kind: z.enum(["coupon", "forced-transfer"]),
  label: z.string().min(1),
  authority: z.string().min(1),
  signature: z.string().min(1),
  selector: hexSchema,
  target: addressSchema,
  chainId: z.number().int().positive(),
  reference: z.string().min(1),
  rows: z.array(planRowSchema),
  drawMicros: microsSchema,
  treasuryMicros: microsSchema,
  headroomMicros: z.string().regex(/^-?\d+$/, "expected a decimal amount"),
  blockers: z.array(z.string()),
  calldata: hexSchema,
  planHash: hexSchema,
});

export const submittedRowSchema = z.object({
  address: addressSchema,
  amountMicros: microsSchema,
});

export const lockBodySchema = z.object({
  intent: z.literal("lock"),
  plan: planSchema,
  approvals: z.array(z.string().min(1)),
});

export const submitBodySchema = z.object({
  intent: z.literal("submit"),
  policyId: z.string().min(1),
  approvedPlan: planSchema,
  submittedRows: z.array(submittedRowSchema),
  tampered: z.boolean(),
  /**
   * One key per distinct submission, derived by the console from the policy,
   * the plan hash, the tampered flag and the calldata. The route answers a
   * repeated key from lib/store.ts instead of broadcasting a second time.
   */
  submissionKey: z.string().min(1),
  /**
   * Set by the wrong-network action in components/console-states.tsx to force
   * the sign and relay path for this one send. Absent means the server's
   * PRIVY_BROADCAST_MODE decides, which is the normal case.
   */
  broadcastPreference: z.enum(["auto", "signature"]).optional(),
});

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
