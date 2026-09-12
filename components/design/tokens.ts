/**
 * The colour tokens of app/globals.css as data, for the living style guide and
 * the contrast table. app/globals.css is the source of truth;
 * tests/design-system.test.ts fails when a value here drifts from it or when a
 * listed pair drops below its WCAG 2.2 AA threshold.
 */

export type ThemeName = "light" | "dark";

export const COLOR_TOKENS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "destructive-muted",
  "success",
  "success-foreground",
  "success-muted",
  "warning",
  "warning-foreground",
  "warning-muted",
  "info",
  "info-foreground",
  "info-muted",
  "mirror",
  "mirror-foreground",
  "mirror-muted",
  "border",
  "input",
  "ring",
  "hairline",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];

/** Resolved OKLCH values, brand aliases expanded. */
export const THEMES: Record<ThemeName, Record<ColorToken, string>> = {
  light: {
    background: "oklch(0.959 0.01 87.5)",
    foreground: "oklch(0.205 0.008 84.6)",
    card: "oklch(0.929 0.016 86.4)",
    "card-foreground": "oklch(0.205 0.008 84.6)",
    popover: "oklch(0.975 0.007 87.5)",
    "popover-foreground": "oklch(0.205 0.008 84.6)",
    primary: "oklch(0.655 0.107 86.9)",
    "primary-foreground": "oklch(0.205 0.008 84.6)",
    secondary: "oklch(0.895 0.021 88.7)",
    "secondary-foreground": "oklch(0.205 0.008 84.6)",
    muted: "oklch(0.895 0.021 88.7)",
    "muted-foreground": "oklch(0.45 0.015 85)",
    accent: "oklch(0.895 0.021 88.7)",
    "accent-foreground": "oklch(0.205 0.008 84.6)",
    destructive: "oklch(0.485 0.133 32.1)",
    "destructive-foreground": "oklch(0.959 0.01 87.5)",
    "destructive-muted": "oklch(0.915 0.03 35)",
    success: "oklch(0.47 0.095 154.6)",
    "success-foreground": "oklch(0.959 0.01 87.5)",
    "success-muted": "oklch(0.915 0.03 155)",
    warning: "oklch(0.5 0.09 40)",
    "warning-foreground": "oklch(0.959 0.01 87.5)",
    "warning-muted": "oklch(0.915 0.035 45)",
    info: "oklch(0.47 0.07 235)",
    "info-foreground": "oklch(0.959 0.01 87.5)",
    "info-muted": "oklch(0.915 0.02 235)",
    mirror: "oklch(0.5 0.09 80)",
    "mirror-foreground": "oklch(0.959 0.01 87.5)",
    "mirror-muted": "oklch(0.915 0.035 86)",
    border: "oklch(0.87 0.022 88)",
    input: "oklch(0.6 0.03 85)",
    ring: "oklch(0.52 0.09 85)",
    hairline: "oklch(0.655 0.107 86.9)",
    "chart-1": "oklch(0.58 0.1 85)",
    "chart-2": "oklch(0.485 0.133 32.1)",
    "chart-3": "oklch(0.47 0.095 154.6)",
    "chart-4": "oklch(0.47 0.07 235)",
    "chart-5": "oklch(0.45 0.015 85)",
  },
  dark: {
    background: "oklch(0.165 0.006 80)",
    foreground: "oklch(0.945 0.012 87)",
    card: "oklch(0.205 0.008 82)",
    "card-foreground": "oklch(0.945 0.012 87)",
    popover: "oklch(0.235 0.009 82)",
    "popover-foreground": "oklch(0.945 0.012 87)",
    primary: "oklch(0.76 0.115 86)",
    "primary-foreground": "oklch(0.165 0.006 80)",
    secondary: "oklch(0.275 0.01 84)",
    "secondary-foreground": "oklch(0.945 0.012 87)",
    muted: "oklch(0.275 0.01 84)",
    "muted-foreground": "oklch(0.76 0.018 85)",
    accent: "oklch(0.275 0.01 84)",
    "accent-foreground": "oklch(0.945 0.012 87)",
    destructive: "oklch(0.68 0.13 35)",
    "destructive-foreground": "oklch(0.165 0.006 80)",
    "destructive-muted": "oklch(0.26 0.045 35)",
    success: "oklch(0.72 0.1 155)",
    "success-foreground": "oklch(0.165 0.006 80)",
    "success-muted": "oklch(0.26 0.04 155)",
    warning: "oklch(0.76 0.075 45)",
    "warning-foreground": "oklch(0.165 0.006 80)",
    "warning-muted": "oklch(0.26 0.04 45)",
    info: "oklch(0.74 0.06 235)",
    "info-foreground": "oklch(0.165 0.006 80)",
    "info-muted": "oklch(0.26 0.03 235)",
    mirror: "oklch(0.78 0.1 86)",
    "mirror-foreground": "oklch(0.165 0.006 80)",
    "mirror-muted": "oklch(0.265 0.04 86)",
    border: "oklch(0.31 0.012 84)",
    input: "oklch(0.52 0.02 85)",
    ring: "oklch(0.72 0.1 86)",
    hairline: "oklch(0.62 0.1 86)",
    "chart-1": "oklch(0.76 0.115 86)",
    "chart-2": "oklch(0.68 0.13 35)",
    "chart-3": "oklch(0.72 0.1 155)",
    "chart-4": "oklch(0.74 0.06 235)",
    "chart-5": "oklch(0.76 0.018 85)",
  },
};

export type PairKind = "text" | "ui";

export interface ContrastPair {
  foreground: ColorToken;
  background: ColorToken;
  kind: PairKind;
  /** Where the pair occurs, for the published table. */
  usage: string;
}

const STATUS = ["destructive", "success", "warning", "info", "mirror"] as const;

/** Every foreground and background pair the system uses. */
export const CONTRAST_PAIRS: ContrastPair[] = [
  {
    foreground: "foreground",
    background: "background",
    kind: "text",
    usage: "body text, tooltip",
  },
  {
    foreground: "card-foreground",
    background: "card",
    kind: "text",
    usage: "card text",
  },
  {
    foreground: "popover-foreground",
    background: "popover",
    kind: "text",
    usage: "menus, dialogs, toasts",
  },
  {
    foreground: "foreground",
    background: "muted",
    kind: "text",
    usage: "text on a muted row",
  },
  {
    foreground: "muted-foreground",
    background: "background",
    kind: "text",
    usage: "secondary text, labels",
  },
  {
    foreground: "muted-foreground",
    background: "card",
    kind: "text",
    usage: "labels inside cards",
  },
  {
    foreground: "muted-foreground",
    background: "popover",
    kind: "text",
    usage: "descriptions in overlays",
  },
  {
    foreground: "muted-foreground",
    background: "muted",
    kind: "text",
    usage: "kbd, skeleton captions",
  },
  {
    foreground: "primary-foreground",
    background: "primary",
    kind: "text",
    usage: "primary button",
  },
  {
    foreground: "secondary-foreground",
    background: "secondary",
    kind: "text",
    usage: "secondary button",
  },
  {
    foreground: "accent-foreground",
    background: "accent",
    kind: "text",
    usage: "hovered menu item",
  },
  ...STATUS.flatMap((status): ContrastPair[] => [
    {
      foreground: `${status}-foreground`,
      background: status,
      kind: "text",
      usage: `solid ${status} fill`,
    },
    {
      foreground: status,
      background: "background",
      kind: "text",
      usage: `${status} text on the ground`,
    },
    {
      foreground: status,
      background: "card",
      kind: "text",
      usage: `${status} text in a card`,
    },
    {
      foreground: status,
      background: "popover",
      kind: "text",
      usage: `${status} text in an overlay`,
    },
    {
      foreground: status,
      background: `${status}-muted`,
      kind: "text",
      usage: `${status} pill and callout`,
    },
  ]),
  {
    foreground: "input",
    background: "background",
    kind: "ui",
    usage: "field boundary",
  },
  {
    foreground: "input",
    background: "card",
    kind: "ui",
    usage: "field boundary in a card",
  },
  {
    foreground: "ring",
    background: "background",
    kind: "ui",
    usage: "focus ring",
  },
  {
    foreground: "ring",
    background: "card",
    kind: "ui",
    usage: "focus ring in a card",
  },
  {
    foreground: "ring",
    background: "muted",
    kind: "ui",
    usage: "focus ring on a muted row",
  },
  {
    foreground: "ring",
    background: "popover",
    kind: "ui",
    usage: "focus ring in an overlay",
  },
  ...([1, 2, 3, 4, 5] as const).flatMap((n): ContrastPair[] => [
    {
      foreground: `chart-${n}`,
      background: "background",
      kind: "ui",
      usage: `chart series ${n}`,
    },
    {
      foreground: `chart-${n}`,
      background: "card",
      kind: "ui",
      usage: `chart series ${n} in a card`,
    },
  ]),
];

export const AA_MINIMUM: Record<PairKind, number> = { text: 4.5, ui: 3 };

function parseOklch(value: string): [number, number, number] {
  const match = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(value);
  if (!match) throw new Error(`not an oklch() literal: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function toLinearSrgb(value: string): [number, number, number] {
  const [l, c, h] = parseOklch(value);
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const lp = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mp = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sp = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return [
    clamp(4.0767416621 * lp - 3.3077115913 * mp + 0.2309699292 * sp),
    clamp(-1.2684380046 * lp + 2.6097574011 * mp - 0.3413193965 * sp),
    clamp(-0.0041960863 * lp - 0.7034186147 * mp + 1.707614701 * sp),
  ];
}

/**
 * WCAG relative luminance. OKLab converts to linear sRGB directly, and
 * luminance is defined on linear channels, so there is no gamma round trip.
 */
function luminance(value: string): number {
  const [r, g, b] = toLinearSrgb(value);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG 2.2 contrast ratio of two oklch() literals. */
export function contrastRatio(foreground: string, background: string): number {
  const [hi, lo] = [luminance(foreground), luminance(background)].sort(
    (x, y) => y - x,
  );
  return (hi + 0.05) / (lo + 0.05);
}

export interface ContrastRow extends ContrastPair {
  ratio: number;
  passes: boolean;
}

export function contrastTable(theme: ThemeName): ContrastRow[] {
  return CONTRAST_PAIRS.map((pair) => {
    const ratio = contrastRatio(
      THEMES[theme][pair.foreground],
      THEMES[theme][pair.background],
    );
    return {
      ...pair,
      ratio: Math.round(ratio * 100) / 100,
      passes: ratio >= AA_MINIMUM[pair.kind],
    };
  });
}
