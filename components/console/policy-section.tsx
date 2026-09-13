"use client";

import { PolicyEmptyState, SendErrorState } from "@/components/console-states";
import {
  LoadingState,
  OfflineNotice,
  Section,
  StatusPill,
} from "@/components/design";
import { Reveal } from "@/components/motion";
import { PolicyExplorer } from "@/components/policy-explorer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { approvers } from "@/lib/data";
import { StepBadge } from "./step-badge";
import type { ConsoleController } from "./use-console";

export function PolicySection({ c }: { c: ConsoleController }) {
  const { installation, failure, failureView, failureControl } = c;
  const lockFailure = failure?.stage === "lock" && failureView ? failure : null;

  return (
    <Section
      id="policy"
      eyebrow="Step 3 of 5"
      heading="Policy"
      description="Two officers approve, and the plan's own calldata is compiled into a wallet policy that allows that transaction and nothing else."
      actions={
        <StepBadge
          status={
            c.locked ? "done" : c.plan.blockers.length ? "next" : "current"
          }
        />
      }
      className="border-t border-border"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="font-display text-heading">
              Key quorum, threshold two
            </CardTitle>
            <CardDescription>
              The policy is not installed by one person. Two distinct signers on
              the treasury wallet open it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <ul className="flex flex-col divide-y divide-border border-y border-border">
              {approvers.map((approver) => {
                const signed = c.approvals.includes(approver.id);
                return (
                  <li
                    key={approver.id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-body-sm font-medium">
                        {approver.name}
                      </p>
                      <p className="text-caption text-muted-foreground">
                        {approver.role},{" "}
                        <span className="font-mono">{approver.keyId}</span>
                      </p>
                    </div>
                    <Button
                      variant={signed ? "secondary" : "outline"}
                      size="sm"
                      disabled={c.locked}
                      onClick={() => c.toggleApproval(approver.id)}
                    >
                      {signed ? "Approved" : "Approve"}
                    </Button>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col gap-2">
              <Progress value={(c.approvals.length / 2) * 100}>
                <ProgressLabel className="sr-only">
                  Quorum signatures
                </ProgressLabel>
              </Progress>
              <p className="text-body-sm text-muted-foreground">
                {c.approvals.length} of 2 signatures collected.
              </p>
            </div>

            {!c.online ? <OfflineNotice /> : null}

            <Button
              size="lg"
              className="w-full text-center"
              disabled={
                c.locked ||
                c.pending !== null ||
                c.plan.blockers.length > 0 ||
                !c.quorumMet ||
                !c.online
              }
              onClick={c.lockPlan}
            >
              {c.pending === "lock"
                ? "Compiling policy…"
                : c.locked
                  ? "Plan locked to the treasury key"
                  : "Lock this plan to the treasury key"}
            </Button>
            {!c.quorumMet && c.plan.blockers.length === 0 && !c.locked ? (
              <p className="text-body-sm text-muted-foreground">
                Collect both approvals to install the policy.
              </p>
            ) : null}

            {/* A refused lock is printed where it can be acted on, including a
                send that came back lock_unknown: the console has already
                returned to this step, so the way out is the button above. */}
            {lockFailure && failureView ? (
              <div
                id="lock-failure"
                tabIndex={-1}
                className="outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <SendErrorState
                  title={failureView.title}
                  hint={failureView.sentence}
                  code={lockFailure.code}
                  blockers={lockFailure.blockers}
                  actionLabel={failureControl?.label}
                  onRetry={
                    failureControl
                      ? () => c.runFailure(failureControl.run)
                      : undefined
                  }
                  busy={
                    c.pending !== null ||
                    (failureView.action === "relock" && !c.quorumMet)
                  }
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="font-display text-heading">
              Compiled wallet policy
            </CardTitle>
            <CardDescription>
              One ALLOW rule, generated from the plan you just read. Everything
              else stays on the default, and the rule dies with the transaction.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {installation ? (
              <Reveal variant="fade" trigger="mount">
                <div
                  id="policy-compiled"
                  tabIndex={-1}
                  aria-label={`Compiled wallet policy ${installation.policy.name}`}
                  className="flex flex-col gap-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-card"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-hairline">
                      {installation.policy.name}
                    </Badge>
                    <StatusPill
                      kind="mode"
                      value={installation.live ? "live" : "mirror"}
                    >
                      {installation.live
                        ? "Installed on Privy"
                        : "Compiled locally"}
                    </StatusPill>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="detent-label">Policy id</span>
                    <span className="font-mono text-caption break-all">
                      {installation.policyId}
                    </span>
                  </div>
                  <PolicyExplorer
                    conditions={installation.policy.rules[0].conditions}
                    target={c.plan.target}
                    selector={c.plan.selector}
                    calldata={c.plan.calldata}
                    defaultAction={installation.policy.default_action}
                  />
                  <p className="text-body-sm text-muted-foreground">
                    {installation.note}
                  </p>
                </div>
              </Reveal>
            ) : c.pending === "lock" ? (
              <LoadingState label="Compiling the wallet policy" rows={4} />
            ) : (
              <PolicyEmptyState />
            )}
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}
