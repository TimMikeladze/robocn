import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { docs } from "@/lib/docs"
import { hasOgImage, ogImage, ogImagePath, siteOgImage } from "@/lib/og"
import { ogPageBySlug, ogPages, ogSitePageSlugs } from "@/lib/og-pages"
import { capturedOgSlugs } from "@/lib/og.generated"

/**
 * The page cards are committed PNGs behind a generated manifest, so the failure
 * mode is a broken picture in somebody's Slack rather than anything the app
 * would notice. These tests tie the three places that have to agree — `docs`,
 * the manifest `pnpm og` writes, and the files on disk — together.
 */

const registry: { items: { name: string }[] } = JSON.parse(
  readFileSync(path.join(process.cwd(), "registry.json"), "utf8"),
)
const registryItems = registry.items.map((item) => item.name)

describe("page social cards", () => {
  it("gives every docs page a card of its own", () => {
    const missing = docs.filter((entry) => !ogPageBySlug(entry.slug)).map((e) => e.slug)
    expect(missing, `no card for: ${missing.join(", ")}`).toEqual([])
  })

  it("keeps the site pages out of the registry's namespace", () => {
    // `/og/workbench` and `/docs/workbench` would otherwise write the same PNG.
    for (const slug of ogSitePageSlugs) {
      expect(registryItems, slug).not.toContain(slug)
      expect(docs.map((entry) => entry.slug), slug).not.toContain(slug)
    }
  })

  it("never reserves a slug the `/og/pages` route needs", () => {
    // `/og/pages` is a static segment; a card called `pages` would be shadowed.
    expect(ogPages.map((page) => page.slug)).not.toContain("pages")
  })

  it("gives each card something to print", () => {
    for (const page of ogPages) {
      expect(page.title.length, page.slug).toBeGreaterThan(2)
      expect(page.summary.length, page.slug).toBeGreaterThan(20)
      expect(page.eyebrow.length, page.slug).toBeGreaterThan(2)
    }
  })
})

describe("og image paths", () => {
  it("points a captured page at its own card", () => {
    const [slug] = capturedOgSlugs
    if (!slug) return
    expect(ogImagePath(slug)).toBe(`/og/${slug}.png`)
    expect(hasOgImage(slug)).toBe(true)
  })

  it("falls back to the site card for a page nobody has captured yet", () => {
    // A component that ships between two runs of `pnpm og` has a page before it
    // has a card; a 404 in a link preview is worse than the contact sheet.
    expect(ogImagePath("a-machine-that-shipped-this-morning")).toBe(siteOgImage)
  })

  it("carries a size and an alt text a platform can use", () => {
    const [image] = ogImage("robot-arm", "Robot arm — an articulated arm and its tool")
    expect(image.width).toBe(1200)
    expect(image.height).toBe(630)
    expect(image.alt.length).toBeGreaterThan(20)
  })

  it("only claims cards that are on disk", () => {
    const missing = capturedOgSlugs.filter(
      (slug) => !existsSync(path.join(process.cwd(), "public", "og", `${slug}.png`)),
    )
    expect(missing, `manifest names missing files: ${missing.join(", ")}`).toEqual([])
  })
})
