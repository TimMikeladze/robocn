import type { Metadata, Viewport } from "next"
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google"
import Link from "next/link"

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

const description =
  "One Rubik's cube, owned by everybody. Each person gets one move a day. When it is solved it is archived forever."

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://cube.robocn.dev"),
  title: { default: "cube — one move a day", template: "%s — cube" },
  description,
  applicationName: "cube",
  robots: { index: true, follow: true },
  openGraph: {
    title: "cube — one move a day",
    description,
    url: "/",
    siteName: "cube",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "cube — one move a day", description },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f4f6" },
    { media: "(prefers-color-scheme: dark)", color: "#131824" },
  ],
  colorScheme: "light dark",
}

/** The theme the visitor already chose, before the first frame paints. */
const themeScript = `(() => {
  try {
    const stored = localStorage.getItem("cube-theme")
    const dark = stored ? stored === "dark" : matchMedia("(prefers-color-scheme: dark)").matches
    document.documentElement.classList.toggle("dark", dark)
  } catch {}
})()`

function CubeMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-[22px] w-[22px]"
      style={{ color: "var(--shell)" }}
    >
      <path
        d="M12 2 21 7v10l-9 5-9-5V7l9-5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12 2v10m0 0 9-5m-9 5-9-5m9 5v10" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
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
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <div className="flex min-h-dvh flex-col">
          <header className="border-b border-border">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
              <Link href="/" className="flex items-center gap-2.5">
                <CubeMark />
                <span className="font-mono text-sm font-medium tracking-tight">
                  cube<span className="text-muted-foreground">.robocn.dev</span>
                </span>
              </Link>
              <nav className="flex items-center gap-1 font-mono text-[12px] tracking-wide uppercase">
                <Link href="/log" className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground">
                  log
                </Link>
                <Link href="/leaderboard" className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground">
                  leaderboard
                </Link>
                <a
                  href="https://robocn.dev"
                  className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground"
                >
                  robocn
                </a>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border">
            <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 font-mono text-[11px] text-muted-foreground">
              <span>
                built with the{" "}
                <a href="https://robocn.dev" className="underline underline-offset-2 hover:text-foreground">
                  rubiks-cube
                </a>{" "}
                component from robocn
              </span>
              <span>one move a day, forever</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
