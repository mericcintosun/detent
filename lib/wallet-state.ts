// The treasury key state machine.
//
// Detent's treasury key is a Privy server wallet, not a browser extension, so
// there is no connect button anywhere in the product and the operator never
// approves anything in a popup. The eight states below are still the ones a
// wallet surface owes its user, mapped onto what a server wallet can actually
// be doing:
//
//   disconnected   no live Privy credentials, so the policy is compiled locally
//                  and the receipt is a stub. The demo runs here with an empty
//                  .env.local.
//   connecting     a policy install is in flight against Privy.
//   wrong-network  the wallet would not take chain 296: the typed error names
//                  the chain. The banner offers the sign and relay route out.
//   idle           live, nothing in flight.
//   tx-pending     a send is in flight.
//   tx-confirmed   the policy allowed the payload and a receipt came back,
//                  on chain or synthetic. The banner says which.
//   tx-rejected    the policy refused the payload. This is the key doing its
//                  job, which is the wow moment, not an error.
//   tx-failed      infrastructure: a timeout, a provider error, or a response
//                  this build could not parse.
//
// Pure and types only at the edges, so the console and the test suite derive the
// same state from the same inputs.

import type { DetentErrorCode } from "@/lib/errors";
import type { ReceiptKind } from "@/lib/hashscan";

export type TreasuryKeyState =
  | "disconnected"
  | "connecting"
  | "wrong-network"
  | "idle"
  | "tx-pending"
  | "tx-confirmed"
  | "tx-rejected"
  | "tx-failed";

/**
 * The slice of a send result the state machine reads.
 *
 * There is no chain-refusal flag any more. It used to be inferred from a policy
 * recompiled out of the request body, and the server no longer recompiles
 * anything: every verdict is judged against the policy held under the lock, so
 * that branch could never be taken. A chain the wallet will not broadcast to now
 * arrives as a typed failure that names the chain.
 */
export interface TreasuryKeySettlement {
  allowed: boolean;
  /** From readReceipt in lib/hashscan.ts. A synthetic receipt carries no hash. */
  receiptKind: ReceiptKind;
}

export interface TreasuryKeyInput {
  /** True when the last policy install came back from a real Privy app. */
  privyLive: boolean;
  /** What the console is waiting on. */
  pending: "lock" | "send" | null;
  /** True while a compiled policy is held against the key. */
  locked: boolean;
  /** The last send, or null before the first one. */
  settlement: TreasuryKeySettlement | null;
  /** The last typed failure, or null. */
  failure: { code: DetentErrorCode; hint: string } | null;
}

/** Infrastructure codes. Everything else is the operator's own input. */
const INFRASTRUCTURE_CODES: DetentErrorCode[] = [
  "upstream_error",
  "upstream_timeout",
  "parse_failure",
];

/** A not_configured failure that names the chain is a network problem. */
function namesTheChain(failure: {
  code: DetentErrorCode;
  hint: string;
}): boolean {
  return (
    failure.code === "not_configured" && /chain|eip155|296/i.test(failure.hint)
  );
}

/**
 * One state from one snapshot of the console. In flight beats everything, then
 * the last answer, then the resting state. `idle` covers live with nothing in
 * flight, whether or not a policy is currently held: holding a policy is not a
 * wallet state, it is a plan state.
 */
export function deriveTreasuryKeyState(
  input: TreasuryKeyInput,
): TreasuryKeyState {
  if (input.pending === "lock") return "connecting";
  if (input.pending === "send") return "tx-pending";

  if (input.failure) {
    if (namesTheChain(input.failure)) return "wrong-network";
    if (INFRASTRUCTURE_CODES.includes(input.failure.code)) return "tx-failed";
  }

  const settlement = input.settlement;
  if (settlement) {
    if (!settlement.allowed) return "tx-rejected";
    if (settlement.receiptKind !== "none") return "tx-confirmed";
    // Allowed and no receipt of either kind. That is infrastructure.
    return "tx-failed";
  }

  if (!input.privyLive) return "disconnected";
  return "idle";
}

/* --- Failures, in the operator's words ------------------------------------ */

/** What the console offers under a failure. */
export type FailureAction = "relock" | "retry" | "wait" | "reload" | "none";

export interface FailureView {
  /** A short label naming what went wrong. */
  title: string;
  /** The sentence to print. The server's own hint when it sent one. */
  sentence: string;
  /** The way out. */
  action: FailureAction;
}

const FALLBACK_SENTENCES: Partial<Record<DetentErrorCode, string>> = {
  lock_unknown:
    "The server no longer holds this lock, so there is no policy to send under. Lock the plan again, then send it.",
  plan_mismatch:
    "The plan on this page is not the plan the server derives from the register. Reload the page, read the plan again and approve it again.",
  plan_blocked:
    "The plan still carries blockers, so nothing can be locked or sent. Clear the rows listed below and try again.",
  quorum_not_met:
    "Two distinct registered officers must approve before the policy is installed.",
  rate_limited: "Too many requests from this address in a short window.",
};

/**
 * One view per failure code, so the lock step and the send step print the same
 * words for the same answer. The server hint is kept verbatim when present,
 * because it carries detail the console cannot know (which officer is missing,
 * how long the window is). A Retry-After header the hint does not already
 * mention is appended, so a 429 always says how long to wait.
 */
export function describeFailure(
  code: DetentErrorCode,
  hint: string | undefined,
  retryAfterSeconds?: number,
): FailureView {
  const base = hint && hint.trim().length > 0 ? hint : FALLBACK_SENTENCES[code];
  let sentence = base ?? "The call did not go through. Nothing was signed.";

  switch (code) {
    case "lock_unknown":
      return {
        title: "Lock expired, lock the plan again",
        sentence,
        action: "relock",
      };
    case "plan_mismatch":
      return {
        title: "The register moved under this plan",
        sentence,
        action: "reload",
      };
    case "plan_blocked":
      return { title: "The plan is blocked", sentence, action: "none" };
    case "quorum_not_met":
      return {
        title: "Approvals do not meet the quorum",
        sentence,
        action: "none",
      };
    case "rate_limited": {
      if (
        retryAfterSeconds !== undefined &&
        Number.isFinite(retryAfterSeconds) &&
        !/\d+\s*seconds?/i.test(sentence)
      ) {
        sentence = `${sentence} Try again in ${retryAfterSeconds} seconds.`;
      }
      return { title: "Slow down", sentence, action: "wait" };
    }
    case "invalid_input":
      return { title: "The request was rejected", sentence, action: "none" };
    default:
      return {
        title: "The call did not go through",
        sentence,
        action: "retry",
      };
  }
}

/**
 * The control printed under a failure, as plain data. The console maps `run` to
 * its own handler at click time, so nothing here closes over component state
 * and the render path never builds a callback that reaches a ref.
 */
export type FailureRun = "relock" | "reload" | "retry-lock" | "retry-send";

export interface FailureControl {
  label: string;
  run: FailureRun;
}

export function failureControlFor(
  action: FailureAction,
  stage: "lock" | "send",
): FailureControl | null {
  switch (action) {
    case "relock":
      return { label: "Lock the plan again", run: "relock" };
    case "reload":
      return { label: "Reload the page", run: "reload" };
    case "retry":
    case "wait":
      return stage === "lock"
        ? { label: "Try the lock again", run: "retry-lock" }
        : { label: "Try the send again", run: "retry-send" };
    case "none":
      return null;
  }
}

/* --- What an allowed send did to the policy ------------------------------- */

export interface PolicyReleaseInput {
  /** True when the lock installed the policy on a real Privy wallet. */
  installedOnWallet: boolean;
  /** From the submit result: the policy id was unbound from the wallet. */
  policyDetached: boolean;
  /** From the submit result: the revoke call succeeded. */
  policyRevoked: boolean;
  policyId: string;
  lockId: string;
}

/**
 * The audit sentence for what happened to the policy and the lock after an
 * allowed send, built from the server's own flags. Nothing is claimed that the
 * response did not report: a keyless run installed nothing on a wallet, so it
 * says there was nothing to detach or revoke, and a live run names each step
 * that did not go through.
 */
export function describePolicyRelease(input: PolicyReleaseInput): string {
  const { installedOnWallet, policyDetached, policyRevoked, policyId, lockId } =
    input;
  if (!installedOnWallet && !policyDetached && !policyRevoked) {
    return `Policy ${policyId} was compiled locally and never installed on a wallet, so there was nothing to detach or revoke. Local lock ${lockId} is closed.`;
  }
  if (policyDetached && policyRevoked) {
    return `Policy ${policyId} detached from the treasury wallet and revoked, lock ${lockId} spent.`;
  }
  const done = [
    policyDetached ? "detached from the treasury wallet" : null,
    policyRevoked ? "revoked" : null,
  ].filter((step): step is string => step !== null);
  const missing = [
    policyDetached ? null : "detached from the wallet",
    policyRevoked ? null : "revoked",
  ].filter((step): step is string => step !== null);
  return `Policy ${policyId} ${done.length > 0 ? `${done.join(" and ")}, but not ` : "was not "}${missing.join(" or ")}; finish it in the Privy dashboard. Lock ${lockId} spent.`;
}
