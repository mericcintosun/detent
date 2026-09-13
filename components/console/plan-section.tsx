"use client";

import { useEffect, useRef, useState } from "react";
import { PlanEmptyState } from "@/components/console-states";
import {
  Callout,
  HashText,
  KeyValue,
  KeyValueList,
  Section,
  Stat,
  StatGroup,
  StatusPill,
} from "@/components/design";
import { NumberTicker } from "@/components/motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { actions, couponWindow } from "@/lib/data";
import { formatMicros, formatTokens, microsToInput } from "@/lib/plan";
import { cn } from "@/lib/utils";
import { StepBadge } from "./step-badge";
import type { ConsoleController } from "./use-console";

/** A micro unit amount as a number and the fraction digits it needs. */
function tickerOf(micros: string): { value: number; decimals: number } {
  const text = microsToInput(micros);
  const fraction = text.includes(".") ? text.split(".")[1].length : 0;
  return { value: Number(text), decimals: Math.max(2, fraction) };
}

export function PlanSection({ c }: { c: ConsoleController }) {
  const { plan, snapshot } = c;
  const [tableOverflows, setTableOverflows] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const rowCount = plan.rows.length;

  useEffect(() => {
    const element = tableRef.current;
    if (!element) return;
    const measure = () =>
      setTableOverflows(element.scrollWidth > element.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [rowCount]);

  const compliance = new Map(
    snapshot.holders.map((holder) => [holder.id, holder.compliance]),
  );
  const headroom = BigInt(plan.headroomMicros);
  const headroomNegative = headroom < 0n;
  const draw = tickerOf(plan.drawMicros);
  const room = tickerOf(String(headroomNegative ? -headroom : headroom));
  const asset = snapshot.treasury.settlementAsset;
  const switchTarget = actions.find((entry) => entry.kind === c.pendingSwitch);

  return (
    <Section
      id="plan"
      eyebrow="Step 2 of 5"
      heading="Plan"
      description="Pick the corporate action. Every included row is a line of the calldata the key will be allowed to sign."
      actions={<StepBadge status={c.locked ? "done" : "current"} />}
      className="border-t border-border"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <p className="detent-label" id="action-label">
            Corporate action
          </p>
          <div
            role="group"
            aria-labelledby="action-label"
            className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
          >
            {actions.map((entry) => {
              const selected = entry.kind === c.kind;
              return (
                <Button
                  key={entry.kind}
                  id={`action-${entry.kind}`}
                  variant={selected ? "default" : "outline"}
                  aria-pressed={selected}
                  onClick={() => c.selectAction(entry.kind)}
                  className={cn("justify-start px-5", !selected && "bg-card")}
                >
                  {entry.label}
                </Button>
              );
            })}
          </div>
          {c.locked && !c.lockSpent && !c.pendingSwitch ? (
            <p className="max-w-measure-lg text-body-sm text-muted-foreground">
              A plan is locked to the treasury key. Switching the corporate
              action releases that lock before anything is sent.
            </p>
          ) : null}
          {c.pendingSwitch && c.installation ? (
            <div
              id="action-switch-confirm"
              role="group"
              aria-labelledby="action-switch-title"
              tabIndex={-1}
              className="flex max-w-measure-xl flex-col gap-3 border-l-2 border-destructive bg-destructive-muted px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p
                id="action-switch-title"
                className="text-body-sm font-semibold text-destructive"
              >
                Release the lock to switch
              </p>
              <p className="text-body-sm text-foreground">
                {plan.label} is locked under {c.installation.lockId}. Switching
                to {switchTarget?.label} drops that lock and its policy in this
                console, clears the approvals and writes the release to the
                audit record. Nothing is signed.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={c.confirmSwitch}>
                  Release the lock and switch
                </Button>
                <Button variant="ghost" onClick={c.keepLockedPlan}>
                  Keep the locked plan
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b border-border py-5">
            <p className="detent-label">Plan, as it will be signed</p>
            <CardTitle className="font-display text-heading">
              {plan.label}
            </CardTitle>
            <CardDescription className="max-w-measure-xl">
              {c.action.summary} Authority: {plan.authority}. Record date{" "}
              {couponWindow.recordDate}, payment date {couponWindow.paymentDate}
              .
            </CardDescription>
          </CardHeader>

          <CardContent className="px-0">
            {plan.rows.length === 0 ? (
              <PlanEmptyState partition={snapshot.token.partition} />
            ) : (
              <>
                {tableOverflows ? (
                  <p className="detent-label px-4 pt-3">
                    Scroll the table sideways for every column. The row controls
                    stay pinned on the right.
                  </p>
                ) : null}
                <Table
                  className="min-w-3xl text-body-sm"
                  containerProps={{
                    ref: tableRef,
                    role: "region",
                    "aria-label": `${plan.label}, ${plan.rows.length} rows`,
                    className: "focus-visible:ring-inset",
                  }}
                >
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="detent-label pl-4">
                        Holder
                      </TableHead>
                      <TableHead className="detent-label">Account</TableHead>
                      <TableHead className="detent-label text-right">
                        Position
                      </TableHead>
                      <TableHead className="detent-label text-right">
                        {c.kind === "coupon" ? "Coupon due" : "Units moved"}
                      </TableHead>
                      <TableHead className="detent-label sticky right-0 bg-card pr-4 text-right before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-border">
                        Row
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plan.rows.map((row) => {
                      const state = compliance.get(row.holderId);
                      return (
                        <TableRow
                          key={row.holderId}
                          className={cn(
                            "align-top",
                            row.held && "bg-muted hover:bg-muted",
                          )}
                        >
                          <TableCell className="py-3 pl-4 whitespace-normal">
                            <div className="flex min-w-0 flex-col gap-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span
                                  className={cn(
                                    "font-medium",
                                    row.held && "text-destructive",
                                  )}
                                >
                                  {row.legalName}
                                </span>
                                {row.held && state ? (
                                  <StatusPill kind="hold" value={state} />
                                ) : null}
                              </span>
                              <span className="flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
                                {row.jurisdiction}
                                <HashText
                                  value={row.address}
                                  label={`${row.legalName} address`}
                                  copyable={false}
                                />
                              </span>
                              {row.held ? (
                                <p className="max-w-measure-xs text-caption text-destructive">
                                  {row.holdReason}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 font-mono text-caption text-muted-foreground">
                            {row.accountId}
                          </TableCell>
                          <TableCell className="amount py-3 text-right">
                            {formatTokens(row.balance)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "amount py-3 text-right",
                              !row.included &&
                                "text-muted-foreground line-through",
                            )}
                          >
                            {formatMicros(row.amountMicros)}
                          </TableCell>
                          {/* Pinned to the scroller's right edge, so the row
                                control is on screen at any width. */}
                          <TableCell
                            className={cn(
                              "sticky right-0 py-2 pr-4 text-right before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-border",
                              row.held ? "bg-muted" : "bg-card",
                            )}
                          >
                            <Button
                              variant={row.included ? "outline" : "ghost"}
                              size="sm"
                              disabled={c.locked}
                              onClick={() => c.toggleRow(row)}
                            >
                              {row.held
                                ? row.included
                                  ? "Hold again"
                                  : "Force in"
                                : row.included
                                  ? "Defer"
                                  : "Restore"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>

        <StatGroup>
          <Stat
            label="In the plan"
            value={`${c.includedRows.length} of ${plan.rows.length}`}
            hint="rows included"
          />
          <Stat
            label="Draw"
            value={<NumberTicker value={draw.value} decimals={draw.decimals} />}
            hint={asset}
          />
          <Stat
            label="Treasury cover"
            value={formatMicros(plan.treasuryMicros)}
            hint={`${asset} on ${snapshot.treasury.accountId}`}
          />
          <Stat
            label="Headroom"
            value={<NumberTicker value={room.value} decimals={room.decimals} />}
            tone={headroomNegative ? "destructive" : "success"}
            hint={headroomNegative ? `Short by this much ${asset}` : asset}
          />
        </StatGroup>

        {plan.blockers.length > 0 ? (
          <Callout tone="destructive" title="The plan cannot be locked yet">
            <ul className="flex flex-col gap-1">
              {plan.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </Callout>
        ) : null}

        <KeyValueList>
          <KeyValue label="Plan hash">
            <HashText
              value={plan.planHash}
              label="plan hash"
              lead={12}
              tail={10}
            />
          </KeyValue>
          <KeyValue label="Call" mono>
            {plan.signature}{" "}
            <span className="text-muted-foreground">
              selector {plan.selector}
            </span>
          </KeyValue>
        </KeyValueList>
      </div>
    </Section>
  );
}
