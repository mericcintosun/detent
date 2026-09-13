import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The one brand mark. The rail and the top bar each carry it, but only one of
 * the two is displayed at any width, and next/image loads lazily, so a page
 * paints and downloads exactly one mark.
 */
export function BrandMark({
  size = "rail",
  className,
}: {
  size?: "rail" | "bar";
  className?: string;
}) {
  const pixels = size === "rail" ? 36 : 28;
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex min-h-11 items-center gap-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      <Image
        src="/brand/logo.png"
        alt=""
        width={pixels}
        height={pixels}
        className={size === "rail" ? "size-9" : "size-7"}
      />
      <span
        className={cn(
          "font-display leading-none text-foreground",
          size === "rail" ? "text-heading" : "text-body",
        )}
      >
        Detent
      </span>
    </Link>
  );
}
