import { act, cleanup, render } from "@testing-library/react"
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"

import { demoFor } from "@/components/demos/demos"
import {
  Catalogue,
  cardArt,
  catalogueArt,
  catalogueSlugs,
  type CatalogueCard,
} from "@/components/site/catalogue"
import { docGroups, docs } from "@/lib/docs"

const registry: { items: { name: string }[] } = JSON.parse(
  readFileSync(path.join(process.cwd(), "registry.json"), "utf8"),
)
const registryItems = registry.items.map((item) => item.name)

/** What the server page hands the client component. */
const cards: CatalogueCard[] = docGroups.flatMap((group) =>
  docs
    .filter((entry) => entry.item && entry.group === group)
    .map(({ slug, title, summary }) => ({ slug, title, group, summary })),
)

describe("landing catalogue", () => {
  it("resolves a card for every registry item, posed or not", () => {
    // Hand-posed art is an override. What must never fail is the resolution:
    // an item with no entry falls back to its own component.
    const missing = registryItems.filter(
      (name) => !cardArt(cards.find((card) => card.slug === name) ?? { slug: name, title: name, group: "Robots" }),
    )
    expect(missing, `nothing draws: ${missing.join(", ")}`).toEqual([])
  })

  it("puts every registry item in the grid the page renders", () => {
    // `docs` is the registry joined onto the written pages, so an item that
    // shipped without a page is still a card here.
    const missing = registryItems.filter(
      (name) => !cards.some((card) => card.slug === name),
    )
    expect(missing, `absent from the landing grid: ${missing.join(", ")}`).toEqual([])
  })

  it("has a demo for every registry item, written or generated", () => {
    const missing = registryItems.filter((name) => !demoFor(name))
    expect(missing, `no demo resolves for: ${missing.join(", ")}`).toEqual([])
  })

  it("has no card for anything you cannot install", () => {
    const orphans = catalogueSlugs.filter((slug) => !registryItems.includes(slug))
    expect(orphans, `catalogue art for non-items: ${orphans.join(", ")}`).toEqual([])
  })

  it("takes its titles from the docs, so they cannot drift", () => {
    // The card renders the passed title verbatim; this pins the source of it.
    for (const slug of catalogueSlugs) {
      expect(docs.find((entry) => entry.slug === slug)?.title, slug).toBeTruthy()
    }
  })

  it("links every registry item exactly once", () => {
    // Foundations cards reuse a machine's artwork, so several cards share an
    // accessible name. Match on where a link goes, not on what it announces.
    const { container } = render(<Catalogue entries={cards} />)
    for (const slug of registryItems) {
      expect(container.querySelectorAll(`a[href="/docs/${slug}"]`), slug).toHaveLength(1)
    }
  })

  it("draws every card without a React warning", () => {
    // The grid is the one place every machine renders at once, so it is where
    // a duplicate key or a bad prop surfaces first. Catch it here rather than
    // in a dev-server console nobody is reading.
    const complaints: Record<string, string> = {}
    for (const [slug, art] of Object.entries(catalogueArt)) {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {})
      render(<>{art.art}</>)
      const first = spy.mock.calls[0]
      if (first) complaints[slug] = String(first[0]).slice(0, 120)
      spy.mockRestore()
      cleanup()
    }
    expect(complaints).toEqual({})
  })

  it("groups the cards in the docs' own group order", () => {
    const { container } = render(<Catalogue entries={cards} />)
    const groups = container.querySelectorAll('[data-slot="catalogue-group"]')
    expect(groups).toHaveLength(docGroups.length)
    expect([...groups].map((group) => group.querySelector("h3")?.textContent)).toEqual(
      docGroups,
    )
  })

  it("mounts a card's art only once it is near the viewport", () => {
    // Every card runs its own animation frame loop, so a grid that mounts all
    // of them is a hundred-odd loops a frame for six cards' worth of viewport.
    // Notes: `docs/catalogue-virtualization.md`.
    const observed = new Map<Element, (near: boolean) => void>()
    class TestObserver {
      constructor(private readonly report: IntersectionObserverCallback) {}
      observe(node: Element) {
        observed.set(node, (near) =>
          this.report(
            [{ target: node, isIntersecting: near } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          ),
        )
      }
      unobserve(node: Element) {
        observed.delete(node)
      }
      disconnect() {
        observed.clear()
      }
    }
    vi.stubGlobal("IntersectionObserver", TestObserver)

    // A card well down in Foundations: far enough down that nothing renders it
    // eagerly, and its art is an SVG machine rather than a WebGL placeholder.
    const slug = "quadruped-kinematics"
    const { container } = render(<Catalogue entries={cards} />)
    const card = container.querySelector(`a[href="/docs/${slug}"]`)
    expect(card?.querySelector("svg"), slug).toBeNull()

    const well = [...observed.keys()].find((node) => card?.contains(node))
    expect(well, `${slug} is not observed`).toBeTruthy()
    act(() => observed.get(well!)!(true))
    expect(card?.querySelector("svg"), slug).not.toBeNull()

    // And it gives the frames back on the way out.
    act(() => observed.get(well!)!(false))
    expect(card?.querySelector("svg"), slug).toBeNull()
    vi.unstubAllGlobals()
  })

  it("draws every card where there is no IntersectionObserver", () => {
    // jsdom and prerender: no observer means nothing would ever report a card
    // as near, so the fallback is to draw it. It is what keeps every other
    // assertion in this file looking at real art.
    expect(typeof IntersectionObserver).toBe("undefined")
    const { container } = render(<Catalogue entries={cards} />)
    const drawn = cards.filter((entry) => {
      const card = container.querySelector(`a[href="/docs/${entry.slug}"]`)
      return entry.group === "Interfaces"
        ? card?.querySelector('[data-slot^="robotic-"]')
        : card?.querySelector("svg")
    })
    // The WebGL cards hold their "3D" placeholder here rather than a canvas.
    expect(cards.length - drawn.length).toBe(4)
  })

  it("holds a placeholder for the WebGL cards instead of a canvas", () => {
    // jsdom has no IntersectionObserver, which is the signal `CatalogueStage`
    // uses for "not a browser" — three must never be pulled into a render here.
    const { container } = render(<Catalogue entries={cards} />)
    for (const slug of ["robot-arm-3d", "robot-stage", "puzzle-cube", "cube-geometry"]) {
      const card = container.querySelector(`a[href="/docs/${slug}"]`)
      expect(card?.textContent, slug).toContain("3D")
      expect(card?.querySelector("canvas"), slug).toBeNull()
    }
  })
})
