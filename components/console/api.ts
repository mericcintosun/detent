// The wire helpers the console uses around POST /api/detent and POST /api/fee.
// Pure functions, no React: the controller hook calls them and nothing renders
// them directly.

import type { DetentErrorCode } from "@/lib/errors";
import { anchorExplorerHref } from "@/lib/hashscan";
import type { AnchorReceipt, ApiResponse } from "@/lib/types";

/** What the console keeps from a failed call. */
export interface ConsoleFailure {
  code: DetentErrorCode;
  hint: string;
  blockers?: string[];
  /**
   * Which step the failure belongs to, so it is printed next to the control
   * that can act on it: a lock refusal under the lock button, a send refusal in
   * the send card. lock_unknown from a send is filed under the lock, because
   * locking again is the only way out of it.
   */
  stage: "lock" | "send";
  /** From a 429's Retry-After header, in seconds. */
  retryAfterSeconds?: number;
}

export interface AuditEntry {
  id: string;
  at: string;
  event: string;
  detail: string;
  tone: "ok" | "bad" | "neutral";
  /** The payout transaction on HashScan. */
  href?: string;
  /** The PlanAnchor transaction on HashScan, when one was sent. */
  anchorHref?: string;
  /** What the anchor said when it did not send anything. */
  anchorNote?: string;
}

/** Retry-After as seconds, or undefined when absent or not a number. */
export function retryAfterOf(response: Response): number | undefined {
  const raw = response.headers.get("Retry-After");
  if (raw === null) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0
    ? Math.ceil(seconds)
    : undefined;
}

/**
 * The anchor's two halves, split for the audit entry that carries them.
 *
 * anchorExplorerHref decides whether there is a link: lib/anchor.ts only fills
 * transactionHash after a real writeContract, and a run that found the hash
 * already anchored reports anchored without a hash of its own. Anything that
 * does not clear that bar prints the anchor's sentence instead.
 */
export function anchorParts(anchor: AnchorReceipt | undefined): {
  anchorHref?: string;
  anchorNote?: string;
} {
  if (!anchor) return {};
  const href = anchorExplorerHref(anchor);
  if (href !== null) return { anchorHref: href };
  return { anchorNote: anchor.note };
}

/** The UTC wall clock time of an audit entry, HH:MM:SS. */
export function stamp(now: Date = new Date()): string {
  return now.toISOString().slice(11, 19);
}

/**
 * Read one /api/detent answer without asserting its shape.
 *
 * A 500 from a proxy, an HTML error page or a route mid-refactor would all
 * satisfy a plain cast and then blow up on the first property read. This
 * narrows the envelope for real and turns anything else into the typed parse
 * failure the console already knows how to render. `data` stays a single,
 * documented boundary cast: the route owns that half of the contract.
 */
export async function readApiResponse<T>(
  response: Response,
): Promise<ApiResponse<T>> {
  const unreadable: ApiResponse<T> = {
    ok: false,
    error: "parse_failure",
    hint: "The endpoint answered with something this build could not read. Nothing was signed.",
  };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return unreadable;
  }

  if (typeof body !== "object" || body === null) return unreadable;
  const envelope = body as Record<string, unknown>;

  if (envelope.ok === true) {
    return { ok: true, data: envelope.data as T };
  }

  if (envelope.ok === false && typeof envelope.error === "string") {
    const blockers = Array.isArray(envelope.blockers)
      ? envelope.blockers.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : undefined;
    return {
      ok: false,
      error: envelope.error as DetentErrorCode,
      hint:
        typeof envelope.hint === "string"
          ? envelope.hint
          : "The endpoint refused the call without saying why.",
      ...(blockers && blockers.length > 0 ? { blockers } : {}),
    };
  }

  return unreadable;
}
