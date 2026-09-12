import type { Metadata } from "next";
import { OperationsConsole } from "@/components/operations-console";
import { Plate, type PlateName } from "@/components/plates";
import { Button } from "@/components/ui/button";
import { getRegisterSnapshot, isPrivyLive } from "@/lib/register";

/**
 * Matches REGISTER_CACHE_MS in lib/config.ts. Twelve holders times three relay
 * reads is not a cost to pay on every navigation during a demo walk.
 */
export const revalidate = 30;

export const metadata: Metadata = {
  title: "Coupon run console",
  description:
    "Read the BMEQ quarterly coupon distribution line by line, then lock the treasury key to exactly that payout.",
};

/**
 * The whole product in three steps, one sentence each. No number appears here
 * that is not already in lib/data.ts: the two approvals are the two entries in
 * `approvers`, and nothing else is counted.
 */
const steps: { plate: PlateName; term: string; sentence: string }[] = [
  {
    plate: "plan",
    term: "Read the plan",
    sentence:
      "Every holder the coupon reaches, every one the compliance module is holding, and what the treasury has left once the draw clears.",
  },
  {
    plate: "policy",
    term: "Lock the key",
    sentence:
      "Two officers approve, and the plan's own calldata is compiled into a wallet policy that allows that transaction and nothing else.",
  },
  {
    plate: "refusal",
    term: "Watch it refuse",
    sentence:
      "Edit one amount by hand and send it. The key names the condition that failed, and the untouched plan still signs.",
  },
];

/** The comparison the prose used to make, in a form a judge can check. */
const comparison: { tool: string; does: string; stops: string }[] = [
  {
    tool: "Tenderly and Safe",
    does: "Simulates the outcome before you sign.",
    stops: "The simulation and the signature are separate events.",
  },
  {
    tool: "Fireblocks",
    does: "An administrator authors policy up front.",
    stops: "The rules persist across every transaction.",
  },
  {
    tool: "OpenZeppelin Defender",
    does: "Routes proposals through a multisig or a relayer.",
    stops: "No ERC-1400 semantics for who may be credited.",
  },
  {
    tool: "Detent",
    does: "Compiles the plan you read into the signing limit.",
    stops: "One corporate action, then the policy is revoked.",
  },
];

export default async function ConsolePage() {
  const snapshot = await getRegisterSnapshot();
  /* Read on the server so the fold can state which of the two modes a reader is
     looking at. A boolean crosses to the client, never the module: lib/privy.ts
     reads PRIVY_APP_SECRET. */
  const signerLive = isPrivyLive();

  return (
    <div className="space-y-16">
      <OperationsConsole snapshot={snapshot} signerLive={signerLive} />

      <section id="brief" className="max-w-[68ch] space-y-10 border-t border-border pt-10">
        {/* One sentence, then the way in. The four paragraphs this fold used to
            carry are now a three step strip and a disclosure. */}
        <div className="space-y-5">
          <p className="text-lg leading-relaxed">
            Detent is built for the person who actually presses send on a
            corporate action, and the plan they accept on this page becomes the
            only thing the treasury key can sign.
          </p>
          <Button variant="outline" asChild>
            <a href="#register">Start at the register</a>
          </Button>
        </div>

        {/* The strip wipes in on its own scroll progress where the browser
            supports it, and is a plain band everywhere else. The ledger rule
            sits behind the plates and under no sentence. */}
        <ol className="detent-band grid gap-6 sm:grid-cols-3">
          {steps.map((step) => (
            <li key={step.term} className="space-y-3">
              <div className="detent-ruled flex items-center justify-center border border-border px-4 py-5">
                <Plate name={step.plate} width={160} height={120} className="h-20 w-auto" />
              </div>
              <p className="detent-label">{step.term}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {step.sentence}
              </p>
            </li>
          ))}
        </ol>

        <h2 className="text-2xl tracking-tight">Why this exists</h2>
        <p className="leading-relaxed text-muted-foreground">
          Whoever runs a tokenized security spends their quarter on operations
          that cannot be taken back: coupon distributions, court ordered
          transfers, freezing a screened address, redemptions. The register is
          live, the amounts are real, and the key that signs is a general purpose
          key with rights over the whole contract. Today the step before signing
          is either reading an explorer or trusting a script. A wrong parameter,
          a lapsed allowlist entry or a thin treasury shows up after the
          transaction lands, which is the worst possible time.
        </p>
        <p className="leading-relaxed text-muted-foreground">
          Detent puts one step in that gap. It reads the holder set and the
          compliance state off the Asset Tokenization Studio contracts, replays
          the action off chain and prints the plan: who receives what, which
          address the transfer hook will reject, how much cover the treasury
          actually has. When the operator accepts that plan, its calldata is
          compiled into a Privy wallet policy. The treasury wallet is then
          allowed to sign that contract, that selector and those exact parameter
          bytes, and nothing else. A key quorum of two opens the policy, and the
          policy is revoked once the transaction is in.
        </p>

        <details className="border-t border-border pt-6">
          <summary className="detent-label cursor-pointer py-2 hover:text-foreground">
            How it differs from a simulator
          </summary>
          <div className="overflow-x-auto pt-4">
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="detent-label py-2 pr-4 font-normal">Tool</th>
                  <th className="detent-label py-2 pr-4 font-normal">What it does</th>
                  <th className="detent-label py-2 font-normal">Where it stops</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.tool} className="border-b border-border last:border-b-0">
                    <td className="py-3 pr-4 align-top leading-relaxed">{row.tool}</td>
                    <td className="py-3 pr-4 align-top leading-relaxed text-muted-foreground">
                      {row.does}
                    </td>
                    <td className="py-3 align-top leading-relaxed text-muted-foreground">
                      {row.stops}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <footer className="space-y-4 border-t border-border pt-8 text-sm leading-relaxed text-muted-foreground">
        <p className="max-w-[68ch]">
          Built for ETHOnline 2026 on Hedera testnet, chain 296.
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <a
            href="https://github.com/mericcintosun/detent"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center underline decoration-hairline underline-offset-4 hover:text-foreground"
          >
            Source on GitHub
          </a>
          <a
            href="https://ethglobal.com/events/ethonline2026"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center underline decoration-hairline underline-offset-4 hover:text-foreground"
          >
            ETHOnline 2026
          </a>
        </div>
      </footer>
    </div>
  );
}
