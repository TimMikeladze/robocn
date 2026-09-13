/**
 * Every page that gets a social card of its own, and the copy that goes on it.
 *
 * One list, read by three things: the `/og/[slug]` route that draws the card,
 * `/og/pages` which is how `pnpm og` learns what to capture, and the test that
 * checks the two site pages never collide with a registry item name.
 * Notes: `docs/per-page-og-images.md`.
 */

import { docs } from "@/lib/docs"

export interface OgPage {
  /** The card's file name, and the docs slug where the page is a docs page. */
  slug: string
  /** Small mono line over the title: the docs group, or what kind of page it is. */
  eyebrow: string
  title: string
  summary: string
  /** Registry item the card prints an install command for, if any. */
  item: string | null
}

/**
 * Pages that are not docs entries. `/` and `/docs` are deliberately absent:
 * the contact sheet in `public/og.png` is already the right picture for both —
 * it is a picture of the whole catalogue, which is what those two pages are.
 */
const sitePages: OgPage[] = [
  {
    slug: "builder",
    eyebrow: "Tool",
    title: "Robot Builder",
    summary:
      "Design robotic React components with an AI agent. Edit the code, preview your robot live, and export it for your own project.",
    item: null,
  },
]

export const ogPages: OgPage[] = [
  ...docs.map((entry) => ({
    slug: entry.slug,
    eyebrow: entry.group,
    title: entry.title,
    summary: entry.summary,
    item: entry.item,
  })),
  ...sitePages,
]

/** Exported for the collision test: these must never be registry item names. */
export const ogSitePageSlugs = sitePages.map((page) => page.slug)

export const ogPageBySlug = (slug: string) => ogPages.find((page) => page.slug === slug)
