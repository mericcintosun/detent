import type { Metadata } from "next";
import { OperationsConsole } from "@/components/operations-console";
import {
  REGISTER_STALE_AFTER_MS,
  getRegisterSnapshot,
  isPrivyLive,
  snapshotReadAt,
} from "@/lib/register";

/**
 * Matches REGISTER_CACHE_MS in lib/config.ts. Twelve holders times three relay
 * reads is not a cost to pay on every navigation during a demo walk.
 */
export const revalidate = 30;

// There is deliberately no app/loading.tsx. On this statically rendered page it
// only added a streamed Suspense boundary whose deferred reveal script moved
// body nodes while React was still hydrating, the main source of React #418
// under parallel cold loads.

export const metadata: Metadata = {
  title: "Coupon run console",
  description:
    "Read the BMEQ quarterly coupon distribution line by line, then lock the treasury key to exactly that payout.",
  alternates: { canonical: "/" },
};

export default async function ConsolePage() {
  const snapshot = await getRegisterSnapshot();
  /* Read on the server so the fold can state which of the two modes a reader is
     looking at. A boolean crosses to the client, never the module: lib/privy.ts
     reads PRIVY_APP_SECRET. */
  const signerLive = isPrivyLive();

  return (
    <OperationsConsole
      snapshot={snapshot}
      signerLive={signerLive}
      readAt={snapshotReadAt(snapshot)}
      staleAfterMs={REGISTER_STALE_AFTER_MS}
    />
  );
}
