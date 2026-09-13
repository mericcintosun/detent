// Privacy, stated only as what the code does.
//
// Every claim below was checked by reading the code, not by policy boilerplate:
// no analytics or cookie library appears anywhere in app/, components/ or lib/,
// next-themes writes one key to localStorage, and the rate limiter's client
// address lives in one process's memory for one minute. See the comment above
// each Section for where the fact was checked.

import type { Metadata } from "next";
import Link from "next/link";
import {
  KeyValue,
  KeyValueList,
  PageHeader,
  Section,
} from "@/components/design";
import { Reveal } from "@/components/motion";
import { buttonVariants } from "@/components/ui/button-variants";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Detent actually does with data: no cookies, no analytics, one theme choice in local storage, and what the server keeps in memory and for how long.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex max-w-content flex-col">
      <Reveal as="div" variant="wipe" trigger="mount">
        <PageHeader
          eyebrow="Privacy"
          title="What Detent does with data"
          description="Short and literal. Every line below was checked against the code, not written from a template."
        />
      </Reveal>

      <Section
        id="tracking"
        heading="No cookies, no analytics"
        description="Checked by searching app/, components/ and lib/ for a cookie or analytics library. Nothing was found."
      >
        <p className="max-w-measure-lg text-body-sm leading-relaxed text-muted-foreground">
          Detent sets no cookie and loads no analytics, tracking pixel or third
          party script. There is no{" "}
          <code className="font-mono">document.cookie</code> write anywhere in
          the app, and no analytics package is a dependency in{" "}
          <code className="font-mono">package.json</code>.
        </p>
      </Section>

      <Section
        id="local-storage"
        heading="What your browser stores"
        description="One key, written by the theme library this app uses."
      >
        <KeyValueList>
          <KeyValue label="localStorage key" mono>
            theme
          </KeyValue>
          <KeyValue label="Value">
            <code className="font-mono">light</code>,{" "}
            <code className="font-mono">dark</code> or{" "}
            <code className="font-mono">system</code>, whichever you last chose
            in the theme toggle.
          </KeyValue>
          <KeyValue label="Who reads it">
            Only your browser. next-themes writes and reads this key locally and
            sends it nowhere.
          </KeyValue>
        </KeyValueList>
      </Section>

      <Section
        id="server-memory"
        heading="What the server keeps, and for how long"
        description="Everything below lives in the memory of one running server process. Nothing here is a database, and nothing here survives a restart."
      >
        <KeyValueList>
          <KeyValue label="Rate limiting" stacked>
            The client address the request arrived with (from a proxy header, or
            unknown if there is none), kept only to count requests against a one
            minute window, up to 2,000 distinct addresses tracked before the
            oldest is dropped. It is never written to disk and never appears in
            a log line.
          </KeyValue>
          <KeyValue label="The lock record" stacked>
            The compiled policy, the approved calldata and the two approving
            officer ids for a plan in progress, held for up to fifteen minutes
            or until the plan is sent, whichever comes first.
          </KeyValue>
          <KeyValue label="The submission ledger" stacked>
            A completed send&apos;s result, kept for thirty minutes so a retry
            returns the same answer instead of sending twice, up to 500 entries.
          </KeyValue>
        </KeyValueList>
      </Section>

      <Section
        id="logs"
        heading="What is logged"
        description="Operational lines only: what happened, not who asked."
      >
        <p className="max-w-measure-lg text-body-sm leading-relaxed text-muted-foreground">
          The server logs one line per meaningful step: a plan hash, a policy
          id, a lock id, an error code and an HTTP status. It does not log the
          client address that rate limiting uses, and it does not log request
          bodies. The host this app runs on, like any web host, keeps its own
          request logs for operating the service; that logging is the
          platform&apos;s, not this application&apos;s code.
        </p>
      </Section>

      <Section id="back" heading="Back to the console">
        <Link href="/" className={buttonVariants({ variant: "default" })}>
          Back to the console
        </Link>
      </Section>
    </div>
  );
}
