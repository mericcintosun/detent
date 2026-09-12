// The five engraved plates, and the one wrapper that renders them.
//
// These are section visuals, not brand marks. The single mark is
// public/brand/logo.png inside the home Link in components/rail.tsx, and none of
// the files below is rendered there or in the register masthead. Each plate is
// decorative: alt is empty and aria-hidden is set, so a screen reader reads the
// sentence beside it and nothing else.
//
// unoptimized is deliberate. Next's image optimizer refuses SVG unless
// dangerouslyAllowSVG is turned on in next.config.ts, and touching that file is
// out of fence; these are 1 KB of flat shapes on the IDENTITY palette, so there
// is nothing to optimize anyway.

import Image from "next/image";

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
      className={className}
    />
  );
}
