// Pure state selection for the record page. No React, no fetch, no clock: a
// PlanRecord in, a view description out, so the six branches of
// app/record/[planHash]/page.tsx are decided here and covered by
// tests/record-page.test.ts instead of by a screenshot.
//
// The tone names are the design system's semantic roles (info, success,
// destructive, warning, muted), never a raw colour. The page and
// RecordStatusPill translate a tone into the matching `text-*` / `bg-*-muted`
// utilities from app/globals.css.

import type { PlanRecord, PlanRecordState } from "@/lib/types";

export type RecordViewKind = PlanRecordState;

export type RecordTone =
  "info" | "success" | "destructive" | "warning" | "muted";

export interface RecordView {
  kind: RecordViewKind;
  /** anchored, settled or abandoned: the contract has a row for this hash. */
  hasChainData: boolean;
  /** Only the relay failure state offers a retry, because it is the only one
   *  a reload can plausibly fix. */
  showRetry: boolean;
  pillLabel: string;
  pillTone: RecordTone;
}

const PILL: Record<RecordViewKind, { label: string; tone: RecordTone }> = {
  anchored: { label: "Anchored, still open", tone: "info" },
  settled: { label: "Settled", tone: "success" },
  abandoned: { label: "Abandoned", tone: "destructive" },
  unknown: { label: "Not anchored", tone: "muted" },
  unwired: { label: "Anchor not configured", tone: "warning" },
  unreadable: { label: "Read failed", tone: "destructive" },
};

const CHAIN_DATA_STATES = new Set<RecordViewKind>([
  "anchored",
  "settled",
  "abandoned",
]);

/** Which component the page renders, and how the pill and CTAs read. */
export function selectRecordView(record: PlanRecord): RecordView {
  const kind = record.state;
  const { label, tone } = PILL[kind];
  return {
    kind,
    hasChainData: CHAIN_DATA_STATES.has(kind),
    showRetry: kind === "unreadable",
    pillLabel: label,
    pillTone: tone,
  };
}

export interface TimelineStep {
  key: "anchored" | "closed";
  label: string;
  /** ISO 8601, or undefined while the step has not been reached. */
  timestamp?: string;
  reached: boolean;
  tone: RecordTone;
}

/**
 * The two moments PlanAnchor can hold for one hash. Empty for every state
 * that has no chain row, so the caller can render nothing rather than a
 * timeline of blanks.
 */
export function buildTimeline(record: PlanRecord): TimelineStep[] {
  if (!CHAIN_DATA_STATES.has(record.state)) return [];

  const closed =
    record.state === "settled"
      ? { label: "Settled", tone: "success" as const }
      : record.state === "abandoned"
        ? { label: "Abandoned", tone: "destructive" as const }
        : { label: "Open", tone: "info" as const };

  return [
    {
      key: "anchored",
      label: "Anchored",
      timestamp: record.anchoredAt,
      reached: true,
      tone: "info",
    },
    {
      key: "closed",
      label: closed.label,
      timestamp: record.closedAt,
      reached: record.state !== "anchored",
      tone: closed.tone,
    },
  ];
}

/** Named once so the page, the empty state copy and a test agree on the word. */
export const PLAN_ANCHOR_ENV_HINT = "NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS";
