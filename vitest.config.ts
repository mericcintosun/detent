import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The repo root, without the trailing slash, so "@/lib/plan" resolves the same
// way it does under the Next build and the tsconfig paths entry.
const root = fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, "");

export default defineConfig({
  resolve: {
    alias: { "@": root },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
