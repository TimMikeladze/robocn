"use client"

/**
 * The public gallery: `/explore` and `/o/<org>` draw the same cards.
 *
 * A card prefers the version's stored snapshot and falls back to the machine
 * itself, held still. Either way only the first screenful mounts up front; the
 * rest wait for the scroll to reach them, so a gallery of a hundred designs is
 * not a hundred animation loops.
 */

import Link from "next/link"

import { useNearViewport } from "@/components/site/use-near-viewport"
import { eyebrow } from "@/components/studio/kit"
import { DesignPreview } from "@/components/studio/machine-view"

import type { GalleryCard } from "./stage-view"

/** How many cards mount without waiting to be scrolled to. */
const eager = 12

function Preview({ card, wait }: { card: GalleryCard; wait: boolean }) {
  const [ref, near] = useNearViewport<HTMLDivElement>({ rootMargin: "400px", once: true })
  return (
    <div
      ref={ref}
      className="flex aspect-[4/3] items-center justify-center overflow-hidden border-b border-border bg-background/40"
    >
      {!wait || near ? (
        <DesignPreview
          versionId={card.versionId}
          hasThumbnail={card.hasThumbnail}
          alt={`${card.name}: ${card.machine} design`}
          componentId={card.componentId}
          pose={card.pose}
          size="sm"
          className="pointer-events-none"
        />
      ) : (
        <span aria-hidden className={eyebrow}>
          {card.machine}
        </span>
      )}
    </div>
  )
}

function DesignGrid({
  cards,
  listedOrgs,
}: {
  cards: GalleryCard[]
  /** Organizations with a public gallery to link to. Omit to leave the byline out. */
  listedOrgs?: string[]
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((card, index) => (
        <li
          key={card.slug}
          className="group relative flex min-w-0 flex-col border border-border bg-panel transition-colors focus-within:border-foreground/40 hover:border-foreground/40"
        >
          {/* A snapshot is an `<img loading="lazy">` and needs no help; only a live machine waits. */}
          <Preview card={card} wait={!card.hasThumbnail && index >= eager} />
          <div className="flex min-w-0 flex-1 flex-col gap-1 px-3.5 py-3">
            <h3 className="truncate text-[14px] font-medium">
              {/* The whole card is the link; the byline sits above it to stay clickable. */}
              <Link href={`/d/${card.slug}`} className="outline-none after:absolute after:inset-0">
                {card.name}
              </Link>
            </h3>
            {card.description ? (
              <p className="line-clamp-2 text-[12.5px] text-muted-foreground">{card.description}</p>
            ) : null}
            <p className="mt-auto flex flex-wrap items-center gap-x-2 pt-2 font-mono text-[10.5px] text-muted-foreground">
              <span>{card.machine}</span>
              {listedOrgs ? (
                <>
                  <span aria-hidden>·</span>
                  {listedOrgs.includes(card.orgSlug) ? (
                    <Link
                      href={`/o/${card.orgSlug}`}
                      className="relative z-10 underline-offset-2 hover:text-foreground hover:underline"
                    >
                      {card.orgName}
                    </Link>
                  ) : (
                    <span>{card.orgName}</span>
                  )}
                </>
              ) : null}
              {card.published ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{card.published}</span>
                </>
              ) : null}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

export { DesignGrid }
