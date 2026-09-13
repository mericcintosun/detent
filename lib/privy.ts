// Privy server wallet integration: the half of Detent that turns a preview into
// a signing limit.
//
// Two policies come out of one approved plan, and they are not the same thing.
//
// compilePolicy emits the explanation policy: one ALLOW rule that pins the
// chain, the destination contract, the function selector and the exact calldata
// bytes. That is what the console renders and what evaluatePolicy checks, and on
// the live path this server refuses any payload that is not the approved calldata
// before the wallet is ever asked.
//
// compileWirePolicy emits what is actually installed on Privy, in the shape
// Privy documents (https://docs.privy.io/api-reference/policies/create): owned by
// the key quorum through `owner_id`, no `default_action` field (Privy denies when
// no rule resolves), and conditions only from documented field sources.
// `ethereum_transaction` exposes `to`, `value` and `chain_id` and nothing else,
// so calldata is pinned through `ethereum_calldata`, which decodes arguments
// against an ABI and can compare scalar arguments. Array arguments cannot be
// compared, so for the coupon the wallet pins chain, contract, function and
// partition but not the holder list or the amounts. SECURITY.md says so.
//
// Compiling a policy constrains nothing on its own. The binding does: the policy
// id is written into the treasury wallet's `policy_ids` with PATCH
// /v1/wallets/{wallet_id} before the transaction is requested, and the wallet's
// previous `policy_ids` are written back once the lock is spent. Spent means the
// send landed, the send failed or timed out, the attach failed, or the lock
// expired: every one of those paths detaches and revokes on a best effort basis
// and logs what happened.
//
// No non-idempotent POST is ever repeated blind. Policy creation and the wallet
// rpc each carry one `privy-idempotency-key` per logical operation, and the single
// retry reuses that key, which Privy documents as executed at most once in 24
// hours (https://docs.privy.io/api-reference/idempotency-keys).
//
// Server side only: it reads lib/config.ts, which reads PRIVY_APP_SECRET and the
// authorization keys. Never import this from a client component.

import { createPrivateKey, randomUUID, sign as signBytes } from "node:crypto";
import {
  concatHex,
  decodeFunctionData,
  keccak256,
  parseAbiItem,
  toHex,
  type Hex,
} from "viem";
import {
  LOG_PREFIX,
  PRIVY_API_URL,
  PRIVY_APP_ID,
  PRIVY_APP_SECRET,
  PRIVY_AUTHORIZATION_KEYS,
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
import { DetentError, isDetentError } from "@/lib/errors";
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

/**
 * The live Privy path needs both credentials. Nothing else. It does not read
 * NEXT_PUBLIC_ADAPTER_MODE: that switch is the register half (a live ATS read
 * or the cached register), and the treasury key half turns on with its own
 * credentials, so a deployment with Privy keys and no ATS token signs live
 * against the cached register and the status line says both.
 */
export function isPrivyLive(): boolean {
  return Boolean(PRIVY_APP_ID) && Boolean(PRIVY_APP_SECRET);
}

/* --- Authorization signatures ---------------------------------------------- */

/**
 * RFC 8785 JSON canonicalization for the values a request body can hold: object
 * keys sorted by UTF-16 code units, no whitespace, and ECMAScript number and
 * string serialization, which is what JSON.stringify already produces. Keys whose
 * value is undefined are dropped, as JSON.stringify drops them.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry === undefined ? null : entry)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

export interface SignatureInput {
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  /** The full request URL, no trailing slash. */
  url: string;
  body?: unknown;
  /** Only privy- prefixed headers: privy-app-id and, when sent, privy-idempotency-key. */
  headers: Record<string, string>;
}

/**
 * The exact bytes Privy expects to be signed, per the direct implementation guide.
 * A request with no body (the policy DELETE) is signed with `body` set to the
 * empty string, and requestHeaders sends it without a Content-Type. Verified
 * against the live API: that DELETE answers 200 signed over `""` and 401 signed
 * with `body` omitted, `{}` or `null`. Sent with `Content-Type: application/json`
 * instead, Privy reads the empty body as `{}`, so the signed `""` no longer
 * matches and the same call answers 401.
 */
export function signaturePayload(input: SignatureInput): Buffer {
  return Buffer.from(
    canonicalJson({
      version: 1,
      method: input.method,
      url: input.url,
      body: input.body === undefined ? "" : input.body,
      headers: input.headers,
    }),
  );
}

/**
 * privy-authorization-signature, as documented at
 * https://docs.privy.io/controls/authorization-keys/using-owners/sign/direct-implementation:
 * canonicalize the payload, ECDSA P-256 over SHA-256 with each authorization key
 * (the `wallet-auth:` prefix removed, the rest a base64 PKCS#8 key), base64 each
 * DER signature, and join several with commas. Undefined when no key is set.
 */
export function authorizationSignature(
  input: SignatureInput,
  keys: readonly string[] = PRIVY_AUTHORIZATION_KEYS,
): string | undefined {
  if (keys.length === 0) return undefined;
  const payload = signaturePayload(input);
  return keys
    .map((key) => {
      let privateKey;
      try {
        const body = key.replace("wallet-auth:", "");
        privateKey = createPrivateKey({
          key: `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`,
          format: "pem",
        });
      } catch {
        // The key itself is never echoed, not even a prefix of it.
        throw new DetentError(
          "not_configured",
          "An entry in PRIVY_AUTHORIZATION_KEYS does not parse as a P-256 key.",
          "One of the authorization keys on the server does not parse. Paste each key from the Privy dashboard exactly as issued, wallet-auth: prefix included, separated by commas.",
        );
      }
      return signBytes("sha256", payload, privateKey).toString("base64");
    })
    .join(",");
}

/* --- The one Privy client -------------------------------------------------- */

interface PrivyCall {
  path: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /**
   * Required on every POST. The retry reuses it, so a timed out request that did
   * reach Privy is not executed a second time.
   */
  idempotencyKey?: string;
  /** Attach privy-authorization-signature when authorization keys are configured. */
  signed?: boolean;
  /** Said to the operator when the outcome of a write is unknown after a timeout. */
  unknownOutcomeHint?: string;
}

function requestHeaders(call: PrivyCall): Record<string, string> {
  const basic = Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString(
    "base64",
  );
  const privyHeaders: Record<string, string> = {
    "privy-app-id": PRIVY_APP_ID as string,
    ...(call.idempotencyKey
      ? { "privy-idempotency-key": call.idempotencyKey }
      : {}),
  };
  const signature =
    call.signed && call.method !== "GET"
      ? authorizationSignature({
          method: call.method,
          url: `${PRIVY_API_URL}${call.path}`,
          body: call.body,
          headers: privyHeaders,
        })
      : undefined;
  return {
    Authorization: `Basic ${basic}`,
    // Only on a request that has a body: see signaturePayload for why a
    // body-less signed call must not claim a JSON body.
    ...(call.body === undefined ? {} : { "Content-Type": "application/json" }),
    ...privyHeaders,
    ...(signature ? { "privy-authorization-signature": signature } : {}),
  };
}

type Attempt = { kind: "answered"; response: Response } | { kind: "timeout" };

async function attemptPrivy(
  call: PrivyCall,
  headers: Record<string, string>,
): Promise<Attempt> {
  try {
    const response = await fetch(`${PRIVY_API_URL}${call.path}`, {
      method: call.method,
      headers,
      ...(call.body === undefined ? {} : { body: JSON.stringify(call.body) }),
      signal: AbortSignal.timeout(PRIVY_TIMEOUT_MS),
    });
    return { kind: "answered", response };
  } catch {
    return { kind: "timeout" };
  }
}

/**
 * One shared client for every Privy call: basic auth, the app id header, a
 * bounded timeout, and at most one re-attempt on a timeout or a 5xx. GET, PATCH
 * and DELETE are idempotent by definition. A POST is re-attempted only under the
 * idempotency key it was first sent with, and a POST without one is a programming
 * error, so it is never re-attempted at all. A 4xx comes back to the caller,
 * because the caller has to tell a policy refusal apart from an unsupported chain.
 */
async function privyFetch(call: PrivyCall): Promise<Response> {
  const headers = requestHeaders(call);
  const repeatable = call.method !== "POST" || Boolean(call.idempotencyKey);

  const first = await attemptPrivy(call, headers);
  if (first.kind === "answered" && first.response.status < 500) {
    return first.response;
  }

  const final = repeatable ? await attemptPrivy(call, headers) : first;
  const retried = repeatable ? ` after ${RETRY_COUNT} retry` : " with no retry";

  if (final.kind === "answered") {
    if (final.response.status < 500) return final.response;
    throw new DetentError(
      "upstream_error",
      `Privy answered ${final.response.status} on ${call.method} ${call.path}${retried}.`,
      call.unknownOutcomeHint,
      { providerStatus: final.response.status },
    );
  }

  throw new DetentError(
    "upstream_timeout",
    `Privy did not answer ${call.method} ${call.path} within ${PRIVY_TIMEOUT_MS}ms${retried}.`,
    call.unknownOutcomeHint,
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
  request: { to: string; chainId: number; data: Hex },
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
  { ok: true; signers: ApprovedSigner[] } | { ok: false; reason: string };

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
      (approver) => approver.id.toLowerCase() === candidate,
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

/* --- The wire policy, in the shape Privy documents ------------------------- */

const COUPON_ABI_ITEM = parseAbiItem(
  "function distributeCoupon(bytes32 partition, address[] holders, uint256[] amounts)",
);

const FORCED_TRANSFER_ABI_ITEM = parseAbiItem(
  "function operatorTransferByPartition(bytes32 partition, address from, address to, uint256 value, bytes data, bytes operatorData) returns (bytes32)",
);

export interface PrivyWireCondition {
  field_source: "ethereum_transaction" | "ethereum_calldata";
  field: string;
  operator: "eq";
  value: string;
  /** Required on every ethereum_calldata condition. */
  abi?: readonly unknown[];
}

export interface PrivyWireRule {
  name: string;
  method: "eth_sendTransaction" | "eth_signTransaction";
  conditions: PrivyWireCondition[];
  action: "ALLOW";
}

/** The body of POST /v1/policies. No default_action: Privy denies when no rule resolves. */
export interface PrivyWirePolicy {
  version: "1.0";
  name: string;
  chain_type: "ethereum";
  rules: PrivyWireRule[];
  owner_id: string;
}

/**
 * The narrowest documented condition set for one plan. Every rule pins the chain
 * and the destination contract through ethereum_transaction, and the function and
 * every scalar argument through ethereum_calldata against the function's ABI.
 * Array and dynamic bytes arguments are not compared, because Privy documents no
 * operator for them: that leaves the coupon's holder list and amounts, and the
 * forced transfer's two data arguments, to the server side check in
 * submitTransaction. The same conditions are written for eth_sendTransaction and
 * for eth_signTransaction, because a policy on a wallet must carry a rule for
 * every rpc method the wallet is asked to run, and the relay fallback signs.
 */
export function compileWirePolicy(
  plan: Plan,
  keyQuorumId: string,
): PrivyWirePolicy {
  const label = `detent-${plan.kind}-${plan.planHash.slice(2, 10)}`;
  const abiItem =
    plan.kind === "coupon" ? COUPON_ABI_ITEM : FORCED_TRANSFER_ABI_ITEM;
  const abi = [abiItem] as const;

  let args: readonly unknown[];
  try {
    args = decodeFunctionData({ abi, data: plan.calldata }).args ?? [];
  } catch {
    throw new DetentError(
      "parse_failure",
      "The approved calldata does not decode against the plan's own ABI.",
      "The approved calldata could not be decoded, so no policy was compiled for the wallet and nothing was locked. Reload the page and rebuild the plan.",
    );
  }

  const functionName = abiItem.name;
  const calldata = (field: string, value: string): PrivyWireCondition => ({
    field_source: "ethereum_calldata",
    field: `${functionName}.${field}`,
    operator: "eq",
    value,
    abi,
  });

  const pinned: PrivyWireCondition[] = [
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
    calldata("partition", String(args[0])),
  ];

  if (plan.kind === "forced-transfer") {
    pinned.push(
      calldata("from", String(args[1])),
      calldata("to", String(args[2])),
      calldata("value", toHex(args[3] as bigint)),
    );
  }

  return {
    version: "1.0",
    name: label,
    chain_type: "ethereum",
    rules: [
      {
        name: `${label}-send`,
        method: "eth_sendTransaction",
        conditions: pinned,
        action: "ALLOW",
      },
      {
        name: `${label}-sign`,
        method: "eth_signTransaction",
        conditions: pinned,
        action: "ALLOW",
      },
    ],
    owner_id: keyQuorumId,
  };
}

/* --- Request shaping, kept pure so it can be asserted without credentials --- */

export interface PrivyRequest {
  path: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  body?: string;
}

/** POST /v1/policies, owned by the key quorum through owner_id. */
export function policyInstallRequest(
  plan: Plan,
  keyQuorumId: string,
): PrivyRequest {
  return {
    path: "/v1/policies",
    method: "POST",
    body: JSON.stringify(compileWirePolicy(plan, keyQuorumId)),
  };
}

/**
 * PATCH /v1/wallets/{wallet_id}. `policy_ids` replaces the whole list and Privy
 * documents a maximum of one policy per wallet, so an attach is a one element
 * array and a detach is whatever the wallet carried before the lock.
 */
export function walletPolicyPatchRequest(
  walletId: string,
  policyIds: string[],
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

/** DELETE /v1/policies/{policy_id}. */
export function policyRevokeRequest(policyId: string): PrivyRequest {
  return { path: `/v1/policies/${policyId}`, method: "DELETE" };
}

/**
 * POST /v1/wallets/{wallet_id}/rpc, with the chain_type the reference lists.
 * `caip2` goes on eth_sendTransaction only: the eth_signTransaction reference has
 * no such field, and the live API refuses it there with 400 "Unrecognized key(s)
 * in object: 'caip2'". The chain travels in `params.transaction.chain_id`.
 */
export function walletRpcRequest(
  walletId: string,
  method: "eth_sendTransaction" | "eth_signTransaction",
  chainId: number,
  transaction: Record<string, string | number>,
): PrivyRequest {
  return {
    path: `/v1/wallets/${walletId}/rpc`,
    method: "POST",
    body: JSON.stringify({
      method,
      ...(method === "eth_sendTransaction" ? { caip2: `eip155:${chainId}` } : {}),
      chain_type: "ethereum",
      params: { transaction },
    }),
  };
}

async function sendPrivy(
  request: PrivyRequest,
  options: Omit<PrivyCall, "path" | "method" | "body"> = {},
): Promise<Response> {
  return privyFetch({
    path: request.path,
    method: request.method,
    ...(request.body === undefined ? {} : { body: JSON.parse(request.body) }),
    ...options,
  });
}

function statusOf(error: unknown): number | undefined {
  return isDetentError(error) ? error.providerStatus : undefined;
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
      "The treasury wallet could not be read, so the policy was not attached and nothing was locked. Check PRIVY_TREASURY_WALLET_ID and the app credentials, then lock the plan again.",
      { providerStatus: response.status },
    );
  }
  const parsed = privyWalletResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new DetentError(
      "parse_failure",
      "The wallet read answered in a shape this build does not understand.",
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
  previousPolicyIds: string[],
): Promise<void> {
  const response = await sendPrivy(
    walletPolicyPatchRequest(walletId, [policyId]),
    { signed: true },
  );

  if (!response.ok) {
    throw new DetentError(
      "upstream_error",
      `Privy answered ${response.status} attaching policy ${policyId} to wallet ${walletId}.`,
      "Privy would not bind the policy to the treasury wallet, so nothing was locked. A wallet held by an owner needs a request authorization signature on this call: set PRIVY_AUTHORIZATION_KEYS to the owner's authorization key, check the app credentials, then lock the plan again.",
      { providerStatus: response.status },
    );
  }

  const parsed = privyWalletResponseSchema.safeParse(await response.json());
  if (!parsed.success || !parsed.data.policy_ids?.includes(policyId)) {
    throw new DetentError(
      "upstream_error",
      `Privy accepted the wallet patch but did not report policy ${policyId} on wallet ${walletId}.`,
      "Privy did not confirm the policy is enforced on the treasury wallet, so the lock was refused rather than claimed. Check the wallet in the Privy dashboard, then lock the plan again.",
      { providerStatus: response.status },
    );
  }

  console.info(
    `${LOG_PREFIX} policy attached: ${policyId} on wallet ${walletId}, previous policy_ids ${previousPolicyIds.length}`,
  );
}

/** Put the wallet's `policy_ids` back the way the lock found them. */
async function detachPolicyFromWallet(
  walletId: string,
  policyId: string,
  previousPolicyIds: string[],
): Promise<boolean> {
  try {
    const response = await sendPrivy(
      walletPolicyPatchRequest(walletId, previousPolicyIds),
      { signed: true },
    );
    console.info(
      `${LOG_PREFIX} policy detached: ${policyId} from wallet ${walletId}, accepted ${response.ok}, status ${response.status}`,
    );
    return response.ok;
  } catch (error) {
    console.error(
      `${LOG_PREFIX} policy detach failed: ${policyId} on wallet ${walletId}, status ${statusOf(error) ?? "none"},`,
      error instanceof Error ? error.message : "unknown detach failure",
    );
    return false;
  }
}

export interface PolicyRelease {
  detached: boolean;
  revoked: boolean;
}

function releaseSentence(release: PolicyRelease): string {
  return `${release.detached ? "The wallet's previous policy_ids were written back" : "The wallet's previous policy_ids could not be written back, restore them in the Privy dashboard"}, and ${release.revoked ? "the policy was revoked." : "the revoke did not succeed, delete the policy in the Privy dashboard."}`;
}

export async function installPolicy(
  plan: Plan,
  signers: ApprovedSigner[],
): Promise<InstalledPolicy> {
  const policy = compilePolicy(plan);
  console.info(
    `${LOG_PREFIX} policy compiled: ${policy.name}, plan hash ${plan.planHash}, ${policy.rules[0].conditions.length} conditions, calldata ${(plan.calldata.length - 2) / 2} bytes`,
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
      "PRIVY_KEY_QUORUM_ID is not set on the server, so no key quorum can own the policy. Create the quorum with threshold two in the Privy dashboard and set that id.",
    );
  }

  const startedAt = Date.now();
  // Read the wallet first: an attach replaces the whole policy_ids list, and the
  // detach after the send has to put back what was there.
  const previousPolicyIds = await readWalletPolicyIds(WALLET_ID);

  const response = await sendPrivy(
    policyInstallRequest(plan, PRIVY_KEY_QUORUM_ID),
    {
      idempotencyKey: `detent-policy-${randomUUID()}`,
      unknownOutcomeHint:
        "Privy did not confirm the policy install, so nothing was attached to the wallet and nothing was locked. A policy may still have been created without being attached; it constrains nothing, and it can be deleted in the Privy dashboard. Lock the plan again.",
    },
  );

  if (!response.ok) {
    throw new DetentError(
      "upstream_error",
      `Privy refused the policy install with ${response.status}.`,
      "Privy refused to install the policy. Check the app credentials and the key quorum id, then lock the plan again.",
      { providerStatus: response.status },
    );
  }

  const parsed = privyPolicyResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new DetentError(
      "parse_failure",
      "The policy install response carried no id.",
    );
  }
  const policyId = parsed.data.id;

  try {
    await attachPolicyToWallet(WALLET_ID, policyId, previousPolicyIds);
  } catch (error) {
    // The policy exists and may or may not be bound. Put the wallet back and
    // delete the policy before the refusal goes out, so a failed lock leaves
    // nothing behind on Privy.
    const release = await releasePolicy({
      walletId: WALLET_ID,
      policyId,
      previousPolicyIds,
    });
    console.error(
      `${LOG_PREFIX} attach failed, cleaned up: policy ${policyId}, status ${statusOf(error) ?? "none"}, detached ${release.detached}, revoked ${release.revoked}`,
    );
    if (isDetentError(error)) {
      throw new DetentError(
        error.code,
        error.message,
        `${error.hint} ${releaseSentence(release)}`,
        { providerStatus: error.providerStatus },
      );
    }
    throw error;
  }

  console.info(
    `${LOG_PREFIX} policy installed: ${policyId} on wallet ${WALLET_ID}, quorum ${PRIVY_KEY_QUORUM_ID}, ${Date.now() - startedAt}ms`,
  );

  return {
    policyId,
    policy,
    walletId: WALLET_ID,
    previousPolicyIds,
    policyAttached: true,
    live: true,
    note: `Installed on wallet ${WALLET_ID}, owned by key quorum ${PRIVY_KEY_QUORUM_ID}, enforced through the wallet's policy_ids, opened by ${signers.length} of ${QUORUM_THRESHOLD} registered officers. The wallet policy pins the chain, the contract, the function and its scalar arguments; this server checks the full calldata before the wallet is asked.`,
  };
}

/**
 * Remove the single-use rule. Reported rather than thrown, because it runs on
 * the way out of every path. A policy Privy no longer knows (404) counts as gone.
 */
export async function revokePolicy(policyId: string): Promise<boolean> {
  if (!isPrivyLive()) return false;
  try {
    const response = await sendPrivy(policyRevokeRequest(policyId), {
      signed: true,
    });
    const gone = response.ok || response.status === 404;
    console.info(
      `${LOG_PREFIX} policy revoked: ${policyId}, accepted ${gone}, status ${response.status}`,
    );
    return gone;
  } catch (error) {
    console.error(
      `${LOG_PREFIX} policy revoke failed: ${policyId}, status ${statusOf(error) ?? "none"},`,
      error instanceof Error ? error.message : "unknown revoke failure",
    );
    return false;
  }
}

/**
 * Unbind the policy from the wallet, then delete it. That order matters: a
 * policy still listed in policy_ids is a policy the wallet is still enforcing,
 * so the detach is the step that actually gives the treasury key its general
 * authority back. Both steps always run, whatever the first one answered.
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
    options.previousPolicyIds,
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

const UNKNOWN_SEND_HINT =
  "Privy did not confirm this send, even after one retry under the same idempotency key, so whether the transaction was broadcast is unknown. Check the treasury wallet's transactions on HashScan before locking the plan again.";

async function walletRpc(options: WalletRpcOptions): Promise<Response> {
  return sendPrivy(
    walletRpcRequest(
      WALLET_ID,
      options.method,
      options.chainId,
      options.transaction,
    ),
    {
      signed: true,
      idempotencyKey: `detent-rpc-${randomUUID()}`,
      unknownOutcomeHint: UNKNOWN_SEND_HINT,
    },
  );
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
      reason: `Privy refused to sign under policy ${options.policy.name}: no rule allowed the submitted transaction, so Privy's default deny applied (HTTP ${options.status}). ${explanation}`,
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
      "PRIVY_TREASURY_WALLET_ADDRESS is not set on the server, so the nonce for the raw transaction cannot be read. Take the wallet address from the Privy dashboard and set it.",
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
      "Privy would neither broadcast nor sign this transaction. Check the wallet id and the policy owner, then lock and send the approved plan again.",
      { providerStatus: response.status },
    );
  }

  const parsed = privyRpcResponseSchema.safeParse(await response.json());
  const signed = parsed.success
    ? parsed.data.data?.signed_transaction
    : undefined;
  if (!signed) {
    throw new DetentError(
      "parse_failure",
      "The sign response carried no signed transaction.",
    );
  }

  const hash = await client.sendRawTransaction({
    serializedTransaction: signed as Hex,
  });
  console.info(
    `${LOG_PREFIX} tx broadcast via relay: ${hash}, nonce ${nonce}, ${(submit.data.length - 2) / 2} calldata bytes, ${Date.now() - startedAt}ms`,
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

/** Ask the wallet to send, or to sign for the relay, and read what came back. */
async function sendThroughWallet(
  options: SubmitOptions,
  mirrored: SignatureVerdict,
): Promise<ExecutionResult> {
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
        `${LOG_PREFIX} policy denied: ${options.policy.name} refused by Privy with ${response.status}`,
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
        `${LOG_PREFIX} tx submitted: Privy answered ${response.status} for eip155:${options.chainId}, taking the signature path instead`,
      );
      return signAndRelay({ submit: options, mirrored });
    }
    throw new DetentError(
      "upstream_error",
      `Privy refused to broadcast with ${response.status}.`,
      "Privy would not broadcast this transaction. Set PRIVY_BROADCAST_MODE=signature to sign and relay instead, then lock and send the approved plan again.",
      { providerStatus: response.status },
    );
  }

  const parsed = privyRpcResponseSchema.safeParse(await response.json());
  const hash = parsed.success ? parsed.data.data?.hash : undefined;
  if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    throw new DetentError(
      "parse_failure",
      "The wallet broadcast answered without a 32 byte transaction hash.",
      "Privy accepted the transaction but did not return a transaction hash this build can verify, so nothing is claimed about where it landed. Check the treasury wallet on HashScan before sending again.",
      { providerStatus: response.status },
    );
  }
  const transactionHash = hash as `0x${string}`;

  console.info(
    `${LOG_PREFIX} tx submitted: ${transactionHash}, policy ${options.policyId}, ${(options.data.length - 2) / 2} calldata bytes, ${Date.now() - startedAt}ms`,
  );

  const release = await releasePolicy({
    walletId: options.walletId,
    policyId: options.policyId,
    previousPolicyIds: options.previousPolicyIds,
  });

  return {
    verdict: mirrored,
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

export async function submitTransaction(
  options: SubmitOptions,
): Promise<ExecutionResult> {
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
    // The wallet policy cannot compare the coupon's holder and amount arrays, so
    // a payload that is not the approved calldata byte for byte would pass it.
    // This server therefore refuses it here and never asks the wallet, and the
    // verdict says which engine refused.
    console.info(
      `${LOG_PREFIX} server refused the payload before the wallet: ${options.policy.name}, rule ${mirrored.ruleName}, ${(options.data.length - 2) / 2} calldata bytes`,
    );
    return {
      verdict: mirrored,
      policyRevoked: false,
      policyDetached: false,
      decidedBy: "local-mirror",
      live: true,
      note: `Refused by this server before the wallet was asked: the payload is not the approved calldata, and the policy on ${options.walletId} pins the chain, the contract, the function and its scalar arguments but cannot compare array arguments. Nothing was sent to Privy. Policy ${options.policyId} stays attached until the plan is sent as approved or the lock expires.`,
    };
  }

  try {
    return await sendThroughWallet(options, mirrored);
  } catch (error) {
    // Any failure once the wallet may have been asked spends the lock: the
    // wallet's previous policy_ids go back and the policy is revoked, so a failed
    // or unknown send never leaves a policy attached behind it.
    const release = await releasePolicy({
      walletId: options.walletId,
      policyId: options.policyId,
      previousPolicyIds: options.previousPolicyIds,
    });
    console.error(
      `${LOG_PREFIX} send failed, cleaned up: policy ${options.policyId}, status ${statusOf(error) ?? "none"}, detached ${release.detached}, revoked ${release.revoked}`,
    );
    const base = isDetentError(error)
      ? error
      : new DetentError(
          "upstream_error",
          error instanceof Error ? error.message : "unknown send failure",
        );
    throw new DetentError(
      base.code,
      base.message,
      `${base.hint} ${releaseSentence(release)} This lock is spent, so lock the plan again before another send.`,
      { providerStatus: base.providerStatus, lockSpent: true },
    );
  }
}
