// Privy server wallet integration: the half of Detent that turns a preview into
// a signing limit.
//
// compilePolicy takes an approved plan and emits a Privy policy whose only ALLOW
// rule pins the destination contract, the chain, the function selector and the
// exact calldata bytes. Everything else stays on default_action DENY. The key
// quorum (threshold two) owns the policy; the policy is revoked as soon as the
// transaction lands.
//
// Two broadcast paths, because Privy broadcasting to eip155:296 is not proven.
// rpc asks the wallet to send the transaction itself. signature asks the same
// wallet, under the same policy, for a signed legacy transaction and puts it on
// chain through Hashio. auto tries rpc and falls to signature when Privy refuses
// the chain. Either way the policy governs the signing request, which is the
// product claim.
//
// Server side only: it reads lib/config.ts, which reads PRIVY_APP_SECRET. Never
// import this from a client component.

import { toHex, type Hex } from "viem";
import {
  ADAPTER_MODE,
  LOG_PREFIX,
  PRIVY_API_URL,
  PRIVY_APP_ID,
  PRIVY_APP_SECRET,
  PRIVY_BROADCAST_MODE,
  PRIVY_KEY_QUORUM_ID,
  PRIVY_TIMEOUT_MS,
  PRIVY_TREASURY_WALLET_ADDRESS,
  PRIVY_TREASURY_WALLET_ID,
  QUORUM_THRESHOLD,
  RETRY_COUNT,
  SIGNED_TX_GAS_LIMIT,
} from "@/lib/config";
import { treasury } from "@/lib/data";
import { DetentError } from "@/lib/errors";
import { hederaPublicClient } from "@/lib/hedera";
import type { Plan } from "@/lib/plan";
import {
  privyPolicyResponseSchema,
  privyRpcResponseSchema,
} from "@/lib/schemas";
import type {
  ExecutionResult,
  PolicyCondition,
  PolicyInstallation,
  PolicyRule,
  PrivyPolicy,
  SignatureVerdict,
} from "@/lib/types";

export type {
  ExecutionResult,
  PolicyCondition,
  PolicyInstallation,
  PolicyRule,
  PrivyPolicy,
  SignatureVerdict,
};

const WALLET_ID = PRIVY_TREASURY_WALLET_ID ?? treasury.walletId;

/** The live Privy path needs the mode and both credentials. Nothing else. */
export function isPrivyLive(): boolean {
  return (
    ADAPTER_MODE === "real" &&
    Boolean(PRIVY_APP_ID) &&
    Boolean(PRIVY_APP_SECRET)
  );
}

function authHeaders(): Record<string, string> {
  const basic = Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString(
    "base64"
  );
  return {
    Authorization: `Basic ${basic}`,
    "privy-app-id": PRIVY_APP_ID as string,
    "Content-Type": "application/json",
  };
}

type Attempt = { kind: "answered"; response: Response } | { kind: "timeout" };

async function attemptPrivy(path: string, init: RequestInit): Promise<Attempt> {
  try {
    const response = await fetch(`${PRIVY_API_URL}${path}`, {
      ...init,
      // Callers pass a method and a body only: the auth headers and the timeout
      // are this helper's job and are not overridable.
      headers: authHeaders(),
      signal: AbortSignal.timeout(PRIVY_TIMEOUT_MS),
    });
    return { kind: "answered", response };
  } catch {
    return { kind: "timeout" };
  }
}

/**
 * One shared client for every Privy call: basic auth, the app id header, a
 * bounded timeout, and exactly one re-attempt on a timeout or a 5xx. It is
 * written out as a first attempt and a single retry on purpose, so there is no
 * loop that can turn a slow provider into a hung request. A 4xx comes back to
 * the caller, because the caller has to tell a policy refusal apart from an
 * unsupported chain.
 */
async function privyFetch(path: string, init: RequestInit): Promise<Response> {
  const first = await attemptPrivy(path, init);
  if (first.kind === "answered" && first.response.status < 500) {
    return first.response;
  }

  const second = await attemptPrivy(path, init);
  if (second.kind === "answered") {
    if (second.response.status < 500) return second.response;
    throw new DetentError(
      "upstream_error",
      `Privy answered ${second.response.status} on ${path} after ${RETRY_COUNT} retry.`
    );
  }

  throw new DetentError(
    "upstream_timeout",
    `Privy did not answer ${path} within ${PRIVY_TIMEOUT_MS}ms, after ${RETRY_COUNT} retry.`
  );
}

/** The compiler. One plan in, one single-purpose policy out. */
export function compilePolicy(plan: Plan): PrivyPolicy {
  const label = `detent-${plan.kind}-${plan.planHash.slice(2, 10)}`;
  return {
    version: "1.0",
    name: label,
    chain_type: "ethereum",
    rules: [
      {
        name: `${label}-exact-call`,
        method: "eth_sendTransaction",
        conditions: [
          {
            field_source: "ethereum_transaction",
            field: "chain_id",
            operator: "eq",
            value: String(plan.chainId),
          },
          {
            field_source: "ethereum_transaction",
            field: "to",
            operator: "eq",
            value: plan.target,
          },
          {
            field_source: "ethereum_transaction",
            field: "data",
            operator: "starts_with",
            value: plan.selector,
          },
          {
            field_source: "ethereum_transaction",
            field: "data",
            operator: "eq",
            value: plan.calldata,
          },
        ],
        action: "ALLOW",
      },
    ],
    default_action: "DENY",
  };
}

/** First byte offset where two hex payloads diverge, for a readable refusal. */
function divergenceOffset(expected: string, actual: string): number {
  const limit = Math.min(expected.length, actual.length);
  for (let index = 2; index < limit; index += 2) {
    if (expected.slice(index, index + 2) !== actual.slice(index, index + 2)) {
      return (index - 2) / 2;
    }
  }
  return Math.max(expected.length, actual.length) / 2;
}

/**
 * The same evaluation Privy runs on its side, mirrored here so the refusal can
 * be explained in words on screen and so the deny scene works with no keys.
 */
export function evaluatePolicy(
  policy: PrivyPolicy,
  request: { to: string; chainId: number; data: Hex }
): SignatureVerdict {
  for (const rule of policy.rules) {
    let matched = true;
    let failed: PolicyCondition | undefined;

    for (const condition of rule.conditions) {
      const candidate =
        condition.field === "to"
          ? request.to.toLowerCase()
          : condition.field === "chain_id"
            ? String(request.chainId)
            : request.data.toLowerCase();
      const expected = condition.value.toLowerCase();
      const ok =
        condition.operator === "eq"
          ? candidate === expected
          : candidate.startsWith(expected);
      if (!ok) {
        matched = false;
        failed = condition;
        break;
      }
    }

    if (matched) {
      return {
        allowed: true,
        ruleName: rule.name,
        reason: `Rule ${rule.name} matched on all ${rule.conditions.length} conditions.`,
      };
    }

    if (failed && failed.field === "data" && failed.operator === "eq") {
      const offset = divergenceOffset(failed.value, request.data);
      return {
        allowed: false,
        ruleName: rule.name,
        failedCondition: failed,
        reason: `Denied by policy ${policy.name}. Rule ${rule.name} requires ethereum_transaction.data to equal the approved calldata; the submitted payload diverges at byte ${offset}. default_action DENY applied.`,
      };
    }

    if (failed) {
      return {
        allowed: false,
        ruleName: rule.name,
        failedCondition: failed,
        reason: `Denied by policy ${policy.name}. Rule ${rule.name} requires ethereum_transaction.${failed.field} ${failed.operator} ${failed.value}. default_action DENY applied.`,
      };
    }
  }

  return {
    allowed: false,
    ruleName: "none",
    reason: `Denied by policy ${policy.name}. No ALLOW rule matched, default_action DENY applied.`,
  };
}

export function quorumSatisfied(approvals: string[]): boolean {
  return new Set(approvals).size >= QUORUM_THRESHOLD;
}

export async function installPolicy(
  plan: Plan,
  approvals: string[]
): Promise<PolicyInstallation> {
  const policy = compilePolicy(plan);
  console.info(
    `${LOG_PREFIX} policy compiled: ${policy.name}, plan hash ${plan.planHash}, ${policy.rules[0].conditions.length} conditions, calldata ${(plan.calldata.length - 2) / 2} bytes`
  );

  if (!isPrivyLive()) {
    return {
      policyId: `pol_local_${plan.planHash.slice(2, 10)}`,
      policy,
      walletId: WALLET_ID,
      quorumThreshold: QUORUM_THRESHOLD,
      live: false,
      note: "Compiled locally. Set PRIVY_APP_ID and PRIVY_APP_SECRET to install it on the real treasury wallet.",
    };
  }

  if (!PRIVY_KEY_QUORUM_ID) {
    throw new DetentError(
      "not_configured",
      "PRIVY_KEY_QUORUM_ID is missing.",
      "PRIVY_KEY_QUORUM_ID is not set on the server, so no key quorum can own the policy. Create the quorum with threshold two in the Privy dashboard and set that id."
    );
  }

  const startedAt = Date.now();
  const response = await privyFetch("/v1/policies", {
    method: "POST",
    body: JSON.stringify({
      ...policy,
      owner: { key_quorum_id: PRIVY_KEY_QUORUM_ID },
    }),
  });

  if (!response.ok) {
    throw new DetentError(
      "upstream_error",
      `Privy refused the policy install with ${response.status}.`,
      "Privy refused to install the policy. Check the app credentials and the key quorum id, then lock the plan again."
    );
  }

  const parsed = privyPolicyResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new DetentError(
      "parse_failure",
      "The policy install response carried no id."
    );
  }

  console.info(
    `${LOG_PREFIX} policy installed: ${parsed.data.id} on wallet ${WALLET_ID}, quorum ${PRIVY_KEY_QUORUM_ID}, ${Date.now() - startedAt}ms`
  );

  return {
    policyId: parsed.data.id,
    policy,
    walletId: WALLET_ID,
    quorumThreshold: QUORUM_THRESHOLD,
    live: true,
    note: `Installed on wallet ${WALLET_ID}, owned by the key quorum, opened by ${approvals.length} of ${QUORUM_THRESHOLD} signers.`,
  };
}

/**
 * Remove the single-use rule. The transaction has already landed by the time
 * this runs, so a failed revoke is reported in the note rather than thrown.
 */
export async function revokePolicy(policyId: string): Promise<boolean> {
  if (!isPrivyLive()) return true;
  try {
    const response = await privyFetch(`/v1/policies/${policyId}`, {
      method: "DELETE",
    });
    console.info(
      `${LOG_PREFIX} policy revoked: ${policyId}, accepted ${response.ok}`
    );
    return response.ok;
  } catch (error) {
    console.error(
      `${LOG_PREFIX} policy revoked: ${policyId} failed,`,
      error instanceof Error ? error.message : "unknown revoke failure"
    );
    return false;
  }
}

/** Privy answers 4xx both for a policy refusal and for an unsupported chain. */
function looksLikePolicyDenial(body: string): boolean {
  const lowered = body.toLowerCase();
  return (
    lowered.includes("policy") ||
    lowered.includes("denied") ||
    lowered.includes("not allowed")
  );
}

interface WalletRpcOptions {
  method: "eth_sendTransaction" | "eth_signTransaction";
  chainId: number;
  transaction: Record<string, string | number>;
}

async function walletRpc(options: WalletRpcOptions): Promise<Response> {
  return privyFetch(`/v1/wallets/${WALLET_ID}/rpc`, {
    method: "POST",
    body: JSON.stringify({
      method: options.method,
      caip2: `eip155:${options.chainId}`,
      params: { transaction: options.transaction },
    }),
  });
}

function denialResult(
  policy: PrivyPolicy,
  policyId: string,
  status: number
): ExecutionResult {
  const ruleName = policy.rules[0]?.name ?? "none";
  return {
    verdict: {
      allowed: false,
      ruleName,
      reason: `Privy refused to sign under policy ${policy.name}. Rule ${ruleName} did not match the submitted transaction, so default_action DENY applied (HTTP ${status}).`,
    },
    policyRevoked: false,
    live: true,
    note: `The wallet answered with a policy violation on policy ${policyId}.`,
  };
}

/**
 * Take a signature from Privy under the same policy and put the raw transaction
 * on chain through Hashio. This is the documented fallback for Privy refusing to
 * broadcast to eip155:296. Legacy type on purpose: the Hedera relay rejects
 * typed transactions.
 */
async function signAndRelay(options: {
  policy: PrivyPolicy;
  policyId: string;
  to: string;
  chainId: number;
  data: Hex;
  verdict: SignatureVerdict;
}): Promise<ExecutionResult> {
  if (!PRIVY_TREASURY_WALLET_ADDRESS) {
    throw new DetentError(
      "not_configured",
      "PRIVY_TREASURY_WALLET_ADDRESS is missing.",
      "PRIVY_TREASURY_WALLET_ADDRESS is not set on the server, so the nonce for the raw transaction cannot be read. Take the wallet address from the Privy dashboard and set it."
    );
  }

  const client = hederaPublicClient();
  const [nonce, gasPrice] = await Promise.all([
    client.getTransactionCount({ address: PRIVY_TREASURY_WALLET_ADDRESS }),
    client.getGasPrice(),
  ]);

  const startedAt = Date.now();
  const response = await walletRpc({
    method: "eth_signTransaction",
    chainId: options.chainId,
    transaction: {
      to: options.to,
      data: options.data,
      value: "0x0",
      chain_id: options.chainId,
      nonce,
      type: 0,
      gas_limit: toHex(SIGNED_TX_GAS_LIMIT),
      gas_price: toHex(gasPrice),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    if (looksLikePolicyDenial(body)) {
      return denialResult(options.policy, options.policyId, response.status);
    }
    throw new DetentError(
      "upstream_error",
      `Privy refused to sign the transaction with ${response.status}.`,
      "Privy would neither broadcast nor sign this transaction. Check the wallet id and the policy owner, then send the approved plan again."
    );
  }

  const parsed = privyRpcResponseSchema.safeParse(await response.json());
  const signed = parsed.success ? parsed.data.data?.signed_transaction : undefined;
  if (!signed) {
    throw new DetentError(
      "parse_failure",
      "The sign response carried no signed transaction."
    );
  }

  const hash = await client.sendRawTransaction({
    serializedTransaction: signed as Hex,
  });
  console.info(
    `${LOG_PREFIX} tx broadcast via relay: ${hash}, nonce ${nonce}, ${(options.data.length - 2) / 2} calldata bytes, ${Date.now() - startedAt}ms`
  );

  const revoked = await revokePolicy(options.policyId);
  return {
    verdict: options.verdict,
    transactionHash: hash,
    policyRevoked: revoked,
    live: true,
    note: `Signed by ${WALLET_ID} under policy ${options.policyId}, then broadcast through the Hedera relay as a legacy transaction.${revoked ? "" : " The revoke call did not succeed, remove the policy in the Privy dashboard."}`,
  };
}

export async function submitTransaction(options: {
  policy: PrivyPolicy;
  policyId: string;
  to: string;
  chainId: number;
  data: Hex;
}): Promise<ExecutionResult> {
  const verdict = evaluatePolicy(options.policy, {
    to: options.to,
    chainId: options.chainId,
    data: options.data,
  });

  if (!isPrivyLive()) {
    // Local path: the same verdict Privy would return, then a deterministic
    // receipt so the console can be rehearsed without a funded testnet wallet.
    // TODO: nothing to swap here, the live path below is the submission path.
    if (!verdict.allowed) {
      return {
        verdict,
        policyRevoked: false,
        live: false,
        note: "Evaluated against the compiled policy locally.",
      };
    }
    const stub = `0x${options.data.slice(2, 66).padEnd(64, "0")}`;
    return {
      verdict,
      transactionHash: stub,
      policyRevoked: await revokePolicy(options.policyId),
      live: false,
      note: "Evaluated against the compiled policy locally, receipt is a stub.",
    };
  }

  // The local mirror runs first even on the live path, so a tampered payload is
  // refused in words the operator can read without waiting on the provider.
  if (!verdict.allowed) {
    console.info(
      `${LOG_PREFIX} policy denied: ${options.policy.name}, rule ${verdict.ruleName}, ${(options.data.length - 2) / 2} calldata bytes`
    );
    return {
      verdict,
      policyRevoked: false,
      live: true,
      note: `Refused before the wallet was asked: the payload does not satisfy policy ${options.policy.name}, which is installed on ${WALLET_ID}.`,
    };
  }

  if (PRIVY_BROADCAST_MODE === "signature") {
    return signAndRelay({ ...options, verdict });
  }

  const startedAt = Date.now();
  const response = await walletRpc({
    method: "eth_sendTransaction",
    chainId: options.chainId,
    transaction: {
      to: options.to,
      data: options.data,
      chain_id: options.chainId,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    if (looksLikePolicyDenial(body)) {
      console.info(
        `${LOG_PREFIX} policy denied: ${options.policy.name} refused by Privy with ${response.status}`
      );
      return denialResult(options.policy, options.policyId, response.status);
    }
    if (PRIVY_BROADCAST_MODE === "auto" && response.status < 500) {
      console.info(
        `${LOG_PREFIX} tx submitted: Privy answered ${response.status} for eip155:${options.chainId}, taking the signature path instead`
      );
      return signAndRelay({ ...options, verdict });
    }
    throw new DetentError(
      "upstream_error",
      `Privy refused to broadcast with ${response.status}.`,
      "Privy would not broadcast this transaction. Set PRIVY_BROADCAST_MODE=signature to sign and relay instead, then send the approved plan again."
    );
  }

  const parsed = privyRpcResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new DetentError(
      "parse_failure",
      "The wallet RPC response did not match the expected shape."
    );
  }

  const hash = parsed.data.data?.hash;
  console.info(
    `${LOG_PREFIX} tx submitted: ${hash ?? "no hash returned"}, policy ${options.policyId}, ${(options.data.length - 2) / 2} calldata bytes, ${Date.now() - startedAt}ms`
  );

  const revoked = await revokePolicy(options.policyId);
  return {
    verdict,
    transactionHash: hash,
    policyRevoked: revoked,
    live: true,
    note: `Signed and broadcast by ${WALLET_ID} under policy ${options.policyId}.${revoked ? "" : " The revoke call did not succeed, remove the policy in the Privy dashboard."}`,
  };
}
