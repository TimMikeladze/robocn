import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { OgItemCard } from "@/components/site/og-item-card"
import { ogPageBySlug } from "@/lib/og-pages"

/**
 * The per-page card. The picture itself is only checkable by looking at it —
 * `pnpm og --only <slug>`, then open the PNG — so what is checked here is the
 * copy on it, which is the part that can silently point at the wrong thing.
 */

// `FitArt` observes its own box; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const card = (slug: string) => {
  const page = ogPageBySlug(slug)
  if (!page) throw new Error(`no og page for ${slug}`)
  return render(
    <OgItemCard
      slug={page.slug}
      eyebrow={page.eyebrow}
      title={page.title}
      summary={page.summary}
      item={page.item}
    />,
  )
}

describe("page social card", () => {
  it("names the page it is the card for", () => {
    const text = card("micro-duck").container.textContent ?? ""
    expect(text).toContain("Micro duck")
    // The tile label off the contact sheet, kept so the set reads as one.
    expect(text).toContain("micro-duck")
    expect(text).toContain("robocn")
  })

  it("prints an install line that works from anywhere", () => {
    // The card is captured from a dev server; the command on it must not be.
    const text = card("robot-arm").container.textContent ?? ""
    expect(text).toContain("bunx --bun shadcn@latest add")
    expect(text).toContain("https://robocn.dev/r/robot-arm.json")
    expect(text).not.toContain("localhost")
  })

  it("leaves the install box off a page that installs nothing", () => {
    const text = card("installation").container.textContent ?? ""
    expect(text).not.toContain("shadcn@latest add")
    expect(text).toContain("Installation")
  })

  it("draws a machine on every card", () => {
    // Including the pages that have no machine of their own: they fall back to
    // the arm the whole set is built around.
    for (const slug of ["robot-arm", "installation", "workbench", "household-geometry"]) {
      expect(card(slug).container.querySelector("svg"), slug).not.toBeNull()
    }
  })
})
