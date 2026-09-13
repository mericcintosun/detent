"use client";

/**
 * The last boundary: the root layout itself failed, so nothing it provides can be
 * trusted here. No theme provider, no fonts, no app/globals.css, no component
 * that imports any of them. The page is self-contained and uses CSS system
 * colours (Canvas, CanvasText, GrayText) under `color-scheme: light dark`, so it
 * follows the operating system's theme and stays readable in both without
 * defining a colour of its own.
 */
const STYLES = `
:root { color-scheme: light dark; }
body {
  margin: 0;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  background: Canvas;
  color: CanvasText;
  font: 1rem/1.65 ui-sans-serif, system-ui, "Segoe UI", sans-serif;
}
main { max-width: 36rem; padding: 2rem 1.25rem; }
.label { font-size: 0.6875rem; letter-spacing: 0.16em; text-transform: uppercase; color: GrayText; margin: 0 0 1rem; }
h1 { font: 400 2.25rem/1.1 Georgia, "Times New Roman", serif; margin: 0 0 1rem; }
p { margin: 0 0 1.5rem; }
.actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
button, a {
  min-height: 2.75rem; padding: 0 1rem; display: inline-flex; align-items: center;
  font: inherit; color: CanvasText; background: Canvas; border: 1px solid CanvasText;
  text-decoration: none; cursor: pointer;
}
button:focus-visible, a:focus-visible { outline: 2px solid Highlight; outline-offset: 2px; }
code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.8125rem; }
.ref { font-size: 0.8125rem; color: GrayText; }
`;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <title>Detent could not load</title>
        <style>{STYLES}</style>
      </head>
      <body>
        <main>
          <p className="label">Detent</p>
          <h1>Detent could not load</h1>
          <p>
            The application shell failed before any page could render. Loading a
            page never signs or sends anything, so trying again is safe.
          </p>
          <div className="actions">
            <button type="button" onClick={() => reset()}>
              Try again
            </button>
            {/* A full document load, not a client navigation: the layout that
                client routing relies on is the thing that failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/">Reload the console</a>
          </div>
          {error.digest ? (
            <p className="ref">
              Reference <code>{error.digest}</code>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
