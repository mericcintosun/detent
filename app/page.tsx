import type { Metadata } from "next";
import { OperationsConsole } from "@/components/operations-console";
import { Button } from "@/components/ui/button";
import { getRegisterSnapshot } from "@/lib/register";

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

export default async function ConsolePage() {
  const snapshot = await getRegisterSnapshot();

  return (
    <div className="space-y-16">
      <OperationsConsole snapshot={snapshot} />

      <section id="brief" className="max-w-[68ch] space-y-8 border-t border-border pt-10">
        {/* The lead ends in the control rather than carrying it mid-prose, so
            there is one way into DEMO step 1 from this fold. */}
        <div className="space-y-5">
          <p className="text-lg leading-relaxed">
            Detent is the operator console for a tokenized security. It is built
            for the person who actually presses send on a corporate action: the
            fund administrator, the transfer agent, the issuer&apos;s ops lead.
            They read the coupon run line by line on this page, and the plan they
            accepted becomes the only thing the treasury key is allowed to sign.
          </p>
          <Button variant="outline" asChild>
            <a href="#register">Start at the register</a>
          </Button>
        </div>

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
        <h2 className="text-2xl tracking-tight">How it differs from a simulator</h2>
        <p className="leading-relaxed text-muted-foreground">
          Tenderly and the Safe integration built on it show you the outcome
          before you sign, but the simulation and the signature are two separate
          events, so what you previewed and what you signed can differ. The
          Fireblocks policy engine is written up front by an administrator and
          the rules persist across every transaction. OpenZeppelin Defender puts
          proposals through an approval flow on a multisig or a relayer, without
          any ERC-1400 semantics for who is eligible to receive a coupon. Detent
          takes the narrow slice none of them cover: the preview itself becomes
          the signing limit, it exists for exactly one corporate action, and it
          is gone afterwards.
        </p>
      </section>

      <footer className="space-y-4 border-t border-border pt-8 text-sm leading-relaxed text-muted-foreground">
        <p className="max-w-[68ch]">
          Built for ETHOnline 2026 on Hedera testnet, chain 296. Asset
          Tokenization Studio for the security, Privy server wallets, policies
          and key quorums for the treasury key, HashScan for the receipts.
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
