import type { Metadata } from "next";
import {
  JetBrains_Mono,
  Libre_Caslon_Text,
  Libre_Franklin,
} from "next/font/google";
import { OfflineBanner } from "@/components/design/offline-banner";
import { MotionProvider } from "@/components/motion/motion-provider";
import {
  AppRail,
  CommandPaletteProvider,
  SiteFooter,
  SkipLink,
  TopBar,
  type RunModeFlags,
} from "@/components/shell";
import { ThemeProvider } from "@/components/theme-provider";
import { isPrivyLive } from "@/lib/privy";
import { ADAPTER_MODE, ATS_TOKEN_ADDRESS } from "@/lib/public-config";
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
   * metadataBase turns the URLs the metadata routes generate
   * (app/opengraph-image.tsx, app/twitter-image.tsx, the icons) into absolute
   * og:image and twitter:image URLs in view-source, which is the only form link
   * previews accept. The routes supply the images, so there is no
   * openGraph.images field here.
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
  /* The run mode is read here, on the server, and only two booleans cross into
     the shell. lib/privy.ts reads PRIVY_APP_SECRET and must never reach a client
     graph; the live register condition mirrors useLiveRegister() in
     lib/adapter.ts without importing the adapter. */
  const runMode: RunModeFlags = {
    registerLive: ADAPTER_MODE === "real" && Boolean(ATS_TOKEN_ADDRESS),
    signerLive: isPrivyLive(),
  };

  return (
    // suppressHydrationWarning: next-themes adds the theme class and
    // color-scheme to <html> before React hydrates. It applies to this element's
    // own attributes only, never to its children.
    <html
      lang="en"
      className={cn(
        display.variable,
        body.variable,
        mono.variable,
        // An anchor jump lands below the sticky top bar instead of under it.
        "scroll-pt-14 lg:scroll-pt-0",
      )}
      suppressHydrationWarning
    >
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          <MotionProvider>
            <CommandPaletteProvider>
              <SkipLink />
              <div className="lg:grid lg:grid-cols-[18rem_minmax(0,1fr)]">
                <AppRail {...runMode} />
                <div className="flex min-h-dvh min-w-0 flex-col">
                  <TopBar {...runMode} />
                  <main
                    id="main"
                    tabIndex={-1}
                    className="w-full flex-1 px-gutter py-8 outline-none lg:py-12"
                  >
                    <div className="mx-auto w-full max-w-page">{children}</div>
                  </main>
                  <SiteFooter />
                </div>
              </div>
              <OfflineBanner className="fixed inset-x-4 bottom-4 z-(--z-overlay) shadow-xl lg:left-auto lg:w-96" />
            </CommandPaletteProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
