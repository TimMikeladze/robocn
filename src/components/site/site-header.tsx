import Link from "next/link"

import { Logo } from "@/components/site/logo"
import { ThemeToggle } from "@/components/site/theme-toggle"
import { site } from "@/lib/site"

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">{site.name}</span>
        </Link>
        <nav className="flex items-center gap-5 text-[13px] text-muted-foreground">
          <Link href="/docs" className="transition-colors hover:text-foreground">
            Components
          </Link>
          <Link
            href="/docs/installation"
            className="transition-colors hover:text-foreground"
          >
            Install
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <a
            href={site.repository}
            target="_blank"
            rel="noreferrer"
            className="px-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            GitHub
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

export { SiteHeader }
