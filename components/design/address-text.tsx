import { cn } from "@/lib/utils";
import { ExternalLink } from "./external-link";
import { HashText } from "./hash-text";

export interface AddressTextProps {
  address: string;
  /** "treasury address", "token contract". Defaults to "address". */
  label?: string;
  /**
   * An explorer URL. Pass one only for an address that exists on chain, which is
   * the rule lib/hashscan.ts enforces; a seed address gets no link.
   */
  href?: string | null;
  copyable?: boolean;
  className?: string;
}

/** An EVM address: 0x plus four, an ellipsis, the last four, copy and link. */
export function AddressText({
  address,
  label = "address",
  href,
  copyable = true,
  className,
}: AddressTextProps) {
  return (
    <span
      data-slot="address-text"
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-x-2",
        className,
      )}
    >
      <HashText
        value={address}
        label={label}
        lead={6}
        tail={4}
        copyable={copyable}
      />
      {href ? (
        <ExternalLink href={href} className="text-caption">
          HashScan
        </ExternalLink>
      ) : null}
    </span>
  );
}
