"use client";

import { useSyncExternalStore } from "react";
import { OfflineNotice } from "./states";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Appears while the browser reports no network. The server snapshot is online,
 * so the server and the hydrating client both render nothing and the banner
 * only mounts after hydration, when the real value is read.
 */
export function OfflineBanner({ className }: { className?: string }) {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  return online ? null : <OfflineNotice className={className} />;
}
