import type { ComplianceState } from "@/lib/data";
import type { ReceiptKind } from "@/lib/hashscan";
import type { AdapterMode } from "@/lib/public-config";
import { cn } from "@/lib/utils";

export type RunMode = "live" | "mirror";

export type StatusPillProps = (
  | { kind: "mode"; value: RunMode }
  | { kind: "hold"; value: ComplianceState }
  | { kind: "receipt"; value: ReceiptKind }
) & {
  /** Replaces the default label. Keep it short and specific. */
  children?: React.ReactNode;
  className?: string;
};

type Tone =
  "live" | "mirror" | "lapsed" | "refused" | "paused" | "clear" | "none";

const TONE_CLASS: Record<Tone, string> = {
  live: "border-mode-live/40 bg-mode-live-muted text-mode-live",
  mirror: "border-mode-mirror/40 bg-mode-mirror-muted text-mode-mirror",
  lapsed: "border-hold-lapsed/40 bg-hold-lapsed-muted text-hold-lapsed",
  refused: "border-hold-refused/40 bg-hold-refused-muted text-hold-refused",
  paused: "border-hold-paused/40 bg-hold-paused-muted text-hold-paused",
  clear: "border-success/40 bg-success-muted text-success",
  none: "border-border bg-muted text-muted-foreground",
};

const MODE: Record<RunMode, { tone: Tone; label: string }> = {
  live: { tone: "live", label: "Live" },
  mirror: { tone: "mirror", label: "Local mirror" },
};

const HOLD: Record<ComplianceState, { tone: Tone; label: string }> = {
  clear: { tone: "clear", label: "Clear" },
  "allowlist-expired": { tone: "lapsed", label: "Allowlist expired" },
  "kyc-lapsed": { tone: "lapsed", label: "KYC lapsed" },
  "sanctions-hold": { tone: "refused", label: "Sanctions hold" },
  "compliance-refused": { tone: "refused", label: "Compliance refused" },
  paused: { tone: "paused", label: "Token paused" },
  unrecognised: { tone: "refused", label: "Unrecognised refusal" },
};

const RECEIPT: Record<ReceiptKind, { tone: Tone; label: string }> = {
  "on-chain": { tone: "live", label: "On chain" },
  synthetic: { tone: "mirror", label: "Synthetic, nothing on chain" },
  none: { tone: "none", label: "No receipt" },
};

/** The run mode a deployment's adapter mode stands for. */
export function runModeFromAdapter(mode: AdapterMode): RunMode {
  return mode === "real" ? "live" : "mirror";
}

function resolve(props: StatusPillProps): { tone: Tone; label: string } {
  switch (props.kind) {
    case "mode":
      return MODE[props.value];
    case "hold":
      return HOLD[props.value];
    case "receipt":
      return RECEIPT[props.value];
  }
}

/**
 * A square stamp naming a run mode, a hold reason or a receipt kind. The colour
 * is never the only signal: the label always says the state in words.
 */
export function StatusPill(props: StatusPillProps) {
  const { tone, label } = resolve(props);
  return (
    <span
      data-slot="status-pill"
      data-kind={props.kind}
      data-value={props.value}
      className={cn(
        "inline-flex min-h-6 w-fit items-center gap-1.5 border px-2 py-0.5 text-caption font-medium",
        TONE_CLASS[tone],
        props.className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 bg-current" />
      {props.children ?? label}
    </span>
  );
}
