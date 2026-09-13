import { BrandMark } from "./brand-mark";
import { PaletteTrigger } from "./command-palette";
import { MobileMenu } from "./mobile-menu";
import type { RunModeFlags } from "./run-mode";
import { RunModePill, RunModeStatus } from "./run-mode-status";

/** Below lg: a sticky bar with the mark, the run mode, search and the menu. */
export function TopBar(flags: RunModeFlags) {
  return (
    <header className="sticky top-0 z-(--z-sticky) border-b border-border bg-background/95 backdrop-blur-sm lg:hidden">
      <div className="flex h-14 items-center gap-3 px-gutter">
        <BrandMark size="bar" />
        <RunModePill {...flags} className="hidden xs:inline-flex" />
        <div className="ml-auto flex items-center">
          <PaletteTrigger variant="icon" />
          <MobileMenu status={<RunModeStatus idPrefix="sheet" {...flags} />} />
        </div>
      </div>
    </header>
  );
}
