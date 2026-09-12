import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        // An editable cell, not a line of prose: the field carries the surface
        // colour and the value carries ink, so a typed number never reads as
        // placeholder text. The placeholder keeps the muted tone.
        "flex h-11 w-full rounded-none border border-input bg-card px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
