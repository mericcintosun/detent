import { cva, type VariantProps } from "class-variance-authority";

/**
 * shadcn base-lyra badge. Square, like a register stamp. The text wraps rather
 * than overflowing a 360px column, which the fixed-height Lyra default did.
 */
export const badgeVariants = cva(
  "group/badge inline-flex min-h-5 w-fit shrink-0 items-center justify-center gap-1 rounded-none border border-transparent px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors focus-visible:ring-2 focus-visible:ring-ring [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border-border text-foreground [a]:hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-foreground underline decoration-hairline underline-offset-4",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeVariantsProps = VariantProps<typeof badgeVariants>;
