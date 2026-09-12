// Shared shapes for Detent. Types only, no runtime code, no environment reads,
// no network calls: this module is safe to import from a client component and
// from a server module alike.
//
// lib/privy.ts and lib/hedera.ts re-export what they own from here, so existing
// import sites keep resolving while the console and the API route import
// straight from this file.

import type { Holder, SecurityToken, TreasuryAccount } from "@/lib/data";

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

export interface PolicyInstallation {
  policyId: string;
  policy: PrivyPolicy;
  walletId: string;
  quorumThreshold: number;
  live: boolean;
  note: string;
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
}

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; blockers?: string[] };
