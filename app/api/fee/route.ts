import { NextResponse } from "next/server";
import {
  ADAPTER_MODE,
  EDGE_RATE_LIMIT_MAX_REQUESTS,
  HEDERA_RPC_URL,
  PRIVY_TREASURY_WALLET_ADDRESS,
  RATE_LIMIT_MAX_REQUESTS,
  RPC_TIMEOUT_MS,
} from "@/lib/config";
import { treasury } from "@/lib/data";
import { quoteFee, type FeeQuote } from "@/lib/fees";
import { buildPlan } from "@/lib/plan";
import { getRegisterSnapshot } from "@/lib/register";
import { selectionSchema } from "@/lib/schemas";
import { rateLimiter } from "@/lib/store";

export const runtime = "nodejs";

// The network fee estimate for the plan the console is about to send.
//
// The browser sends only the operator's row selection, the same part of a plan
// POST /api/detent takes from the request. The calldata and the destination are
// rebuilt here from the register snapshot, so this route can only ever estimate
// a Detent plan and never becomes a relay proxy for an arbitrary call. The
// keyless mirror answers without touching the network. Rate limited per client
// address like the main route, from the same limiter.

function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || "unknown-client";
}

function refuse(
  error: "invalid_input" | "rate_limited",
  status: number,
  hint: string,
  headers?: HeadersInit,
) {
  return NextResponse.json(
    { ok: false, error, hint },
    { status, ...(headers ? { headers } : {}) },
  );
}

export async function POST(request: Request) {
  const address = clientAddress(request);
  const edge = rateLimiter.consume(
    `edge:${address}`,
    EDGE_RATE_LIMIT_MAX_REQUESTS,
  );
  const verdict = edge.allowed
    ? rateLimiter.consume(`fee:${address}`, RATE_LIMIT_MAX_REQUESTS)
    : edge;
  if (!verdict.allowed) {
    return refuse(
      "rate_limited",
      429,
      `This address has asked for too many fee estimates in the current window. Wait ${verdict.retryAfterSeconds} seconds and try again.`,
      { "Retry-After": String(verdict.retryAfterSeconds) },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return refuse("invalid_input", 400, "The request body was not valid JSON.");
  }

  const parsed = selectionSchema.safeParse(
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>).selection
      : undefined,
  );
  if (!parsed.success) {
    return refuse(
      "invalid_input",
      400,
      "The fee request needs the plan selection the console sends. Reload the page and lock the plan again.",
    );
  }

  let quote: FeeQuote;
  if (ADAPTER_MODE !== "real") {
    quote = await quoteFee({
      mode: ADAPTER_MODE,
      rpcUrl: HEDERA_RPC_URL,
      from: treasury.address,
      to: treasury.address,
      data: "0x",
    });
  } else {
    const snapshot = await getRegisterSnapshot();
    const plan = buildPlan({
      kind: parsed.data.kind,
      deferred: parsed.data.deferred,
      forced: parsed.data.forced,
      holders: snapshot.holders,
      treasuryMicros: snapshot.treasury.balanceMicros,
    });
    quote = await quoteFee({
      mode: ADAPTER_MODE,
      rpcUrl: HEDERA_RPC_URL,
      from: PRIVY_TREASURY_WALLET_ADDRESS ?? treasury.address,
      to: plan.target,
      data: plan.calldata,
      timeoutMs: RPC_TIMEOUT_MS,
    });
  }

  return NextResponse.json({ ok: true, data: quote });
}
