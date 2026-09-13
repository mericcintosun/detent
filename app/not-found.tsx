import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/design/page-header";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "No page here",
  description: "There is no Detent page at this address.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex max-w-measure-xl flex-col gap-10 py-8 lg:py-16">
      <PageHeader
        eyebrow="Error 404"
        title="There is no page here"
        description="The address does not match a Detent page. A plan record lives at /record/ followed by its plan hash: 0x and 64 hexadecimal characters, exactly as the audit record prints it."
        meta={
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "border-input",
            )}
          >
            Back to the console
          </Link>
        }
      />
      <p className="max-w-measure-md text-body-sm text-muted-foreground">
        Press <kbd className="font-mono text-foreground">Ctrl K</kbd> or{" "}
        <kbd className="font-mono text-foreground">⌘ K</kbd> to search every
        page and console section, or to paste a plan hash and open its record.
      </p>
    </div>
  );
}
