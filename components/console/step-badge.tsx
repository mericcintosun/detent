import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StepStatus = "done" | "current" | "next";

const STEP: Record<StepStatus, { label: string; className: string }> = {
  done: { label: "Done", className: "border-success/40 text-success" },
  current: {
    label: "Current step",
    className: "border-hairline text-foreground",
  },
  next: { label: "Up next", className: "border-border text-muted-foreground" },
};

/**
 * Where one of the five console steps stands. The word carries the state, the
 * rule colour only repeats it.
 */
export function StepBadge({ status }: { status: StepStatus }) {
  const { label, className } = STEP[status];
  return (
    <Badge variant="outline" className={cn("min-h-6", className)}>
      {label}
    </Badge>
  );
}
