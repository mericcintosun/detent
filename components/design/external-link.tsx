import { ArrowUpRightIcon } from "@phosphor-icons/react/ssr";
import type * as React from "react";
import { hashscanToken, hashscanTransaction } from "@/lib/hashscan";
import { cn } from "@/lib/utils";

export interface ExternalLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * A link that leaves Detent. Opens in a new tab without an opener, says so to
 * screen readers, and carries the 44px hit area of every link in a hairline row.
 */
export function ExternalLink({ href, children, className }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-slot="external-link"
      className={cn(
        "inline-flex min-h-11 items-center gap-1 text-foreground underline decoration-hairline underline-offset-4 hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {children}
      <ArrowUpRightIcon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export interface HashScanLinkProps {
  kind: "token" | "transaction";
  /** A value that exists on chain. Never pass a seed address or a synthetic reference. */
  value: string;
  children?: React.ReactNode;
  className?: string;
}

/** A HashScan link for a token contract or a transaction on Hedera testnet. */
export function HashScanLink({
  kind,
  value,
  children,
  className,
}: HashScanLinkProps) {
  const href =
    kind === "token" ? hashscanToken(value) : hashscanTransaction(value);
  return (
    <ExternalLink href={href} className={className}>
      {children ?? "Open on HashScan"}
    </ExternalLink>
  );
}
