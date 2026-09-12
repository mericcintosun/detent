import { RegisterSkeleton } from "@/components/console-states";

/**
 * One skeleton in the repo. The markup lives with the console's other standby
 * surfaces in components/console-states.tsx, so the loading shape and the empty
 * shapes cannot drift apart.
 */
export default function Loading() {
  return <RegisterSkeleton />;
}
