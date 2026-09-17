/**
 * A published design and the machine it poses, once per request: a page and
 * its `generateMetadata` both ask, and a design whose machine has left the
 * registry is as gone as one that was never published.
 */

import "server-only"

import { cache } from "react"

import { getPublished } from "@/lib/studio/queries"
import { workbenchComponent } from "@/lib/workbench/controls"

export const loadPublished = cache(async (slug: string) => {
  const row = await getPublished(slug)
  const component = row ? workbenchComponent(row.componentId) : null
  return row && component ? { row, component } : null
})

export type PublishedDesign = NonNullable<Awaited<ReturnType<typeof loadPublished>>>
