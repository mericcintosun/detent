import {
  CheckCircleIcon,
  InfoIcon,
  FlaskIcon,
  WarningIcon,
  WarningOctagonIcon,
} from "@phosphor-icons/react/ssr";
import type * as React from "react";
import { cn } from "@/lib/utils";

export type CalloutTone =
  "neutral" | "info" | "success" | "warning" | "destructive" | "mirror";

const TONES: Record<
  CalloutTone,
  { box: string; icon: string; Icon: typeof InfoIcon }
> = {
  neutral: {
    box: "border-border bg-card",
    icon: "text-muted-foreground",
    Icon: InfoIcon,
  },
  info: { box: "border-info bg-info-muted", icon: "text-info", Icon: InfoIcon },
  success: {
    box: "border-success bg-success-muted",
    icon: "text-success",
    Icon: CheckCircleIcon,
  },
  warning: {
    box: "border-warning bg-warning-muted",
    icon: "text-warning",
    Icon: WarningIcon,
  },
  destructive: {
    box: "border-destructive bg-destructive-muted",
    icon: "text-destructive",
    Icon: WarningOctagonIcon,
  },
  mirror: {
    box: "border-mirror bg-mirror-muted",
    icon: "text-mirror",
    Icon: FlaskIcon,
  },
};

export interface CalloutProps {
  tone?: CalloutTone;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * A static note in the flow of a page, marked by a left rule and a tinted
 * surface. It is not announced; use ErrorState with `live` for a failure the
 * reader just caused, and a toast for a passing confirmation.
 */
export function Callout({
  tone = "neutral",
  title,
  children,
  className,
}: CalloutProps) {
  const { box, icon, Icon } = TONES[tone];
  return (
    <aside
      data-slot="callout"
      data-tone={tone}
      className={cn("flex gap-3 border-l-2 px-4 py-3", box, className)}
    >
      <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", icon)} />
      <div className="flex min-w-0 flex-col gap-1 text-body-sm text-foreground">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className="text-foreground">{children}</div>
      </div>
    </aside>
  );
}
