import {
  CheckCircleIcon,
  CircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react/ssr";
import { Stagger, StaggerItem } from "@/components/motion";
import { cn } from "@/lib/utils";
import type { PlanRecord } from "@/lib/types";
import { buildTimeline, type RecordTone } from "./record-view";

const ICON: Record<RecordTone, typeof CircleIcon> = {
  info: CircleIcon,
  success: CheckCircleIcon,
  destructive: XCircleIcon,
  warning: CircleIcon,
  muted: CircleIcon,
};

const TEXT_CLASS: Record<RecordTone, string> = {
  info: "text-info",
  success: "text-success",
  destructive: "text-destructive",
  warning: "text-warning",
  muted: "text-muted-foreground",
};

/** ISO to the form the console prints: seconds, no T, named as UTC. */
function utc(value: string | undefined): string {
  if (!value) return "not reached yet";
  return `${value.slice(0, 19).replace("T", " ")} UTC`;
}

/**
 * Anchored, then settled or abandoned: the two moments PlanAnchor holds for
 * one plan hash, entering in the Detent 40ms stagger step. Renders nothing
 * for a hash with no chain row, so the caller does not need to branch first.
 */
export function RecordTimeline({ record }: { record: PlanRecord }) {
  const steps = buildTimeline(record);
  if (steps.length === 0) return null;

  return (
    <Stagger as="ol" trigger="mount" className="flex flex-col gap-4">
      {steps.map((step) => {
        const Icon = ICON[step.tone];
        return (
          <StaggerItem
            as="li"
            key={step.key}
            className="flex items-start gap-3 border-l-2 border-border py-0.5 pl-4"
          >
            <Icon
              aria-hidden="true"
              className={cn(
                "mt-0.5 size-4 shrink-0",
                step.reached ? TEXT_CLASS[step.tone] : "text-muted-foreground",
              )}
            />
            <div className="flex flex-col gap-0.5">
              <p
                className={cn(
                  "text-body-sm font-medium",
                  step.reached ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </p>
              <p className="text-caption text-muted-foreground">
                {step.timestamp ? (
                  <time dateTime={step.timestamp}>{utc(step.timestamp)}</time>
                ) : (
                  utc(step.timestamp)
                )}
              </p>
            </div>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}
