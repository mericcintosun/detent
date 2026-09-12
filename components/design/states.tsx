import {
  CloudSlashIcon,
  ClockCounterClockwiseIcon,
  WarningOctagonIcon,
} from "@phosphor-icons/react/ssr";
import type * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StateBaseProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** One control that moves the reader on: an outline Button or a link. */
  action?: React.ReactNode;
  /** h2 when the state stands in for a whole section, h3 inside a card. */
  level?: 2 | 3;
  className?: string;
}

/** Nothing to show yet, and what would put something here. */
export function EmptyState({
  title,
  description,
  action,
  level = 3,
  icon,
  className,
}: StateBaseProps & { icon?: React.ReactNode }) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center gap-3 border-y border-border bg-card px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="text-muted-foreground [&_svg]:size-6"
        >
          {icon}
        </span>
      ) : null}
      <Heading className="font-display text-heading text-foreground">
        {title}
      </Heading>
      {description ? (
        <p className="max-w-measure-sm text-body-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/**
 * Something failed. `live` announces it assertively, which is right for a
 * failure caused by the reader's own action and wrong for one present on load.
 */
export function ErrorState({
  title,
  description,
  action,
  code,
  live = false,
  level = 3,
  className,
}: StateBaseProps & { code?: string; live?: boolean }) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div
      data-slot="error-state"
      role={live ? "alert" : undefined}
      className={cn(
        "flex flex-col gap-3 border border-destructive/50 bg-destructive-muted p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <WarningOctagonIcon
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-destructive"
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <Heading className="text-body font-semibold text-destructive">
            {title}
          </Heading>
          {description ? (
            <p className="text-body-sm text-foreground">{description}</p>
          ) : null}
          {code ? (
            <p className="text-caption text-muted-foreground">
              Error code <code className="font-mono">{code}</code>
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="pl-8">{action}</div> : null}
    </div>
  );
}

export interface LoadingStateProps {
  /** Read by screen readers while the content loads. */
  label?: string;
  /** rows for a list or table, block for a card or panel. */
  shape?: "rows" | "block";
  rows?: number;
  className?: string;
}

/**
 * Skeleton placeholders with a polite status message. The shapes are neutral
 * bars, never fake numbers, so nothing on screen can be mistaken for data.
 */
export function LoadingState({
  label = "Loading",
  shape = "rows",
  rows = 3,
  className,
}: LoadingStateProps) {
  return (
    <div
      data-slot="loading-state"
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("flex flex-col gap-3", className)}
    >
      <span className="sr-only">{label}</span>
      {shape === "block" ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))
      )}
    </div>
  );
}

export interface StaleBannerProps {
  /** When the data was read, as ISO 8601. Rendered in a <time> element. */
  readAt: string;
  /** The same moment in words, computed by the caller: "4 minutes ago". */
  age: React.ReactNode;
  /** What the reader is looking at: "The register snapshot". */
  subject: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Says data is older than it should be. The caller decides staleness, so this
 * component never reads the clock and cannot cause a hydration mismatch.
 */
export function StaleBanner({
  readAt,
  age,
  subject,
  action,
  className,
}: StaleBannerProps) {
  return (
    <div
      data-slot="stale-banner"
      role="status"
      className={cn(
        "flex flex-col gap-3 border-l-2 border-warning bg-warning-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="flex items-start gap-2 text-body-sm text-foreground">
        <ClockCounterClockwiseIcon
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-warning"
        />
        <span>
          {subject} was read <time dateTime={readAt}>{age}</time> and may be out
          of date.
        </span>
      </p>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export interface OfflineNoticeProps {
  className?: string;
}

/** The static offline message. OfflineBanner shows it only while offline. */
export function OfflineNotice({ className }: OfflineNoticeProps) {
  return (
    <div
      data-slot="offline-banner"
      role="status"
      className={cn(
        "flex items-start gap-2 border-l-2 border-info bg-info-muted px-4 py-3 text-body-sm text-foreground",
        className,
      )}
    >
      <CloudSlashIcon
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-info"
      />
      <span>
        You are offline. What is on screen stays readable, and nothing will be
        sent until the connection returns.
      </span>
    </div>
  );
}
