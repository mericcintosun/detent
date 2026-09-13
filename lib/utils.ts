import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge only knows the default Tailwind scales. Detent declares its
 * own type scale, measures, spacing and easings in app/globals.css (listed in
 * docs/frontend/04_DESIGN_SYSTEM.md sections 5, 6 and 8); without them here a
 * custom size such as `text-caption` is read as a text colour and dropped the
 * moment a tone class like `text-success` follows it.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "label",
        "caption",
        "body-sm",
        "body",
        "lead",
        "heading",
        "title",
        "headline",
        "display",
      ],
      container: [
        "measure-2xs",
        "measure-xs",
        "measure-sm",
        "measure-md",
        "measure-lg",
        "measure-xl",
        "content",
        "page",
      ],
      spacing: ["touch", "gutter", "section"],
      ease: ["standard", "emphasized", "exit", "wipe"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
