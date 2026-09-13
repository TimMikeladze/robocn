import Link from "next/link"

import { GitHubIcon, LinkedInIcon, XIcon } from "@/components/site/brand-icons"
import { Logo } from "@/components/site/logo"
import { SiteNav } from "@/components/site/site-nav"
import { ThemeCustomizer } from "@/components/site/theme-customizer"
import { ThemeToggle } from "@/components/site/theme-toggle"
import { site } from "@/lib/site"

/** One shape for the three social links: a 32 px square target, not bare ink. */
const iconLink =
  "hidden size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo className="size-7 shrink-0" />
          {/* `leading-none` so `items-center` centres the letters against the
              square mark rather than centring a line box that sits low. */}
          <span className="text-[16px] font-semibold leading-none tracking-[-0.02em]">
            {site.name}
          </span>
        </Link>
        {/* Ends the lockup: without it the nav reads as part of the brand. */}
        <span aria-hidden className="hidden h-4 w-px bg-border sm:block" />
        <SiteNav />
        <div className="ml-auto flex items-center gap-0.5">
          <a
            href={site.repository}
            target="_blank"
            rel="noreferrer"
            aria-label="robocn on GitHub"
            className={iconLink}
          >
            <GitHubIcon className="size-4" />
          </a>
          <a
            href={site.author.twitter}
            target="_blank"
            rel="noreferrer"
            aria-label="Author on X"
            className={iconLink}
          >
            <XIcon className="size-4" />
          </a>
          <a
            href={site.author.linkedin}
            target="_blank"
            rel="noreferrer"
            aria-label="Author on LinkedIn"
            className={iconLink}
          >
            <LinkedInIcon className="size-4" />
          </a>
          <ThemeCustomizer />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

export { SiteHeader }
