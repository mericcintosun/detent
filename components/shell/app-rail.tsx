import { ThemeToggle } from "@/components/theme-toggle";
import { BrandMark } from "./brand-mark";
import { PaletteTrigger } from "./command-palette";
import { ConsoleSections } from "./console-sections";
import { PrimaryNav } from "./primary-nav";
import type { RunModeFlags } from "./run-mode";
import { RunModeStatus } from "./run-mode-status";

/**
 * The L6 rail, from lg up: solid ground, a hairline on the right, persistent and
 * sticky at full height. A server component; the pathname aware parts are the
 * two small client islands inside it.
 */
export function AppRail(flags: RunModeFlags) {
  return (
    <header className="sticky top-0 z-(--z-rail) hidden h-dvh flex-col border-r border-border bg-background lg:flex">
      <div className="flex flex-col gap-1 border-b border-border px-5 pt-6 pb-5">
        <BrandMark />
        <p className="detent-label pl-12">Operator console</p>
      </div>

      {/* The shell's one entrance: the CSS wipe, so it plays from server HTML
          without waiting for hydration and collapses under reduced motion. */}
      <div className="detent-enter flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-3 py-6">
        <PrimaryNav />
        <ConsoleSections />
      </div>

      <div className="flex flex-col gap-5 border-t border-border px-5 py-5">
        <RunModeStatus idPrefix="rail" {...flags} />
        <PaletteTrigger variant="wide" />
        <div className="flex items-center justify-between gap-3">
          <span className="detent-label">Theme</span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
