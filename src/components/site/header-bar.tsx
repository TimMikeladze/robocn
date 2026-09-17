"use client"

/**
 * The header's own container, split out so it can read `usePathname` without
 * dragging the logo lockup and the social links across the client boundary.
 */

import { usePathname } from "next/navigation"

import { rail } from "@/components/site/rail"
import { cn } from "@/lib/utils"

/**
 * The workbench and Studio are app frames, not pages: their toolbars, lists and
 * panels already run edge to edge, so the header drops its rail there and lines
 * up with them instead of floating in the middle of a wide screen.
 */
function isFullBleed(pathname: string | null) {
  if (!pathname) return false
  return ["/workbench", "/studio"].some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  )
}

function HeaderBar({ children }: { children: React.ReactNode }) {
  const fullBleed = isFullBleed(usePathname())

  return (
    <div
      data-full-bleed={fullBleed || undefined}
      className={cn(
        "flex h-14 items-center gap-4",
        // Matches the workbench toolbar's own gutter, so the wordmark sits over
        // *New* rather than a notch to its right.
        fullBleed ? "w-full px-2 sm:px-3" : rail,
      )}
    >
      {children}
    </div>
  )
}

export { HeaderBar, isFullBleed }
