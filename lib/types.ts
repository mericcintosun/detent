// Shared shapes for Detent. Types only, no runtime code, no environment reads,
// no network calls: this module is safe to import from a client component and
// from a server module alike.
//
// lib/privy.ts and lib/hedera.ts re-export what they own from here, so existing
// import sites keep resolving while the console and the API route import
// straight from this file.

import type { Holder, SecurityToken, TreasuryAccount } from "@/lib/data";
import type { DetentErrorCode } from "@/lib/errors";

/* --- Privy policy shapes -------------------------------------------------- */

export interface PolicyCondition {
  field_source: "ethereum_transaction";
  field: "to" | "chain_id" | "data";
  operator: "eq" | "starts_with";
  value: string;
}

export interface PolicyRule {
  name: string;
  method: "eth_sendTransaction";
  conditions: PolicyCondition[];
  action: "ALLOW";
}

export interface PrivyPolicy {
  version: "1.0";
  name: string;
  chain_type: "ethereum";
  rules: PolicyRule[];
  default_action: "DENY";
}

/* --- On chain anchor ------------------------------------------------------ */

/**
 * What PlanAnchor did, or why it did nothing. Every anchor call degrades into
 * one of these rather than throwing, because a missing operator key or a busy
 * relay must never fail a send.
 */
export interface AnchorReceipt {
  anchored: boolean;
  transactionHash?: `0x${string}`;
  note: string;
}

/**
 * What the chain holds for one plan hash right now, as read back by
 * readPlanRecord in lib/anchor.ts.
 *
 * The first two states are not chain states at all: `unwired` means no contract
 * address is configured, `unreadable` means the relay would not answer. The other
 * four mirror PlanAnchor.Status, so `unknown` is a hash the contract has never
 * seen. Everything past `state` is present only once the record exists.
 */
export type PlanRecordState =
  | "unwired"
  | "unreadable"
  | "unknown"
  | "anchored"
  | "settled"
  | "abandoned";

export interface PlanRecord {
  state: PlanRecordState;
  /** One sentence a reader can act on, in every state. */
  note: string;
  token?: `0x${string}`;
  selector?: `0x${string}`;
  anchoredBy?: `0x${string}`;
  /** ISO 8601, or absent when the contract holds a zero timestamp. */
  anchoredAt?: string;
  settledAt?: string;
}

export interface PolicyInstallation {
  policyId: string;
  policy: PrivyPolicy;
  walletId: string;
  quorumThreshold: number;
  live: boolean;
  note: string;
  anchor?: AnchorReceipt;
}

export interface SignatureVerdict {
  allowed: boolean;
  ruleName: string;
  reason: string;
  failedCondition?: PolicyCondition;
}

export interface ExecutionResult {
  verdict: SignatureVerdict;
  transactionHash?: string;
  policyRevoked: boolean;
  live: boolean;
  note: string;
}

/* --- Register shapes ------------------------------------------------------ */

export interface RegisterSnapshot {
  source: "hedera-testnet" | "seed";
  token: SecurityToken;
  treasury: TreasuryAccount;
  holders: Holder[];
  fetchedAt: string;
  note: string;
}

/* --- Wire shapes ---------------------------------------------------------- */

export interface SubmitResult extends ExecutionResult {
  calldata: `0x${string}`;
  tampered: boolean;
  policySource: "held-from-lock" | "recompiled-from-approved-plan";
  planHash: `0x${string}`;
  anchor?: AnchorReceipt;
}

export type ApiResponse<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: DetentErrorCode;
      hint: string;
      blockers?: string[];
    };
