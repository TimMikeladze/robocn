"use client"

import { ThemeProvider as NextThemes } from "next-themes"

function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  )
}

export { ThemeProvider }
