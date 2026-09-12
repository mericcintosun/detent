// Typed failures for the core path.
//
// Every failure that crosses the API boundary carries one of these codes plus a
// hint written for the operator, never a provider body and never a stack trace.
// The console switches on the code and prints the hint, so the wording can move
// without breaking the component.

export type DetentErrorCode =
  | "invalid_input"
  | "plan_blocked"
  | "quorum_not_met"
  | "not_configured"
  | "upstream_timeout"
  | "upstream_error"
  | "parse_failure"
  | "policy_denied";

const HINTS: Record<DetentErrorCode, string> = {
  invalid_input:
    "The request did not match the shape the console sends. Reload the page and rebuild the plan.",
  plan_blocked:
    "The plan still carries blockers, so nothing can be locked. Clear the rows listed below and try again.",
  quorum_not_met:
    "Two distinct signers must approve before the policy is installed on the treasury wallet.",
  not_configured:
    "A required environment value is missing on the server, so the live path cannot run.",
  upstream_timeout:
    "The provider did not answer in time. Testnet infrastructure answers slowly under load, so try once more.",
  upstream_error:
    "The provider answered with an error. The plan is untouched, nothing was signed.",
  parse_failure:
    "The provider answered in a shape this build does not understand, so the result was not trusted.",
  policy_denied:
    "The wallet policy refused this payload. Send the plan exactly as it was approved.",
};

export function hintFor(code: DetentErrorCode): string {
  return HINTS[code];
}

/** An error that is safe to show: it carries a code and one human sentence. */
export class DetentError extends Error {
  readonly code: DetentErrorCode;
  readonly hint: string;

  constructor(code: DetentErrorCode, message?: string, hint?: string) {
    super(message ?? code);
    this.name = "DetentError";
    this.code = code;
    this.hint = hint ?? hintFor(code);
  }
}

export function isDetentError(value: unknown): value is DetentError {
  return value instanceof DetentError;
}
