// The favicon. LOGO_POLICY in IDENTITY.md is raster-only, so this route never
// draws a mark: it reads the same public/brand/logo.png the shell's home link
// already uses (components/shell/brand-mark.tsx) and centres it on the bone ground the
// mark was made for. Replaces the hand-drawn app/icon.svg, which duplicated
// the mark as a second, vector, drawing of it.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Read once per server instance; the file is a build artefact, not a request input. */
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

export default function Icon() {
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
        <img src={mark} width={30} height={30} alt="" />
      ) : (
        <span
          style={{
            fontSize: 22,
            color: "#191713",
            fontWeight: 700,
          }}
        >
          D
        </span>
      )}
    </div>,
    { ...size },
  );
}
