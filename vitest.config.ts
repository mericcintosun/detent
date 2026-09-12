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
    // The suite is offline by contract. These are the four values that would
    // otherwise let a developer's shell put a live Privy call or a Hashio read
    // inside a test run, so they are pinned empty here rather than assumed
    // absent. A test that needs another state stubs it with vi.stubEnv and
    // re-imports the module under vi.resetModules.
    env: {
      NEXT_PUBLIC_ADAPTER_MODE: "fake",
      NEXT_PUBLIC_ATS_TOKEN_ADDRESS: "",
      NEXT_PUBLIC_PLAN_ANCHOR_ADDRESS: "",
      NEXT_PUBLIC_CONTRACT_ADDRESS: "",
      NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS: "",
      OPERATOR_PRIVATE_KEY: "",
      PRIVY_APP_ID: "",
      PRIVY_APP_SECRET: "",
    },
  },
});
