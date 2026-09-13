// The full plan hash, spelled out rather than truncated through HashText.
//
// HashText renders two text nodes for one value: a visible truncated form and
// a sr-only span carrying the full value for assistive technology and for
// e2e/routes.spec.ts's `getByText(planHash)` check. Passing a lead/tail wide
// enough to skip truncation still leaves both nodes holding the full hash, so
// a substring query matches two elements and Playwright's strict mode refuses
// to pick one. The plan hash is exactly the value that page needs asserted as
// one visible match, so it gets its own single, visible, breakable node here
// and its own copy control, instead of HashText's tooltip-plus-sr-only shape.
import { CopyButton } from "@/components/design";

export function PlanHash({ value }: { value: string }) {
  return (
    // No flex-wrap: at phone widths the 66 character hash breaks inside its own
    // column and the copy control stays beside its first line instead of
    // dropping onto a row of its own.
    <span className="flex max-w-full items-start gap-1">
      <span className="amount min-w-0 flex-1 break-all font-mono text-caption text-foreground">
        {value}
      </span>
      <CopyButton value={value} label="plan hash" className="shrink-0" />
    </span>
  );
}
