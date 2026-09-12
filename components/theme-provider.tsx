"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";

/**
 * Light, dark or the operating system's choice, written as a class on <html> by
 * an inline script before first paint so there is no flash. `color-scheme`
 * follows the class through app/globals.css and through next-themes, so native
 * controls and scrollbars match the theme.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      enableColorScheme
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
