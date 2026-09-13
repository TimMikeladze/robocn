import type { Metadata } from "next"

import { OgCard } from "@/components/site/og-card"
import { docs } from "@/lib/docs"
import { cn } from "@/lib/utils"

/**
 * The social card on a route, so a real browser can render it and
 * `scripts/build-og.mjs` can capture it. Not linked from anywhere and not
 * indexed — see `docs/og-image.md`.
 *
 * The card is pinned over the site chrome rather than rendered inside it: the
 * App Router has one root layout, and the header and footer would otherwise
 * push the composition down the page.
 */
export const metadata: Metadata = {
  title: "Social card",
  robots: { index: false, follow: false },
}

export default async function OgPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>
}) {
  const { theme } = await searchParams
  const items = docs.filter((entry) => entry.item).length

  const dark = theme === "dark"

  return (
    // The class is explicit in both directions: `system` would otherwise hand
    // the capture whatever theme the machine running Chrome happens to be in.
    <div
      className={cn("fixed inset-0 z-50 overflow-hidden bg-background", dark ? "dark" : "light")}
      style={{ colorScheme: dark ? "dark" : "light" }}
    >
      <OgCard items={items} />
    </div>
  )
}
