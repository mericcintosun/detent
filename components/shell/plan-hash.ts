import { planHashSchema } from "@/lib/schemas";

export type PlanHashCheck =
  { ok: true; value: `0x${string}` } | { ok: false; message: string };

/**
 * Validates what a reader typed into the palette's record lookup with the same
 * schema the record route uses, so the palette never sends anyone to a 404, and
 * says what is wrong in words rather than only that something is.
 */
export function checkPlanHash(input: string): PlanHashCheck {
  const value = input.trim();
  const parsed = planHashSchema.safeParse(value);
  if (parsed.success) return { ok: true, value: parsed.data };
  if (value.length === 0) {
    return { ok: false, message: "Paste a plan hash to open its record." };
  }
  if (!/^0x/i.test(value) || value.startsWith("0X")) {
    return {
      ok: false,
      message: "A plan hash starts with a lowercase 0x.",
    };
  }
  const digits = value.slice(2);
  if (!/^[0-9a-fA-F]*$/.test(digits)) {
    return {
      ok: false,
      message: "A plan hash holds only hexadecimal characters after 0x.",
    };
  }
  return {
    ok: false,
    message: `A plan hash has 64 hexadecimal characters after 0x; this one has ${digits.length}.`,
  };
}
