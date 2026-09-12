import type { Metadata } from "next";
import {
  JetBrains_Mono,
  Libre_Caslon_Text,
  Libre_Franklin,
} from "next/font/google";
import { MotionProvider } from "@/components/motion/motion-provider";
import { AboutSecurity, Rail } from "@/components/rail";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
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

/**
 * Hashes, addresses, amounts and code. JetBrains Mono is a variable face with a
 * slashed zero and distinct 1, l and I, which is what a reader comparing two
 * 64 character hashes needs. Not preloaded: no mono text is the largest element
 * on any first screen, so it must not compete with the display face for LCP.
 */
const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-jetbrains",
  fallback: [
    "ui-monospace",
    "SFMono-Regular",
    "Menlo",
    "Consolas",
    "monospace",
  ],
});

export const metadata: Metadata = {
  /**
   * metadataBase is what turns app/opengraph-image.png into an absolute og:image
   * URL in view-source, which is the only form link previews accept. The raster
   * is the convention file, so there is no openGraph.images field and no
   * opengraph-image.tsx.
   */
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://detent-app.vercel.app",
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: next-themes adds the theme class and
    // color-scheme to <html> before React hydrates. It applies to this element's
    // own attributes only, never to its children.
    <html
      lang="en"
      className={cn(display.variable, body.variable, mono.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <MotionProvider>
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
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
