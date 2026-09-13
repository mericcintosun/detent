import type { createToastManager } from "@base-ui/react/toast";

type ToastManager = ReturnType<typeof createToastManager>;
type ToastOptions = Parameters<ToastManager["add"]>[0];

/**
 * Raises a toast without loading the toast region. Base UI exposes its toast
 * parts only as one `Toast` namespace, which cannot be tree shaken, so a static
 * import of the real manager would put the whole region in the caller's first
 * load. This forwards each call to the manager in components/ui/toast.tsx,
 * which is already loaded by the time an operator action raises a toast
 * (components/operations-console.tsx mounts the region after hydration).
 */
export const toast = {
  add(options: ToastOptions): void {
    void import("./toast").then((mod) => mod.toast.add(options));
  },
};
