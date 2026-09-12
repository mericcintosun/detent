import { RecordSkeleton } from "@/components/console-states";

/**
 * The record route reads planOf over the relay before it can render anything, so
 * this segment gets its own standby surface. It lives beside the console's other
 * standby surfaces in components/console-states.tsx, so the loading shape and the
 * record's own dl cannot drift apart.
 */
export default function Loading() {
  return <RecordSkeleton />;
}
