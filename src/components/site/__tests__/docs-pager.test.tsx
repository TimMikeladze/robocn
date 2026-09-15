import { describe, expect, it } from "vitest"

import { docNeighbours } from "@/components/site/docs-pager"
import { docGroups, docs } from "@/lib/docs"

/** The sidebar's order, which is the order the pager has to walk. */
const order = docGroups.flatMap((group) => docs.filter((entry) => entry.group === group))

describe("docs pager", () => {
  it("walks the sidebar's order, not the order entries were authored in", () => {
    const [first, second] = order
    expect(docNeighbours(first.slug)).toEqual({ previous: null, next: second })
    expect(docNeighbours(second.slug).previous).toBe(first)
  })

  it("stops at the last entry rather than wrapping round", () => {
    const last = order[order.length - 1]
    expect(docNeighbours(last.slug).next).toBeNull()
  })

  it("has neither neighbour for a slug that is not a docs page", () => {
    expect(docNeighbours("not-a-component")).toEqual({ previous: null, next: null })
  })

  it("covers every page exactly once, so nothing is unreachable by paging", () => {
    expect(new Set(order.map((entry) => entry.slug)).size).toBe(docs.length)
  })
})
