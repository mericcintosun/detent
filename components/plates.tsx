// The five engraved plates, and the one wrapper that renders them.
//
// These are section visuals, not brand marks. The single mark is
// public/brand/logo.png inside the home Link in components/rail.tsx, and none of
// the files below is rendered there or in the register masthead. Each plate is
// decorative: alt is empty and aria-hidden is set, so a screen reader reads the
// sentence beside it and nothing else.
//
// The plates are rasters painted on parchment, which read as bright cards on the
// dark ground. In dark mode each one is inverted and turned half way round the
// hue wheel, which puts the parchment near the dark ground, the ink near bone
// and the gold back on gold, then dimmed a step so it sits under the text beside
// it. No colour value is introduced: the filter only moves the plate's own.
//
// unoptimized is deliberate. Next's image optimizer refuses SVG unless
// dangerouslyAllowSVG is turned on in next.config.ts, and touching that file is
// out of fence; these are 1 KB of flat shapes on the IDENTITY palette, so there
// is nothing to optimize anyway.

import Image from "next/image";
import { cn } from "@/lib/utils";

export type PlateName = "plan" | "policy" | "refusal" | "register" | "record";

const PLATES: Record<PlateName, string> = {
  plan: "/brand/plate-plan.svg",
  policy: "/brand/plate-policy.svg",
  refusal: "/brand/plate-refusal.svg",
  register: "/brand/plate-register.svg",
  record: "/brand/plate-record.svg",
};

export function Plate({
  name,
  width = 160,
  height = 120,
  className = "",
}: {
  name: PlateName;
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <Image
      src={PLATES[name]}
      alt=""
      aria-hidden="true"
      width={width}
      height={height}
      unoptimized
      className={cn(
        "dark:opacity-80 dark:mix-blend-lighten dark:hue-rotate-180 dark:invert",
        className,
      )}
    />
  );
}
