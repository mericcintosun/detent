import type { Metadata } from "next";
import { Libre_Caslon_Text, Libre_Franklin } from "next/font/google";
import { Rail } from "@/components/rail";
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
  title: { default: "Detent", template: "%s | Detent" },
  description:
    "Operator console for tokenized securities: preview a coupon run or a forced transfer line by line, then lock the treasury wallet to exactly that transaction.",
  openGraph: {
    title: "Detent",
    description:
      "Preview the corporate action line by line, then lock the treasury key to exactly that transaction.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen antialiased">
        <div className="lg:flex lg:items-start">
          <Rail />
          <main className="min-w-0 flex-1 px-6 py-10 lg:px-12 lg:py-14">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
