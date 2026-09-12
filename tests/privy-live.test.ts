// The live Privy path, with no network.
//
// Every test here switches lib/privy.ts to its live path with vi.stubEnv and a
// fresh module graph, and replaces global fetch with a recorder that answers the
// way Privy's reference documents. The assertions are on what leaves the
// process: request bodies in the documented shape, no POST repeated without its
// idempotency key, detach and revoke on every failure path, the expiry cleanup,
// and the authorization signature.
//
// Sources for the shapes asserted below:
//   https://docs.privy.io/api-reference/policies/create
//   https://docs.privy.io/api-reference/wallets/update
//   https://docs.privy.io/api-reference/wallets/ethereum/eth-send-transaction
//   https://docs.privy.io/api-reference/idempotency-keys
//   https://docs.privy.io/controls/authorization-keys/using-owners/sign/direct-implementation

import {
  createPublicKey,
  generateKeyPairSync,
  verify as verifySignature,
} from "node:crypto";
import { decodeFunctionData, parseAbiItem, type Hex } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { holders } from "@/lib/data";
import { buildCalldata, buildPlan, type Plan } from "@/lib/plan";

const APP_ID = "app_test_live";
const APP_SECRET = "secret-that-must-never-appear";
const WALLET = "wlt_live_treasury";
const QUORUM = "kq_live_quorum";
const TX_HASH = `0x${"cd".repeat(32)}`;
const POLICY_ID = "pol_live_00000000000000001";

interface Recorded {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

type Responder = (request: Recorded) => Response | "timeout";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** The default Privy: a wallet with no policy, and every call succeeding. */
function privyAnswer(request: Recorded, walletPolicies: string[]): Response {
  const key = `${request.method} ${request.path}`;
  if (key === `GET /v1/wallets/${WALLET}`) {
    return json(200, { id: WALLET, policy_ids: walletPolicies });
  }
  if (key === "POST /v1/policies") return json(200, { id: POLICY_ID });
  if (key === `PATCH /v1/wallets/${WALLET}`) {
    const body = request.body as { policy_ids: string[] };
    return json(200, { id: WALLET, policy_ids: body.policy_ids });
  }
  if (key === `POST /v1/wallets/${WALLET}/rpc`) {
    return json(200, {
      method: "eth_sendTransaction",
      data: { hash: TX_HASH, caip2: "eip155:296" },
    });
  }
  if (key === `DELETE /v1/policies/${POLICY_ID}`) {
    return json(200, { success: true });
  }
  return json(404, { error: "not mocked" });
}

let recorded: Recorded[] = [];

function installFetch(
  override: Responder = () => json(599, {}),
  walletPolicies: string[] = [],
) {
  recorded = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const request: Recorded = {
        method: init?.method ?? "GET",
        path: url.pathname,
        headers: { ...(init?.headers as Record<string, string>) },
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      };
      recorded.push(request);
      const scripted = override(request);
      if (scripted === "timeout") {
        throw new DOMException("The operation timed out.", "TimeoutError");
      }
      if (scripted.status !== 599) return scripted;
      return privyAnswer(request, walletPolicies);
    }),
  );
}

const sequence = () => recorded.map((entry) => `${entry.method} ${entry.path}`);

function newKey(): { privateKey: string; publicKeyDer: Buffer } {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const pkcs8 = privateKey.export({ format: "der", type: "pkcs8" });
  return {
    privateKey: `wallet-auth:${pkcs8.toString("base64")}`,
    publicKeyDer: publicKey.export({ format: "der", type: "spki" }),
  };
}

async function loadLive(env: Record<string, string> = {}) {
  vi.stubEnv("NEXT_PUBLIC_ADAPTER_MODE", "real");
  vi.stubEnv("PRIVY_APP_ID", APP_ID);
  vi.stubEnv("PRIVY_APP_SECRET", APP_SECRET);
  vi.stubEnv("PRIVY_TREASURY_WALLET_ID", WALLET);
  vi.stubEnv("PRIVY_KEY_QUORUM_ID", QUORUM);
  vi.stubEnv("PRIVY_API_URL", "https://api.privy.test");
  vi.stubEnv("PRIVY_BROADCAST_MODE", "rpc");
  vi.stubEnv("PRIVY_AUTHORIZATION_KEYS", "");
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  vi.resetModules();
  const privy = await import("@/lib/privy");
  const errors = await import("@/lib/errors");
  return { privy, errors };
}

const plan: Plan = buildPlan({ kind: "coupon", holders });
const approvedRows = plan.rows
  .filter((row) => row.included)
  .map((row) => ({ address: row.address, amountMicros: row.amountMicros }));

const signers = [
  { id: "ops-controller", name: "A", role: "r" },
  { id: "risk-officer", name: "B", role: "r" },
] as never;

function submitOptions(
  privy: Awaited<ReturnType<typeof loadLive>>["privy"],
  data: Hex = plan.calldata,
) {
  return {
    policy: privy.compilePolicy(plan),
    policyId: POLICY_ID,
    walletId: WALLET,
    previousPolicyIds: ["pol_house_0000000000000001"],
    to: plan.target,
    chainId: plan.chainId,
    planHash: plan.planHash,
    data,
  };
}

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("the documented request shapes", () => {
  it("creates the policy with owner_id, no default_action and ABI decoded calldata conditions", async () => {
    const { privy } = await loadLive();
    const wire = privy.compileWirePolicy(plan, QUORUM);

    expect(Object.keys(wire).sort()).toEqual(
      ["chain_type", "name", "owner_id", "rules", "version"].sort(),
    );
    expect(wire.owner_id).toBe(QUORUM);
    expect(wire.version).toBe("1.0");
    expect(wire.name.length).toBeLessThanOrEqual(50);

    const partition = decodeFunctionData({
      abi: [
        parseAbiItem(
          "function distributeCoupon(bytes32 partition, address[] holders, uint256[] amounts)",
        ),
      ],
      data: plan.calldata,
    }).args[0];

    for (const rule of wire.rules) {
      expect(rule.name.length).toBeLessThanOrEqual(50);
      expect(rule.action).toBe("ALLOW");
      expect(rule.conditions.map((c) => [c.field_source, c.field])).toEqual([
        ["ethereum_transaction", "chain_id"],
        ["ethereum_transaction", "to"],
        ["ethereum_calldata", "distributeCoupon.partition"],
      ]);
      // ethereum_transaction documents only to, value and chain_id.
      for (const condition of rule.conditions) {
        if (condition.field_source === "ethereum_transaction") {
          expect(["to", "value", "chain_id"]).toContain(condition.field);
          expect(condition.abi).toBeUndefined();
        } else {
          expect(condition.abi).toHaveLength(1);
        }
      }
      expect(rule.conditions[0].value).toBe("296");
      expect(rule.conditions[1].value).toBe(plan.target);
      expect(rule.conditions[2].value).toBe(partition);
    }
    expect(wire.rules.map((rule) => rule.method)).toEqual([
      "eth_sendTransaction",
      "eth_signTransaction",
    ]);
  });

  it("pins every scalar argument of a forced transfer", async () => {
    const { privy } = await loadLive();
    const forced = buildPlan({ kind: "forced-transfer", holders });
    const fields = privy
      .compileWirePolicy(forced, QUORUM)
      .rules[0].conditions.map((condition) => condition.field);
    expect(fields).toEqual([
      "chain_id",
      "to",
      "operatorTransferByPartition.partition",
      "operatorTransferByPartition.from",
      "operatorTransferByPartition.to",
      "operatorTransferByPartition.value",
    ]);
  });

  it("sends method, caip2, chain_type and params.transaction on the rpc", async () => {
    const { privy } = await loadLive();
    const request = privy.walletRpcRequest(WALLET, "eth_sendTransaction", 296, {
      to: plan.target,
      data: plan.calldata,
      chain_id: 296,
    });
    expect(request.path).toBe(`/v1/wallets/${WALLET}/rpc`);
    expect(JSON.parse(request.body ?? "{}")).toEqual({
      method: "eth_sendTransaction",
      caip2: "eip155:296",
      chain_type: "ethereum",
      params: {
        transaction: { to: plan.target, data: plan.calldata, chain_id: 296 },
      },
    });
  });

  it("locks and sends in the documented order, with the documented bodies", async () => {
    installFetch(() => json(599, {}), ["pol_house_0000000000000001"]);
    const { privy } = await loadLive();

    const installed = await privy.installPolicy(plan, signers);
    expect(installed.policyAttached).toBe(true);
    expect(installed.previousPolicyIds).toEqual(["pol_house_0000000000000001"]);

    const result = await privy.submitTransaction({
      ...submitOptions(privy),
      previousPolicyIds: installed.previousPolicyIds,
    });

    expect(sequence()).toEqual([
      `GET /v1/wallets/${WALLET}`,
      "POST /v1/policies",
      `PATCH /v1/wallets/${WALLET}`,
      `POST /v1/wallets/${WALLET}/rpc`,
      `PATCH /v1/wallets/${WALLET}`,
      `DELETE /v1/policies/${POLICY_ID}`,
    ]);
    expect(recorded[1].body).toEqual(privy.compileWirePolicy(plan, QUORUM));
    expect(recorded[2].body).toEqual({ policy_ids: [POLICY_ID] });
    expect(recorded[4].body).toEqual({
      policy_ids: ["pol_house_0000000000000001"],
    });
    expect(result.receipt).toMatchObject({
      kind: "on-chain",
      transactionHash: TX_HASH,
    });
    expect(result.decidedBy).toBe("privy-wallet");
    expect(result.policyDetached && result.policyRevoked).toBe(true);

    for (const entry of recorded) {
      expect(entry.headers["privy-app-id"]).toBe(APP_ID);
      expect(entry.headers.Authorization).toBe(
        `Basic ${Buffer.from(`${APP_ID}:${APP_SECRET}`).toString("base64")}`,
      );
    }
    // Each POST carries its own idempotency key.
    const posts = recorded.filter((entry) => entry.method === "POST");
    const keys = posts.map((entry) => entry.headers["privy-idempotency-key"]);
    expect(keys.every(Boolean)).toBe(true);
    expect(new Set(keys).size).toBe(posts.length);
  });

  it("refuses a tampered payload before the wallet is asked", async () => {
    installFetch();
    const { privy } = await loadLive();
    const tampered = buildCalldata(
      "coupon",
      approvedRows.map((row, index) =>
        index === 0 ? { ...row, amountMicros: `${row.amountMicros}0` } : row,
      ),
    );

    const result = await privy.submitTransaction(
      submitOptions(privy, tampered),
    );

    expect(result.verdict.allowed).toBe(false);
    expect(result.decidedBy).toBe("local-mirror");
    expect(result.live).toBe(true);
    expect(recorded).toHaveLength(0);
  });
});

describe("no non-idempotent POST is repeated blind", () => {
  it("retries a timed out rpc once, under the same idempotency key, then cleans up", async () => {
    installFetch((request) =>
      request.path.endsWith("/rpc") ? "timeout" : json(599, {}),
    );
    const { privy, errors } = await loadLive();

    const thrown = await privy
      .submitTransaction(submitOptions(privy))
      .catch((error: unknown) => error);

    expect(errors.isDetentError(thrown)).toBe(true);
    const error = thrown as InstanceType<typeof errors.DetentError>;
    expect(error.code).toBe("upstream_timeout");
    expect(error.lockSpent).toBe(true);
    expect(error.hint).toContain("unknown");
    expect(error.hint).toContain("HashScan");

    const rpcs = recorded.filter((entry) => entry.path.endsWith("/rpc"));
    expect(rpcs).toHaveLength(2);
    expect(rpcs[0].headers["privy-idempotency-key"]).toBeTruthy();
    expect(rpcs[1].headers["privy-idempotency-key"]).toBe(
      rpcs[0].headers["privy-idempotency-key"],
    );
    expect(sequence().slice(2)).toEqual([
      `PATCH /v1/wallets/${WALLET}`,
      `DELETE /v1/policies/${POLICY_ID}`,
    ]);
    expect(recorded[2].body).toEqual({
      policy_ids: ["pol_house_0000000000000001"],
    });
  });

  it("retries a policy create 500 only under its idempotency key and attaches nothing", async () => {
    installFetch((request) =>
      request.path === "/v1/policies" ? json(500, {}) : json(599, {}),
    );
    const { privy } = await loadLive();

    await expect(privy.installPolicy(plan, signers)).rejects.toMatchObject({
      code: "upstream_error",
      providerStatus: 500,
    });
    const creates = recorded.filter((entry) => entry.path === "/v1/policies");
    expect(creates).toHaveLength(2);
    expect(creates[1].headers["privy-idempotency-key"]).toBe(
      creates[0].headers["privy-idempotency-key"],
    );
    expect(sequence()).not.toContain(`PATCH /v1/wallets/${WALLET}`);
  });

  it("never repeats a POST that has no idempotency key", async () => {
    // Every POST this module sends carries a key; a key-less POST is not
    // reachable from the exported API, so the guard is asserted structurally:
    // across a full lock and send, no POST is ever seen twice with the same
    // body unless it also carries the same key.
    installFetch((request) =>
      request.method === "POST" && request.path === "/v1/policies"
        ? "timeout"
        : json(599, {}),
    );
    const { privy } = await loadLive();
    await expect(privy.installPolicy(plan, signers)).rejects.toMatchObject({
      code: "upstream_timeout",
    });
    const creates = recorded.filter((entry) => entry.method === "POST");
    for (const entry of creates) {
      expect(entry.headers["privy-idempotency-key"]).toBeTruthy();
    }
  });
});

describe("every failure path detaches and revokes", () => {
  it("cleans up when the attach is refused", async () => {
    installFetch((request) =>
      request.method === "PATCH"
        ? json(401, { error: "missing authorization signature" })
        : json(599, {}),
    );
    const { privy } = await loadLive();

    const thrown = await privy
      .installPolicy(plan, signers)
      .catch((error: unknown) => error);

    expect(thrown).toMatchObject({
      code: "upstream_error",
      providerStatus: 401,
    });
    expect((thrown as Error & { hint: string }).hint).toContain(
      "PRIVY_AUTHORIZATION_KEYS",
    );
    expect(sequence()).toEqual([
      `GET /v1/wallets/${WALLET}`,
      "POST /v1/policies",
      `PATCH /v1/wallets/${WALLET}`,
      `PATCH /v1/wallets/${WALLET}`,
      `DELETE /v1/policies/${POLICY_ID}`,
    ]);
    expect(recorded[3].body).toEqual({ policy_ids: [] });
  });

  it("cleans up when the rpc answers a non policy error", async () => {
    installFetch((request) =>
      request.path.endsWith("/rpc")
        ? json(400, { error: "chain not supported" })
        : json(599, {}),
    );
    const { privy } = await loadLive();

    await expect(
      privy.submitTransaction(submitOptions(privy)),
    ).rejects.toMatchObject({ lockSpent: true, providerStatus: 400 });
    expect(sequence()).toEqual([
      `POST /v1/wallets/${WALLET}/rpc`,
      `PATCH /v1/wallets/${WALLET}`,
      `DELETE /v1/policies/${POLICY_ID}`,
    ]);
  });

  it("cleans up when the rpc answers without a transaction hash", async () => {
    installFetch((request) =>
      request.path.endsWith("/rpc") ? json(200, { data: {} }) : json(599, {}),
    );
    const { privy } = await loadLive();

    await expect(
      privy.submitTransaction(submitOptions(privy)),
    ).rejects.toMatchObject({ code: "parse_failure", lockSpent: true });
    expect(sequence().slice(1)).toEqual([
      `PATCH /v1/wallets/${WALLET}`,
      `DELETE /v1/policies/${POLICY_ID}`,
    ]);
  });

  it("leaves the policy attached on a wallet policy violation, which keeps the lock", async () => {
    installFetch((request) =>
      request.path.endsWith("/rpc")
        ? json(400, { error: "policy_violation" })
        : json(599, {}),
    );
    const { privy } = await loadLive();

    const result = await privy.submitTransaction(submitOptions(privy));
    expect(result.verdict.allowed).toBe(false);
    expect(result.decidedBy).toBe("privy-wallet");
    expect(sequence()).toEqual([`POST /v1/wallets/${WALLET}/rpc`]);
  });
});

describe("the expiry cleanup", () => {
  it("evicts expired entries through the callback, and only those", async () => {
    const { createBoundedStore } = await import("@/lib/store");
    let clock = 0;
    const evicted: string[] = [];
    const store = createBoundedStore<string>({
      ttlMs: 100,
      maxEntries: 2,
      now: () => clock,
      onEvict: (key, _value, reason) => evicted.push(`${key}:${reason}`),
    });
    store.set("a", "1");
    store.set("b", "2");
    store.delete("b");
    clock = 150;
    store.sweep();
    expect(evicted).toEqual(["a:expired"]);
    store.set("c", "3");
    store.set("d", "4");
    store.set("e", "5");
    expect(evicted).toEqual(["a:expired", "c:capacity"]);
  });

  it("detaches and revokes the policy of a lock that expires unspent", async () => {
    vi.useFakeTimers();
    installFetch();
    await loadLive({ DETENT_LOCK_TTL_MS: "5000" });
    const { lockVault } = await import("@/lib/store");
    await import("@/app/api/detent/route");
    const { compilePolicy } = await import("@/lib/privy");

    lockVault.open({
      policyId: POLICY_ID,
      policy: compilePolicy(plan),
      plan,
      selection: { kind: "coupon", deferred: [], forced: [] },
      approvedCalldata: plan.calldata,
      approvedBy: signers,
      walletId: WALLET,
      previousPolicyIds: ["pol_house_0000000000000001"],
      policyAttached: true,
      live: true,
    });

    await vi.advanceTimersByTimeAsync(5_001);

    expect(sequence()).toEqual([
      `PATCH /v1/wallets/${WALLET}`,
      `DELETE /v1/policies/${POLICY_ID}`,
    ]);
    expect(recorded[0].body).toEqual({
      policy_ids: ["pol_house_0000000000000001"],
    });
    expect(lockVault.size).toBe(0);
  });
});

describe("the authorization signature", () => {
  it("canonicalizes the documented payload per RFC 8785", async () => {
    const { privy } = await loadLive();
    // The payload from the Privy utility functions page, with its placeholders.
    const payload = privy.signaturePayload({
      method: "POST",
      url: "https://api.privy.io/v1/wallets/<insert-wallet-id>/rpc",
      headers: { "privy-app-id": "<insert-app-id>" },
      body: {
        method: "personal_sign",
        params: { message: "Hello from Privy!", encoding: "utf-8" },
      },
    });
    expect(payload.toString()).toBe(
      '{"body":{"method":"personal_sign","params":{"encoding":"utf-8","message":"Hello from Privy!"}},"headers":{"privy-app-id":"<insert-app-id>"},"method":"POST","url":"https://api.privy.io/v1/wallets/<insert-wallet-id>/rpc","version":1}',
    );
    expect(privy.canonicalJson({ b: [1, { d: 2, c: null }], a: 1.5 })).toBe(
      '{"a":1.5,"b":[1,{"c":null,"d":2}]}',
    );
  });

  it("signs with ECDSA P-256 over SHA-256 and verifies under the public key, one signature per key", async () => {
    const first = newKey();
    const second = newKey();
    const { privy } = await loadLive();
    const input = {
      method: "PATCH" as const,
      url: `https://api.privy.test/v1/wallets/${WALLET}`,
      body: { policy_ids: [POLICY_ID] },
      headers: { "privy-app-id": APP_ID },
    };

    const header = privy.authorizationSignature(input, [
      first.privateKey,
      second.privateKey,
    ]);
    const parts = (header ?? "").split(",");
    expect(parts).toHaveLength(2);

    const payload = privy.signaturePayload(input);
    [first, second].forEach((key, index) => {
      const publicKey = createPublicKey({
        key: key.publicKeyDer,
        format: "der",
        type: "spki",
      });
      expect(
        verifySignature(
          "sha256",
          payload,
          publicKey,
          Buffer.from(parts[index], "base64"),
        ),
      ).toBe(true);
    });
    expect(privy.authorizationSignature(input, [])).toBeUndefined();
  });

  it("signs the wallet update, the rpc and the delete, and never the read or the create", async () => {
    const key = newKey();
    installFetch();
    const { privy } = await loadLive({
      PRIVY_AUTHORIZATION_KEYS: key.privateKey,
    });

    const installed = await privy.installPolicy(plan, signers);
    await privy.submitTransaction({
      ...submitOptions(privy),
      previousPolicyIds: installed.previousPolicyIds,
    });

    const signed = recorded
      .filter((entry) => entry.headers["privy-authorization-signature"])
      .map((entry) => `${entry.method} ${entry.path}`);
    expect(signed).toEqual([
      `PATCH /v1/wallets/${WALLET}`,
      `POST /v1/wallets/${WALLET}/rpc`,
      `PATCH /v1/wallets/${WALLET}`,
      `DELETE /v1/policies/${POLICY_ID}`,
    ]);

    const rpc = recorded[3];
    const publicKey = createPublicKey({
      key: key.publicKeyDer,
      format: "der",
      type: "spki",
    });
    const payload = privy.signaturePayload({
      method: "POST",
      url: `https://api.privy.test${rpc.path}`,
      body: rpc.body,
      headers: {
        "privy-app-id": APP_ID,
        "privy-idempotency-key": rpc.headers["privy-idempotency-key"],
      },
    });
    expect(
      verifySignature(
        "sha256",
        payload,
        publicKey,
        Buffer.from(rpc.headers["privy-authorization-signature"], "base64"),
      ),
    ).toBe(true);
  });

  it("refuses a key that does not parse without echoing it", async () => {
    const { privy } = await loadLive();
    const thrown = (() => {
      try {
        privy.authorizationSignature(
          {
            method: "DELETE",
            url: "https://api.privy.test/v1/policies/x",
            headers: { "privy-app-id": APP_ID },
          },
          ["wallet-auth:not-a-real-key-SENTINEL"],
        );
      } catch (error) {
        return error as Error & { hint: string };
      }
    })();
    expect(thrown?.message).not.toContain("SENTINEL");
    expect(thrown?.hint).not.toContain("SENTINEL");
  });
});

describe("the route on the live path", () => {
  it("logs one line per failed lock with the code and the provider status, and never the secret", async () => {
    installFetch(() => json(401, { error: "invalid app secret" }));
    await loadLive();
    const { POST } = await import("@/app/api/detent/route");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await POST(
      new Request("https://detent.test/api/detent", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "192.0.2.50",
        },
        body: JSON.stringify({
          intent: "lock",
          plan,
          approvals: ["ops-controller", "risk-officer"],
        }),
      }),
    );
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(text).not.toContain(APP_SECRET);
    const lines = warn.mock.calls.map((call) => call.join(" "));
    expect(lines).toContain(
      "[core] lock failed: upstream_error, http 502, provider 401",
    );
    for (const method of ["info", "warn", "error"] as const) {
      const calls = (
        console[method] as unknown as { mock: { calls: unknown[][] } }
      ).mock.calls;
      expect(JSON.stringify(calls)).not.toContain(APP_SECRET);
    }
  });

  it("releases the lock when a failed send already cleaned up", async () => {
    installFetch((request) =>
      request.path.endsWith("/rpc") ? "timeout" : json(599, {}),
    );
    await loadLive();
    const { POST } = await import("@/app/api/detent/route");
    const call = (body: unknown) =>
      POST(
        new Request("https://detent.test/api/detent", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "192.0.2.51",
          },
          body: JSON.stringify(body),
        }),
      );

    const locked = (await (
      await call({
        intent: "lock",
        plan,
        approvals: ["ops-controller", "risk-officer"],
      })
    ).json()) as { ok: boolean; data: { lockId: string } };
    expect(locked.ok).toBe(true);

    const failed = await call({
      intent: "submit",
      lockId: locked.data.lockId,
      submittedRows: approvedRows,
    });
    expect(failed.status).toBe(504);

    const again = await call({
      intent: "submit",
      lockId: locked.data.lockId,
      submittedRows: approvedRows,
    });
    expect(again.status).toBe(409);
    expect(((await again.json()) as { error: string }).error).toBe(
      "lock_unknown",
    );
  });

  it("counts malformed bodies against a coarse per address budget", async () => {
    installFetch();
    await loadLive();
    const { POST } = await import("@/app/api/detent/route");
    const { EDGE_RATE_LIMIT_MAX_REQUESTS } = await import("@/lib/config");
    const garbage = () =>
      POST(
        new Request("https://detent.test/api/detent", {
          method: "POST",
          headers: { "x-forwarded-for": "192.0.2.52" },
          body: "{not json",
        }),
      );

    for (let index = 0; index < EDGE_RATE_LIMIT_MAX_REQUESTS; index += 1) {
      expect((await garbage()).status).toBe(400);
    }
    const limited = await garbage();
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
  });
});
