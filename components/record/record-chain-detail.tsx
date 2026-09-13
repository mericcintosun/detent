// The anchored, settled and abandoned states share one shape: a sentence from
// readPlanRecord, the lifecycle timeline, and the register row. Only the
// sentence and the timeline's second step differ between the three, and both
// are already decided by lib/anchor.ts and buildTimeline, so one component
// renders all three rather than three near-identical ones.

import { AddressText, KeyValue, KeyValueList } from "@/components/design";
import type { PlanRecord } from "@/lib/types";
import { RecordTimeline } from "./record-timeline";

export function RecordChainDetail({ record }: { record: PlanRecord }) {
  return (
    <div className="space-y-6">
      <p className="max-w-measure-lg text-body-sm leading-relaxed text-muted-foreground">
        {record.note}
      </p>
      <RecordTimeline record={record} />
      <KeyValueList>
        <KeyValue label="Token" mono>
          {record.token ?? "not set"}
        </KeyValue>
        <KeyValue label="Selector" mono>
          {record.selector ?? "not set"}
        </KeyValue>
        <KeyValue label="Anchored by">
          {record.anchoredBy ? (
            <AddressText
              address={record.anchoredBy}
              label="anchoring address"
            />
          ) : (
            "not set"
          )}
        </KeyValue>
      </KeyValueList>
    </div>
  );
}
