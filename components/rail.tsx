import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { security } from "@/lib/data";
import { hashscanToken } from "@/lib/hedera";

// The five demo steps in DEMO.md land on the first five of these, in order.
const sections = [
  { href: "#register", label: "Register" },
  { href: "#plan", label: "Plan" },
  { href: "#policy", label: "Policy" },
  { href: "#send", label: "Send" },
  { href: "#ledger", label: "Audit record" },
  { href: "#brief", label: "Why it exists" },
];

export function Rail() {
  return (
    <aside className="border-b border-border bg-background lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col gap-8 px-6 py-6 lg:px-7 lg:py-9">
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

        <p className="max-w-[28ch] text-sm leading-relaxed text-muted-foreground">
          Operator console for tokenized securities. Preview the corporate
          action, then hold the treasury key to exactly that.
        </p>

        <nav
          aria-label="Console sections"
          className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 lg:flex-col lg:gap-y-3"
        >
          {sections.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="detent-label transition-colors hover:text-foreground"
            >
              {section.label}
            </a>
          ))}
        </nav>

        <Button asChild size="lg" className="w-full lg:mt-auto">
          <a href="#plan">Open the Q3 coupon run</a>
        </Button>

        <dl className="space-y-2 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="detent-label">Network</dt>
            <dd>Hedera testnet</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="detent-label">Security</dt>
            <dd>
              <a
                href={hashscanToken(security.address)}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-hairline underline-offset-4 hover:text-foreground"
              >
                {security.symbol} on HashScan
              </a>
            </dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
