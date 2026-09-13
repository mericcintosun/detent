"use client";

import {
  BookOpenTextIcon,
  DropIcon,
  ShieldCheckIcon,
  TerminalWindowIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isCurrentRoute, PRIMARY_NAV } from "./nav";

const ICONS = {
  "/": TerminalWindowIcon,
  "/how-it-works": BookOpenTextIcon,
  "/security": ShieldCheckIcon,
  "/faucet": DropIcon,
} as const;

/** The primary routes. The only client work is reading the pathname. */
export function PrimaryNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary">
      <ul className="flex flex-col gap-px">
        {PRIMARY_NAV.map(({ href, label }) => {
          const current = isCurrentRoute(pathname, href);
          const Icon = ICONS[href];
          return (
            <li key={href}>
              <Link
                href={href}
                // The content routes land with page-content in the same wave;
                // until then a viewport prefetch would log a 404 on every page.
                prefetch={href === "/" ? undefined : false}
                aria-current={current ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "group flex min-h-11 items-center gap-3 border-l-2 px-3 text-body-sm transition-colors duration-(--duration-fast) focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  current
                    ? "border-hairline bg-accent font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon
                  aria-hidden="true"
                  weight={current ? "fill" : "regular"}
                  className="size-4 shrink-0"
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
