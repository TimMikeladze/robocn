/**
 * An organization's public gallery: who they are, in their own colour, and
 * everything they have published. An organization that turned its profile off
 * is a 404 here even with published designs — those stay reachable by their
 * own links, just not collected under a name.
 */

import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cache } from "react"

import { rail } from "@/components/site/rail"
import { EmptyState } from "@/components/studio/kit"
import { DesignGrid } from "@/components/studio/public/design-grid"
import { OrgLogo } from "@/components/studio/public/org-logo"
import { galleryCards } from "@/components/studio/public/stage-view"
import { eyebrow } from "@/components/studio/styles"
import { site } from "@/lib/site"
import { getOrgBySlug, listPublished } from "@/lib/studio/queries"
import { parseSettings } from "@/lib/studio/settings"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

const load = cache(async (slug: string) => {
  const org = await getOrgBySlug(slug)
  if (!org) return null
  const { profile } = parseSettings(org.settings)
  return profile.listed ? { org, profile } : null
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ org: string }>
}): Promise<Metadata> {
  const { org: slug } = await params
  const found = await load(slug)
  if (!found) return { title: "Not found", robots: { index: false } }
  const description =
    found.profile.tagline || `Machines published by ${found.org.name} with ${site.name} Studio.`
  return {
    title: found.org.name,
    description,
    alternates: { canonical: `/o/${slug}` },
    openGraph: {
      title: `${found.org.name} — ${site.name}`,
      description,
      url: `${site.url}/o/${slug}`,
      type: "profile",
    },
  }
}

const hostOf = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, "")
  } catch {
    return url
  }
}

export default async function OrgGalleryPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const found = await load(slug)
  if (!found) notFound()
  const { org, profile } = found
  const cards = galleryCards(await listPublished({ orgSlug: slug }))

  return (
    <div className={cn(rail, "py-8 sm:py-10")}>
      <header className="relative border border-border bg-panel">
        {/* The organization's own colour, as a rule rather than a fill: it has to sit on any accent. */}
        <span aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ background: profile.accent }} />
        <div className="flex flex-wrap items-center gap-4 px-4 py-5 sm:px-6">
          {profile.logoAssetId ? <OrgLogo assetId={profile.logoAssetId} name={org.name} /> : null}
          <div className="min-w-0 flex-1">
            <p className={cn(eyebrow, "flex items-center gap-1.5")}>
              <span aria-hidden className="size-1.5" style={{ background: profile.accent }} />
              Organization
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight break-words sm:text-3xl">
              {org.name}
            </h1>
            {profile.tagline ? (
              <p className="mt-1 max-w-[64ch] text-[14px] text-muted-foreground">{profile.tagline}</p>
            ) : null}
          </div>
          {profile.website ? (
            <a
              href={profile.website}
              target="_blank"
              rel="noreferrer nofollow ugc"
              className="font-mono text-[12px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {hostOf(profile.website)} ↗
            </a>
          ) : null}
        </div>
      </header>

      <div className="mt-8 flex items-baseline justify-between gap-4">
        <h2 className="text-[15px] font-medium">
          Published designs{" "}
          <span className="font-mono text-[12px] text-muted-foreground tabular-nums">{cards.length}</span>
        </h2>
        <Link href="/explore" className="text-[13px] text-muted-foreground hover:text-foreground">
          Explore everyone&apos;s
        </Link>
      </div>

      <div className="mt-4">
        {cards.length ? (
          <DesignGrid cards={cards} />
        ) : (
          <EmptyState title="Nothing published yet">
            When {org.name} publishes a design it shows up here.
          </EmptyState>
        )}
      </div>
    </div>
  )
}
