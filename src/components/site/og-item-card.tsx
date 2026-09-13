"use client"

/**
 * The per-page social card, drawn as a page.
 *
 * `public/og/<slug>.png` is a screenshot of this component at exactly
 * 1200 x 630 — the same argument as the site card in `og-card.tsx`, pointed at
 * every docs page instead of one. Reasoning: `docs/per-page-og-images.md`.
 *
 * The art is `cardArt` from the landing catalogue, not a second list: the
 * catalogue's poses are already the best drawing of each machine in the repo,
 * and reusing them means a re-posed card re-poses the social card with it.
 * Those poses are deliberately *not* pinned — `catalogue-motion.test.tsx`
 * fails any card that draws the same picture twice — so `pnpm og` pins them at
 * capture time by emulating `prefers-reduced-motion: reduce`, which parks every
 * machine in the set at its `phase`.
 */

import * as React from "react"

import { cardArt, type CatalogueCard } from "@/components/site/catalogue"
import { galleryEntries } from "@/components/site/gallery.generated"
import { Logo } from "@/components/site/logo"
import { RobotArm } from "@/components/ui/robot-arm"
import { installCommand, productionUrl, site } from "@/lib/site"
import { ogSize } from "@/lib/og"
import { cn } from "@/lib/utils"

/** The stage the drawing is fitted into, inside the 770 px right-hand panel. */
const STAGE = { width: 660, height: 500 } as const

/**
 * How far a catalogue pose may be blown up. They are drawn for a 168 px card
 * well, so almost everything wants 3x or more, and the SVG stays crisp however
 * far it goes. The cap is about proportion rather than quality: past this, a
 * machine with three moving parts starts to read as a diagram of one part.
 */
const MAX_SCALE = 4.6

/**
 * A page with no machine of its own: `installation` is prose about a registry,
 * so it gets the arm the whole set is built around, drawn as a drawing.
 */
const fallbackArt = (
  <RobotArm size={190} variant="blueprint" behavior="idle" phase={0.2} tool="gripper" showEnvelope />
)

/**
 * Scales its child to fill `width` x `height` without distorting it, and
 * centres it on the drawing rather than on its box.
 *
 * Both halves are measured rather than picked per item: the catalogue draws
 * machines anywhere between 88 and 300 px, and most of them sit off-centre
 * inside their own viewBox — a machine with a reach envelope or a ground
 * shadow reserves room on one side that nothing is drawn in. `getBBox()` is
 * the ink, so fitting and centring on it is what puts the duck in the middle
 * of the card instead of down and to the right of it.
 *
 * `offsetWidth` is the layout size, so it is unaffected by the transform this
 * then applies — reading `getBoundingClientRect` here would feed the scale
 * back into itself.
 */
function FitArt({
  width,
  height,
  children,
}: {
  width: number
  height: number
  children: React.ReactNode
}) {
  const inner = React.useRef<HTMLDivElement>(null)
  const [fit, setFit] = React.useState({ scale: 1, x: 0, y: 0 })

  React.useLayoutEffect(() => {
    const element = inner.current
    if (!element) return
    const measure = () => {
      const { offsetWidth: w, offsetHeight: h } = element
      if (!w || !h) return
      const svg = element.querySelector("svg")
      const view = svg?.viewBox.baseVal
      // The ink, in CSS pixels: user units through the viewBox's own scale.
      const ink = svg && view?.width ? inkBox(svg, view, w / view.width) : null
      const box = ink ?? { x: 0, y: 0, width: w, height: h }
      setFit({
        scale: Math.min(width / box.width, height / box.height, MAX_SCALE),
        x: w / 2 - (box.x + box.width / 2),
        y: h / 2 - (box.y + box.height / 2),
      })
    }
    measure()
    // A canvas card sizes itself after its context arrives, and a machine whose
    // drawing grows on its first solved frame changes the box under us.
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [width, height])

  return (
    <div className="flex items-center justify-center" style={{ width, height }}>
      <div
        ref={inner}
        className="inline-flex items-center justify-center"
        style={{ transform: `scale(${fit.scale}) translate(${fit.x}px, ${fit.y}px)` }}
      >
        {children}
      </div>
    </div>
  )
}

/** The drawn extent of an `<svg>`, in CSS pixels from its own top left. */
function inkBox(svg: SVGSVGElement, view: DOMRect, scale: number) {
  let ink: DOMRect
  try {
    ink = svg.getBBox()
  } catch {
    // jsdom, and a drawing that has not laid out yet.
    return null
  }
  if (!(ink.width > 0) || !(ink.height > 0)) return null
  return {
    x: (ink.x - view.x) * scale,
    y: (ink.y - view.y) * scale,
    width: ink.width * scale,
    height: ink.height * scale,
  }
}

export interface OgItemCardProps {
  /** The doc slug, which is also the registry item name where there is one. */
  slug: string
  /** Small mono line over the title: the docs group, or what kind of page it is. */
  eyebrow: string
  title: string
  /** The page's own two-sentence summary. The card prints one clause of it. */
  summary: string
  /** Registry item to print an install command for. Null prints none. */
  item: string | null
}

function OgItemCard({ slug, eyebrow, title, summary, item }: OgItemCardProps) {
  // One call, so the line and the drawing come from the same card: a hand-posed
  // catalogue entry brings its own clause, and everything else falls back to
  // the first sentence of the summary, which is what the landing grid prints.
  const card = cardArt({ slug, title, group: eyebrow, summary } satisfies CatalogueCard)
  const drawing = card?.art ?? fallbackArt
  const line = card?.line ?? summary
  // The two WebGL cards are a canvas sized by its container, not a drawing with
  // a box of its own, so there is nothing for `FitArt` to measure: they are
  // given the stage directly instead.
  const webgl = galleryEntries[slug]?.webgl ?? false

  // Split at the last space so the URL gets its own line, same as the site card.
  const command = item ? installCommand(item, "pnpm", productionUrl) : null
  const runner = command?.slice(0, command.lastIndexOf(" "))
  const target = command?.slice(command.lastIndexOf(" ") + 1)

  return (
    <div
      className="relative flex overflow-hidden bg-background text-foreground"
      style={{ width: ogSize.width, height: ogSize.height }}
    >
      {/* The drawing frame's corner ticks — `datum-frame` only marks two. */}
      {[
        "top-0 left-0 border-t border-l",
        "top-0 right-0 border-t border-r",
        "bottom-0 left-0 border-b border-l",
        "bottom-0 right-0 border-b border-r",
      ].map((corner) => (
        <span
          key={corner}
          aria-hidden
          className={cn("pointer-events-none absolute z-10 size-3 border-datum", corner)}
        />
      ))}

      {/* Title block */}
      <aside className="relative flex w-[430px] shrink-0 flex-col border-r border-border bg-panel px-10 py-9">
        <div className="flex items-center gap-3">
          <Logo behavior="static" className="size-9" />
          <span className="text-[26px] leading-none font-semibold tracking-[-0.03em]">
            {site.name}
          </span>
        </div>

        {/* `my-auto` centres this between the wordmark and the host line, which
            leaves the card's weight in the middle whether the title is one line
            or three. */}
        <div className="my-auto">
          <div className="font-mono text-[12px] tracking-[0.22em] text-muted-foreground uppercase">
            <span className="border-b-2 border-signal pb-1.5">{eyebrow}</span>
          </div>
          <h1 className="mt-4 text-[52px] leading-[1.02] font-semibold tracking-[-0.04em] text-balance">
            {title}
          </h1>
          <p className="mt-4 max-w-[30ch] text-[17px] leading-snug text-muted-foreground">
            {line}
          </p>

          {command ? (
            <div className="mt-8 border border-border bg-background">
              <div className="border-b border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                <span className="border-b-2 border-signal pb-1.5 text-foreground">pnpm</span>
              </div>
              <code className="block px-3 py-2.5 font-mono text-[13px] leading-[1.6]">
                <span className="block text-muted-foreground">{runner}</span>
                <span className="block">{target}</span>
              </code>
            </div>
          ) : (
            <p className="mt-8 border-t border-border pt-4 text-[14px] leading-relaxed text-muted-foreground">
              {site.tagline}. Install the source, theme it with CSS variables.
            </p>
          )}
        </div>

        <div className="font-mono text-[12px] text-muted-foreground">
          {productionUrl.replace(/^https?:\/\//, "")}
        </div>
      </aside>

      {/* Stage */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-panel">
        {webgl ? (
          <div className="[&>div]:h-full" style={{ width: STAGE.width, height: STAGE.height }}>
            {drawing}
          </div>
        ) : (
          <FitArt width={STAGE.width} height={STAGE.height}>
            {drawing}
          </FitArt>
        )}
        <span className="absolute bottom-3 left-4 font-mono text-[11px] text-muted-foreground opacity-70">
          {item ?? slug}
        </span>
      </div>
    </div>
  )
}

export { OgItemCard }
