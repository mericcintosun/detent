// Privy server wallet integration: the half of Detent that turns a preview into
// a signing limit.
//
// compilePolicy takes an approved plan and emits a Privy policy whose only ALLOW
// rule pins the destination contract, the chain, the function selector and the
// exact calldata bytes. Everything else stays on default_action DENY. The key
// quorum (threshold two) owns the policy.
//
// Compiling a policy constrains nothing on its own. What makes Privy, rather
// than this app, the thing that refuses is the binding: the policy id is written
// into the treasury wallet's `policy_ids` with PATCH /v1/wallets/{wallet_id}
// before the transaction is requested, and written back out again once the
// transaction lands, alongside the revoke. Privy documents at most one policy per
// wallet and a PATCH that replaces the whole list, so the wallet's previous
// `policy_ids` are read first and restored on the way out. An attach that does
// not take fails the lock: an unbound policy is an unconstrained treasury key,
// and the product would be claiming otherwise.
//
// evaluatePolicy below mirrors the same evaluation locally. It is the
// explanation layer and nothing else: it names the failed condition and the byte
// offset for the operator, and on the keyless path it is the only engine there
// is. On the live path the wallet is always asked, and the answer that counts is
// the wallet's.
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

import { concatHex, keccak256, toHex, type Hex } from "viem";
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
import { approvers, treasury } from "@/lib/data";
import { DetentError } from "@/lib/errors";
import { hederaPublicClient } from "@/lib/hedera";
import type { Plan } from "@/lib/plan";
import {
  privyPolicyResponseSchema,
  privyRpcResponseSchema,
  privyWalletResponseSchema,
} from "@/lib/schemas";
import type {
  ApprovedSigner,
  ExecutionReceipt,
  ExecutionResult,
  InstalledPolicy,
  PolicyCondition,
  PolicyEngine,
  PolicyInstallation,
  PolicyRule,
  PrivyPolicy,
  SignatureVerdict,
} from "@/lib/types";

export type {
  ApprovedSigner,
  ExecutionReceipt,
  ExecutionResult,
  InstalledPolicy,
  PolicyCondition,
  PolicyEngine,
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

/**
 * A counting helper, not an authorisation check: it knows how many distinct
 * entries a list holds and nothing about who anyone is. resolveApprovals below
 * is the gate, and it is the only thing the route calls.
 */
export function quorumSatisfied(approvals: string[]): boolean {
  return new Set(approvals).size >= QUORUM_THRESHOLD;
}

export type ApprovalResolution =
  | { ok: true; signers: ApprovedSigner[] }
  | { ok: false; reason: string };

/**
 * Resolve approval ids against the officer registry in lib/data.ts. Two things
 * have to hold before a lock opens: every approval names an officer the server
 * knows, and no officer is counted twice. Nothing here is echoed back from the
 * request, so an unknown id produces the same sentence whatever it contained.
 *
 * Said plainly, and said again in SECURITY.md: this is a registry check, not an
 * authentication one. There is no session, no signature over the approval and no
 * proof that the browser posting an officer id is that officer. It closes the
 * "any two distinct strings open the lock" hole and it closes nothing else.
 */
export function resolveApprovals(approvals: string[]): ApprovalResolution {
  const signers: ApprovedSigner[] = [];
  const seen = new Set<string>();

  for (const entry of approvals) {
    const candidate = entry.trim().toLowerCase();
    const officer = approvers.find(
      (approver) => approver.id.toLowerCase() === candidate
    );
    if (!officer) {
      return {
        ok: false,
        reason:
          "One of the approvals does not name an officer in the approver registry, so the quorum was not counted.",
      };
    }
    if (seen.has(officer.id)) {
      return {
        ok: false,
        reason: `${officer.name} appears twice in the approvals. ${QUORUM_THRESHOLD} distinct officers must approve.`,
      };
    }
    seen.add(officer.id);
    signers.push(officer);
  }

  if (signers.length < QUORUM_THRESHOLD) {
    return {
      ok: false,
      reason: `${signers.length} of ${QUORUM_THRESHOLD} registered officers approved this plan.`,
    };
  }

  return { ok: true, signers };
}

/* --- Request shaping, kept pure so it can be asserted without credentials --- */

export interface PrivyRequest {
  path: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  body?: string;
}

/** POST /v1/policies, owned by the key quorum. */
export function policyInstallRequest(
  policy: PrivyPolicy,
  keyQuorumId: string
): PrivyRequest {
  return {
    path: "/v1/policies",
    method: "POST",
    body: JSON.stringify({ ...policy, owner: { key_quorum_id: keyQuorumId } }),
  };
}

/**
 * PATCH /v1/wallets/{wallet_id}. `policy_ids` replaces the whole list and Privy
 * documents a maximum of one policy per wallet, so an attach is a one element
 * array and a detach is whatever the wallet carried before the lock.
 */
export function walletPolicyPatchRequest(
  walletId: string,
  policyIds: string[]
): PrivyRequest {
  return {
    path: `/v1/wallets/${walletId}`,
    method: "PATCH",
    body: JSON.stringify({ policy_ids: policyIds }),
  };
}

/** GET /v1/wallets/{wallet_id}, read before the attach so the detach can restore. */
export function walletReadRequest(walletId: string): PrivyRequest {
  return { path: `/v1/wallets/${walletId}`, method: "GET" };
}

async function sendPrivy(request: PrivyRequest): Promise<Response> {
  return privyFetch(request.path, {
    method: request.method,
    ...(request.body === undefined ? {} : { body: request.body }),
  });
}

/**
 * What the wallet carries in `policy_ids` right now. A wallet that cannot be
 * read is a wallet whose policies cannot be restored afterwards, so this throws
 * rather than guessing an empty list.
 */
async function readWalletPolicyIds(walletId: string): Promise<string[]> {
  const response = await sendPrivy(walletReadRequest(walletId));
  if (!response.ok) {
    throw new DetentError(
      "upstream_error",
      `Privy answered ${response.status} reading wallet ${walletId}.`,
      "The treasury wallet could not be read, so the policy was not attached and nothing was locked. Check PRIVY_TREASURY_WALLET_ID and the app credentials, then lock the plan again."
    );
  }
  const parsed = privyWalletResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new DetentError(
      "parse_failure",
      "The wallet read answered in a shape this build does not understand."
    );
  }
  return parsed.data.policy_ids ?? [];
}

/**
 * Bind the policy to the treasury wallet. This is the step that makes the
 * preview a signing limit, so a failure here fails the lock: the alternative is
 * a compiled policy nobody enforces and a product claim that is not true.
 */
async function attachPolicyToWallet(
  walletId: string,
  policyId: string,
  previousPolicyIds: string[]
): Promise<void> {
  const response = await sendPrivy(
    walletPolicyPatchRequest(walletId, [policyId])
  );

  if (!response.ok) {
    throw new DetentError(
      "upstream_error",
      `Privy answered ${response.status} attaching policy ${policyId} to wallet ${walletId}.`,
      "The policy was created but Privy would not bind it to the treasury wallet, so nothing was locked and the key is unchanged. A wallet held by an owner needs a request authorization signature on this call; check the wallet owner and the app credentials, then lock the plan again."
    );
  }

  const parsed = privyWalletResponseSchema.safeParse(await response.json());
  if (!parsed.success || !parsed.data.policy_ids?.includes(policyId)) {
    throw new DetentError(
      "upstream_error",
      `Privy accepted the wallet patch but did not report policy ${policyId} on wallet ${walletId}.`,
      "Privy did not confirm the policy is enforced on the treasury wallet, so the lock was refused rather than claimed. Check the wallet in the Privy dashboard, then lock the plan again."
    );
  }

  console.info(
    `${LOG_PREFIX} policy attached: ${policyId} on wallet ${walletId}, previous policy_ids ${previousPolicyIds.length}`
  );
}

/** Put the wallet's `policy_ids` back the way the lock found them. */
async function detachPolicyFromWallet(
  walletId: string,
  policyId: string,
  previousPolicyIds: string[]
): Promise<boolean> {
  try {
    const response = await sendPrivy(
      walletPolicyPatchRequest(walletId, previousPolicyIds)
    );
    console.info(
      `${LOG_PREFIX} policy detached: ${policyId} from wallet ${walletId}, accepted ${response.ok}`
    );
    return response.ok;
  } catch (error) {
    console.error(
      `${LOG_PREFIX} policy detach failed: ${policyId} on wallet ${walletId},`,
      error instanceof Error ? error.message : "unknown detach failure"
    );
    return false;
  }
}

export async function installPolicy(
  plan: Plan,
  signers: ApprovedSigner[]
): Promise<InstalledPolicy> {
  const policy = compilePolicy(plan);
  console.info(
    `${LOG_PREFIX} policy compiled: ${policy.name}, plan hash ${plan.planHash}, ${policy.rules[0].conditions.length} conditions, calldata ${(plan.calldata.length - 2) / 2} bytes`
  );

  if (!isPrivyLive()) {
    return {
      policyId: `pol_local_${plan.planHash.slice(2, 10)}`,
      policy,
      walletId: WALLET_ID,
      previousPolicyIds: [],
      policyAttached: false,
      live: false,
      note: "Compiled locally and attached to nothing. Set PRIVY_APP_ID and PRIVY_APP_SECRET to install it on the real treasury wallet and bind it there.",
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
  // Read the wallet first: an attach replaces the whole policy_ids list, and the
  // detach after the send has to put back what was there.
  const previousPolicyIds = await readWalletPolicyIds(WALLET_ID);

  const response = await sendPrivy(
    policyInstallRequest(policy, PRIVY_KEY_QUORUM_ID)
  );

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

  await attachPolicyToWallet(WALLET_ID, parsed.data.id, previousPolicyIds);

  console.info(
    `${LOG_PREFIX} policy installed: ${parsed.data.id} on wallet ${WALLET_ID}, quorum ${PRIVY_KEY_QUORUM_ID}, ${Date.now() - startedAt}ms`
  );

  return {
    policyId: parsed.data.id,
    policy,
    walletId: WALLET_ID,
    previousPolicyIds,
    policyAttached: true,
    live: true,
    note: `Installed on wallet ${WALLET_ID}, owned by the key quorum, enforced through the wallet's policy_ids, opened by ${signers.length} of ${QUORUM_THRESHOLD} registered officers.`,
  };
}

/**
 * Remove the single-use rule. The transaction has already landed by the time
 * this runs, so a failed revoke is reported in the note rather than thrown.
 */
export async function revokePolicy(policyId: string): Promise<boolean> {
  if (!isPrivyLive()) return false;
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

export interface PolicyRelease {
  detached: boolean;
  revoked: boolean;
}

/**
 * Unbind the policy from the wallet, then delete it. That order matters: a
 * policy still listed in policy_ids is a policy the wallet is still enforcing,
 * so the detach is the step that actually gives the treasury key its general
 * authority back.
 */
export async function releasePolicy(options: {
  walletId: string;
  policyId: string;
  previousPolicyIds: string[];
}): Promise<PolicyRelease> {
  if (!isPrivyLive()) {
    return { detached: false, revoked: false };
  }
  const detached = await detachPolicyFromWallet(
    options.walletId,
    options.policyId,
    options.previousPolicyIds
  );
  const revoked = await revokePolicy(options.policyId);
  return { detached, revoked };
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

function denialResult(options: {
  policy: PrivyPolicy;
  policyId: string;
  status: number;
  /** The mirror's reading of the same payload, used as the explanation. */
  mirrored: SignatureVerdict;
}): ExecutionResult {
  const ruleName = options.policy.rules[0]?.name ?? "none";
  const explanation = options.mirrored.allowed
    ? "The local mirror read this payload as allowed, so the wallet and the mirror disagree; the wallet is the one that decides."
    : options.mirrored.reason;
  return {
    verdict: {
      allowed: false,
      ruleName,
      ...(options.mirrored.failedCondition
        ? { failedCondition: options.mirrored.failedCondition }
        : {}),
      reason: `Privy refused to sign under policy ${options.policy.name}. Rule ${ruleName} did not match the submitted transaction, so default_action DENY applied (HTTP ${options.status}). ${explanation}`,
    },
    policyRevoked: false,
    policyDetached: false,
    decidedBy: "privy-wallet",
    live: true,
    note: `The wallet answered with a policy violation on policy ${options.policyId}, which is still attached to ${WALLET_ID} until the plan is sent as approved or the lock expires.`,
  };
}

/**
 * The reference a keyless send carries. It is keccak256 over the plan hash and
 * the submitted calldata: deterministic, so a rehearsal is reproducible, and
 * explicitly not a transaction hash. Nothing links it to an explorer and
 * settlePlan refuses to write it on chain.
 */
export function syntheticReference(planHash: Hex, data: Hex): Hex {
  return keccak256(concatHex([planHash, data]));
}

export interface SubmitOptions {
  policy: PrivyPolicy;
  policyId: string;
  /** The wallet the policy is attached to, and what it carried before. */
  walletId: string;
  previousPolicyIds: string[];
  to: string;
  chainId: number;
  planHash: Hex;
  data: Hex;
  /**
   * Set by the console's wrong-network action for one send only. It overrides
   * PRIVY_BROADCAST_MODE, so an operator who watched Privy refuse eip155:296
   * can take the sign and relay path without a redeploy.
   */
  broadcastPreference?: "auto" | "signature";
}

/**
 * Take a signature from Privy under the same policy and put the raw transaction
 * on chain through Hashio. This is the documented fallback for Privy refusing to
 * broadcast to eip155:296. Legacy type on purpose: the Hedera relay rejects
 * typed transactions.
 */
async function signAndRelay(options: {
  submit: SubmitOptions;
  mirrored: SignatureVerdict;
}): Promise<ExecutionResult> {
  const { submit, mirrored } = options;

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
    chainId: submit.chainId,
    transaction: {
      to: submit.to,
      data: submit.data,
      value: "0x0",
      chain_id: submit.chainId,
      nonce,
      type: 0,
      gas_limit: toHex(SIGNED_TX_GAS_LIMIT),
      gas_price: toHex(gasPrice),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    if (looksLikePolicyDenial(body)) {
      return denialResult({
        policy: submit.policy,
        policyId: submit.policyId,
        status: response.status,
        mirrored,
      });
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
    `${LOG_PREFIX} tx broadcast via relay: ${hash}, nonce ${nonce}, ${(submit.data.length - 2) / 2} calldata bytes, ${Date.now() - startedAt}ms`
  );

  const release = await releasePolicy({
    walletId: submit.walletId,
    policyId: submit.policyId,
    previousPolicyIds: submit.previousPolicyIds,
  });

  return {
    verdict: mirrored,
    receipt: {
      kind: "on-chain",
      transactionHash: hash,
      broadcast: "relay",
      note: "Signed by the treasury wallet under the attached policy, then broadcast through the Hedera relay as a legacy transaction.",
    },
    transactionHash: hash,
    policyRevoked: release.revoked,
    policyDetached: release.detached,
    decidedBy: "privy-wallet",
    live: true,
    note: `Signed by ${WALLET_ID} under policy ${submit.policyId}, then broadcast through the Hedera relay as a legacy transaction.${release.detached ? "" : " The policy could not be detached from the wallet, remove it in the Privy dashboard."}${release.revoked ? "" : " The revoke call did not succeed, delete the policy in the Privy dashboard."}`,
  };
}

export async function submitTransaction(
  options: SubmitOptions
): Promise<ExecutionResult> {
  // The mirror runs for the explanation and for the log. On the live path it
  // never decides anything: the wallet is asked either way, because a refusal
  // that never left this process is not the product's claim.
  const mirrored = evaluatePolicy(options.policy, {
    to: options.to,
    chainId: options.chainId,
    data: options.data,
  });

  if (!isPrivyLive()) {
    // Keyless path: the mirror is the only engine there is, and it says so.
    if (!mirrored.allowed) {
      return {
        verdict: mirrored,
        policyRevoked: false,
        policyDetached: false,
        decidedBy: "local-mirror",
        live: false,
        note: "Evaluated against the compiled policy locally. No policy is installed on a wallet in this mode, so there was nothing to detach or revoke.",
      };
    }
    return {
      verdict: mirrored,
      receipt: {
        kind: "synthetic",
        reference: syntheticReference(options.planHash, options.data),
        note: "Synthetic receipt. No key signed this and nothing was broadcast: the reference is keccak256 over the plan hash and the submitted calldata, and no block explorer will resolve it. Set PRIVY_APP_ID and PRIVY_APP_SECRET for a real signature.",
      },
      policyRevoked: false,
      policyDetached: false,
      decidedBy: "local-mirror",
      live: false,
      note: "Evaluated against the compiled policy locally. No policy is installed on a wallet in this mode, so there was nothing to detach or revoke.",
    };
  }

  if (!mirrored.allowed) {
    // Not a decision, a prediction: the wallet is still asked below, and if it
    // allows what the mirror refused the two have diverged and the log says so.
    console.info(
      `${LOG_PREFIX} mirror predicts a denial: ${options.policy.name}, rule ${mirrored.ruleName}, ${(options.data.length - 2) / 2} calldata bytes`
    );
  }

  const broadcastMode = options.broadcastPreference ?? PRIVY_BROADCAST_MODE;

  if (broadcastMode === "signature") {
    return signAndRelay({ submit: options, mirrored });
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
      return denialResult({
        policy: options.policy,
        policyId: options.policyId,
        status: response.status,
        mirrored,
      });
    }
    if (broadcastMode === "auto" && response.status < 500) {
      console.info(
        `${LOG_PREFIX} tx submitted: Privy answered ${response.status} for eip155:${options.chainId}, taking the signature path instead`
      );
      return signAndRelay({ submit: options, mirrored });
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
  if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    throw new DetentError(
      "parse_failure",
      "The wallet broadcast answered without a 32 byte transaction hash.",
      "Privy accepted the transaction but did not return a transaction hash this build can verify, so nothing is claimed about where it landed. Check the wallet in the Privy dashboard before sending again."
    );
  }
  const transactionHash = hash as `0x${string}`;

  if (!mirrored.allowed) {
    console.error(
      `${LOG_PREFIX} mirror and wallet diverged: the mirror refused ${options.policy.name} and the wallet signed anyway, tx ${transactionHash}`
    );
  }

  console.info(
    `${LOG_PREFIX} tx submitted: ${transactionHash}, policy ${options.policyId}, ${(options.data.length - 2) / 2} calldata bytes, ${Date.now() - startedAt}ms`
  );

  const release = await releasePolicy({
    walletId: options.walletId,
    policyId: options.policyId,
    previousPolicyIds: options.previousPolicyIds,
  });

  return {
    verdict: mirrored.allowed
      ? mirrored
      : {
          allowed: true,
          ruleName: options.policy.rules[0]?.name ?? "none",
          reason: `The wallet signed under policy ${options.policy.name}. The local mirror read the same payload as a refusal, so the two engines disagree and the wallet's answer is the one that counts.`,
        },
    receipt: {
      kind: "on-chain",
      transactionHash,
      broadcast: "privy-rpc",
      note: "Signed and broadcast by the treasury wallet under the attached policy.",
    },
    transactionHash,
    policyRevoked: release.revoked,
    policyDetached: release.detached,
    decidedBy: "privy-wallet",
    live: true,
    note: `Signed and broadcast by ${WALLET_ID} under policy ${options.policyId}.${release.detached ? "" : " The policy could not be detached from the wallet, remove it in the Privy dashboard."}${release.revoked ? "" : " The revoke call did not succeed, delete the policy in the Privy dashboard."}`,
  };
}
