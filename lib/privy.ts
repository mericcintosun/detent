// Privy server wallet integration: the half of Detent that turns a preview into
// a signing limit.
//
// compilePolicy takes an approved plan and emits a Privy policy whose only ALLOW
// rule pins the destination contract, the chain, the function selector and the
// exact calldata bytes. Everything else stays on default_action DENY. The key
// quorum (threshold two) is what installs the policy; the policy is revoked as
// soon as the transaction lands.
//
// Server side only: it reads PRIVY_APP_SECRET. Never import this from a client
// component.

import type { Hex } from "viem";
import { useLivePrivy } from "@/lib/adapter";
import { treasury } from "@/lib/data";
import type { Plan } from "@/lib/plan";
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

const PRIVY_API = process.env.PRIVY_API_URL ?? "https://api.privy.io";
const APP_ID = process.env.PRIVY_APP_ID;
const APP_SECRET = process.env.PRIVY_APP_SECRET;
const WALLET_ID = process.env.PRIVY_TREASURY_WALLET_ID ?? treasury.walletId;
const QUORUM_THRESHOLD = 2;

export function isPrivyLive(): boolean {
  return useLivePrivy();
}

function authHeaders(): Record<string, string> {
  const basic = Buffer.from(`${APP_ID}:${APP_SECRET}`).toString("base64");
  return {
    Authorization: `Basic ${basic}`,
    "privy-app-id": APP_ID as string,
    "Content-Type": "application/json",
  };
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

  const response = await fetch(`${PRIVY_API}/v1/policies`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      ...policy,
      owner: { key_quorum_id: process.env.PRIVY_KEY_QUORUM_ID },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Privy refused the policy install: ${response.status} ${await response.text()}`
    );
  }

  const created = (await response.json()) as { id: string };
  return {
    policyId: created.id,
    policy,
    walletId: WALLET_ID,
    quorumThreshold: QUORUM_THRESHOLD,
    live: true,
    note: `Installed on wallet ${WALLET_ID}, opened by ${approvals.length} of ${QUORUM_THRESHOLD} quorum signers.`,
  };
}

export async function revokePolicy(policyId: string): Promise<boolean> {
  if (!isPrivyLive()) return true;
  const response = await fetch(`${PRIVY_API}/v1/policies/${policyId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return response.ok;
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

  const response = await fetch(
    `${PRIVY_API}/v1/wallets/${WALLET_ID}/rpc`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        method: "eth_sendTransaction",
        caip2: `eip155:${options.chainId}`,
        params: {
          transaction: {
            to: options.to,
            data: options.data,
            chain_id: options.chainId,
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    return {
      verdict: {
        allowed: false,
        ruleName: options.policy.rules[0]?.name ?? "none",
        reason: `Privy refused to sign: ${response.status} ${body}`,
      },
      policyRevoked: false,
      live: true,
      note: "The wallet answered with a policy violation.",
    };
  }

  const result = (await response.json()) as { data?: { hash?: string } };
  return {
    verdict,
    transactionHash: result.data?.hash,
    policyRevoked: await revokePolicy(options.policyId),
    live: true,
    note: `Signed by ${WALLET_ID} under policy ${options.policyId}.`,
  };
}
