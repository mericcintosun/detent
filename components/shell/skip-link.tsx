import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

/** The first tab stop on every page. Invisible until it holds focus. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className={cn(
        buttonVariants({ variant: "default" }),
        "sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-(--z-tooltip) focus:shadow-xl",
      )}
    >
      Skip to content
    </a>
  );
}
