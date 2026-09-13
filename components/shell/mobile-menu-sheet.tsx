"use client";

import { GithubLogoIcon } from "@phosphor-icons/react";
import type * as React from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConsoleSections } from "./console-sections";
import { SOURCE_URL } from "./nav";
import { PrimaryNav } from "./primary-nav";

/**
 * The body of the mobile menu. MobileMenu loads this file on the first tap, so
 * the dialog primitive, its focus management and the scroll lock stay out of
 * the first load bundle of every route.
 */
export default function MobileMenuSheet({
  open,
  onOpenChange,
  onNavigate,
  finalFocus,
  status,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: () => void;
  finalFocus: React.RefObject<HTMLButtonElement | null>;
  status: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        finalFocus={finalFocus}
        className="w-full gap-0 duration-(--duration-base) ease-standard data-ending-style:duration-(--duration-fast) data-ending-style:ease-exit data-[side=right]:sm:max-w-sm"
      >
        <SheetHeader className="border-b border-border px-5 py-4 pr-14">
          <SheetTitle className="detent-label">Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Pages, console sections, run mode and theme.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-5 py-6">
          <PrimaryNav onNavigate={onNavigate} />
          <ConsoleSections onNavigate={onNavigate} showProgress={false} />
          {status}
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-4">
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 text-body-sm text-muted-foreground underline decoration-hairline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <GithubLogoIcon aria-hidden="true" className="size-4" />
            Source
            <span className="sr-only"> on GitHub (opens in a new tab)</span>
          </a>
          <ThemeToggle />
        </div>
      </SheetContent>
    </Sheet>
  );
}
