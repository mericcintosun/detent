// How the preview becomes the signing limit.
//
// Static server page: the three step strip, the "why this exists" prose and the
// simulator comparison table move here from app/page.tsx, which keeps only a
// compact hero and a link to this route. Every claim here is traceable to
// README.md, SECURITY.md and the files it names; nothing here states a live
// result the code has not produced.

import type { Metadata } from "next";
import Link from "next/link";
import { ArchitectureDiagram } from "@/components/content/architecture-diagram";
import { Callout, PageHeader, Section } from "@/components/design";
import { Plate, type PlateName } from "@/components/plates";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How Detent turns a corporate action preview into the treasury key's signing limit: three steps, one architecture, one policy that dies with the transaction.",
  alternates: { canonical: "/how-it-works" },
};

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

export default function HowItWorksPage() {
  return (
    <div className="mx-auto flex max-w-content flex-col">
      <Reveal as="div" variant="wipe" trigger="mount">
        <PageHeader
          eyebrow="How it works"
          title="The preview is the signing limit"
          description="Detent reads a corporate action, replays it off chain, and compiles what the operator accepted into the one transaction the treasury key is allowed to sign."
          actions={
            <>
              <Link href="/" className={buttonVariants({ variant: "default" })}>
                Open the console
              </Link>
              <Link
                href="/security"
                className={buttonVariants({ variant: "outline" })}
              >
                Read the security model
              </Link>
            </>
          }
        />
      </Reveal>

      <Section
        id="problem"
        heading="The problem with a general purpose key"
        description="A treasury key that can sign anything the token contract exposes is not narrowed by reading an explorer first."
      >
        <p className="max-w-measure-lg text-body leading-relaxed text-muted-foreground">
          Whoever runs a tokenized security spends the quarter on operations
          that cannot be taken back: coupon distributions, court ordered
          transfers, freezing a screened address, redemptions. The register is
          live, the amounts are real, and the key that signs has rights over the
          whole contract. Today the step before signing is reading an explorer
          or trusting a script, and a wrong parameter, a lapsed allowlist entry
          or a thin treasury only shows up after the transaction lands.
        </p>
      </Section>

      <Section
        id="steps"
        heading="Three steps"
        description="No number below is invented for this page: the two approvals are the two registered officers in lib/data.ts, and nothing else is counted."
      >
        <Stagger as="ol" className="grid gap-6 sm:grid-cols-3">
          {steps.map((step) => (
            <StaggerItem
              as="li"
              key={step.term}
              className="flex flex-col gap-3"
            >
              <div className="detent-band detent-ruled flex items-center justify-center border border-border px-4 py-5">
                <Plate
                  name={step.plate}
                  width={160}
                  height={120}
                  className="h-20 w-auto"
                />
              </div>
              <p className="detent-label">{step.term}</p>
              <p className="text-body-sm leading-relaxed text-muted-foreground">
                {step.sentence}
              </p>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      <Section
        id="architecture"
        heading="Architecture"
        description="Every box below is a file in this repository or a network it talks to. Read top to bottom: this is the order one plan actually moves through."
      >
        <ArchitectureDiagram className="max-w-measure-lg" />
        <Callout
          tone="mirror"
          title="What has run, and what has not"
          className="mt-8 max-w-measure-lg"
        >
          Steps 2 through 4 run today, locally, on every visit: the plan engine,
          the policy compiler and the local evaluator are real code under test,
          not a mock. Step 1 runs against Hedera testnet only when an ATS token
          address is configured; without one the console serves a cached
          register and says so. Steps 5 and 6 run against{" "}
          <code className="font-mono">PlanAnchor</code> and a live Privy server
          wallet only once both are deployed and configured; until then the app
          renders its documented unwired state rather than implying a record it
          does not have. See{" "}
          <Link
            href="/security"
            className="underline decoration-hairline underline-offset-4 hover:decoration-foreground"
          >
            the security model
          </Link>{" "}
          for the exact line between the two.
        </Callout>
      </Section>

      <Section
        id="sponsors"
        heading="Built on two sponsor platforms"
        description="Stated plainly, with the file that does the work next to each claim."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="border border-border bg-card p-5">
            <p className="detent-label">Hedera, Asset Tokenization Studio</p>
            <p className="pt-2 text-body-sm leading-relaxed text-muted-foreground">
              The security is modelled as an ATS equity token on Hedera testnet.{" "}
              <code className="font-mono">lib/hedera.ts</code> reads{" "}
              <code className="font-mono">balanceOfByPartition</code> (ERC-1410)
              for every holder and asks{" "}
              <code className="font-mono">canTransferByPartition</code> whether
              a credit from the treasury would clear, over the Hashio JSON-RPC
              relay.{" "}
              <code className="font-mono">contracts/src/PlanAnchor.sol</code>{" "}
              anchors each approved plan hash before the policy opens and
              settles it after, so HashScan carries the record once the contract
              is deployed.
            </p>
          </div>
          <div className="border border-border bg-card p-5">
            <p className="detent-label">Privy, server wallets and policies</p>
            <p className="pt-2 text-body-sm leading-relaxed text-muted-foreground">
              <code className="font-mono">lib/privy.ts</code> compiles an
              approved plan into a wallet policy pinning chain id, contract,
              function and partition, installs it on the treasury server wallet
              under a key quorum of two, and revokes it once the transaction is
              decided. The exact calldata, which Privy&apos;s conditions cannot
              compare for an array of holders and amounts, is enforced by this
              server before the request ever reaches the wallet.
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="comparison"
        heading="How this differs from a simulator"
        description="A simulation next to a signature is not the same thing as a policy that only allows the transaction you read."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tool</TableHead>
              <TableHead>What it does</TableHead>
              <TableHead>Where it stops</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparison.map((row) => (
              <TableRow key={row.tool}>
                <TableCell className="whitespace-normal align-top font-medium text-foreground">
                  {row.tool}
                </TableCell>
                <TableCell className="whitespace-normal align-top text-muted-foreground">
                  {row.does}
                </TableCell>
                <TableCell className="whitespace-normal align-top text-muted-foreground">
                  {row.stops}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section
        id="try"
        heading="Try it"
        description="No keys, no wallet connector, no sign-up."
      >
        <Link href="/" className={buttonVariants({ variant: "default" })}>
          Open the console
        </Link>
      </Section>
    </div>
  );
}
