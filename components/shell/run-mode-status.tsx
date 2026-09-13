import { StatusPill } from "@/components/design/status-pill";
import { CHAIN_ID } from "@/lib/public-config";
import { cn } from "@/lib/utils";
import { describeRunMode, type RunModeFlags } from "./run-mode";

/** The run mode block of the rail and the sheet: a pill and one status line. */
export function RunModeStatus({
  className,
  idPrefix,
  ...flags
}: RunModeFlags & { className?: string; idPrefix: string }) {
  const copy = describeRunMode(flags);
  const labelId = `${idPrefix}-run-mode-label`;
  return (
    <section
      aria-labelledby={labelId}
      className={cn("flex flex-col gap-2", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={labelId} className="detent-label font-sans">
          Run mode
        </h2>
        {/* The caption size sits on a wrapper: inside StatusPill, cn() reads
            text-caption and the tone's text colour as one group and drops the
            size, so the pill would inherit the body size. */}
        <span className="text-caption">
          <StatusPill kind="mode" value={copy.mode}>
            {copy.label}
          </StatusPill>
        </span>
      </div>
      <p className="text-caption text-foreground">{copy.line}</p>
      <p className="text-caption text-muted-foreground">
        Hedera testnet, chain {CHAIN_ID}
      </p>
    </section>
  );
}

/** The top bar's compact form: the pill, with both halves in its name. */
export function RunModePill({
  className,
  ...flags
}: RunModeFlags & { className?: string }) {
  const copy = describeRunMode(flags);
  return (
    <span className={cn("text-caption", className)}>
      <StatusPill kind="mode" value={copy.mode}>
        <span className="sr-only">Run mode: </span>
        {copy.label}
        <span className="sr-only">. {copy.line}.</span>
      </StatusPill>
    </span>
  );
}
