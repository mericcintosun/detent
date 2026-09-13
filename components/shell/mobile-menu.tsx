"use client";

import { GithubLogoIcon, ListIcon } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ConsoleSections } from "./console-sections";
import { SOURCE_URL } from "./nav";
import { PrimaryNav } from "./primary-nav";

/**
 * The same items as the rail, in a sheet. `status` is the server rendered run
 * mode block, passed through as children so no server module enters this file.
 */
export function MobileMenu({ status }: { status: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState(pathname);
  // A navigation from inside the sheet closes it.
  if (open && openedAt !== pathname) {
    setOpen(false);
    setOpenedAt(pathname);
  }
  const close = () => setOpen(false);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setOpenedAt(pathname);
      }}
    >
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open the menu"
          />
        }
      >
        <ListIcon aria-hidden="true" className="size-5" />
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full gap-0 duration-(--duration-base) ease-standard data-ending-style:duration-(--duration-fast) data-ending-style:ease-exit data-[side=right]:sm:max-w-sm"
      >
        <SheetHeader className="border-b border-border px-5 py-4 pr-14">
          <SheetTitle className="detent-label">Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Pages, console sections, run mode and theme.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-5 py-6">
          <PrimaryNav onNavigate={close} />
          <ConsoleSections onNavigate={close} showProgress={false} />
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
