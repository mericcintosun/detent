// Terms, kept to what is actually true of a hackathon demo on testnet.

import type { Metadata } from "next";
import Link from "next/link";
import {
  ExternalLink,
  KeyValue,
  KeyValueList,
  PageHeader,
  Section,
} from "@/components/design";
import { Reveal } from "@/components/motion";
import { buttonVariants } from "@/components/ui/button-variants";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "Detent is a hackathon demo on Hedera testnet, provided with no warranty and no real securities. MIT licensed.",
  alternates: { canonical: "/terms" },
};

const LICENSE_URL = "https://github.com/mericcintosun/detent/blob/main/LICENSE";

export default function TermsPage() {
  return (
    <div className="mx-auto flex max-w-content flex-col">
      <Reveal as="div" variant="wipe" trigger="mount">
        <PageHeader
          eyebrow="Terms"
          title="A hackathon demo, on testnet"
          description="Short and literal, the same standard as the privacy page."
        />
      </Reveal>

      <Section
        id="what-this-is"
        heading="What this is"
        description="Built for ETHOnline 2026, running on Hedera testnet, chain 296."
      >
        <p className="max-w-measure-lg text-body-sm leading-relaxed text-muted-foreground">
          Every holder, balance and transfer this app shows or produces is on a
          public test network with no real value. No token here represents a
          real security, a real share or a real claim on anything. Nothing in
          this product is investment advice, legal advice or a solicitation to
          buy or sell any asset, tokenized or otherwise.
        </p>
      </Section>

      <Section
        id="warranty"
        heading="No warranty"
        description="This is a hackathon build, written in a short window under a deadline and not audited."
      >
        <p className="max-w-measure-lg text-body-sm leading-relaxed text-muted-foreground">
          The app, the contract and every fixture in this repository are
          provided as is, with no warranty of any kind, express or implied,
          including no warranty of fitness for a particular purpose. Use of the
          live URL, the source or the contract is at your own risk.
        </p>
      </Section>

      <Section
        id="licence"
        heading="Licence"
        description="One licence covers the app, the contracts and the fixtures alike."
      >
        <KeyValueList>
          <KeyValue label="Licence">MIT</KeyValue>
          <KeyValue label="Full text">
            <ExternalLink href={LICENSE_URL}>LICENSE</ExternalLink>, in the
            repository root
          </KeyValue>
        </KeyValueList>
      </Section>

      <Section id="back" heading="Back to the console">
        <Link href="/" className={buttonVariants({ variant: "default" })}>
          Back to the console
        </Link>
      </Section>
    </div>
  );
}
