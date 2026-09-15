"use client"

/**
 * *On This Page*, on the right of a docs page from `xl` up.
 *
 * The sections are passed in rather than scraped out of the DOM: a robocn doc
 * page renders a fixed list — Install, Notes, Usage, Props, API, Source — and
 * the page already knows which of them it drew. Scraping headings back out
 * would be the same list, read less reliably.
 */

import * as React from "react"

import { cn } from "@/lib/utils"

export interface TocSection {
  id: string
  label: string
}

function DocsToc({ sections }: { sections: TocSection[] }) {
  const [active, setActive] = React.useState<string | null>(sections[0]?.id ?? null)

  React.useEffect(() => {
    if (!sections.length) return
    const headings = sections
      .map((section) => document.getElementById(section.id))
      .filter((node): node is HTMLElement => node !== null)
    if (!headings.length) return

    /**
     * The heading nearest the top of the viewport that has not yet passed it —
     * or, once everything has scrolled past, the last one. Reading positions on
     * each callback rather than trusting `isIntersecting` is what makes a fast
     * scroll land on the right entry instead of one it flew through.
     */
    const pick = () => {
      // Clear of the sticky header, so the section under it is the active one.
      const line = 96
      let current = headings[0]
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= line) current = heading
      }
      setActive(current.id)
    }

    const observer = new IntersectionObserver(pick, {
      rootMargin: "-80px 0px -60% 0px",
      threshold: [0, 1],
    })
    for (const heading of headings) observer.observe(heading)
    window.addEventListener("scroll", pick, { passive: true })
    pick()

    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", pick)
    }
  }, [sections])

  if (sections.length < 2) return null

  return (
    <nav
      aria-label="On this page"
      className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] self-start overflow-y-auto xl:block"
    >
      <h2 className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground">
        On this page
      </h2>
      <ul className="space-y-1 border-l border-border">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              aria-current={active === section.id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l py-1 pl-3 text-[13px] transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground",
                active === section.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground",
              )}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export { DocsToc }
