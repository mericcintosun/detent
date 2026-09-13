// Fund a Hedera testnet account, then deploy PlanAnchor and issue the ATS
// token against it.
//
// Nothing on this page reads a local env file: every address and every key
// name below is either a public network constant or a literal variable name
// copied from .env.example, never a value pulled from process.env. A private
// key and a deployer address never belong on a public page.

import type { Metadata } from "next";
import Link from "next/link";
import {
  Callout,
  CodeBlock,
  ExternalLink,
  KeyValue,
  KeyValueList,
  PageHeader,
  Section,
} from "@/components/design";
import { Reveal } from "@/components/motion";
import { buttonVariants } from "@/components/ui/button-variants";
import { CHAIN_ID, HASHSCAN_BASE, HEDERA_RPC_URL } from "@/lib/public-config";

export const metadata: Metadata = {
  title: "Faucet",
  description:
    "Fund a Hedera testnet account, then deploy PlanAnchor and issue the ATS equity token against it.",
  alternates: { canonical: "/faucet" },
};

const FAUCET_URL = "https://portal.hedera.com/faucet";
const PORTAL_URL = "https://portal.hedera.com";
const ATS_DOCS_URL = "https://docs.hedera.com/solutions/tokenization/ats";
const ATS_REPO_URL = "https://github.com/hashgraph/asset-tokenization-studio";
const CONTRACTS_README_URL =
  "https://github.com/mericcintosun/detent/blob/main/contracts/README.md";

export default function FaucetPage() {
  return (
    <div className="mx-auto flex max-w-content flex-col">
      <Reveal as="div" variant="wipe" trigger="mount">
        <PageHeader
          eyebrow="Testnet funding"
          title="Get a Hedera testnet account funded"
          description="PlanAnchor and the ATS equity token both need a funded Hedera testnet account before they can be deployed. This page is the funding step; the deploy commands live in the repository."
          actions={
            <>
              <ExternalLink href={FAUCET_URL}>
                Open the official faucet
              </ExternalLink>
              <a
                href="#deploy"
                className={buttonVariants({ variant: "outline" })}
              >
                Deployment steps
              </a>
            </>
          }
        />
      </Reveal>

      <Section
        id="steps"
        heading="Fund an account"
        description="No token is issued and no contract is deployed from this app: both are commands run from a terminal with a funded key."
      >
        <ol className="flex flex-col gap-6">
          <li className="border border-border bg-card p-5">
            <p className="detent-label">Step 1</p>
            <p className="pt-2 text-body-sm leading-relaxed text-muted-foreground">
              Get an EVM-compatible Hedera testnet address. Foundry&apos;s
              encrypted keystore works well for a deploy key and never puts the
              raw key on a command line or in shell history:
            </p>
            <CodeBlock
              className="mt-3"
              label="Import a deploy key into Foundry"
              code="cast wallet import detent-operator --interactive"
            />
          </li>
          <li className="border border-border bg-card p-5">
            <p className="detent-label">Step 2</p>
            <p className="pt-2 text-body-sm leading-relaxed text-muted-foreground">
              Open the official{" "}
              <ExternalLink href={FAUCET_URL}>
                Hedera portal faucet
              </ExternalLink>{" "}
              and paste that address in. It funds an EVM address with testnet
              HBAR once a day with no account and no sign-up, after a human
              check. A deploy plus a smoke test of PlanAnchor costs under 2
              HBAR; issuing the ATS token through its factory costs more,
              roughly 40 to 120 HBAR depending on the gas limits used.
            </p>
          </li>
          <li className="border border-border bg-card p-5">
            <p className="detent-label">Step 3</p>
            <p className="pt-2 text-body-sm leading-relaxed text-muted-foreground">
              Confirm the balance landed by searching the address on{" "}
              <ExternalLink href={HASHSCAN_BASE}>HashScan</ExternalLink>,
              Hedera&apos;s block explorer for chain {CHAIN_ID}.
            </p>
          </li>
        </ol>
      </Section>

      <Section
        id="deploy"
        heading="Deploy PlanAnchor"
        description="Two Foundry commands, run from contracts/, both against the funded account from step 1."
      >
        <p className="max-w-measure-lg text-body-sm leading-relaxed text-muted-foreground">
          The full deploy and smoke test commands are in{" "}
          <ExternalLink href={CONTRACTS_README_URL}>
            contracts/README.md
          </ExternalLink>
          . Both need <code className="font-mono">--legacy</code> because the
          Hedera relay rejects typed transactions. After the smoke test passes,
          set <code className="font-mono">NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS</code>{" "}
          to the deployed address.
        </p>
      </Section>

      <Section
        id="ats"
        heading="Issue the ATS equity token"
        description="A separate step, through Hedera's own Asset Tokenization Studio, not through this app."
      >
        <p className="max-w-measure-lg text-body-sm leading-relaxed text-muted-foreground">
          Detent reads an already issued ATS token; it does not issue one.
          Deploy the equity through the ATS factory following{" "}
          <ExternalLink href={ATS_DOCS_URL}>
            Hedera&apos;s ATS documentation
          </ExternalLink>{" "}
          or the{" "}
          <ExternalLink href={ATS_REPO_URL}>
            asset-tokenization-studio
          </ExternalLink>{" "}
          source, add the issuer, grant KYC and add each holder to the control
          list, then issue balances on the default partition. Point Detent at
          the result with the variables below.
        </p>
      </Section>

      <Section
        id="env"
        heading="Environment variables"
        description="Names only, copied from .env.example. Every value in that file ships empty; nothing here is a real address or a real key."
      >
        <KeyValueList>
          <KeyValue label="Chain id" mono>
            NEXT_PUBLIC_CHAIN_ID
          </KeyValue>
          <KeyValue label="RPC relay" mono>
            NEXT_PUBLIC_HEDERA_RPC_URL
          </KeyValue>
          <KeyValue label="ATS equity token" mono>
            NEXT_PUBLIC_ATS_TOKEN_ADDRESS
          </KeyValue>
          <KeyValue label="Compliance check sender" mono>
            NEXT_PUBLIC_ATS_CHECK_FROM_ADDRESS
          </KeyValue>
          <KeyValue label="Partition" mono>
            NEXT_PUBLIC_ATS_PARTITION
          </KeyValue>
          <KeyValue label="PlanAnchor address" mono>
            NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS
          </KeyValue>
          <KeyValue label="PlanAnchor deploy key, server only" mono>
            OPERATOR_PRIVATE_KEY
          </KeyValue>
        </KeyValueList>
        <Callout
          tone="warning"
          title="Never commit a real key"
          className="mt-6 max-w-measure-lg"
        >
          <code className="font-mono">.env.example</code> is committed, so a
          real key pasted into it ships to everyone who clones the repository.
          Keep every deploy key in <code className="font-mono">.env.local</code>
          , which is gitignored, and use a testnet-only key that holds no value
          beyond the HBAR needed for these two deploys.
        </Callout>
      </Section>

      <Section
        id="network"
        heading="Network facts"
        description="The same constants the app reads, so this page cannot drift from the running code."
      >
        <KeyValueList>
          <KeyValue label="Chain" mono>
            Hedera testnet, chain {CHAIN_ID}
          </KeyValue>
          <KeyValue label="RPC relay" mono>
            {HEDERA_RPC_URL}
          </KeyValue>
          <KeyValue label="Explorer">
            <ExternalLink href={HASHSCAN_BASE}>{HASHSCAN_BASE}</ExternalLink>
          </KeyValue>
          <KeyValue label="Portal">
            <ExternalLink href={PORTAL_URL}>{PORTAL_URL}</ExternalLink>
          </KeyValue>
        </KeyValueList>
      </Section>

      <Section id="back" heading="Back to the console">
        <Link href="/" className={buttonVariants({ variant: "default" })}>
          Open the console
        </Link>
      </Section>
    </div>
  );
}
