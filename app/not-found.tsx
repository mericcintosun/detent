import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "No page here",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="max-w-[62ch] space-y-6 py-20">
      <p className="detent-label">Detent</p>
      <h1 className="text-4xl leading-[1.05] tracking-tight">
        There is no page here
      </h1>
      <p className="leading-relaxed text-muted-foreground">
        Detent is one console on one route. Every step of the coupon run lives
        on that page, under its own section.
      </p>
      <Button asChild variant="outline">
        <Link href="/">Back to the console</Link>
      </Button>
    </div>
  );
}
