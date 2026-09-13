import { describe, expect, it } from "vitest";
import { selectRecordView } from "@/components/record/record-view";
import { buttonVariants } from "@/components/ui/button-variants";
import type { PlanRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

describe("cn knows the Detent utilities", () => {
  it("keeps a custom font size next to a tone colour", () => {
    expect(cn("text-caption text-success")).toBe("text-caption text-success");
  });

  it("lets a later custom utility replace an earlier one of its group", () => {
    expect(cn("text-caption", "text-body")).toBe("text-body");
    expect(cn("max-w-measure-md", "max-w-measure-xl")).toBe("max-w-measure-xl");
    expect(cn("py-section", "py-10")).toBe("py-10");
    expect(cn("ease-standard", "ease-wipe")).toBe("ease-wipe");
  });
});

describe("buttonVariants", () => {
  it("merges a className override through cn", () => {
    const classes = buttonVariants({ variant: "outline", className: "px-8" });
    expect(classes).toContain("px-8");
    expect(classes).not.toMatch(/(^| )px-4( |$)/);
  });

  it("draws the outline rule in the input token, which clears 3:1", () => {
    const classes = buttonVariants({ variant: "outline" }).split(" ");
    expect(classes).toContain("border-input");
    expect(classes).not.toContain("border-border");
  });
});

describe("record page tones", () => {
  const record = (state: PlanRecord["state"]) => ({ state }) as PlanRecord;

  it("shows an unconfigured anchor as a neutral state, not an error", () => {
    expect(selectRecordView(record("unwired")).pillTone).toBe("muted");
  });

  it("keeps destructive for a read that failed", () => {
    expect(selectRecordView(record("unreadable")).pillTone).toBe("destructive");
  });
});
