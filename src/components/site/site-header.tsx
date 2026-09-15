import Link from "next/link"

import { GitHubIcon, LinkedInIcon, XIcon } from "@/components/site/brand-icons"
import { CommandMenu } from "@/components/site/command-menu"
import { HeaderBar } from "@/components/site/header-bar"
import { Logo } from "@/components/site/logo"
import { SiteNav } from "@/components/site/site-nav"
import { ThemeCustomizer } from "@/components/site/theme-customizer"
import { ThemeToggle } from "@/components/site/theme-toggle"
import { docs } from "@/lib/docs"
import { formatStars, repoStars } from "@/lib/github"
import { site } from "@/lib/site"

/**
 * One shape for the author's two social links: a 32 px square target, not bare
 * ink. They appear from `lg` only — they are in the footer as well, and the bar
 * has to fit a search field now. What the header keeps at every width is the
 * search, the theme controls and (from `sm`) the repository.
 */
const iconLink =
  "hidden size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex"

/**
 * Only what the palette needs. Sending all 208 entries is the same payload the
 * landing grid already ships, so nothing new goes on the wire for it.
 */
const searchEntries = docs.map(({ slug, title, summary, group, item }) => ({
  slug,
  title,
  summary,
  group,
  item,
}))

async function SiteHeader() {
  const stars = await repoStars()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <HeaderBar>
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo className="size-9 shrink-0" />
          {/* `leading-none` so `items-center` centres the letters against the
              square mark rather than centring a line box that sits low. */}
          <span className="text-[16px] font-semibold leading-none tracking-[-0.02em]">
            {site.name}
          </span>
        </Link>
        {/* Ends the lockup: without it the nav reads as part of the brand. */}
        <span aria-hidden className="hidden h-4 w-px bg-border sm:block" />
        {/* Below `sm` the bar cannot hold the nav *and* the search without
            overflowing, and the search is the better of the two on a phone:
            these same three destinations are the palette's first group. */}
        <SiteNav className="hidden sm:flex" />
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <CommandMenu entries={searchEntries} />
          <div className="flex items-center gap-0.5">
            <a
              href={site.repository}
              target="_blank"
              rel="noreferrer"
              aria-label={
                stars === null
                  ? "robocn on GitHub"
                  : `robocn on GitHub — ${stars} stars`
              }
              // The count widens the target, so this one is a pill rather than
              // a square; the other two stay squares.
              className="hidden h-8 items-center gap-1.5 rounded-md px-2 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
            >
              <GitHubIcon className="size-4" />
              {/* Omitted rather than zeroed when the API says nothing. */}
              {stars === null ? null : (
                <span className="font-mono text-[11px] tabular-nums">
                  {formatStars(stars)}
                </span>
              )}
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
      </HeaderBar>
    </header>
  )
}

export { SiteHeader }
