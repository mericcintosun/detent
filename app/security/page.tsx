// The security model, stated from the code rather than from intent.
//
// Every claim below is traceable to SECURITY.md, README.md or the file it
// names. Where a value depends on configuration (the ATS token, PlanAnchor),
// this page reads the same client safe constants the console and the rail
// read, and prints the honest "not configured" state instead of a fabricated
// address. Server component: nothing here needs a client bundle.

import type { Metadata } from "next";
import Link from "next/link";
import {
  AddressText,
  Callout,
  ExternalLink,
  KeyValue,
  KeyValueList,
  PageHeader,
  Section,
} from "@/components/design";
import { Reveal } from "@/components/motion";
import { buttonVariants } from "@/components/ui/button-variants";
import { tokenExplorerHref } from "@/lib/hashscan";
import {
  ADAPTER_MODE,
  ATS_TOKEN_ADDRESS,
  CHAIN_ID,
  HASHSCAN_BASE,
  HEDERA_RPC_URL,
  PLAN_ANCHOR_ADDRESS,
} from "@/lib/public-config";

export const metadata: Metadata = {
  title: "Security",
  description:
    "What Detent enforces on the server, in the wallet policy and in the contract, and what has not run against a live network yet.",
  alternates: { canonical: "/security" },
};

const REPO_URL = "https://github.com/mericcintosun/detent";
const SECURITY_POLICY_URL = `${REPO_URL}/blob/main/SECURITY.md`;

/** Same rule as components/rail.tsx: a seed address never becomes a link. */
const liveTokenAddress =
  ADAPTER_MODE === "real" ? ATS_TOKEN_ADDRESS : undefined;

export default function SecurityPage() {
  return (
    <div className="mx-auto flex max-w-content flex-col">
      <Reveal as="div" variant="wipe" trigger="mount">
        <PageHeader
          eyebrow="Security model"
          title="What is enforced, and what is not"
          description="Testnet only, nothing audited. This states what the server, the wallet policy and the contract each guarantee, and names the two paths that have not run against a live network."
          actions={
            <>
              <ExternalLink href={SECURITY_POLICY_URL}>
                Read the source
              </ExternalLink>
              <Link href="/" className={buttonVariants({ variant: "outline" })}>
                Open the console
              </Link>
            </>
          }
        />
      </Reveal>

      <Section
        id="enforcement"
        heading="What is enforced, and where"
        description="Four layers, each covering what the one before it cannot."
      >
        <KeyValueList>
          <KeyValue label="The server derives the plan" stacked>
            <code className="font-mono">POST /api/detent</code> rebuilds the
            plan from the register snapshot this server reads, not from the
            request body, and refuses with{" "}
            <code className="font-mono">plan_mismatch</code> when the submitted
            plan hash, calldata, target or chain differ from what the server
            derives. Blockers are enforced on both the lock and the submit step
            from that server derived plan.
          </KeyValue>
          <KeyValue label="Lock ids are server minted" stacked>
            A lock id is 24 random bytes minted by{" "}
            <code className="font-mono">lib/store.ts</code>, never a value the
            client chose. A submit whose lock this server instance does not
            hold, recycled, expired after fifteen minutes, or never issued, is
            refused with <code className="font-mono">lock_unknown</code> rather
            than recompiled from whatever the client sent.
          </KeyValue>
          <KeyValue label="The approval quorum" stacked>
            Two approvals are required, each resolved against the registered
            officers in <code className="font-mono">lib/data.ts</code>, and no
            officer counts twice. This is a registry check, not authentication:
            there is no session and no signature over an approval, so it proves
            the request named two distinct registered officers, not that either
            of them approved anything.
          </KeyValue>
          <KeyValue label="Rate limiting and the operator token" stacked>
            A fixed window limiter keyed by client address allows 30 requests a
            minute and 6 lock attempts a minute, held in one process&apos;s
            memory with a ceiling on tracked addresses. When{" "}
            <code className="font-mono">OPERATOR_API_TOKEN</code> is set, the
            lock intent also requires it in the{" "}
            <code className="font-mono">x-detent-operator</code> header. Unset,
            the lock is open, which is the keyless demo posture.
          </KeyValue>
          <KeyValue
            label="The wallet policy pins what Privy can compare"
            stacked
          >
            The installed policy pins chain id, the target contract, and the
            function and partition through Privy&apos;s calldata condition.
            Privy&apos;s documented conditions cannot compare an array of
            holders and amounts, so for a coupon those two arguments are not
            constrained by the wallet: the exact calldata, byte for byte, is
            checked by this server before a submitted payload ever reaches the
            wallet.
          </KeyValue>
          <KeyValue label="Policy cleanup" stacked>
            A send that lands, a send that fails, a send that times out, an
            attach that is refused and a lock that expires unspent all write the
            wallet&apos;s previous policy list back and delete the policy.
            Nothing is left attached to the treasury key once its one
            transaction is decided.
          </KeyValue>
        </KeyValueList>
      </Section>

      <Section
        id="not-verified"
        heading="Not verified live"
        description="Stated exactly as README.md and SECURITY.md state it: written and tested, not run against a live service."
      >
        <Callout
          tone="warning"
          title="No live credentials exist in this environment"
        >
          Every Privy call is covered by offline tests of its exact request
          shape and by a dry run against a local mock that enforces the
          published request shapes, the owner signature and idempotency. Neither
          is a run against the real Privy engine, so the condition value formats
          it expects have not been confirmed live.
        </Callout>
        <ul className="mt-6 flex flex-col gap-4 text-body-sm leading-relaxed text-muted-foreground">
          <li>
            <strong className="text-foreground">The register read.</strong>{" "}
            <code className="font-mono">lib/hedera.ts</code> issues real reads
            over Hashio, but no token has been issued for this submission, so
            the recorded run serves the cached register in{" "}
            <code className="font-mono">fixtures/register.seed.json</code> and
            labels it as cached.
          </li>
          <li>
            <strong className="text-foreground">The signature.</strong> With no
            Privy credentials set, the same policy evaluator answers locally,
            which is why the demo produces a real refusal with no keys and no
            broadcast.
          </li>
          <li>
            <strong className="text-foreground">The on chain record.</strong>{" "}
            <code className="font-mono">PlanAnchor</code> has 37 Foundry tests
            passing, 9 of them fuzz, but has not been deployed. The console and{" "}
            <code className="font-mono">/record/[planHash]</code> both name that
            state on screen rather than implying a record that does not exist.
          </li>
        </ul>
      </Section>

      <Section
        id="addresses"
        heading="Contracts and chain"
        description="Read live from lib/public-config.ts. An address prints as plain text, never a link, until it exists on chain."
      >
        <KeyValueList>
          <KeyValue label="Network" mono>
            Hedera testnet, chain {CHAIN_ID}
          </KeyValue>
          <KeyValue label="RPC relay" mono>
            {HEDERA_RPC_URL}
          </KeyValue>
          <KeyValue label="Explorer">
            <ExternalLink href={HASHSCAN_BASE}>{HASHSCAN_BASE}</ExternalLink>
          </KeyValue>
          <KeyValue label="ATS equity token">
            {liveTokenAddress ? (
              <AddressText
                address={liveTokenAddress}
                label="ATS equity token address"
                href={tokenExplorerHref(liveTokenAddress, "on-chain")}
              />
            ) : (
              "Not configured for this deployment: the console serves the cached register."
            )}
          </KeyValue>
          <KeyValue label="PlanAnchor">
            {PLAN_ANCHOR_ADDRESS ? (
              <AddressText
                address={PLAN_ANCHOR_ADDRESS}
                label="PlanAnchor contract address"
                href={tokenExplorerHref(PLAN_ANCHOR_ADDRESS, "on-chain")}
              />
            ) : (
              "Not deployed yet: the record route renders its unwired state."
            )}
          </KeyValue>
        </KeyValueList>
      </Section>

      <Section
        id="report"
        heading="Report a problem"
        description="This is a testnet hackathon build with no user funds at risk, so there is no bounty programme."
      >
        <p className="max-w-measure-lg text-body-sm leading-relaxed text-muted-foreground">
          Open an issue on the repository. The full policy, including what the
          API route trusts on a public request and how a Privy owned resource is
          authorized, is in{" "}
          <ExternalLink href={SECURITY_POLICY_URL}>SECURITY.md</ExternalLink>.
        </p>
        <div className="pt-4">
          <ExternalLink href={REPO_URL}>Source on GitHub</ExternalLink>
        </div>
      </Section>
    </div>
  );
}
