"use client";

import { ListIcon } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

// The sheet (the Base UI dialog, focus trap and scroll lock) loads on the first
// tap and is kept mounted after that, so the close animation can play.
const MobileMenuSheet = dynamic(() => import("./mobile-menu-sheet"), {
  ssr: false,
});

/**
 * The same items as the rail, in a sheet. `status` is the server rendered run
 * mode block, passed through as children so no server module enters this file.
 */
export function MobileMenu({ status }: { status: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState(pathname);
  // A navigation from inside the sheet closes it.
  if (open && openedAt !== pathname) {
    setOpen(false);
    setOpenedAt(pathname);
  }
  const close = () => setOpen(false);

  return (
    <>
      <Button
        ref={trigger}
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Open the menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setRequested(true);
          setOpen(true);
          setOpenedAt(pathname);
        }}
      >
        <ListIcon aria-hidden="true" className="size-5" />
      </Button>
      {requested ? (
        <MobileMenuSheet
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            setOpenedAt(pathname);
          }}
          onNavigate={close}
          finalFocus={trigger}
          status={status}
        />
      ) : null}
    </>
  );
}
