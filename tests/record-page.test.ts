// The state selection logic behind /record/[planHash]: which of the six
// PlanRecordState values maps to which pill, which chain-data branch, and
// which two-step timeline. Pure functions, no React and no network, so every
// branch the page can take is covered here rather than only by a screenshot.

import { describe, expect, it } from "vitest";
import {
  buildTimeline,
  PLAN_ANCHOR_ENV_HINT,
  selectRecordView,
} from "@/components/record/record-view";
import type { PlanRecord } from "@/lib/types";

function record(
  overrides: Partial<PlanRecord> & Pick<PlanRecord, "state">,
): PlanRecord {
  return { note: "note", ...overrides };
}

describe("selectRecordView", () => {
  it("marks anchored, settled and abandoned as having a chain row", () => {
    for (const state of ["anchored", "settled", "abandoned"] as const) {
      const view = selectRecordView(record({ state }));
      expect(view.kind).toBe(state);
      expect(view.hasChainData).toBe(true);
      expect(view.showRetry).toBe(false);
    }
  });

  it("marks unknown, unwired and unreadable as having no chain row", () => {
    for (const state of ["unknown", "unwired", "unreadable"] as const) {
      const view = selectRecordView(record({ state }));
      expect(view.hasChainData).toBe(false);
    }
  });

  it("offers a retry only for the relay failure", () => {
    expect(selectRecordView(record({ state: "unreadable" })).showRetry).toBe(
      true,
    );
    for (const state of [
      "anchored",
      "settled",
      "abandoned",
      "unknown",
      "unwired",
    ] as const) {
      expect(selectRecordView(record({ state })).showRetry).toBe(false);
    }
  });

  it("gives each state a distinct pill label and a design system tone", () => {
    const seen = new Set<string>();
    for (const state of [
      "anchored",
      "settled",
      "abandoned",
      "unknown",
      "unwired",
      "unreadable",
    ] as const) {
      const view = selectRecordView(record({ state }));
      expect(view.pillLabel.length).toBeGreaterThan(0);
      expect(["info", "success", "destructive", "warning", "muted"]).toContain(
        view.pillTone,
      );
      seen.add(view.pillLabel);
    }
    expect(seen.size).toBe(6);
  });

  it("settles on success and abandons on destructive, never the other way round", () => {
    expect(selectRecordView(record({ state: "settled" })).pillTone).toBe(
      "success",
    );
    expect(selectRecordView(record({ state: "abandoned" })).pillTone).toBe(
      "destructive",
    );
  });
});

describe("buildTimeline", () => {
  it("is empty for the three states with no chain row", () => {
    for (const state of ["unknown", "unwired", "unreadable"] as const) {
      expect(buildTimeline(record({ state }))).toEqual([]);
    }
  });

  it("shows an anchored plan as open, its second step not yet reached", () => {
    const steps = buildTimeline(
      record({ state: "anchored", anchoredAt: "2026-01-01T00:00:00.000Z" }),
    );
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({
      key: "anchored",
      reached: true,
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    expect(steps[1]).toMatchObject({
      key: "closed",
      label: "Open",
      tone: "info",
      reached: false,
      timestamp: undefined,
    });
  });

  it("closes a settled plan on the success tone with its closedAt timestamp", () => {
    const steps = buildTimeline(
      record({
        state: "settled",
        anchoredAt: "2026-01-01T00:00:00.000Z",
        closedAt: "2026-01-02T00:00:00.000Z",
      }),
    );
    expect(steps[1]).toMatchObject({
      label: "Settled",
      tone: "success",
      reached: true,
      timestamp: "2026-01-02T00:00:00.000Z",
    });
  });

  it("closes an abandoned plan on the destructive tone", () => {
    const steps = buildTimeline(
      record({
        state: "abandoned",
        anchoredAt: "2026-01-01T00:00:00.000Z",
        closedAt: "2026-01-02T00:00:00.000Z",
      }),
    );
    expect(steps[1]).toMatchObject({
      label: "Abandoned",
      tone: "destructive",
      reached: true,
    });
  });
});

describe("PLAN_ANCHOR_ENV_HINT", () => {
  it("names the variable lib/public-config.ts actually reads", () => {
    expect(PLAN_ANCHOR_ENV_HINT).toBe("NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS");
  });
});
