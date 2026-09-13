import type { RunMode } from "@/components/design/status-pill";

/**
 * The two facts the shell states on every page. Both are read on the server by
 * app/layout.tsx and cross to the client as booleans, never as modules:
 * lib/privy.ts reads PRIVY_APP_SECRET.
 */
export interface RunModeFlags {
  /** ADAPTER_MODE is real and a token address is configured. */
  registerLive: boolean;
  /** isPrivyLive(): both Privy credentials, whatever the register mode. */
  signerLive: boolean;
}

export interface RunModeCopy {
  /** The tone of the pill. Anything short of fully live reads as the mirror. */
  mode: RunMode;
  /** The pill's word. */
  label: string;
  register: string;
  signer: string;
  /** The one status line naming both halves. */
  line: string;
}

export function describeRunMode({
  registerLive,
  signerLive,
}: RunModeFlags): RunModeCopy {
  const register = registerLive ? "Live register" : "Local mirror register";
  const signer = signerLive ? "Live Privy signer" : "Local mirror signer";
  const mode: RunMode = registerLive && signerLive ? "live" : "mirror";
  const label =
    registerLive && signerLive
      ? "Live"
      : registerLive || signerLive
        ? "Partly live"
        : "Local mirror";
  const line = `${register}, ${signer.charAt(0).toLowerCase()}${signer.slice(1)}`;
  return { mode, label, register, signer, line };
}
