/**
 * The social card, drawn as a page.
 *
 * `public/og.png` is a screenshot of this component at exactly 1200 x 630 —
 * see `docs/og-image.md` for why it is captured rather than composed with
 * `ImageResponse`. Nothing here is specific to the capture: it is ordinary
 * site markup on ordinary theme tokens, which is the point. Edit it, run
 * `pnpm og`, commit the PNG.
 *
 * The poses are lifted from the landing catalogue's art map so a tile matches
 * the card the visitor lands on. Every machine is pinned to a fixed pose
 * (`behavior="static"`, or an explicit `phase`) so two captures of the same
 * commit are the same file.
 */

import { AstromechDroid } from "@/components/ui/astromech-droid"
import { AttendantDroid } from "@/components/ui/attendant-droid"
import { CasingDroid } from "@/components/ui/casing-droid"
import { DeltaArm } from "@/components/ui/delta-arm"
import { Fabricator } from "@/components/ui/fabricator"
import { LidarScan } from "@/components/ui/lidar-scan"
import { OrbDroid } from "@/components/ui/orb-droid"
import { ReachyMini } from "@/components/ui/reachy-mini"
import { RobotArm } from "@/components/ui/robot-arm"
import { RobotBird } from "@/components/ui/robot-bird"
import { RobotQuadruped } from "@/components/ui/robot-quadruped"
import { RobotSpider } from "@/components/ui/robot-spider"
import { Logo } from "@/components/site/logo"
import { defaultManager, installCommand, productionUrl, site } from "@/lib/site"
import { cn } from "@/lib/utils"

/** Open Graph's long-standing default, and what every platform requests. */
export const ogSize = { width: 1200, height: 630 } as const

const lidarSamples = Array.from({ length: 36 }, (_, i) => ({
  angle: i * 10,
  distance: 5 + 2 * Math.sin(i * 0.7),
}))

interface Tile {
  /** Registry item name. Printed on the tile, and checked by the test. */
  slug: string
  art: React.ReactNode
}

/**
 * Twelve, in reading order across a 4 x 3 sheet. Chosen for silhouette variety
 * at feed size — a tall arm, a cone, a radial walker, a wingspan, a barrel, a
 * sphere, a humanoid, a build cell, a quadruped, a parallel arm, a polar plot.
 * The `blueprint` variant is not among them: at 80px wide in a feed its grid
 * and dimension lines wash out to an empty tile.
 *
 * The WebGL items are left out on purpose: screenshotting a `<canvas>` in
 * headless Chrome is a coin flip.
 */
const tiles: Tile[] = [
  { slug: "robot-arm", art: <RobotArm size={160} behavior="idle" phase={0.2} tool="gripper" /> },
  {
    slug: "casing-droid",
    art: <CasingDroid size={122} behavior="static" domeAngle={38} eyeElevation={-10} manipulator="clamp" />,
  },
  {
    slug: "robot-spider",
    art: <RobotSpider size={150} gait="tripod" phase={0.3} heading={14} showGround={false} interactive={false} />,
  },
  {
    slug: "robot-bird",
    art: (
      <RobotBird
        size={150}
        phase={0.28}
        spread={1}
        tail={0.7}
        altitude={0.55}
        headAngle={-12}
        interactive={false}
      />
    ),
  },
  {
    slug: "astromech-droid",
    art: <AstromechDroid size={124} behavior="static" domeAngle={-40} panel tool="welder" holo={0.85} />,
  },
  {
    slug: "reachy-mini",
    art: <ReachyMini size={140} yaw={14} pitch={-6} track={false} look={{ x: 0.4, y: 0.2 }} />,
  },
  {
    slug: "attendant-droid",
    art: <AttendantDroid size={114} behavior="static" pose="present" headAngle={18} speaking />,
  },
  {
    slug: "fabricator",
    art: <Fabricator size={152} progress={0.62} resolution={7} shape="lattice" showReadout={false} />,
  },
  {
    slug: "orb-droid",
    art: <OrbDroid size={128} bodyAngle={38} headAngle={-12} track={false} look={{ x: 0.4, y: -0.2 }} />,
  },
  { slug: "robot-quadruped", art: <RobotQuadruped size={176} gait="trot" phase={0.65} /> },
  { slug: "lidar-scan", art: <LidarScan size={138} scanAngle={60} samples={lidarSamples} /> },
  { slug: "delta-arm", art: <DeltaArm size={150} behavior="orbit" phase={0.6} /> },
]

/** Exported for the drift test — every tile must name a real registry item. */
export const ogTileSlugs = tiles.map((tile) => tile.slug)

export interface OgCardProps {
  /** How many registry items exist, from the server. Printed in the fact strip. */
  items: number
}

function OgCard({ items }: OgCardProps) {
  // Split at the last space so the URL gets its own line: `break-all` is right
  // on the site, where the box is narrow and live, and wrong on a poster.
  const command = installCommand("robot-arm", defaultManager, productionUrl)
  const runner = command.slice(0, command.lastIndexOf(" "))
  const target = command.slice(command.lastIndexOf(" ") + 1)

  return (
    <div
      // The capture's shutter release — see `og-item-card.tsx`.
      data-og-card="site"
      className="relative flex overflow-hidden bg-background text-foreground"
      style={{ width: ogSize.width, height: ogSize.height }}
    >
      {/* The drawing frame's corner ticks. `datum-frame` marks two corners with
          pseudo-elements, which the panels here would paint over — and a sheet
          wants all four anyway. */}
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
      <aside className="relative flex w-[440px] shrink-0 flex-col border-r border-border bg-panel">
        <div className="flex flex-1 flex-col justify-center gap-7 px-11">
          <Logo behavior="static" className="size-14" />
          <div>
            <h1 className="text-[78px] leading-none font-semibold tracking-[-0.045em]">
              {site.name}
            </h1>
            <p className="mt-5 text-[21px] leading-snug text-muted-foreground">
              Robot components for shadcn/ui
            </p>
          </div>
          <p className="max-w-[36ch] text-[14.5px] leading-relaxed text-muted-foreground">
            Arms, droids, machines and animals that solve their own kinematics in the
            browser. Install the source, theme it with CSS variables.
          </p>
          <div className="border border-border bg-background">
            <div className="border-b border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
              <span className="border-b-2 border-signal pb-1.5 text-foreground">{defaultManager}</span>
            </div>
            <code className="block px-3 py-2.5 font-mono text-[13px] leading-[1.6]">
              <span className="block text-muted-foreground">{runner}</span>
              <span className="block">{target}</span>
            </code>
          </div>
        </div>
        <div className="mt-9 grid grid-cols-3 gap-px border-t border-border bg-border">
          {[
            { value: String(items), label: "registry items" },
            { value: "2D + 3D", label: "same kinematics" },
            { value: "MIT", label: "copy the source" },
          ].map((fact, i) => (
            <div key={fact.label} className={cn("bg-panel px-4 py-4", i === 0 && "pl-11")}>
              <div className="font-mono text-[17px] leading-none">{fact.value}</div>
              <div className="mt-1.5 text-[11px] text-muted-foreground">{fact.label}</div>
            </div>
          ))}
        </div>
      </aside>

      {/* Contact sheet */}
      <div className="relative grid flex-1 grid-cols-4 grid-rows-3 gap-px bg-border">
        {tiles.map((tile) => (
          <div
            key={tile.slug}
            className="relative flex items-center justify-center overflow-hidden bg-panel"
          >
            {tile.art}
            <span className="absolute bottom-2 left-2.5 font-mono text-[10px] text-muted-foreground opacity-70">
              {tile.slug}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export { OgCard }
