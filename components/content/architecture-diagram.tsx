// The architecture diagram for /how-it-works, drawn from design primitives.
//
// No image, no new colour: every box is a Card on the semantic border and
// background tokens, connected by a plain arrow glyph. The connector is
// decorative (aria-hidden) and the reading order for a screen reader is the
// ordered list underneath it, one item per step, in the order the plan
// actually moves through the code.

import { ArrowDownIcon } from "@phosphor-icons/react/ssr";
import { Fragment } from "react";
import { Stagger, StaggerItem } from "@/components/motion";
import { cn } from "@/lib/utils";

export interface ArchitectureStep {
  /** "1" through "6". Printed as the step's eyebrow. */
  index: string;
  title: string;
  body: string;
  /** The file or service this step names, printed in the mono face. */
  source: string;
}

export const ARCHITECTURE_STEPS: ArchitectureStep[] = [
  {
    index: "1",
    title: "Register read",
    body: "lib/hedera.ts calls balanceOfByPartition and canTransferByPartition against the ATS equity token over the Hashio relay, and asks whether a credit from the treasury to each holder would clear.",
    source: "Hedera testnet, ATS token",
  },
  {
    index: "2",
    title: "Off chain replay",
    body: "lib/plan.ts rebuilds the payout row by row from that register: which holder is blocked and why, how much cover the treasury has, and the exact calldata and plan hash the action would use.",
    source: "lib/plan.ts",
  },
  {
    index: "3",
    title: "Policy compiled",
    body: "Once the operator accepts the plan, lib/privy.ts compiles its calldata into a wallet policy and installs it on the treasury server wallet, owned by a key quorum of two.",
    source: "lib/privy.ts, 2 of 2 key quorum",
  },
  {
    index: "4",
    title: "Send",
    body: "The wallet may sign only for that chain, that contract, that function and that partition. A submitted payload that does not match the approved calldata is refused before it reaches the wallet.",
    source: "Privy server wallet",
  },
  {
    index: "5",
    title: "Anchor and settle",
    body: "PlanAnchor records the plan hash before the send and closes it as settled or abandoned once the outcome is known, so the audit record survives past the session.",
    source: "contracts/src/PlanAnchor.sol",
  },
  {
    index: "6",
    title: "Policy revoked",
    body: "Whether the send lands, fails or times out, the policy is detached from the treasury wallet and deleted. Nothing stays attached to the key once its one transaction is decided.",
    source: "lib/privy.ts, releasePolicy",
  },
];

function Connector() {
  return (
    <li aria-hidden="true" className="flex justify-center py-1">
      <ArrowDownIcon className="size-4 text-muted-foreground" />
    </li>
  );
}

export function ArchitectureDiagram({ className }: { className?: string }) {
  return (
    <Stagger as="ol" className={cn("flex flex-col", className)}>
      {ARCHITECTURE_STEPS.map((step, position) => (
        <Fragment key={step.index}>
          <li>
            <StaggerItem as="div">
              <div className="flex flex-col gap-2 border border-border bg-card p-5">
                <p className="detent-label">Step {step.index}</p>
                <h3 className="font-display text-heading text-foreground">
                  {step.title}
                </h3>
                <p className="text-body-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
                <p className="amount pt-1 font-mono text-caption text-muted-foreground">
                  {step.source}
                </p>
              </div>
            </StaggerItem>
          </li>
          {position < ARCHITECTURE_STEPS.length - 1 ? <Connector /> : null}
        </Fragment>
      ))}
    </Stagger>
  );
}
