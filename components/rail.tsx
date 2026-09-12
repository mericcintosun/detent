import Image from "next/image";
import Link from "next/link";
import { SectionProgress } from "@/components/section-progress";
import { Button } from "@/components/ui/button";
import { security } from "@/lib/data";
import { tokenExplorerHref } from "@/lib/hashscan";
import { shortHex } from "@/lib/plan";
import {
  ADAPTER_MODE,
  ATS_TOKEN_ADDRESS,
  CHAIN_ID,
  PLAN_ANCHOR_ADDRESS,
} from "@/lib/public-config";

/** The security policy, in the shared shell so both routes reach it. */
const SECURITY_POLICY_URL =
  "https://github.com/mericcintosun/detent/blob/main/SECURITY.md";

/**
 * A link in a hairline row is a few pixels of ink, so every one of them carries
 * a 44px box of its own. Same idiom as the footer in app/page.tsx and the rail
 * sections in components/section-progress.tsx, so nothing new is introduced:
 * inline-flex keeps the text on the row's baseline and only the hit area grows.
 */
const ROW_LINK =
  "inline-flex min-h-11 items-center underline decoration-hairline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The token address this deployment would actually read, or undefined when the
 * console is on the cached register.
 *
 * Same condition as useLiveRegister() in lib/adapter.ts, stated here because the
 * rail is a server component in the shared shell and must not pull the adapter,
 * lib/hedera.ts or any secret into its graph. The seed address in lib/data.ts is
 * a fixture: Hedera testnet returns eth_getCode = 0x for it and HashScan renders
 * a 404, so it is never a link.
 */
const LIVE_TOKEN_ADDRESS =
  ADAPTER_MODE === "real" ? ATS_TOKEN_ADDRESS : undefined;

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
  const securityHref = tokenExplorerHref(LIVE_TOKEN_ADDRESS, "on-chain");
  const anchorHref = tokenExplorerHref(PLAN_ANCHOR_ADDRESS, "on-chain");

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
        {/* The explorer link belongs to the live read and to nothing else. On
            the cached register the address is a seed literal HashScan has
            never heard of, and a link to an empty explorer page is worse than
            no link, so the seed branch says what the address is in plain
            text. Same rule as the masthead in the console. */}
        <dd className="text-right">
          {securityHref ? (
            <a
              href={securityHref}
              target="_blank"
              rel="noopener noreferrer"
              title={LIVE_TOKEN_ADDRESS}
              className={ROW_LINK}
            >
              {security.symbol} on HashScan
            </a>
          ) : (
            <span title={security.address}>
              {security.symbol}, seed address not on chain
            </span>
          )}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="detent-label">Anchor</dt>
        <dd className="text-right">
          {anchorHref && PLAN_ANCHOR_ADDRESS ? (
            <a
              href={anchorHref}
              target="_blank"
              rel="noopener noreferrer"
              title={PLAN_ANCHOR_ADDRESS}
              className={ROW_LINK}
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
        <dd className="text-right">
          <a
            href={SECURITY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={ROW_LINK}
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
        {/* No aria-current here: the rail is in the shared shell, so this same
            link renders on /record/[planHash] where it is not the current
            page. A wrong aria-current is worse than none. */}
        <Link
          href="/"
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

        {/* The same six anchors Phase 8 shipped, in the same scrolling row below
            lg and the same stacked column at lg. What is new is that the rail
            says which one you are in: components/section-progress.tsx owns the
            observer, and the markup renders identically with JavaScript off. */}
        <SectionProgress sections={sections} />

        {/* Dropped below lg on purpose: at that width the plan table is already
            the next thing on screen, so a full-bleed gold block would only push
            the product down. */}
        <Button
          asChild
          size="lg"
          className="hidden w-full lg:mt-auto lg:inline-flex"
        >
          <a href="#plan">Open the Q3 coupon run</a>
        </Button>

        <div className="hidden border-t border-border pt-5 lg:block">
          <AboutSecurity />
        </div>
      </div>
    </aside>
  );
}
