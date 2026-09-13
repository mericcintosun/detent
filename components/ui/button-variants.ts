import { cva, type VariantProps } from "class-variance-authority";
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

/**
 * shadcn base-lyra button, adapted to Detent.
 *
 * Kept from Detent: every size used on the demo path is at least 44px tall; a
 * disabled control keeps its shape and rule and loses only its fill, instead of
 * an opacity wash; `destructive` is the loudest control on the page, a full
 * oxide fill on a 2px oxide rule in wide-tracked capitals, because the refusal
 * is the one moment the screen spends that colour on.
 *
 * Outline: the rule is `border-input`, which clears 3:1 against the ground and
 * the card in both themes; `border-border` is decorative and vanished in light.
 *
 * Links: Base UI renders a real <button>. For navigation put `buttonVariants()`
 * on an <a> or next/link <Link> so the element keeps its link role.
 */
const buttonVariantsBase = cva(
  // No whitespace-nowrap here (A11Y-02, WCAG 1.4.10 Reflow): a long label on a
  // full-width control must be free to wrap at 320 CSS px, or its min-content
  // width can force the whole page wider than the viewport. Every size still
  // sets a min-height, not a fixed height, so a wrapped two-line label simply
  // grows past the 44px floor instead of being clipped.
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-none border border-transparent bg-clip-padding text-sm font-medium tracking-wide transition-colors duration-(--duration-fast) outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 disabled:border-border disabled:bg-transparent disabled:text-muted-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:text-muted-foreground",
        outline:
          "border-input bg-transparent hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent disabled:text-muted-foreground",
        ghost:
          "hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent disabled:text-muted-foreground",
        destructive:
          "border-2 border-destructive bg-destructive font-semibold tracking-[0.14em] text-destructive-foreground uppercase hover:bg-destructive/90 disabled:bg-transparent disabled:text-destructive",
        link: "text-foreground underline decoration-hairline underline-offset-4 hover:decoration-foreground disabled:text-muted-foreground",
      },
      size: {
        default: "min-h-11 px-4 py-2",
        xs: "min-h-8 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "min-h-11 px-3 text-xs",
        lg: "min-h-12 px-8",
        icon: "size-11",
        "icon-xs": "size-8 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonVariantsProps = VariantProps<typeof buttonVariantsBase> & {
  className?: ClassValue;
};

/**
 * The variant classes, with `className` merged through `cn`, so a caller's
 * override (a border, a padding) replaces the variant's class instead of
 * competing with it in the cascade.
 */
export function buttonVariants({
  className,
  ...variants
}: ButtonVariantsProps = {}): string {
  return cn(buttonVariantsBase(variants), className);
}
