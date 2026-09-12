import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

/**
 * Flat config, ESLint 9.
 *
 * The rule set is the two Next presets plus a short list of rules that catch
 * the mistakes this codebase can actually make, and nothing that would force a
 * sweep of eslint-disable comments through working code. eslint-config-next 16
 * ships native flat config arrays, so the presets are spread directly instead
 * of going through the eslintrc compatibility layer. eslint-config-prettier
 * comes last so no rule here argues with the formatter.
 */
const eslintConfig = defineConfig([
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "out/**",
    "build/**",
    "contracts/cache/**",
    "contracts/out/**",
    "next-env.d.ts",
    "test-results/**",
    "playwright-report/**",
    "blob-report/**",
  ]),
  ...nextVitals,
  ...nextTypescript,
  prettier,
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
    // eslint-plugin-react-hooks 7 (pulled in by eslint-config-next 16) adds the
    // React Compiler diagnostics. react-hooks/refs reports failureControl() in
    // this file because the closures it returns call send(), which touches a
    // ref. Those closures only run from click handlers, never during render, so
    // the report is a false positive for the code as written. The component
    // belongs to the frontend workstream; restructuring failureControl into
    // plain data plus handlers is the real fix, and this override should be
    // deleted in the same change.
    files: ["components/operations-console.tsx"],
    rules: { "react-hooks/refs": "off" },
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
]);

export default eslintConfig;
