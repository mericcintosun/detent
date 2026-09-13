"use client";

import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  CheckIcon,
  CopyIcon,
  DesktopIcon,
  HashIcon,
  MoonIcon,
  SunIcon,
} from "@phosphor-icons/react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { ATS_TOKEN_ADDRESS, PLAN_ANCHOR_ADDRESS } from "@/lib/public-config";
import { CONSOLE_SECTIONS, PRIMARY_NAV } from "./nav";
import { checkPlanHash } from "./plan-hash";

const THEMES = [
  { value: "light", label: "Light theme", Icon: SunIcon },
  { value: "dark", label: "Dark theme", Icon: MoonIcon },
  { value: "system", label: "System theme", Icon: DesktopIcon },
] as const;

/** Only configured addresses are offered; an unset one is not a command. */
const COPYABLE = [
  { key: "token", label: "token address", value: ATS_TOKEN_ADDRESS },
  {
    key: "anchor",
    label: "anchor contract address",
    value: PLAN_ANCHOR_ADDRESS,
  },
].filter(
  (entry): entry is { key: string; label: string; value: `0x${string}` } =>
    Boolean(entry.value),
);

/**
 * The design system's overlay motion (scaleIn: 96 percent and a fade on the
 * base duration, out on the fast exit curve). The reduced motion block in
 * app/globals.css collapses it to a frame.
 */
const OVERLAY_MOTION =
  "data-open:duration-(--duration-base) data-open:ease-standard data-open:zoom-in-96 data-closed:duration-(--duration-fast) data-closed:ease-exit data-closed:zoom-out-98";

export default function CommandPaletteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [view, setView] = useState<"list" | "record">("list");
  const [query, setQuery] = useState("");
  const [hash, setHash] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  // A section jump on the console waits until the dialog has closed and handed
  // focus back, so restoring focus cannot scroll the page away from it.
  const pendingSection = useRef<string | null>(null);
  const ids = useId();

  // Every opening starts on the full list. Resetting here, while rendering the
  // opening, rather than when the close animation completes means a palette
  // closed by a navigation can never reopen on a stale view.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setView("list");
      setQuery("");
      setHash("");
      setError(null);
      setCopied(null);
    }
  }

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  function close() {
    onOpenChange(false);
  }

  function goTo(href: string) {
    close();
    router.push(href);
  }

  function goToSection(id: string) {
    if (pathname === "/") {
      pendingSection.current = id;
      close();
    } else {
      goTo(`/#${id}`);
    }
  }

  function openRecordView() {
    setHash(/^0x/i.test(query.trim()) ? query.trim() : "");
    setError(null);
    setView("record");
  }

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setAnnouncement(`Copied the ${label}`);
    } catch {
      setAnnouncement(`Could not copy the ${label}`);
    }
  }

  function submitRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const check = checkPlanHash(hash);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    goTo(`/record/${check.value}`);
  }

  const looksLikeHash = /^0x/i.test(query.trim());
  const hintId = `${ids}-hint`;
  const errorId = `${ids}-error`;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen) return;
        const section = pendingSection.current;
        pendingSection.current = null;
        if (section) {
          const target = document.getElementById(section);
          target?.scrollIntoView({ block: "start" });
          window.history.pushState(null, "", `#${section}`);
        }
      }}
      title="Command palette"
      description="Go to a page or a console section, open a plan record, change the theme or copy a contract address."
      className={`top-16 sm:top-1/4 sm:max-w-xl ${OVERLAY_MOTION}`}
    >
      {view === "list" ? (
        <Command label="Command palette" loop>
          <CommandInput
            aria-label="Search commands"
            placeholder="Search pages, sections and actions"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[min(24rem,60dvh)] p-1">
            <CommandEmpty>
              Nothing matches. Paste a plan hash to open its record.
            </CommandEmpty>
            {looksLikeHash ? (
              <CommandGroup heading="Record">
                <CommandItem
                  value={`record ${query}`}
                  forceMount
                  onSelect={openRecordView}
                >
                  <HashIcon aria-hidden="true" />
                  Open the record for this plan hash
                </CommandItem>
              </CommandGroup>
            ) : null}
            <CommandGroup heading="Pages">
              {PRIMARY_NAV.map(({ href, label }) => (
                <CommandItem
                  key={href}
                  value={`page ${label}`}
                  onSelect={() => goTo(href)}
                >
                  <ArrowUpRightIcon aria-hidden="true" />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Console sections">
              {CONSOLE_SECTIONS.map(({ id, label }, index) => (
                <CommandItem
                  key={id}
                  value={`section ${label} ${id}`}
                  onSelect={() => goToSection(id)}
                >
                  <span
                    aria-hidden="true"
                    className="amount w-4 font-mono text-caption text-muted-foreground"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
            {!looksLikeHash ? (
              <CommandGroup heading="Record">
                <CommandItem
                  value="record open a plan record by plan hash"
                  onSelect={openRecordView}
                >
                  <HashIcon aria-hidden="true" />
                  Open a record by plan hash
                </CommandItem>
              </CommandGroup>
            ) : null}
            <CommandGroup
              heading="Theme"
              className="mt-1 border-t border-border pt-1"
            >
              {THEMES.map(({ value, label, Icon }) => (
                <CommandItem
                  key={value}
                  value={`theme ${label}`}
                  data-checked={theme === value}
                  onSelect={() => {
                    setTheme(value);
                    close();
                  }}
                >
                  <Icon aria-hidden="true" />
                  {label}
                  {theme === value ? (
                    <span className="sr-only">, current</span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
            {COPYABLE.length > 0 ? (
              <CommandGroup heading="Copy">
                {COPYABLE.map(({ key, label, value }) => (
                  <CommandItem
                    key={key}
                    value={`copy ${label}`}
                    onSelect={() => copy(label, value)}
                  >
                    {copied === label ? (
                      <CheckIcon aria-hidden="true" className="text-success" />
                    ) : (
                      <CopyIcon aria-hidden="true" />
                    )}
                    {copied === label
                      ? `Copied the ${label}`
                      : `Copy the ${label}`}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
          <div
            aria-hidden="true"
            className="flex items-center gap-4 border-t border-border px-3 py-2 text-caption text-muted-foreground"
          >
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> move
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>Enter</Kbd> open
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>Esc</Kbd> close
            </span>
          </div>
        </Command>
      ) : (
        <form
          noValidate
          onSubmit={submitRecord}
          className="flex flex-col gap-4 bg-popover p-4"
        >
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setView("list")}
              aria-label="Back to all commands"
            >
              <ArrowLeftIcon aria-hidden="true" />
            </Button>
            <p className="font-heading text-heading">Open a plan record</p>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${ids}-hash`} className="detent-label">
              Plan hash
            </label>
            <Input
              id={`${ids}-hash`}
              autoFocus
              value={hash}
              onChange={(event) => {
                setHash(event.target.value);
                if (error) setError(null);
              }}
              placeholder="0x"
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${hintId} ${errorId}` : hintId}
              className="font-mono text-caption"
            />
            <p id={hintId} className="text-caption text-muted-foreground">
              0x followed by 64 hexadecimal characters, as the audit record
              prints it.
            </p>
            {error ? (
              <p
                id={errorId}
                role="alert"
                className="text-body-sm text-destructive"
              >
                {error}
              </p>
            ) : null}
          </div>
          <Button type="submit" className="self-start">
            Open the record
          </Button>
        </form>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </CommandDialog>
  );
}
