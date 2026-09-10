"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4 py-24 text-center">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
