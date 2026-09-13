/**
 * Which social card a page points at.
 *
 * `public/og.png` is the site card — the twelve-machine contact sheet. Every
 * docs page has one of its own under `public/og/<slug>.png`, captured by
 * `pnpm og`. Reasoning and the composition: `docs/per-page-og-images.md`.
 *
 * The manifest is what `pnpm og` actually wrote, not what it could write: a
 * component that ships between two capture runs has a page before it has a
 * card, and pointing its `og:image` at a 404 is worse than pointing it at the
 * site card. So an unknown slug falls back.
 */

import { capturedOgSlugs } from "@/lib/og.generated"

export const ogSize = { width: 1200, height: 630 } as const

/** The site card, and what every page falls back to. */
export const siteOgImage = "/og.png"

const captured = new Set<string>(capturedOgSlugs)

export const hasOgImage = (slug: string) => captured.has(slug)

export const ogImagePath = (slug: string) =>
  hasOgImage(slug) ? `/og/${slug}.png` : siteOgImage

/**
 * The `openGraph.images` entry for a page. `alt` is what a reader who gets the
 * alt text instead of the picture is told the card shows.
 */
export function ogImage(slug: string, alt: string) {
  return [{ url: ogImagePath(slug), ...ogSize, alt }] as const
}
