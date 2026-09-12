import { type APIRequestContext, type APIResponse } from "@playwright/test";
import { holders, treasury } from "@/lib/data";
import { buildPlan } from "@/lib/plan";
import { expect, test, uniqueClientAddress } from "./fixtures";

// The fail closed contract of POST /api/detent, exercised over HTTP against the
// production server. The plan is built with the same builder the console uses
// over the seed register, which is the plan a seed mode server derives.

const ENDPOINT = "/api/detent";
const OFFICERS = ["ops-controller", "risk-officer"];

const plan = buildPlan({
  kind: "coupon",
  holders,
  treasuryMicros: treasury.balanceMicros,
});

const approvedRows = plan.rows
  .filter((row) => row.included)
  .map((row) => ({ address: row.address, amountMicros: row.amountMicros }));

/** The approved rows with the first amount moved by `delta` micro units. */
function editedRows(delta: bigint) {
  return approvedRows.map((row, index) =>
    index === 0
      ? { ...row, amountMicros: (BigInt(row.amountMicros) + delta).toString() }
      : row,
  );
}

function lockBody(approvals: string[] = OFFICERS) {
  return {
    intent: "lock",
    plan,
    selection: { kind: "coupon", deferred: [], forced: [] },
    approvals,
  };
}

function post(
  request: APIRequestContext,
  data: unknown,
  headers?: Record<string, string>,
) {
  return request.post(ENDPOINT, { data, headers });
}

async function lock(request: APIRequestContext): Promise<string> {
  const response = await post(request, lockBody());
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.ok).toBe(true);
  return body.data.lockId as string;
}

async function submit(
  request: APIRequestContext,
  lockId: string,
  submittedRows: { address: string; amountMicros: string }[],
): Promise<APIResponse> {
  return post(request, { intent: "submit", lockId, submittedRows });
}

/** Real stack frames or source paths, not prose that happens to contain "at". */
const STACK_TRACE =
  /\n\s+at\s|\bat\s+\S+\s+\(|\.(ts|tsx|js):\d+:\d+|node_modules/;

test.describe("POST /api/detent contract", () => {
  test.beforeEach(async ({ request }) => {
    const html = await (await request.get("/")).text();
    test.skip(
      !html.includes("Cached register"),
      "the contract tests build their plan from the seed register",
    );
  });

  test("lock returns a server generated lock id", async ({ request }) => {
    const response = await post(request, lockBody());
    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(typeof body.data.lockId).toBe("string");
    expect(body.data.lockId.length).toBeGreaterThan(0);
    expect(body.data.lockId).not.toBe(body.data.policyId);
    expect(body.data.lockId).not.toBe(plan.planHash);
    expect(body.data.planHash).toBe(plan.planHash);
    expect(body.data.policy.default_action).toBe("DENY");
    expect(
      body.data.approvedBy.map((signer: { id: string }) => signer.id),
    ).toEqual(OFFICERS);

    const second = await lock(request);
    expect(second).not.toBe(body.data.lockId);
  });

  test("a tampered submit is refused with a byte offset and keeps the lock for the approved submit", async ({
    request,
  }) => {
    const lockId = await lock(request);

    const refused = await submit(request, lockId, editedRows(1n));
    expect(refused.status()).toBe(200);
    const refusal = (await refused.json()).data;
    expect(refusal.verdict.allowed).toBe(false);
    expect(refusal.tampered).toBe(true);
    expect(refusal.verdict.reason).toMatch(/diverges at byte \d+/);
    expect(refusal.decidedBy).toBe("local-mirror");
    expect(refusal.receipt).toBeUndefined();

    const accepted = await submit(request, lockId, approvedRows);
    expect(accepted.status()).toBe(200);
    const result = (await accepted.json()).data;
    expect(result.verdict.allowed).toBe(true);
    expect(result.tampered).toBe(false);
    // Keyless: no policy was installed on a wallet, so the server reports
    // nothing revoked. What ends the policy's authority is the spent lock,
    // which the lock_unknown test below proves.
    expect(result.decidedBy).toBe("local-mirror");
    expect(result.policyRevoked).toBe(false);
    expect(result.receipt.kind).toBe("synthetic");
    expect(result.receipt.transactionHash).toBeUndefined();
    expect(result.transactionHash).toBeUndefined();
  });

  test("a successful submit consumes the lock so a new payload gets 409 lock_unknown", async ({
    request,
  }) => {
    const lockId = await lock(request);
    const first = await submit(request, lockId, approvedRows);
    expect((await first.json()).data.verdict.allowed).toBe(true);

    // The same payload again is the documented idempotent replay: the first
    // answer comes back from the submission ledger, nothing is sent twice.
    const replay = await submit(request, lockId, approvedRows);
    expect(replay.status()).toBe(200);
    expect((await replay.json()).data).toEqual((await first.json()).data);

    // Anything not already answered under this lock finds no lock at all.
    const second = await submit(request, lockId, editedRows(2n));
    expect(second.status()).toBe(409);
    const body = await second.json();
    expect(body).toMatchObject({ ok: false, error: "lock_unknown" });
    expect(typeof body.hint).toBe("string");
  });

  test("a submit under a lock id the server never issued gets 409 lock_unknown", async ({
    request,
  }) => {
    const response = await submit(request, "lock-never-issued", approvedRows);
    expect(response.status()).toBe(409);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "lock_unknown",
    });
  });

  test("unregistered approvers are refused with 409 quorum_not_met", async ({
    request,
  }) => {
    const response = await post(
      request,
      lockBody(["someone-else", "another-stranger"]),
    );
    expect(response.status()).toBe(409);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "quorum_not_met",
    });

    const single = await post(request, lockBody(["ops-controller"]));
    expect(single.status()).toBe(409);
    expect((await single.json()).error).toBe("quorum_not_met");
  });

  test("a malformed body is refused with 400 invalid_input and no stack trace", async ({
    request,
  }) => {
    const notJson = await request.post(ENDPOINT, {
      data: "{not json",
      headers: { "content-type": "application/json" },
    });
    const wrongShape = await post(request, {
      intent: "submit",
      lockId: 42,
      submittedRows: "all of them",
    });
    const unknownIntent = await post(request, { intent: "drain" });

    for (const response of [notJson, wrongShape, unknownIntent]) {
      expect(response.status()).toBe(400);
      const text = await response.text();
      expect(text).not.toMatch(STACK_TRACE);
      const body = JSON.parse(text);
      expect(body).toMatchObject({ ok: false, error: "invalid_input" });
      expect(Object.keys(body).sort()).toEqual(["error", "hint", "ok"]);
    }
  });

  test("repeated locks from one address are limited with 429 and Retry-After", async ({
    request,
  }) => {
    const statuses: number[] = [];
    let limited: APIResponse | undefined;
    for (let attempt = 0; attempt < 12 && !limited; attempt += 1) {
      const response = await post(request, lockBody());
      statuses.push(response.status());
      if (response.status() === 429) limited = response;
    }

    expect(limited, `statuses were ${statuses.join(", ")}`).toBeDefined();
    expect(statuses.slice(0, -1).every((status) => status === 200)).toBe(true);
    const retryAfter = Number(limited!.headers()["retry-after"]);
    expect(retryAfter).toBeGreaterThan(0);
    expect(await limited!.json()).toMatchObject({
      ok: false,
      error: "rate_limited",
    });

    // The budget belongs to the address, not to the route.
    const elsewhere = await post(request, lockBody(), {
      "x-forwarded-for": uniqueClientAddress(),
    });
    expect(elsewhere.status()).toBe(200);
  });
});
