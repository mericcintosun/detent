// The link preview for one permanent record. Named "Plan record" and the plan
// hash shortened; nothing else, because this image is a build/request time
// artefact and the record's actual state, timestamps and links come from
// readPlanRecord, a chain read that has no place inside an image generator.
//
// The hash is validated with planHashSchema, the same schema
// app/record/[planHash]/page.tsx parses the path segment with, so the two
// routes can never disagree about what a valid plan hash looks like. An
// invalid segment (a crawler probing a malformed URL, for instance) falls
// back to the generic image from the parent route instead of rendering a
// broken or misleading preview.

import { ImageResponse } from "next/og";
import { planHashSchema } from "@/lib/schemas";
import GenericImage, { loadOgFonts } from "../../opengraph-image";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Plan record on Detent, the anchored plan hash shortened";

const BONE = "#f4f1ea";
const INK = "#191713";
const GOLD = "#ad8c3a";

/** "0x1234...abcd", the same truncation idiom the console uses for addresses. */
function shortenHash(hash: `0x${string}`): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

export default async function Image({
  params,
}: {
  params: Promise<{ planHash: string }>;
}) {
  const { planHash } = await params;
  const parsed = planHashSchema.safeParse(planHash);

  if (!parsed.success) {
    // Not a valid plan hash: the same generic picture every other page uses,
    // rather than a picture that names an invalid hash as if it were real.
    return GenericImage();
  }

  const fonts = await loadOgFonts();
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
      <span
        style={{
          fontFamily: bodyFont,
          fontWeight: 400,
          fontSize: 24,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: INK,
        }}
      >
        Plan record
      </span>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{ display: "flex", width: 180, height: 2, background: GOLD }}
        />
        <span
          style={{
            fontFamily: displayFont,
            fontWeight: 700,
            fontSize: 56,
            color: INK,
            letterSpacing: -1,
          }}
        >
          {shortenHash(parsed.data)}
        </span>
      </div>
    </div>,
    { ...size, fonts },
  );
}
