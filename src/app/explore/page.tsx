/**
 * Everything published, across every organization, newest first. The search is
 * a plain GET form — `?q=` — so a result is a URL that can be shared, and the
 * page works with no script at all.
 */

import type { Metadata } from "next"
import Link from "next/link"
import { Search } from "lucide-react"

import { rail } from "@/components/site/rail"
import { EmptyState } from "@/components/studio/kit"
import { DesignGrid } from "@/components/studio/public/design-grid"
import { galleryCards } from "@/components/studio/public/stage-view"
import { eyebrow, fieldClass } from "@/components/studio/styles"
import { Button, buttonVariants } from "@/components/ui/button"
import { site } from "@/lib/site"
import { listPublished } from "@/lib/studio/queries"
import { parseSettings } from "@/lib/studio/settings"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

const description =
  "Machines posed, themed and published by teams using robocn Studio. Open one to copy its JSX, embed it, or fork it into your own workspace."

export const metadata: Metadata = {
  title: "Explore",
  description,
  alternates: { canonical: "/explore" },
  openGraph: {
    title: `Explore — ${site.name}`,
    description,
    url: `${site.url}/explore`,
    type: "website",
  },
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { q } = await searchParams
  const query = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 80) ?? ""
  const rows = await listPublished({ query })
  const cards = galleryCards(rows)

  // A byline only links to a gallery that exists: an unlisted organization's `/o` page is a 404.
  const listedOrgs = [
    ...new Set(
      rows.flatMap((row) => (parseSettings(row.orgSettings).profile.listed ? [row.orgSlug] : [])),
    ),
  ]

  return (
    <div className={cn(rail, "py-8 sm:py-10")}>
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-border pb-6">
        <div className="min-w-0">
          <p className={eyebrow}>Studio</p>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-tight">Explore</h1>
          <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        <form action="/explore" method="get" role="search" className="flex w-full gap-2 sm:w-80">
          <label htmlFor="explore-q" className="sr-only">
            Search published designs
          </label>
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="explore-q"
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Name or machine"
              maxLength={80}
              className={cn(fieldClass, "pl-8")}
            />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      </header>

      <div className="mt-6">
        {query ? (
          <p className="mb-4 text-[13px] text-muted-foreground">
            {cards.length} {cards.length === 1 ? "design" : "designs"} matching{" "}
            <span className="text-foreground">&ldquo;{query}&rdquo;</span> ·{" "}
            <Link href="/explore" className="underline-offset-2 hover:text-foreground hover:underline">
              Clear
            </Link>
          </p>
        ) : null}
        {cards.length ? (
          <DesignGrid cards={cards} listedOrgs={listedOrgs} />
        ) : (
          <EmptyState
            title={query ? "Nothing matches that" : "Nothing published yet"}
            action={
              <Link href="/studio" className={buttonVariants({ size: "sm" })}>
                Open Studio
              </Link>
            }
          >
            {query
              ? "Try a machine's name — robot arm, rover, gripper — or publish the first one yourself."
              : "Pose a machine in Studio, save a version and publish it. It will be the first one here."}
          </EmptyState>
        )}
      </div>
    </div>
  )
}
