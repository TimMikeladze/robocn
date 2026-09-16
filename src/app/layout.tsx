import type { Metadata, Viewport } from "next"
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google"

import { Analytics } from "@/components/site/analytics"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { ThemeProvider } from "@/components/site/theme-provider"
import { ThemeScript } from "@/components/site/theme-script"
import { site } from "@/lib/site"

import "./globals.css"

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
})

/** Described for a reader who gets the alt text instead of the picture. */
const ogAlt = `${site.name} — twelve robot components on a contact sheet beside the wordmark`

/** One string for the tab, the card, GitHub's description and the repo topics. */
const title = `${site.name} — ${site.tagline}`

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: title, template: `%s — ${site.name}` },
  description: site.description,
  applicationName: site.name,
  keywords: [...site.keywords],
  authors: [{ name: site.author.name, url: site.author.portfolio }],
  creator: site.author.name,
  publisher: site.author.name,
  category: "technology",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    title,
    description: site.description,
    url: site.url,
    siteName: site.name,
    type: "website",
    locale: "en_US",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: ogAlt }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: site.description,
    // The handle a card credits, so a repost carries the author with it.
    creator: "@linesofcode",
    site: "@linesofcode",
    images: [{ url: "/og.png", alt: ogAlt }],
  },
  // Every page is its own canonical; a sub-route overrides this with its path.
  // The `types` entry is the `.md` mirror, so a crawler reading `rel=alternate`
  // finds the Markdown without having to guess at the convention.
  alternates: {
    canonical: "/",
    types: { "text/markdown": "/docs.md" },
  },
  other: {
    // Named in the head as well as in `/llms.txt`, because an agent that starts
    // from a page rather than from the root should still find the index.
    "llms-txt": "/llms.txt",
  },
}

/**
 * The browser chrome follows the palette. Two entries rather than one: a
 * visitor in dark mode gets the dark ground behind the address bar, which is
 * the whole point of the tag.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f4f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1116" },
  ],
  colorScheme: "light dark",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable}`}
    >
      <body className="min-h-dvh antialiased">
        {/* Before anything below it is parsed, so no frame paints in the wrong palette. */}
        <ThemeScript />
        {/* Nothing at all unless NEXT_PUBLIC_UMAMI_WEBSITE_ID is set: `docs/analytics.md`. */}
        <Analytics />
        {/* For an agent reading the rendered page rather than the head: the
            Markdown mirrors are the better surface, and this is where it finds
            out they exist. `docs/site-polish.md`. */}
        <p className="sr-only">
          For the complete index, see /llms.txt. A Markdown version of any
          documentation page is available by appending .md to its URL or by
          sending an Accept: text/markdown header.
        </p>
        <ThemeProvider>
          <div className="flex min-h-dvh flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
