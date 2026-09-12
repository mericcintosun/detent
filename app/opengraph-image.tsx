// The link preview image for every page that does not define its own (the
// dynamic /record/[planHash] route is the one exception, see the sibling file
// there). Bone ground, ink text, one gold hairline: the same three anchors
// IDENTITY.md declares for the product itself. The run mode is deliberately
// absent, because this image is fixed at build time and the run mode is a
// request time fact the console prints instead.
//
// Replaces the static app/opengraph-image.png, a stock photograph of a wax
// seal that named neither the product nor what it does. See the worktree
// report for the one line change app/layout.tsx still needs: its metadataBase
// comment describes the file it replaces.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export const alt =
  "Detent, operator console for tokenized securities: preview a coupon run or a forced transfer line by line, then lock the treasury wallet to exactly that transaction.";

const NAME = "Detent";
const DESCRIPTION =
  "Operator console for tokenized securities: preview a coupon run or a forced transfer line by line, then lock the treasury wallet to exactly that transaction.";

const BONE = "#f4f1ea";
const INK = "#191713";
const GOLD = "#ad8c3a";

type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
};

/**
 * Google Fonts serves ttf/otf/woff depending on the User-Agent the css2 request
 * carries; this UA is the one documented for getting a plain, satori
 * compatible woff back rather than a woff2. Runs at build time for this
 * static route, so a network failure here (offline CI, a firewalled build
 * runner) is caught and logged rather than failing the build: the image still
 * renders, on the platform default font, and the console warning says why.
 */
async function fetchFont(
  family: string,
  weight: 400 | 700,
): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
    const cssResponse = await fetch(cssUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/534.57.2 (KHTML, like Gecko) Version/5.1.7 Safari/534.57.2",
      },
    });
    if (!cssResponse.ok) return null;
    const css = await cssResponse.text();
    const match = css.match(
      /src: url\((.+?)\) format\((?:"|')(?:woff|truetype|opentype)(?:"|')\)/,
    );
    const fontUrl = match?.[1];
    if (!fontUrl) return null;
    const fontResponse = await fetch(fontUrl);
    if (!fontResponse.ok) return null;
    return await fontResponse.arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * Loads the two brand fonts for og image text. Offline-safe: any failure
 * (no network at build time, Google Fonts unreachable) returns an empty list,
 * a warning is printed once, and ImageResponse falls back to its bundled
 * default font rather than the build failing.
 */
export async function loadOgFonts(): Promise<OgFont[]> {
  const [caslon400, caslon700, franklin400] = await Promise.all([
    fetchFont("Libre Caslon Text", 400),
    fetchFont("Libre Caslon Text", 700),
    fetchFont("Libre Franklin", 400),
  ]);

  const fonts: OgFont[] = [];
  if (caslon400)
    fonts.push({
      name: "Libre Caslon Text",
      data: caslon400,
      weight: 400,
      style: "normal",
    });
  if (caslon700)
    fonts.push({
      name: "Libre Caslon Text",
      data: caslon700,
      weight: 700,
      style: "normal",
    });
  if (franklin400)
    fonts.push({
      name: "Libre Franklin",
      data: franklin400,
      weight: 400,
      style: "normal",
    });

  if (fonts.length === 0) {
    console.warn(
      "opengraph-image: could not load Libre Caslon Text or Libre Franklin from Google Fonts; rendering with the platform default font instead.",
    );
  }
  return fonts;
}

function brandMarkDataUrl(): string | null {
  try {
    const bytes = readFileSync(
      join(process.cwd(), "public", "brand", "logo.png"),
    );
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image() {
  const fonts = await loadOgFonts();
  const mark = brandMarkDataUrl();
  const displayFont = fonts.some((f) => f.name === "Libre Caslon Text")
    ? "Libre Caslon Text"
    : "serif";
  const bodyFont = fonts.some((f) => f.name === "Libre Franklin")
    ? "Libre Franklin"
    : "sans-serif";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: BONE,
        padding: "72px 88px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        {mark ? <img src={mark} width={72} height={72} alt="" /> : null}
        <span
          style={{
            fontFamily: displayFont,
            fontWeight: 700,
            fontSize: 64,
            color: INK,
            letterSpacing: -1,
          }}
        >
          {NAME}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{ display: "flex", width: 180, height: 2, background: GOLD }}
        />
        <span
          style={{
            fontFamily: bodyFont,
            fontWeight: 400,
            fontSize: 32,
            lineHeight: 1.4,
            color: INK,
            maxWidth: 920,
          }}
        >
          {DESCRIPTION}
        </span>
      </div>
    </div>,
    { ...size, fonts },
  );
}
