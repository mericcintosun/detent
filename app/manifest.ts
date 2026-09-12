// The web app manifest. Detent is a console read mostly in a desktop tab, not
// an installed app, so this exists for the browsers that still ask for one
// (an "add to home screen" prompt, a taskbar pin) rather than for a real
// install flow. Colours are the two brand anchors from IDENTITY.md: bone for
// the ground the whole product renders on, ink for the one text colour dark
// enough to sit on it.

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Detent, operator console for tokenized securities",
    short_name: "Detent",
    description:
      "Operator console for tokenized securities: preview a coupon run or a forced transfer line by line, then lock the treasury wallet to exactly that transaction.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1ea",
    theme_color: "#191713",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
