"use client"

/**
 * The header's own container, split out so it can read `usePathname` without
 * dragging the logo lockup and the social links across the client boundary.
 */

import { usePathname } from "next/navigation"

import { rail } from "@/components/site/rail"
import { cn } from "@/lib/utils"

/**
 * The workbench is an app frame, not a page: its toolbar, list and prop panel
 * already run edge to edge, so the header drops its 6xl rail there and lines
 * up with them instead of floating in the middle of a wide screen.
 */
function isFullBleed(pathname: string | null) {
  if (!pathname) return false
  return pathname === "/workbench" || pathname.startsWith("/workbench/")
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
