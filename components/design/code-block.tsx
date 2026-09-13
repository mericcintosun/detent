import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

export interface CodeBlockProps {
  code: string;
  /** Shown as a detent-label caption and used in the copy button's name. */
  label?: string;
  copyable?: boolean;
  className?: string;
}

/**
 * Preformatted code or calldata in the mono face. The block scrolls sideways in
 * its own wrapper and is focusable, so a keyboard reader can scroll it too.
 */
export function CodeBlock({
  code,
  label = "code",
  copyable = true,
  className,
}: CodeBlockProps) {
  return (
    <figure
      data-slot="code-block"
      className={cn("flex flex-col border border-border bg-card", className)}
    >
      <figcaption className="flex min-h-11 items-center justify-between gap-3 border-b border-border pl-4 pr-1">
        <span className="detent-label">{label}</span>
        {copyable ? <CopyButton value={code} label={label} /> : null}
      </figcaption>
      <pre
        tabIndex={0}
        className="overflow-x-auto p-4 font-mono text-caption leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <code>{code}</code>
      </pre>
    </figure>
  );
}
