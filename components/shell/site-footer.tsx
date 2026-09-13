import Link from "next/link";
import { ExternalLink } from "@/components/design/external-link";
import { CHAIN_ID } from "@/lib/public-config";
import { ETHONLINE_URL, FOOTER_NAV, SOURCE_URL } from "./nav";

const FOOTER_LINK =
  "inline-flex min-h-11 items-center text-muted-foreground underline decoration-hairline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export function SiteFooter() {
  return (
    <footer className="border-t border-border px-gutter py-6">
      <div className="mx-auto flex w-full max-w-page flex-col gap-3 text-body-sm md:flex-row md:items-center md:justify-between md:gap-8">
        <p className="text-muted-foreground">
          Built for ETHOnline 2026 on Hedera testnet, chain {CHAIN_ID}.
        </p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center gap-x-6">
            {FOOTER_NAV.map(({ href, label }) => (
              <li key={href}>
                {/* No prefetch: these routes land with page-content. */}
                <Link href={href} prefetch={false} className={FOOTER_LINK}>
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <ExternalLink
                href={SOURCE_URL}
                className="text-muted-foreground hover:text-foreground"
              >
                Source on GitHub
              </ExternalLink>
            </li>
            <li>
              <ExternalLink
                href={ETHONLINE_URL}
                className="text-muted-foreground hover:text-foreground"
              >
                ETHOnline 2026
              </ExternalLink>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
