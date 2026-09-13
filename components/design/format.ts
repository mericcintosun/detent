/**
 * Truncates a hex string to its first `lead` and last `tail` characters around
 * an ellipsis. Values that are already short come back unchanged.
 */
export function truncateMiddle(value: string, lead = 10, tail = 6): string {
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}
