/**
 * A private share link: one design, shown to whoever holds the token. It is a
 * review link, so there is no fork, no JSX and no way onward into the
 * workspace — just the machine, which version it is, and how long the link
 * lasts.
 *
 * The token is the credential and it is in the URL, so the page is kept out of
 * every index and sends no referrer to anything it links to.
 */

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { cache } from "react"

import { rail } from "@/components/site/rail"
import { Pill } from "@/components/studio/kit"
import { DesignStage } from "@/components/studio/public/design-stage"
import { publishedOn, safeStage } from "@/components/studio/public/stage-view"
import { eyebrow } from "@/components/studio/styles"
import { sanitizePose } from "@/lib/studio/pose"
import { getShared } from "@/lib/studio/queries"
import { workbenchComponent } from "@/lib/workbench/controls"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

const load = cache(async (token: string) => {
  const row = await getShared(token)
  const component = row ? workbenchComponent(row.componentId) : null
  return row && component ? { row, component } : null
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const found = await load(token)
  return {
    title: found ? `${found.row.name} (shared)` : "Link expired",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
    // The root layout's canonical points at `/`; a private page has none.
    alternates: { canonical: null },
  }
}

export default async function SharedDesignPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const found = await load(token)
  if (!found) notFound()
  const { row, component } = found
  const pose = sanitizePose(component, row.pose)
  const expires = publishedOn(row.expiresAt)

  return (
    <div className={cn(rail, "py-8 sm:py-10")}>
      <header className="space-y-2">
        <p className={eyebrow}>Shared for review · {row.orgName}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{row.name}</h1>
        {row.description ? (
          <p className="max-w-[64ch] text-[15px] leading-relaxed whitespace-pre-line text-muted-foreground">
            {row.description}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Pill>v{row.versionNumber}</Pill>
          <Pill>{row.pinned ? "Pinned to this version" : "Follows the latest version"}</Pill>
          <Pill>{component.title}</Pill>
        </div>
      </header>

      <DesignStage
        componentId={component.id}
        pose={pose}
        size={pose.size === undefined ? "lg" : undefined}
        stage={safeStage(row.stageView)}
        label={`${row.name}: a live ${component.title}`}
        className="mt-6 h-[22rem] border border-border sm:h-[32rem]"
      />

      <dl className="mt-6 grid gap-px border border-border bg-border text-[13px] sm:grid-cols-2">
        <div className="bg-panel px-4 py-3">
          <dt className={eyebrow}>Version note</dt>
          <dd className="mt-1 whitespace-pre-line">
            {row.note.trim() || <span className="text-muted-foreground">No note on this version.</span>}
          </dd>
        </div>
        <div className="bg-panel px-4 py-3">
          <dt className={eyebrow}>This link</dt>
          <dd className="mt-1 text-muted-foreground">
            {row.pinned
              ? `Always shows v${row.versionNumber}, whatever is saved after it.`
              : "Shows the newest saved version each time it is opened."}{" "}
            {expires ? `Expires ${expires}.` : "Does not expire."} View only.
          </dd>
        </div>
      </dl>
    </div>
  )
}
