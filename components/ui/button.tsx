import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // RADIUS sharp per IDENTITY.md. A disabled control is a control that is
  // waiting, so it keeps its shape and its rule and loses only its fill: an
  // opacity wash over gold on parchment is the lowest contrast thing a page can
  // draw, which is exactly backwards for the two buttons that carry the demo.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-sm font-medium tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 disabled:border disabled:border-border disabled:bg-transparent disabled:text-muted-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:text-muted-foreground",
        outline:
          "border border-border bg-transparent hover:bg-accent hover:text-accent-foreground disabled:text-muted-foreground",
        ghost:
          "hover:bg-accent hover:text-accent-foreground disabled:text-muted-foreground",
        // SECOND oxide-red is spent on the refusal and nowhere else, so the
        // refusal control is the loudest control on the page: a full oxide fill
        // on a 2px oxide rule, ground ink, wide-tracked capitals. Waiting, it
        // keeps the rule and the oxide ink rather than fading to pink.
        destructive:
          "border-2 border-destructive bg-destructive font-semibold uppercase tracking-[0.14em] text-destructive-foreground hover:bg-destructive/90 disabled:bg-transparent disabled:text-bad",
        link: "text-primary underline-offset-4 hover:underline disabled:text-muted-foreground",
      },
      // At least 44px tall on every size, so every control on the demo path is a
      // real touch target at 360px.
      size: {
        default: "min-h-11 px-4 py-2",
        sm: "min-h-11 rounded-none px-3 text-xs",
        lg: "min-h-12 rounded-none px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
