import { cn } from "@/lib/utils";
import type { RecordTone } from "./record-view";

const TONE_CLASS: Record<RecordTone, string> = {
  info: "border-info/40 bg-info-muted text-info",
  success: "border-success/40 bg-success-muted text-success",
  destructive: "border-destructive/40 bg-destructive-muted text-destructive",
  warning: "border-warning/40 bg-warning-muted text-warning",
  muted: "border-border bg-muted text-muted-foreground",
};

export interface RecordStatusPillProps {
  label: string;
  tone: RecordTone;
  className?: string;
}

/**
 * The same square stamp shape as components/design/status-pill.tsx, for a
 * state that component's `mode` / `hold` / `receipt` union does not name: the
 * lifecycle of one plan hash in PlanAnchor. Colour is never the only signal,
 * the label always says the state in words.
 */
export function RecordStatusPill({
  label,
  tone,
  className,
}: RecordStatusPillProps) {
  return (
    <span
      data-slot="record-status-pill"
      data-tone={tone}
      className={cn(
        "inline-flex min-h-6 w-fit items-center gap-1.5 border px-2 py-0.5 text-caption font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 bg-current" />
      {label}
    </span>
  );
}
