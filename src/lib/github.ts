/**
 * The repository's star count, for the header.
 *
 * Unauthenticated and cached for an hour: the number is decoration, and a rate
 * limit or an outage must never be able to fail a page render. A failed fetch
 * returns null and the header simply draws the icon on its own, rather than
 * claiming the project has zero stars.
 */

import { site } from "@/lib/site"

const REPO = site.repository.replace("https://github.com/", "")

/** `1.7k` past a thousand, the plain number below it — GitHub's own rounding. */
export function formatStars(count: number) {
  if (count < 1000) return String(count)
  const thousands = count / 1000
  return `${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1)}k`
}

export async function repoStars(): Promise<number | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}`, {
      // No identifying headers: this is a build-time request from whatever
      // machine happens to be rendering, and it does not need to say whose.
      headers: { accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
    })
    if (!response.ok) return null
    const data = (await response.json()) as { stargazers_count?: number }
    return typeof data.stargazers_count === "number" ? data.stargazers_count : null
  } catch {
    // Offline dev, a rate limit, a DNS hiccup: the header does without.
    return null
  }
}
