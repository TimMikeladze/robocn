/**
 * A published design with nothing around it, for somebody else's page. The
 * site chrome already steps aside for `/embed/*`; this fills the frame with
 * the machine on its ground and leaves one small credit in the corner.
 *
 * `?bg=transparent` drops the ground so the host page shows through;
 * `?controls=0` hides the credit.
 */

import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { DesignStage } from "@/components/studio/public/design-stage"
import { loadPublished } from "@/components/studio/public/load"
import { safeStage } from "@/components/studio/public/stage-view"
import { site } from "@/lib/site"
import { sanitizePose } from "@/lib/studio/pose"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const found = await loadPublished(slug)
  return {
    title: found ? found.row.name : "Design not found",
    // The page worth indexing is `/d/<slug>`; this is a fragment of it.
    alternates: { canonical: `/d/${slug}` },
    robots: { index: false, follow: false },
  }
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const found = await loadPublished(slug)
  if (!found) notFound()
  const { row, component } = found

  const transparent = first(query.bg) === "transparent"
  const credit = first(query.controls) !== "0"
  const stage = safeStage(row.stageView)

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      {/* The root layout paints the body; an embed that asked for no ground has to unpaint it. */}
      {transparent ? <style>{"html,body{background:transparent!important}"}</style> : null}
      <DesignStage
        componentId={component.id}
        pose={sanitizePose(component, row.pose)}
        stage={stage}
        bare={transparent}
        fit
        label={`${row.name}: a live ${component.title}`}
        className="size-full"
      />
      {credit ? (
        <a
          href={`/d/${slug}`}
          target="_blank"
          rel="noopener"
          className="absolute right-2 bottom-2 max-w-[calc(100%-1rem)] truncate rounded-sm border border-border bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
        >
          {row.name} — {site.name}
        </a>
      ) : null}
    </div>
  )
}
