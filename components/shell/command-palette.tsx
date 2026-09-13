"use client";

import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

// The palette body (cmdk, the dialog, next-themes calls) loads on first open,
// so none of it is in the first load bundle of any route.
const CommandPaletteDialog = dynamic(() => import("./command-palette-dialog"), {
  ssr: false,
});

const OpenPalette = createContext<() => void>(() => {});

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Mounted on first request and kept, so the close animation can play.
  const [requested, setRequested] = useState(false);

  const openPalette = useCallback(() => {
    setRequested(true);
    setOpen(true);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k") return;
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      event.preventDefault();
      setRequested(true);
      setOpen((current) => !current);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <OpenPalette value={openPalette}>
      {children}
      {requested ? (
        <CommandPaletteDialog open={open} onOpenChange={setOpen} />
      ) : null}
    </OpenPalette>
  );
}

const noop = () => () => {};

/**
 * The platform is unknown on the server, so the first render says Ctrl and the
 * client corrects it after hydration: server and client markup stay identical.
 */
function useIsApple(): boolean {
  return useSyncExternalStore(
    noop,
    () => /Mac|iPhone|iPad|iPod/.test(navigator.userAgent),
    () => false,
  );
}

export function PaletteTrigger({
  variant,
  className,
}: {
  variant: "wide" | "icon";
  className?: string;
}) {
  const openPalette = use(OpenPalette);
  const apple = useIsApple();

  if (variant === "icon") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={openPalette}
        aria-label="Search and jump"
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        className={className}
      >
        <MagnifyingGlassIcon aria-hidden="true" className="size-5" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={openPalette}
      aria-haspopup="dialog"
      aria-keyshortcuts="Meta+K Control+K"
      className={cn(
        "w-full justify-between bg-card px-3 font-normal tracking-normal text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <span className="flex items-center gap-2">
        <MagnifyingGlassIcon aria-hidden="true" />
        Search and jump
      </span>
      <KbdGroup>
        <Kbd>{apple ? "⌘" : "Ctrl"}</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
    </Button>
  );
}
