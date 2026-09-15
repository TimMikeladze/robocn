/**
 * Prev/next at the foot of a docs page.
 *
 * The order is the sidebar's order — `docGroups` flattened — so "next" means
 * the entry under this one in the nav, which is the only definition a reader
 * can predict.
 */

import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"

import { docGroups, docs, type DocEntry } from "@/lib/docs"

/** The flat reading order: the sidebar, top to bottom. */
const order: DocEntry[] = docGroups.flatMap((group) =>
  docs.filter((entry) => entry.group === group),
)

export function docNeighbours(slug: string) {
  const index = order.findIndex((entry) => entry.slug === slug)
  if (index === -1) return { previous: null, next: null }
  return {
    previous: index > 0 ? order[index - 1] : null,
    next: index < order.length - 1 ? order[index + 1] : null,
  }
}

function PagerLink({
  entry,
  direction,
}: {
  entry: DocEntry
  direction: "previous" | "next"
}) {
  const next = direction === "next"
  return (
    <Link
      href={`/docs/${entry.slug}`}
      rel={next ? "next" : "prev"}
      className={`group flex min-w-0 flex-1 items-center gap-3 border border-border bg-panel px-4 py-3 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-foreground ${next ? "justify-end text-right" : ""}`}
    >
      {next ? null : (
        <ArrowLeft className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <span className="min-w-0">
        <span className="block text-[11px] text-muted-foreground">
          {next ? "Next" : "Previous"}
        </span>
        <span className="block truncate text-[13.5px] font-medium">{entry.title}</span>
      </span>
      {next ? (
        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      ) : null}
    </Link>
  )
}

function DocsPager({ slug }: { slug: string }) {
  const { previous, next } = docNeighbours(slug)
  if (!previous && !next) return null

  return (
    <nav
      aria-label="Catalogue"
      className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row"
    >
      {previous ? <PagerLink entry={previous} direction="previous" /> : <span className="flex-1" />}
      {next ? <PagerLink entry={next} direction="next" /> : <span className="flex-1" />}
    </nav>
  )
}

export { DocsPager }
