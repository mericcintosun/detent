// Shared shapes for Detent. Types only, no runtime code, no environment reads,
// no network calls: this module is safe to import from a client component and
// from a server module alike.
//
// lib/privy.ts and lib/hedera.ts re-export what they own from here, so existing
// import sites keep resolving while the console and the API route import
// straight from this file.

import type {
  Approver,
  Holder,
  SecurityToken,
  TreasuryAccount,
} from "@/lib/data";
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
  /**
   * When the plan reached a terminal state, settled or abandoned. Absent while
   * the plan is still open. Named for what it is: PlanAnchor closes an abandoned
   * plan with the same field it closes a settled one.
   */
  closedAt?: string;
}

/**
 * An officer from the server side signer registry in lib/data.ts. Approvals
 * arrive as ids and are resolved against that registry before a lock opens, so
 * an approval names a known officer rather than any two distinct strings.
 */
export type ApprovedSigner = Approver;

/**
 * What installPolicy produced: the policy, its id, and whether it is actually
 * bound to the treasury wallet. The route turns this into a PolicyInstallation
 * once the lock record exists.
 */
export interface InstalledPolicy {
  policyId: string;
  policy: PrivyPolicy;
  walletId: string;
  /** The wallet's `policy_ids` before the attach, restored when the lock is spent. */
  previousPolicyIds: string[];
  policyAttached: boolean;
  live: boolean;
  note: string;
}

export interface PolicyInstallation {
  /**
   * The opaque, server generated handle for this lock. The submit intent
   * presents it and the server answers from its own record: the approved
   * calldata and the compiled policy are never rebuilt from the request body.
   */
  lockId: string;
  policyId: string;
  policy: PrivyPolicy;
  walletId: string;
  quorumThreshold: number;
  /** Who opened this lock, resolved against the registry. */
  approvedBy: ApprovedSigner[];
  /**
   * True when the policy id is bound to the treasury wallet's `policy_ids`, which
   * is what makes Privy, rather than this app, the thing that refuses. False only
   * on the keyless path, where nothing was installed anywhere.
   */
  policyAttached: boolean;
  /** The plan hash the server derived, which is the one that was anchored. */
  planHash: `0x${string}`;
  /** ISO 8601. After this the lock is gone and the plan has to be locked again. */
  expiresAt: string;
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

/**
 * Which engine produced the verdict. The local mirror explains; only the wallet
 * enforces. A refusal that never left this process says `local-mirror`, so a
 * screenshot can never pass a local decision off as the wallet's.
 */
export type PolicyEngine = "privy-wallet" | "local-mirror";

/**
 * What a send that was allowed produced, discriminated so nothing that is not a
 * real transaction can be rendered as one. Absent when nothing was signed, which
 * is what a policy refusal looks like.
 *
 * `on-chain` carries a hash a block explorer will resolve. `synthetic` is the
 * keyless rehearsal: no key signed and nothing was broadcast, so it carries no
 * `transactionHash` at all, only a `reference` that must never be linked to an
 * explorer and is never written on chain as a settlement reference.
 *
 * The console reads `kind` and `transactionHash`; `reference`, `broadcast` and
 * `note` are additional detail it may render.
 */
export type ExecutionReceipt =
  | {
      kind: "on-chain";
      transactionHash: `0x${string}`;
      /** Which path put it on chain: the wallet RPC, or sign plus relay. */
      broadcast: "privy-rpc" | "relay";
      note: string;
    }
  | {
      kind: "synthetic";
      /** keccak256 over the plan hash and the submitted calldata. Not a hash of a transaction. */
      reference: `0x${string}`;
      note: string;
    };

export interface ExecutionResult {
  verdict: SignatureVerdict;
  /** Present when the send was allowed; absent when nothing was signed. */
  receipt?: ExecutionReceipt;
  /** Present only when `receipt.kind` is "on-chain". Never set for a synthetic receipt. */
  transactionHash?: `0x${string}`;
  policyRevoked: boolean;
  /** True when the policy id was unbound from the wallet's `policy_ids` again. */
  policyDetached: boolean;
  decidedBy: PolicyEngine;
  /** True when Privy credentials are configured, so the live path ran at all. */
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
  /**
   * Derived on the server by comparing the submitted calldata with the calldata
   * held under the lock. It is never read from the request body.
   */
  tampered: boolean;
  /**
   * Where the policy this send was judged against came from. The only source is
   * the policy held under the lock: a submit the server holds no lock for is
   * refused rather than rebuilt from the request body.
   */
  policySource: "held-from-lock";
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
