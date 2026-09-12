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
//   wrong-network  the wallet would not take chain 296: either the typed error
//                  names the chain, or the send came back on the chain-refusal
//                  path. The banner offers the sign and relay route out.
//   idle           live, nothing in flight.
//   tx-pending     a send is in flight.
//   tx-confirmed   the policy allowed the payload and a transaction hash came
//                  back.
//   tx-rejected    the policy refused the payload. This is the key doing its
//                  job, which is the wow moment, not an error.
//   tx-failed      infrastructure: a timeout, a provider error, or a response
//                  this build could not parse.
//
// Pure and types only at the edges, so the console and the test suite derive the
// same state from the same inputs.

import type { DetentErrorCode } from "@/lib/errors";

export type TreasuryKeyState =
  | "disconnected"
  | "connecting"
  | "wrong-network"
  | "idle"
  | "tx-pending"
  | "tx-confirmed"
  | "tx-rejected"
  | "tx-failed";

export interface TreasuryKeySettlement {
  allowed: boolean;
  transactionHash?: string;
  policySource: "held-from-lock" | "recompiled-from-approved-plan";
  /**
   * Privy was live, the policy had to be recompiled rather than recalled, the
   * payload was allowed and nothing landed. That is what a refused chain looks
   * like from the browser.
   */
  chainRefused: boolean;
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
function namesTheChain(failure: { code: DetentErrorCode; hint: string }): boolean {
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
  input: TreasuryKeyInput
): TreasuryKeyState {
  if (input.pending === "lock") return "connecting";
  if (input.pending === "send") return "tx-pending";

  if (input.failure) {
    if (namesTheChain(input.failure)) return "wrong-network";
    if (INFRASTRUCTURE_CODES.includes(input.failure.code)) return "tx-failed";
  }

  const settlement = input.settlement;
  if (settlement) {
    if (settlement.chainRefused) return "wrong-network";
    if (!settlement.allowed) return "tx-rejected";
    if (settlement.transactionHash) return "tx-confirmed";
    // Allowed, live, and nothing came back to link. That is infrastructure.
    return "tx-failed";
  }

  if (!input.privyLive) return "disconnected";
  return "idle";
}
