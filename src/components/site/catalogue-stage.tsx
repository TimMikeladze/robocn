"use client"

/**
 * The WebGL cards in the landing catalogue.
 *
 * `three` is loaded through `next/dynamic({ ssr: false })` and the canvas is
 * only mounted once the card is near the viewport, so the landing page still
 * ships without WebGL and scrolling to the Arms group is what starts a context
 * — not loading the page. The placeholder is the same size as the canvas, so
 * the grid never reflows when it arrives.
 *
 * Design notes: `docs/landing-catalogue.md`.
 */

import dynamic from "next/dynamic"

import { useNearViewport } from "@/components/site/use-near-viewport"
import { prefersReducedMotion } from "@/lib/robocn/style"

const CardStage = dynamic(
  () => import("@/components/site/catalogue-stage-canvas").then((m) => m.CardStage),
  { ssr: false },
)

export interface CatalogueStageProps {
  floor?: "grid" | "shadow" | "none"
  /** Which machine stands on the card. */
  machine?: "arm" | "cube"
}

function CatalogueStage({ floor = "shadow", machine = "arm" }: CatalogueStageProps) {
  // `once`: a context is expensive enough to start that it is not torn down for
  // a scroll past — the card around it unmounts this whole component when it
  // goes a viewport away, which is what actually releases it.
  // `fallback: false`: no IntersectionObserver means this is not a browser
  // (jsdom, a prerender), so hold the placeholder rather than start a context.
  const [holder, near] = useNearViewport<HTMLDivElement>({
    rootMargin: "300px",
    once: true,
    fallback: false,
  })

  return (
    <div ref={holder} className="h-44 w-full [&_canvas]:pointer-events-none">
      {near ? (
        <CardStage floor={floor} machine={machine} calm={prefersReducedMotion()} />
      ) : (
        <div className="flex h-full items-center justify-center font-mono text-[12px] text-muted-foreground opacity-50">
          3D
        </div>
      )}
    </div>
  )
}

export { CatalogueStage }
