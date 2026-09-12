import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A pnpm-lock.yaml sits in the home directory above this project, so Next
  // inferred /Users/<you> as the workspace root and traced output from there.
  // Pin the root to this project. npm scripts always run with the cwd here.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
