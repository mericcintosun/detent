import type { Metadata } from "next";
import { Libre_Caslon_Text, Libre_Franklin } from "next/font/google";
import { AboutSecurity, Rail } from "@/components/rail";
import "./globals.css";

const display = Libre_Caslon_Text({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-caslon",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const body = Libre_Franklin({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-franklin",
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
});

export const metadata: Metadata = {
  /**
   * metadataBase is what turns app/opengraph-image.png into an absolute og:image
   * URL in view-source, which is the only form link previews accept. The raster
   * is the convention file, so there is no openGraph.images field and no
   * opengraph-image.tsx.
   */
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://detent-app.vercel.app"
  ),
  title: { default: "Detent", template: "%s | Detent" },
  description:
    "Operator console for tokenized securities: preview a coupon run or a forced transfer line by line, then lock the treasury wallet to exactly that transaction.",
  openGraph: {
    title: "Detent",
    description:
      "Preview the corporate action line by line, then lock the treasury key to exactly that transaction.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Detent",
    description:
      "A treasury key can sign anything the contract exposes. Detent narrows it to the one coupon run you just read, line by line.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen antialiased">
        <div className="lg:flex lg:items-start">
          <Rail />
          <div className="min-w-0 flex-1">
            <main className="px-5 py-8 sm:px-6 lg:px-12 lg:py-14">
              {children}
            </main>
            {/* The about and security rows the rail used to spend the phone's
                first screen on. Rendered once here so they reach / and
                /record/[planHash] alike; the rail shows the same block again
                from lg up, where the column has the height for it. */}
            <section
              aria-label="About and security"
              className="border-t border-border px-5 py-8 sm:px-6 lg:hidden"
            >
              <AboutSecurity />
            </section>
          </div>
        </div>
      </body>
    </html>
  );
}
