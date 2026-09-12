// The iOS home screen icon. Same raster brand mark as app/icon.tsx, at the
// 180x180 size Apple's own guidance asks for, with more breathing room around
// the mark than the 32px favicon has space for.
//
// Falls back to a typographic "D" monogram, Libre Caslon Text style, on bone
// with an ink border, only if public/brand/logo.png cannot be read. That
// branch has not run against this repository: the raster mark ships in
// public/brand/, so this is the path an operator would only see if that file
// were ever removed.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

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

export default function AppleIcon() {
  const mark = brandMarkDataUrl();

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f4f1ea",
      }}
    >
      {mark ? (
        <img src={mark} width={148} height={148} alt="" />
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 148,
            height: 148,
            border: "4px solid #191713",
            fontFamily: '"Libre Caslon Text", Georgia, serif',
            fontSize: 96,
            color: "#191713",
          }}
        >
          D
        </div>
      )}
    </div>,
    { ...size },
  );
}
