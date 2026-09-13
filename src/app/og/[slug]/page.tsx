import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { OgItemCard } from "@/components/site/og-item-card"
import { ogPageBySlug } from "@/lib/og-pages"
import { cn } from "@/lib/utils"

/**
 * One page's social card, on a route, so a real browser can render it and
 * `scripts/build-og.mjs` can capture it to `public/og/<slug>.png`. Not linked
 * from anywhere and not indexed — see `docs/per-page-og-images.md`.
 *
 * Rendered on demand rather than prerendered: there are 170-odd of these and
 * nothing but the capture script ever asks for one, so putting them through
 * `generateStaticParams` would add 170 pages to every production build to serve
 * a maintainer command.
 */
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Social card",
  robots: { index: false, follow: false },
}

export default async function OgSlugPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ theme?: string }>
}) {
  const { slug } = await params
  const { theme } = await searchParams
  const page = ogPageBySlug(slug)
  if (!page) notFound()

  const dark = theme === "dark"

  return (
    // Explicit in both directions: `system` would otherwise hand the capture
    // whatever theme the machine running Chrome happens to be in.
    <div
      className={cn("fixed inset-0 z-50 overflow-hidden bg-background", dark ? "dark" : "light")}
      style={{ colorScheme: dark ? "dark" : "light" }}
    >
      <OgItemCard
        slug={page.slug}
        eyebrow={page.eyebrow}
        title={page.title}
        summary={page.summary}
        item={page.item}
      />
    </div>
  )
}
