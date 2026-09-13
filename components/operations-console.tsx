"use client";

// The operator console at `/`: a compact hero, then the five steps in order.
//
// State and every server call live in components/console/use-console.ts; each
// step renders from that one controller in its own file under
// components/console/. The toast region is mounted here, around the console
// subtree, because the console is the only surface that raises a toast.

import { Toaster } from "@/components/ui/toast";
import type { RegisterSnapshot } from "@/lib/types";
import { ConsoleHero } from "./console/console-hero";
import { LedgerSection } from "./console/ledger-section";
import { PlanSection } from "./console/plan-section";
import { PolicySection } from "./console/policy-section";
import { RegisterSection } from "./console/register-section";
import { SendSection } from "./console/send-section";
import { useConsole } from "./console/use-console";

export interface OperationsConsoleProps {
  snapshot: RegisterSnapshot;
  /**
   * Whether the treasury key on the server is a real Privy server wallet or the
   * local evaluator standing in for one. Read in app/page.tsx through
   * lib/register.ts, because lib/privy.ts is server only and this file is not.
   */
  signerLive: boolean;
  /** When the snapshot was read, from lib/register.ts snapshotReadAt. */
  readAt: string;
  /** Past this age the register shows a stale banner. */
  staleAfterMs: number;
}

export function OperationsConsole({
  snapshot,
  signerLive,
  readAt,
  staleAfterMs,
}: OperationsConsoleProps) {
  const c = useConsole({ snapshot, signerLive });
  return (
    <Toaster>
      <div className="mx-auto flex w-full max-w-content flex-col gap-10">
        <ConsoleHero c={c} signerLive={signerLive} />
        <div className="flex flex-col">
          <RegisterSection c={c} readAt={readAt} staleAfterMs={staleAfterMs} />
          <PlanSection c={c} />
          <PolicySection c={c} />
          <SendSection c={c} />
          <LedgerSection c={c} />
        </div>
      </div>
    </Toaster>
  );
}
