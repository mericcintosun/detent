import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

/**
 * Flat config, ESLint 9.
 *
 * The rule set is the two Next presets plus a short list of rules that catch
 * the mistakes this codebase can actually make, and nothing that would force a
 * sweep of eslint-disable comments through working code. eslint-config-prettier
 * comes last so no rule here argues with the formatter.
 */
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "contracts/cache/**",
      "contracts/out/**",
      "next-env.d.ts",
      "test-results/**",
      "playwright-report/**",
      "blob-report/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
  {
    rules: {
      // Strict TypeScript is already on in tsconfig. These three are the ones
      // the compiler does not report.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      eqeqeq: ["error", "always", { null: "ignore" }],
      // Server side logging in lib/ is deliberate and prefixed; a bare
      // console.log in app code is not.
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-var": "error",
      "prefer-const": "error",
    },
  },
  {
    // lib/ holds no component and no JSX, so the React Hook rules do not apply
    // there. They fire on lib/adapter.ts's useLiveRegister(), a plain predicate
    // whose name collides with the hook convention. Renaming it is the real
    // fix and it belongs to whoever owns that module.
    files: ["lib/**/*.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  {
    // Node scripts and config files are not part of the app bundle.
    files: ["scripts/**/*.mjs", "*.config.{mjs,ts}"],
    rules: { "no-console": "off" },
  },
  {
    files: ["tests/**/*.ts", "tests/**/*.tsx"],
    rules: { "no-console": "off" },
  },
];

export default eslintConfig;
