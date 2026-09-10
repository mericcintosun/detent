import type { Metadata } from "next";
import "./globals.css";

// TEMPLATE: replace the title and description with the product's real name
// and one-liner during scaffold. No placeholder copy may survive.
export const metadata: Metadata = {
  title: "App",
  description: "Replace with the product one-liner.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
