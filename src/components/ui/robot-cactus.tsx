"use client"

/**
 * robot-cactus — a potted columnar collector.
 *
 * The machine is one solver used three times. A ribbed limb is a centreline
 * *solved from its curvature* — the tangent angle integrated along the arc,
 * the joints then walked off it one fixed link at a time — so the column, and
 * each arm growing off it, are the same mechanism at different settings and
 * every one of them is exactly as long bent as it was straight.
 *
 * Everything on the skin is written in the frame each station carries, which
 * is why nothing can disagree with the bend. The ribs are a modulation of the
 * section radius, so a rib crest is a *line on the solved surface* rather than
 * a stripe drawn along a shape; the areoles sit on those crests at even arc
 * spacing, staggered every other rib; and each one carries the outward normal
 * of the skin it is set into, taper included, which is what leans the crown's
 * spines up and out instead of sideways. The corolla is rigid blades on a ring
 * in the tip station's own plane, so shutting it into a bud shortens the
 * silhouette and not the petal.
 *
 * The lean is the one thing that is not a pose: the column takes a bend toward
 * whatever it has noticed — the pointer, or the slow wander it runs on its own
 * — and the arms and the flower are carried by it rather than aimed separately.
 *
 * One geometry, four cameras. Design note: docs/ribbed-column.md.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import {
  areoleSites,
  corollaPetals,
  limbPoint,
  limbRing,
  ribCrest,
  rollToward,
  solveCactusLimb,
  spineFan,
  stationAt,
  type CactusAreole,
  type CactusLimb,
} from "@/lib/robocn/cactus"
import { clamp, convexHull2, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  aboutPoint,
  circleFootprint,
  frustumPath,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

const VIEW_WIDTH = 156
const VIEW_HEIGHT = 212
/** The centre of the pot's foot, on the ground, in view units. */
const ORIGIN = { x: 78, y: 190 }
/** It is drawn straight on: a column is a column from the front. */
const NATIVE_VIEW: RobotView = "front"

/** The pot, in world units. */
const POT_FOOT = 19
const POT_MOUTH = 26
const POT_HEIGHT = 27
const RIM_RADIUS = 28.4
const RIM_BOTTOM = 25.5
const RIM_TOP = 30
/** Where the column leaves the soil. */
const SOIL = 27.5

/** The column. */
const TRUNK_LENGTH = 118
const TRUNK_SEGMENTS = 14
const TRUNK_RADIUS = 14
/** Furthest the column's tip leans off vertical, in degrees. */
const MAX_LEAN = 15
/** The slow wander it runs when nothing has its attention, in degrees. */
const SWAY = 3.4
/** Sway cycles per unit clock. Two incommensurate rates: a wander, not a metronome. */
const SWAY_RATE = 16

/** The arms, in the order they are grown. */
const ARMS = [
  { side: "left", station: 0.34, bearing: 64, length: 54, ribs: 10 },
  { side: "right", station: 0.55, bearing: -116, length: 46, ribs: 10 },
  { side: "rear", station: 0.44, bearing: 172, length: 40, ribs: 9 },
  { side: "fore", station: 0.24, bearing: -24, length: 34, ribs: 9 },
] as const

const ARM_SEGMENTS = 10
const ARM_RADIUS = 8.4
/** Where an arm leaves the column, and how far it may be raised from there. */
const ARM_EMERGENCE = 88
const ARM_RAISE = 40

/** Corolla pitch, in degrees above the ring's plane: shut into a bud, and open. */
const FURLED_PITCH = 76
const OPEN_PITCH = 32

/** Bloom travelled per second while the machine returns to its behaviour. */
const BLOOM_RATE = 0.5

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/** How far the camera pulls back, and rides up, to hold one frame. */
const framing: Record<RobotView, { zoom: number; rise: number }> = {
  plan: { zoom: 1.3, rise: -65 },
  front: { zoom: 1, rise: 0 },
  profile: { zoom: 1, rise: 0 },
  iso: { zoom: 0.94, rise: -6 },
}

export type CactusBehavior = "breathe" | "flower" | "reach" | "static"

export interface RobotCactusProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  /** Where the camera stands. One machine, four projections. */
  view?: RobotView
  variant?: RobotVariant
  /** Controlled flowering, 0 shut and low to 1 wide and lifted. Stops the loop. */
  bloom?: number
  /** What it does when `bloom` is not supplied. */
  behavior?: CactusBehavior
  /** Cycles per second: one flowering. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag up and down to work the flowering, or arrow-key it. */
  interactive?: boolean
  onBloomChange?: (bloom: number) => void
  /** Controlled attention in −1..1; overrides pointer tracking. */
  look?: Vec2 | null
  /** Lean toward the pointer while it is over the drawing. */
  track?: boolean
  /** Rib crests round the column. Clamped 5–28. */
  ribs?: number
  /** How deep the furrows cut, 0 round to 0.6. */
  ribDepth?: number
  /** Areoles on each crest of the column. Clamped 0–12. */
  areoles?: number
  /** Needles in each areole's fan. Clamped 0–10. */
  spines?: number
  /** Arms grown off the column. Clamped 0–4. */
  arms?: number
  /** Petals in the outer rank of the corolla. Clamped 0–36. */
  petals?: number
  /** How much of the idle wander it runs, 0 rigid to 1 full. */
  sway?: number
  signal?: "idle" | "ready" | "warning"
  showPot?: boolean
  showGround?: boolean
  label?: string
}

function RobotCactus({
  size = "md",
  view = NATIVE_VIEW,
  variant = "solid",
  bloom,
  behavior = "breathe",
  speed = 0.12,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onBloomChange,
  look = null,
  track = true,
  ribs = 13,
  ribDepth = 0.2,
  areoles = 4,
  spines = 6,
  arms = 2,
  petals = 16,
  sway = 1,
  signal = "ready",
  showPot = true,
  showGround = true,
  label,
  color,
  accent,
  metal,
  dark,
  glow,
  grid,
  palette: paletteOverride,
  className,
  style,
  role,
  tabIndex,
  onKeyDown,
  onBlur,
  ...props
}: RobotCactusProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = bloom !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? clamp(Number.isFinite(bloom) ? bloom : 0, 0, 1) : held
  const goal = React.useCallback(
    (clock: number) => cactusGoal(behavior, clock),
    [behavior],
  )
  const motion = useRobotScalar(goal, {
    rate: BLOOM_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })

  const apply = React.useCallback(
    (next: number) => {
      const bounded = clamp(Number.isFinite(next) ? next : 0, 0, 1)
      setHeld(bounded)
      onBloomChange?.(bounded)
    },
    [onBloomChange],
  )

  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(1 - unit.y), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const pointer = usePointerTarget(svgRef, {
    enabled: track && !look,
    toWorld: React.useCallback(
      (unit: Vec2) => ({ x: unit.x * 2 - 1, y: unit.y * 2 - 1 }),
      [],
    ),
  })

  const open = clamp(motion.value, 0, 1)
  // Attention, in order of authority: an explicit look, then the pointer, then
  // the wander it runs on its own.
  const gaze = look ?? (dragging ? null : pointer.target)
  const swayAmount = clamp(Number.isFinite(sway) ? sway : 1, 0, 1)
  const drift = cactusSway(motion.clock, swayAmount)
  const wake = gaze ? cactusWake(gaze) : { x: 0, y: 0 }
  const leanEast = drift.x + wake.x
  const leanFore = drift.y + wake.y
  const leanAngle = clamp(Math.hypot(leanEast, leanFore), 0, MAX_LEAN + SWAY)
  const leanBearing =
    leanAngle > 1e-6 ? (Math.atan2(leanEast, leanFore) * 180) / Math.PI : 0

  const crests = Math.round(clamp(Number.isFinite(ribs) ? ribs : 13, 5, 28))
  const depth = clamp(Number.isFinite(ribDepth) ? ribDepth : 0.2, 0, 0.6)
  const pads = Math.round(clamp(Number.isFinite(areoles) ? areoles : 4, 0, 12))
  const needles = Math.round(clamp(Number.isFinite(spines) ? spines : 6, 0, 10))
  const limbs = Math.round(clamp(Number.isFinite(arms) ? arms : 2, 0, ARMS.length))
  const blades = Math.round(clamp(Number.isFinite(petals) ? petals : 16, 0, 36))

  const camera = robotCamera(view)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const flower = robotSurface("accent", variant, palette, 0.6)
  const signalColor =
    signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

  const at = (point: Vec3): Vec2 => {
    const screen = camera.project(point.x, point.y, point.z)
    return { x: ORIGIN.x + screen.x, y: ORIGIN.y + screen.y }
  }
  const towardCamera = (point: Vec3) => camera.depth(point.x, point.y, point.z)

  /* ---- the column ------------------------------------------------------ */

  const trunk = solveCactusLimb({
    length: TRUNK_LENGTH,
    segments: TRUNK_SEGMENTS,
    base: { x: 0, y: SOIL, z: 0 },
    bearing: leanBearing,
    emergence: 0,
    // A column that bends progressively: nothing at the soil, all of the lean
    // by the crown.
    sweep: -leanAngle,
    elbow: 0.62,
    spread: 0.45,
    radius: trunkRadius,
  })
  // Anchored to the world rather than to the bend plane, so the ribs do not
  // spin when the machine changes its mind about which way to lean.
  const trunkRibs = { ribs: crests, depth, roll: -leanBearing }

  /* ---- the arms -------------------------------------------------------- */

  const { lift, curl } = cactusArmPose(open)
  const arm = ARMS.slice(0, limbs).map((spec, index) => {
    const seat = stationAt(trunk, spec.station)
    // Each arm gets its own beat of the wander, so a pair never works in step.
    const stagger = drift.x * 0.35 * (index % 2 === 0 ? 1 : -1)
    const bearing = spec.bearing + (gaze ? wake.x * 1.4 : 0) + stagger
    const roll = rollToward(seat, bearing)
    const skin = limbPoint(seat, roll, trunkRibs)
    const emergence = ARM_EMERGENCE - lift * ARM_RAISE
    const limb = solveCactusLimb({
      length: spec.length,
      segments: ARM_SEGMENTS,
      // Seated a little inside the column, so the joint reads as grown rather
      // than glued on.
      base: {
        x: seat.centre.x + (skin.x - seat.centre.x) * 0.72,
        y: seat.centre.y + (skin.y - seat.centre.y) * 0.72,
        z: seat.centre.z + (skin.z - seat.centre.z) * 0.72,
      },
      bearing,
      emergence,
      sweep: emergence * curl,
      elbow: 0.34,
      spread: 0.22,
      radius: (s) => armRadius(s) * (spec.length / 54),
    })
    return {
      side: spec.side,
      limb,
      ribs: { ribs: spec.ribs, depth, roll: -bearing },
      depth: towardCamera(limb.tip.centre),
    }
  })

  /* ---- the corolla ----------------------------------------------------- */

  const crown = trunk.tip
  // The tube: it barely moves, so the corolla always stands clear of the crown
  // spines rather than opening down into them.
  const sheath = corollaPetals(Math.max(5, Math.round(crests / 2)), crown, {
    radius: crown.radius * 0.92,
    length: 8,
    width: 4.8,
    taper: 0.34,
    pitch: 88 - open * 10,
    rise: 0.6,
  })
  // A funnel, not a disc. The rigid blades stand into a tall narrow bud shut,
  // and open into a shallow bowl — the two silhouettes are the whole read, and
  // a corolla that opened flat would collapse to a line in the front camera,
  // which sits ten degrees above horizontal.
  const outer = corollaPetals(blades, crown, {
    radius: crown.radius * 0.8,
    length: 16,
    width: 5.4,
    taper: 0.44,
    pitch: FURLED_PITCH - open * (FURLED_PITCH - OPEN_PITCH),
    rise: 6.2,
  })
  const inner = corollaPetals(Math.round(blades * 0.62), crown, {
    radius: crown.radius * 0.5,
    length: 11,
    width: 4.2,
    taper: 0.5,
    pitch: FURLED_PITCH + 8 - open * (FURLED_PITCH + 8 - (OPEN_PITCH + 14)),
    start: blades > 0 ? 180 / blades : 0,
    rise: 7.6,
  })
  const hub = {
    x: crown.centre.x + crown.tangent.x * 8.6,
    y: crown.centre.y + crown.tangent.y * 8.6,
    z: crown.centre.z + crown.tangent.z * 8.6,
  }
  const stamens = open > 0.25 ? Math.round(clamp(blades * 0.5, 0, 14)) : 0

  /* ---- the ground and the pot ------------------------------------------ */

  const potBody = frustumPath(
    circleFootprint(0, 0, POT_FOOT, 16),
    circleFootprint(0, 0, POT_MOUTH, 16),
    camera,
    0,
    POT_HEIGHT,
  )
  const potRim = frustumPath(
    circleFootprint(0, 0, RIM_RADIUS, 16),
    circleFootprint(0, 0, RIM_RADIUS, 16),
    camera,
    RIM_BOTTOM,
    RIM_TOP,
  )
  const soil = closedPath(
    circleFootprint(0, 0, POT_MOUTH - 3.4, 24).map((point) =>
      at({ x: point.x, y: SOIL, z: point.y }),
    ),
  )

  const readout = Math.round(open * 100)
  const trunkDepth = towardCamera(trunk.stations[Math.round(TRUNK_SEGMENTS / 2)].centre)
  const behind = arm.filter((each) => each.depth <= trunkDepth)
  const front = arm.filter((each) => each.depth > trunkDepth)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Robot cactus, flower ${readout} percent open, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout} percent open` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.15 : 0.05, 0.25)
        if (delta !== 0) apply(open + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      width={width}
      height={px((width * VIEW_HEIGHT) / VIEW_WIDTH)}
      className={cn(
        "max-w-full select-none",
        interactive &&
          "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]",
        dragging && "cursor-grabbing",
        className,
      )}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path
            d={`M 10 ${ORIGIN.y} H ${VIEW_WIDTH - 10} M ${ORIGIN.x} 12 V ${ORIGIN.y + 10}`}
            strokeDasharray="2 3"
          />
          {/* The lean itself: where the column has decided to go. */}
          <path
            d={openPath([at(trunk.base.centre), at(crown.centre)])}
            strokeDasharray="4 2.5"
          />
        </g>
      )}

      <g
        data-frame
        data-view={view}
        data-lean={`${px(leanAngle)} ${px(leanBearing)}`}
        transform={aboutPoint(
          framing[view]?.rise ? `translate(0 ${framing[view].rise})` : "",
          ORIGIN.x,
          ORIGIN.y,
          framing[view]?.zoom ?? 1,
        )}
      >
        {showGround && (
          <ellipse
            cx={ORIGIN.x}
            cy={ORIGIN.y}
            rx={px(RIM_RADIUS * 1.12)}
            ry={px(Math.max(2.4, RIM_RADIUS * 1.12 * camera.flatten))}
            fill={palette.dark}
            opacity={0.14}
          />
        )}

        {showPot && (
          <g data-pot transform={`translate(${ORIGIN.x} ${ORIGIN.y})`}>
            <path d={potBody} {...machined} />
            <path data-rim d={potRim} {...machined} />
          </g>
        )}
        {showPot && (
          <path data-soil d={soil} fill={palette.dark} opacity={variant === "solid" ? 0.5 : 0.2} />
        )}

        {behind.map((each) => (
          <Limb
            key={each.side}
            name={each.side}
            limb={each.limb}
            ribs={each.ribs}
            areoles={pads}
            spines={needles}
            shell={shell}
            palette={palette}
            variant={variant}
            at={at}
            towardCamera={towardCamera}
          />
        ))}

        <Limb
          name="column"
          limb={trunk}
          ribs={trunkRibs}
          areoles={pads + 2}
          spines={needles}
          shell={shell}
          palette={palette}
          variant={variant}
          at={at}
          towardCamera={towardCamera}
        />

        {front.map((each) => (
          <Limb
            key={each.side}
            name={each.side}
            limb={each.limb}
            ribs={each.ribs}
            areoles={pads}
            spines={needles}
            shell={shell}
            palette={palette}
            variant={variant}
            at={at}
            towardCamera={towardCamera}
          />
        ))}

        <g data-flower data-open={readout}>
          {sheath.map((petal) => (
            <path key={petal.index} d={closedPath(petal.corners.map(at))} {...cast} />
          ))}
          {outer.map((petal) => (
            <path
              key={petal.index}
              data-petal={petal.index}
              d={closedPath(petal.corners.map(at))}
              {...flower}
              fillOpacity={variant === "solid" ? 0.92 : flower.fillOpacity}
            />
          ))}
          {inner.map((petal) => (
            <path key={petal.index} d={closedPath(petal.corners.map(at))} {...flower} />
          ))}
          <circle
            data-stamen
            cx={px(at(hub).x)}
            cy={px(at(hub).y)}
            r={px(Math.max(1.2, crown.radius * 0.42))}
            {...machined}
          />
          {Array.from({ length: stamens }, (_, index) => {
            const angle = (index / Math.max(1, stamens)) * Math.PI * 2
            const reach = crown.radius * 0.3 + open * 2.4
            const point = at({
              x: hub.x + (Math.cos(angle) * crown.normal.x + Math.sin(angle) * crown.binormal.x) * reach,
              y: hub.y + (Math.cos(angle) * crown.normal.y + Math.sin(angle) * crown.binormal.y) * reach,
              z: hub.z + (Math.cos(angle) * crown.normal.z + Math.sin(angle) * crown.binormal.z) * reach,
            })
            return (
              <circle
                key={index}
                cx={px(point.x)}
                cy={px(point.y)}
                r={0.7}
                fill={signalColor}
                opacity={0.85}
              />
            )
          })}
        </g>

        {showPot && (
          <circle
            data-lamp
            cx={px(at({ x: 0, y: RIM_BOTTOM - 9, z: -POT_MOUTH * 0.8 }).x)}
            cy={px(at({ x: 0, y: RIM_BOTTOM - 9, z: -POT_MOUTH * 0.8 }).y)}
            r={2.2}
            fill={signalColor}
            className={signal === "ready" ? "robocn-pulse" : undefined}
          />
        )}
      </g>

      {variant === "blueprint" && (
        <text
          x={VIEW_WIDTH - 10}
          y={22}
          textAnchor="end"
          fontFamily="ui-monospace, monospace"
          fontSize={4.4}
          fill={palette.grid}
        >
          {`RIB ${crests} BLOOM ${readout}% LEAN ${px(leanAngle)}° BRG ${px(leanBearing)}°`}
        </text>
      )}
      {label && (
        <text
          x={ORIGIN.x}
          y={206}
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fontSize={6}
          fill={palette.foreground}
        >
          {label}
        </text>
      )}
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* one limb, painted                                                           */
/* -------------------------------------------------------------------------- */

interface LimbProps {
  name: string
  limb: CactusLimb
  ribs: { ribs: number; depth: number; roll: number }
  areoles: number
  spines: number
  shell: ReturnType<typeof robotSurface>
  palette: ReturnType<typeof resolveRobotPalette>
  variant: RobotVariant
  at: (point: Vec3) => Vec2
  towardCamera: (point: Vec3) => number
}

/**
 * A limb is painted as the solid it is: each link's silhouette is the hull of
 * the two ribbed sections that bound it, which is exact for a convex slice and
 * correct from every camera. The crests are then drawn over it, because a rib
 * on a surface reads as a rib and a rib on a silhouette reads as a stripe.
 */
function Limb({
  name,
  limb,
  ribs,
  areoles,
  spines,
  shell,
  palette,
  variant,
  at,
  towardCamera,
}: LimbProps) {
  const sections = limb.stations.map((station) =>
    limbRing(station, { ...ribs, steps: 22 }).map(at),
  )
  const centres = limb.stations.map((station) => at(station.centre))
  const pads = areoleSites(limb, { ...ribs, perRib: areoles, from: 0.08, to: 0.97 })
  const crown = crownAreoles(limb, ribs)
  const mesh = variant === "blueprint" || variant === "wire"

  return (
    <g data-limb={name}>
      <path data-skin d={tubeOutline(sections, centres)} {...shell} />

      {mesh &&
        sections.map((section, index) => (
          <path
            key={index}
            data-section={index}
            d={closedPath(section)}
            fill="none"
            stroke={palette.grid}
            strokeWidth={0.4}
            opacity={0.5}
          />
        ))}

      {Array.from({ length: ribs.ribs }, (_, index) => {
        const crest = ribCrest(limb, index, ribs)
        // A crest on the far side of the limb is behind its own skin.
        if (towardCamera(crest[Math.round(crest.length / 2)]) <= towardCamera(limb.stations[Math.round(limb.stations.length / 2)].centre)) {
          return null
        }
        return (
          <path
            key={index}
            data-rib={index}
            d={openPath(crest.map(at))}
            fill="none"
            stroke={palette.dark}
            strokeWidth={0.7}
            opacity={variant === "solid" ? 0.42 : 0.3}
          />
        )
      })}

      {[...pads, ...crown]
        // Kept a little past the silhouette, so the needles at the edge of the
        // limb are there rather than stopping at the outline.
        .filter((pad) => towardCamera(pad.normal) > -0.2)
        .map((pad) => (
          <g key={`${pad.rib}-${pad.index}-${px(pad.s)}`} data-areole={pad.index}>
            {spines > 0 && (
              <path
                d={spineFan(pad, {
                  count: spines,
                  length: pad.s > 0.94 ? 6.2 : 4.4,
                  spread: 64,
                  start: pad.rib * 21,
                  centre: spines > 3,
                })
                  .map((needle) => openPath([at(needle.root), at(needle.tip)]))
                  .join(" ")}
                fill="none"
                stroke={palette.metal}
                strokeWidth={0.55}
                opacity={0.85}
              />
            )}
            <circle
              cx={px(at(pad.position).x)}
              cy={px(at(pad.position).y)}
              r={0.85}
              fill={palette.dark}
              opacity={0.7}
            />
          </g>
        ))}
    </g>
  )
}

/** The ring of areoles at the very crown, where the spines stand up and out. */
function crownAreoles(
  limb: CactusLimb,
  ribs: { ribs: number; depth: number; roll: number },
): CactusAreole[] {
  return areoleSites(limb, { ...ribs, perRib: 1, from: 0.985, to: 0.985, stagger: 0 }).map(
    (pad, index) => ({ ...pad, index: 1000 + index }),
  )
}

/* -------------------------------------------------------------------------- */
/* behaviour                                                                   */
/* -------------------------------------------------------------------------- */

/** How far through the flowering the machine is aiming to be at `clock`, 0..1. */
export function cactusGoal(behavior: CactusBehavior, clock: number): number {
  if (behavior === "static") return 0.5
  const t = Number.isFinite(clock) ? ((clock % 1) + 1) % 1 : 0
  switch (behavior) {
    // Shut and idling: the sway is the motion, and the bud only breathes.
    case "breathe":
      return 0.06 + 0.04 * Math.sin(t * Math.PI * 2)
    // The whole flowering: open, hold it, shut again.
    case "flower":
      if (t < 0.34) return t / 0.34
      if (t < 0.62) return 1
      return Math.max(0, 1 - (t - 0.62) / 0.3)
    // The arms working, with the flower never more than ajar.
    case "reach":
      return 0.3 + 0.35 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2))
    default:
      return 0.5
  }
}

/**
 * The idle wander, as a lean in degrees: east along `x`, and toward the camera
 * along `y`. Two incommensurate rates, so it drifts round rather than ticking
 * back and forth on one axis.
 */
export function cactusSway(clock: number, amount = 1): Vec2 {
  const t = Number.isFinite(clock) ? clock : 0
  const scale = clamp(Number.isFinite(amount) ? amount : 1, 0, 1) * SWAY
  return {
    x: scale * Math.sin(t * SWAY_RATE),
    y: scale * 0.55 * Math.sin(t * SWAY_RATE * 0.73 + 1.1),
  }
}

/**
 * The lean the pointer asks for, in degrees. Sideways is where the pointer is
 * across the drawing; the pull toward the camera grows as the pointer comes
 * down the frame, which is what makes a machine leaning at a hand near its pot
 * look different from one standing up under a hand held high.
 */
export function cactusWake(look: Vec2 | null | undefined): Vec2 {
  if (!look) return { x: 0, y: 0 }
  const x = clamp(Number.isFinite(look.x) ? look.x : 0, -1, 1)
  const y = clamp(Number.isFinite(look.y) ? look.y : 0, -1, 1)
  return { x: -x * MAX_LEAN, y: (0.2 + 0.5 * ((y + 1) / 2)) * MAX_LEAN * 0.5 }
}

/** What the arms do as the machine flowers: they come up, and they curl in. */
export function cactusArmPose(bloom: number): { lift: number; curl: number } {
  const open = clamp(Number.isFinite(bloom) ? bloom : 0, 0, 1)
  return { lift: 0.3 + 0.6 * open, curl: 0.52 + 0.44 * open }
}

/** The column's radius at a station: a tucked foot, a slim waist, a domed crown. */
export function trunkRadius(s: number): number {
  const t = clamp(Number.isFinite(s) ? s : 0, 0, 1)
  const tuck = 0.88 + 0.12 * Math.min(1, t / 0.08)
  const taper = 1 - 0.26 * t
  const crown = t > 0.9 ? 0.28 + 0.72 * Math.cos(((t - 0.9) / 0.1) * (Math.PI / 2)) : 1
  return TRUNK_RADIUS * tuck * taper * crown
}

/** An arm's radius: pinched where it leaves the column, domed at the tip. */
export function armRadius(s: number): number {
  const t = clamp(Number.isFinite(s) ? s : 0, 0, 1)
  const root = 0.62 + 0.38 * Math.min(1, t / 0.14)
  const taper = 1 - 0.18 * t
  const crown = t > 0.86 ? 0.3 + 0.7 * Math.cos(((t - 0.86) / 0.14) * (Math.PI / 2)) : 1
  return ARM_RADIUS * root * taper * crown
}

/* -------------------------------------------------------------------------- */
/* drawing helpers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The silhouette of a tube: at every section, the two projected points furthest
 * either side of the direction the centreline runs in on screen. Walking up one
 * side and back down the other is one closed path for the whole limb, so a bent
 * column has no seams across it and every variant paints it as one solid.
 */
function tubeOutline(sections: readonly Vec2[][], centres: readonly Vec2[]): string {
  const last = sections.length - 1
  if (last < 1) return ""
  const left: Vec2[] = []
  const right: Vec2[] = []
  for (let index = 0; index <= last; index += 1) {
    const back = centres[Math.max(0, index - 1)]
    const ahead = centres[Math.min(last, index + 1)]
    const run = Math.hypot(ahead.x - back.x, ahead.y - back.y)
    const across =
      run > 1e-9
        ? { x: -(ahead.y - back.y) / run, y: (ahead.x - back.x) / run }
        : { x: 1, y: 0 }
    let low = sections[index][0]
    let high = sections[index][0]
    let lowest = Infinity
    let highest = -Infinity
    for (const point of sections[index]) {
      const reach = (point.x - centres[index].x) * across.x + (point.y - centres[index].y) * across.y
      if (reach < lowest) {
        lowest = reach
        low = point
      }
      if (reach > highest) {
        highest = reach
        high = point
      }
    }
    left.push(high)
    right.push(low)
  }
  const points = [...left, ...right.reverse()]
  return `${points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
}

/** The outline round a set of projected points: any convex solid, any angle. */
function closedPath(points: readonly Vec2[]): string {
  const hull = convexHull2(points)
  if (hull.length < 3) return ""
  return `${hull.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
}

/** An open polyline: a rib crest, a needle, a dimension line. */
function openPath(points: readonly Vec2[]): string {
  if (points.length < 2) return ""
  return points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")
}

export { RobotCactus }
