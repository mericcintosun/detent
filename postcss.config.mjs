// Object form, not the array form. Next accepts both, but vite (and therefore
// vitest) rejects `plugins: ["@tailwindcss/postcss"]` with "Invalid PostCSS
// Plugin found at: plugins[0]", which made `npm test` exit 1 with zero tests
// executed on a fresh clone.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
