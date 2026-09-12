import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { security } from "@/lib/data";
import { hashscanToken } from "@/lib/hashscan";
import { shortHex } from "@/lib/plan";
import { CHAIN_ID, PLAN_ANCHOR_ADDRESS } from "@/lib/public-config";

/** The security policy, in the shared shell so both routes reach it. */
const SECURITY_POLICY_URL =
  "https://github.com/mericcintosun/detent/blob/main/SECURITY.md";

// The five demo steps in DEMO.md land on the first five of these, in order.
const sections = [
  { href: "#register", label: "Register" },
  { href: "#plan", label: "Plan" },
  { href: "#policy", label: "Policy" },
  { href: "#send", label: "Send" },
  { href: "#ledger", label: "Audit record" },
  { href: "#brief", label: "Why it exists" },
];

/**
 * About and security, lifted out of the rail so it stops eating the phone's
 * first screen. app/layout.tsx renders it once below the console, which keeps it
 * in the shared shell: it reaches / and /record/[planHash] alike, at every
 * width, and the rail shows the same rows again from lg up where the column has
 * the height to spare. Every value is reused, not re-derived.
 */
export function AboutSecurity({ className = "" }: { className?: string }) {
  return (
    <dl
      className={`grid gap-x-10 gap-y-2 text-xs leading-relaxed text-muted-foreground sm:grid-cols-2 lg:grid-cols-1 ${className}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <dt className="detent-label">Network</dt>
        <dd>Hedera testnet, chain {CHAIN_ID}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="detent-label">Security</dt>
        <dd>
          <a
            href={hashscanToken(security.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-hairline underline-offset-4 hover:text-foreground"
          >
            {security.symbol} on HashScan
          </a>
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="detent-label">Anchor</dt>
        <dd className="text-right">
          {PLAN_ANCHOR_ADDRESS ? (
            <a
              href={hashscanToken(PLAN_ANCHOR_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              title={PLAN_ANCHOR_ADDRESS}
              className="underline decoration-hairline underline-offset-4 hover:text-foreground"
            >
              {shortHex(PLAN_ANCHOR_ADDRESS, 8, 6)}
            </a>
          ) : (
            "Not deployed yet"
          )}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="detent-label">Source</dt>
        <dd>
          <a
            href={SECURITY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-hairline underline-offset-4 hover:text-foreground"
          >
            Source and security policy
          </a>
        </dd>
      </div>
    </dl>
  );
}

export function Rail() {
  return (
    <aside className="border-b border-border bg-background lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r">
      {/* Below lg this is a compact bar: mark, then one scrollable row of
          section links, and nothing else. The blurb, the CTA and the about
          block are all held behind lg, so the register masthead is on the
          phone's first screen. At lg and up nothing changes: solid ground,
          border-r hairline, persistent, sticky, full height. */}
      <div className="flex h-full flex-col gap-4 px-5 py-4 lg:gap-8 lg:px-7 lg:py-9">
        <Link
          href="/"
          aria-current="page"
          className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Image
            src="/brand/logo.png"
            alt=""
            width={44}
            height={44}
            priority
            className="h-11 w-11 object-contain"
          />
          <span className="font-display text-2xl tracking-tight">Detent</span>
        </Link>

        <p className="hidden max-w-[28ch] text-sm leading-relaxed text-muted-foreground lg:block">
          Operator console for tokenized securities. Preview the corporate
          action, then hold the treasury key to exactly that.
        </p>

        {/* The scroll lives in this wrapper, never on the page: the negative
            margin lets the row bleed to the edges so a half-cut label reads as
            "there is more", and it is undone at lg where the links stack. */}
        <nav
          aria-label="Console sections"
          className="-mx-5 overflow-x-auto border-t border-border px-5 pt-3 lg:mx-0 lg:overflow-x-visible lg:px-0 lg:pt-6"
        >
          <div className="flex w-max gap-x-6 lg:w-auto lg:flex-col lg:gap-y-3">
            {sections.map((section) => (
              <a
                key={section.href}
                href={section.href}
                // A wide-tracked small-caps label is three pixels of ink; the hit
                // area has to be its own thing on the scrolling mobile bar.
                className="detent-label inline-flex min-h-11 shrink-0 items-center whitespace-nowrap transition-colors hover:text-foreground"
              >
                {section.label}
              </a>
            ))}
          </div>
        </nav>

        {/* Dropped below lg on purpose: at that width the plan table is already
            the next thing on screen, so a full-bleed gold block would only push
            the product down. */}
        <Button asChild size="lg" className="hidden w-full lg:mt-auto lg:inline-flex">
          <a href="#plan">Open the Q3 coupon run</a>
        </Button>

        <div className="hidden border-t border-border pt-5 lg:block">
          <AboutSecurity />
        </div>
      </div>
    </aside>
  );
}
