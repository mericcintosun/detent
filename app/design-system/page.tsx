import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AddressText,
  Callout,
  CodeBlock,
  EmptyState,
  ErrorState,
  ExternalLink,
  KeyValue,
  KeyValueList,
  LoadingState,
  OfflineNotice,
  PageHeader,
  Section,
  StaleBanner,
  Stat,
  StatGroup,
  StatusPill,
} from "@/components/design";
import {
  COLOR_TOKENS,
  THEMES,
  contrastTable,
  type ColorToken,
} from "@/components/design/tokens";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { ComplianceState } from "@/lib/data";
import { InteractiveDemos, MotionDemos, ThemeSwitch } from "./demos";

export const metadata: Metadata = {
  title: "Design system",
  description: "The Detent design system: tokens, type, primitives and motion.",
  robots: { index: false, follow: false },
};

// Read the flag per request, so a production build answers 404 unless the
// server was started with DETENT_DESIGN_SYSTEM=1.
export const dynamic = "force-dynamic";

const SWATCH: Record<ColorToken, string> = {
  background: "bg-background",
  foreground: "bg-foreground",
  card: "bg-card",
  "card-foreground": "bg-card-foreground",
  popover: "bg-popover",
  "popover-foreground": "bg-popover-foreground",
  primary: "bg-primary",
  "primary-foreground": "bg-primary-foreground",
  secondary: "bg-secondary",
  "secondary-foreground": "bg-secondary-foreground",
  muted: "bg-muted",
  "muted-foreground": "bg-muted-foreground",
  accent: "bg-accent",
  "accent-foreground": "bg-accent-foreground",
  destructive: "bg-destructive",
  "destructive-foreground": "bg-destructive-foreground",
  "destructive-muted": "bg-destructive-muted",
  success: "bg-success",
  "success-foreground": "bg-success-foreground",
  "success-muted": "bg-success-muted",
  warning: "bg-warning",
  "warning-foreground": "bg-warning-foreground",
  "warning-muted": "bg-warning-muted",
  info: "bg-info",
  "info-foreground": "bg-info-foreground",
  "info-muted": "bg-info-muted",
  mirror: "bg-mirror",
  "mirror-foreground": "bg-mirror-foreground",
  "mirror-muted": "bg-mirror-muted",
  border: "bg-border",
  input: "bg-input",
  ring: "bg-ring",
  hairline: "bg-hairline",
  "chart-1": "bg-chart-1",
  "chart-2": "bg-chart-2",
  "chart-3": "bg-chart-3",
  "chart-4": "bg-chart-4",
  "chart-5": "bg-chart-5",
};

const TYPE_SCALE = [
  {
    name: "text-display",
    className: "font-display text-display",
    sample: "Detent",
  },
  {
    name: "text-headline",
    className: "font-display text-headline",
    sample: "Distribute quarterly coupon",
  },
  {
    name: "text-title",
    className: "font-display text-title",
    sample: "Plan for the Q3 coupon run",
  },
  {
    name: "text-heading",
    className: "font-display text-heading",
    sample: "Treasury key",
  },
  {
    name: "text-lead",
    className: "text-lead",
    sample: "Preview the corporate action line by line.",
  },
  {
    name: "text-body",
    className: "text-body",
    sample: "Twelve holders on the register, two held by compliance.",
  },
  {
    name: "text-body-sm",
    className: "text-body-sm",
    sample: "The lock expires when the plan is sent or abandoned.",
  },
  {
    name: "text-caption",
    className: "text-caption text-muted-foreground",
    sample: "Read from the cached register",
  },
  { name: "detent-label", className: "detent-label", sample: "Units moved" },
  {
    name: "font-mono amount",
    className: "amount font-mono text-body-sm",
    sample: "0x7a3f9c01d2e4b5a6 1,204,550.000000",
  },
] as const;

const MEASURES = [
  "measure-2xs",
  "measure-xs",
  "measure-sm",
  "measure-md",
  "measure-lg",
  "measure-xl",
] as const;
const MEASURE_CLASS: Record<(typeof MEASURES)[number], string> = {
  "measure-2xs": "max-w-measure-2xs",
  "measure-xs": "max-w-measure-xs",
  "measure-sm": "max-w-measure-sm",
  "measure-md": "max-w-measure-md",
  "measure-lg": "max-w-measure-lg",
  "measure-xl": "max-w-measure-xl",
};

const RADII = [
  ["rounded-none", "rounded-none", "0, the component default"],
  ["rounded-xs", "rounded-xs", "1px"],
  ["rounded-sm", "rounded-sm", "2px, --radius"],
  ["rounded-md", "rounded-md", "3px"],
  ["rounded-lg", "rounded-lg", "4px"],
  ["rounded-xl", "rounded-xl", "6px, the ceiling"],
] as const;

const SHADOWS = [
  ["shadow-xs", "shadow-xs", "elevation 1: sticky rows"],
  ["shadow-sm", "shadow-sm", "elevation 2: raised cards"],
  ["shadow-md", "shadow-md", "elevation 3: menus, popovers"],
  ["shadow-xl", "shadow-xl", "elevation 4: dialogs, sheets, toasts"],
] as const;

const Z_INDEX = [
  ["--z-base", 0],
  ["--z-raised", 10],
  ["--z-sticky", 20],
  ["--z-rail", 30],
  ["--z-overlay", 40],
  ["--z-modal", 50],
  ["--z-popover", 60],
  ["--z-toast", 70],
  ["--z-tooltip", 80],
] as const;

const HOLDS: ComplianceState[] = [
  "clear",
  "allowlist-expired",
  "kyc-lapsed",
  "sanctions-hold",
  "compliance-refused",
  "paused",
  "unrecognised",
];

const BUTTON_VARIANTS = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "destructive",
  "link",
] as const;
const BUTTON_SIZES = ["xs", "sm", "default", "lg"] as const;
const BADGE_VARIANTS = [
  "default",
  "secondary",
  "outline",
  "destructive",
  "ghost",
  "link",
] as const;

/** A 64 character example value, labelled as an example wherever it appears. */
const EXAMPLE_HASH = `0x${"3f9c".repeat(16)}`;
const EXAMPLE_ADDRESS = `0x${"a1b2".repeat(10)}`;

function Subheading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-4 font-display text-heading">{children}</h3>;
}

export default function DesignSystemPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.DETENT_DESIGN_SYSTEM !== "1"
  ) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-content flex-col">
      <PageHeader
        eyebrow="Development only · not indexed"
        title="Design system"
        description="Every token, type step, primitive and motion variant Detent builds from, rendered in the current theme. Values that carry an example label are placeholders for the guide, not data."
        actions={<ThemeSwitch />}
      />

      <Section
        id="colour"
        heading="Colour"
        description="Semantic tokens in the current theme. Switch the theme to see the other set."
      >
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {COLOR_TOKENS.map((token) => (
            <li
              key={token}
              className="flex flex-col border border-border bg-card"
            >
              <span
                aria-hidden="true"
                className={`h-14 border-b border-border ${SWATCH[token]}`}
              />
              <span className="flex flex-col gap-0.5 p-2">
                <code className="font-mono text-caption text-foreground">
                  --{token}
                </code>
                <span className="font-mono text-caption text-muted-foreground">
                  {THEMES.light[token]}
                </span>
                <span className="font-mono text-caption text-muted-foreground">
                  {THEMES.dark[token]}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="contrast"
        heading="Contrast"
        description="Every foreground and background pair the system uses, computed from the OKLCH values. Text needs 4.5:1, focus rings, field boundaries and chart marks need 3:1 (WCAG 2.2 AA)."
      >
        <div className="grid gap-8 xl:grid-cols-2">
          {(["light", "dark"] as const).map((theme) => {
            const rows = contrastTable(theme);
            const failing = rows.filter((row) => !row.passes).length;
            return (
              <div key={theme} className="min-w-0">
                <Subheading>
                  {theme === "light" ? "Light" : "Dark"}:{" "}
                  {rows.length - failing} of {rows.length} pass
                </Subheading>
                <Table>
                  <TableCaption>Contrast ratios, {theme} theme</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Foreground</TableHead>
                      <TableHead>Background</TableHead>
                      <TableHead className="text-right">Ratio</TableHead>
                      <TableHead>Needs</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={`${row.foreground}-${row.background}`}>
                        <TableCell className="font-mono">
                          {row.foreground}
                        </TableCell>
                        <TableCell className="font-mono">
                          {row.background}
                        </TableCell>
                        <TableCell className="amount text-right">
                          {row.ratio.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {row.kind === "text" ? "4.5" : "3.0"}
                        </TableCell>
                        <TableCell
                          className={
                            row.passes ? "text-success" : "text-destructive"
                          }
                        >
                          {row.passes ? "Pass" : "Fail"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        id="type"
        heading="Type"
        description="Libre Caslon Text for display, Libre Franklin for text, JetBrains Mono for hashes, addresses, amounts and code. Every step is fluid and carries its line height and tracking."
      >
        <div className="divide-y divide-border border-y border-border">
          {TYPE_SCALE.map((step) => (
            <div
              key={step.name}
              className="grid gap-2 py-4 md:grid-cols-[12rem_minmax(0,1fr)] md:items-baseline"
            >
              <code className="font-mono text-caption text-muted-foreground">
                {step.name}
              </code>
              <p className={`min-w-0 break-words ${step.className}`}>
                {step.sample}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="layout" heading="Space, measure, radius, elevation">
        <div className="flex flex-col gap-10">
          <div>
            <Subheading>Reading measures</Subheading>
            <div className="flex flex-col gap-2">
              {MEASURES.map((measure) => (
                <div
                  key={measure}
                  className={`${MEASURE_CLASS[measure]} border-l-2 border-hairline bg-card px-3 py-1.5`}
                >
                  <code className="font-mono text-caption">
                    max-w-{measure}
                  </code>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Subheading>Named spacing</Subheading>
            <KeyValueList className="max-w-measure-lg">
              <KeyValue label="p-touch, size-touch" mono>
                2.75rem, the 44px target
              </KeyValue>
              <KeyValue label="px-gutter" mono>
                clamp(1.25rem, 0.9rem + 1.6vw, 3rem)
              </KeyValue>
              <KeyValue label="py-section" mono>
                clamp(3rem, 2rem + 4vw, 6rem)
              </KeyValue>
              <KeyValue label="base step" mono>
                0.25rem, Tailwind default
              </KeyValue>
            </KeyValueList>
          </div>
          <div>
            <Subheading>Radius</Subheading>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {RADII.map(([name, className, note]) => (
                <div key={name} className="flex flex-col gap-2">
                  <span
                    aria-hidden="true"
                    className={`h-16 border-2 border-foreground bg-card ${className}`}
                  />
                  <code className="font-mono text-caption">{name}</code>
                  <span className="text-caption text-muted-foreground">
                    {note}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Subheading>Elevation</Subheading>
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              {SHADOWS.map(([name, className, note]) => (
                <div
                  key={name}
                  className={`flex h-24 flex-col justify-end gap-1 bg-popover p-3 ${className}`}
                >
                  <code className="font-mono text-caption">{name}</code>
                  <span className="text-caption text-muted-foreground">
                    {note}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Subheading>Stacking</Subheading>
            <KeyValueList className="max-w-measure-sm">
              {Z_INDEX.map(([name, value]) => (
                <KeyValue key={name} label={name} mono>
                  z-({name}) = {value}
                </KeyValue>
              ))}
            </KeyValueList>
          </div>
        </div>
      </Section>

      <Section id="buttons" heading="Buttons and badges">
        <div className="flex flex-col gap-8">
          {BUTTON_VARIANTS.map((variant) => (
            <div key={variant} className="flex flex-col gap-3">
              <p className="detent-label">variant {variant}</p>
              <div className="flex flex-wrap items-center gap-3">
                {BUTTON_SIZES.map((size) => (
                  <Button key={size} variant={variant} size={size}>
                    {variant} {size}
                  </Button>
                ))}
                <Button variant={variant} disabled>
                  {variant} disabled
                </Button>
              </div>
            </div>
          ))}
          <div className="flex flex-col gap-3">
            <p className="detent-label">badges</p>
            <div className="flex flex-wrap items-center gap-2">
              {BADGE_VARIANTS.map((variant) => (
                <Badge key={variant} variant={variant}>
                  {variant}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section id="forms" heading="Fields">
        <div className="grid max-w-measure-lg gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ds-amount">Coupon per unit</Label>
            <Input id="ds-amount" inputMode="decimal" placeholder="0.000000" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ds-disabled">Locked field</Label>
            <Input
              id="ds-disabled"
              disabled
              defaultValue="Locked to the treasury key"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ds-invalid">Invalid field</Label>
            <Input
              id="ds-invalid"
              aria-invalid="true"
              aria-describedby="ds-invalid-hint"
              defaultValue="7,756.25"
            />
            <p id="ds-invalid-hint" className="text-caption text-destructive">
              Use a dot for decimals.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="ds-note">Operator note</Label>
            <Textarea
              id="ds-note"
              placeholder="Why this plan differs from the last run"
            />
          </div>
        </div>
      </Section>

      <Section id="surfaces" heading="Surfaces">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Card title</CardTitle>
              <CardDescription>Card description in muted text.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-body-sm">
                Card content sits on the parchment surface.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm">
                Footer action
              </Button>
            </CardFooter>
          </Card>
          <div className="flex flex-col gap-4">
            <Alert>
              <AlertTitle>Default alert</AlertTitle>
              <AlertDescription>
                Neutral information attached to a control.
              </AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertTitle>Destructive alert</AlertTitle>
              <AlertDescription>
                The treasury key refused the payload.
              </AlertDescription>
            </Alert>
            <Separator />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <p className="flex items-center gap-2 text-body-sm">
              Open the palette with
              <KbdGroup>
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </KbdGroup>
            </p>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Console</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Design system</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>
      </Section>

      <Section
        id="overlays"
        heading="Overlays and controls"
        description="Dialog, sheet, menu, command palette, tooltip, tabs, switch, toggle group, progress, scroll area and toast."
      >
        <InteractiveDemos />
      </Section>

      <Section
        id="primitives"
        heading="Detent primitives"
        description="components/design. Values marked as examples are placeholders for this guide."
      >
        <div className="flex flex-col gap-10">
          <div>
            <Subheading>Status pills</Subheading>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <StatusPill kind="mode" value="live" />
                <StatusPill kind="mode" value="mirror" />
              </div>
              <div className="flex flex-wrap gap-2">
                {HOLDS.map((hold) => (
                  <StatusPill key={hold} kind="hold" value={hold} />
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill kind="receipt" value="on-chain" />
                <StatusPill kind="receipt" value="synthetic" />
                <StatusPill kind="receipt" value="none" />
              </div>
            </div>
          </div>
          <div>
            <Subheading>Stats</Subheading>
            <StatGroup>
              <Stat label="Holders" value="12" hint="Example value" />
              <Stat
                label="Held"
                value="2"
                tone="warning"
                hint="Example value"
              />
              <Stat
                label="Units moved"
                value="1,204,550"
                unit="units"
                hint="Example value"
              />
              <Stat
                label="Refused"
                value="1"
                tone="destructive"
                hint="Example value"
              />
            </StatGroup>
          </div>
          <div>
            <Subheading>Key values, hashes and addresses</Subheading>
            <KeyValueList className="max-w-measure-xl">
              <KeyValue label="Plan hash, example">
                <AddressText address={EXAMPLE_HASH} label="example plan hash" />
              </KeyValue>
              <KeyValue label="Token contract, example">
                <AddressText
                  address={EXAMPLE_ADDRESS}
                  label="example token address"
                />
              </KeyValue>
              <KeyValue label="Chain id" mono>
                296
              </KeyValue>
              <KeyValue label="Explorer">
                <ExternalLink href="https://hashscan.io/testnet">
                  HashScan testnet
                </ExternalLink>
              </KeyValue>
            </KeyValueList>
          </div>
          <div>
            <Subheading>Callouts</Subheading>
            <div className="grid gap-3 md:grid-cols-2">
              <Callout title="Neutral">A note in the flow of the page.</Callout>
              <Callout tone="info" title="Info">
                The register is read every 30 seconds.
              </Callout>
              <Callout tone="success" title="Success">
                Signed and broadcast.
              </Callout>
              <Callout tone="warning" title="Warning">
                Two holders are held by compliance.
              </Callout>
              <Callout tone="destructive" title="Destructive">
                The payload differs from the locked plan.
              </Callout>
              <Callout tone="mirror" title="Mirror">
                Keyless rehearsal, nothing is signed.
              </Callout>
            </div>
          </div>
          <div>
            <Subheading>States</Subheading>
            <div className="grid gap-6 lg:grid-cols-2">
              <EmptyState
                title="No plan yet"
                description="Choose a corporate action to build the plan from the register."
                action={
                  <Button variant="outline">Distribute quarterly coupon</Button>
                }
              />
              <ErrorState
                title="The lock expired"
                description="Lock the plan again before sending it."
                code="lock_unknown"
                action={<Button variant="outline">Lock this plan again</Button>}
              />
              <LoadingState label="Loading the register" rows={4} />
              <LoadingState label="Loading the record" shape="block" />
              <StaleBanner
                subject="The register snapshot"
                readAt="2026-09-13T09:00:00Z"
                age="12 minutes ago, an example"
                action={
                  <Button variant="outline" size="sm">
                    Read again
                  </Button>
                }
              />
              <OfflineNotice />
            </div>
          </div>
          <div>
            <Subheading>Code</Subheading>
            <CodeBlock
              label="example calldata"
              code={`distribute(address[] holders, uint256[] amounts)\n0x${"00".repeat(4)}${"7a3f".repeat(20)}`}
            />
          </div>
        </div>
      </Section>

      <Section
        id="motion"
        heading="Motion"
        description="lib/motion.ts tokens through components/motion. With reduced motion on, transforms drop and only opacity changes."
      >
        <MotionDemos />
      </Section>
    </div>
  );
}
