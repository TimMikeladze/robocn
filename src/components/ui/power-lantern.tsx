"use client"

/**
 * power-lantern — a carried reservoir that charges a ring, and comes apart.
 *
 * The form is the old marine-lamp archetype: a squat barrel of ribbed prism
 * glass inside a cage of bowed straps, between a flared foot and a stack of
 * collars under a domed cap, hung from a stem and an eye. The charge port is a
 * round boss on its *face* — a bore with an iris in it that a ring seats into,
 * head-on to the reader, which is why the ring's own charge reads as an arc
 * rather than as an edge-on line.
 *
 * Charge leaves the reservoir and arrives in the ring — it is moved, not
 * invented, and `stepCharge` is what says how much. The recital lights the
 * collar a glyph at a time and the transfer is gated to it, so the ring is full
 * on the last glyph. Emission is a cone out of the port, paid for out of the
 * same reserve, reaching `√intensity` of full range because illuminance goes as
 * the inverse square.
 *
 * The other half of the machine is that it is an *assembly*. Every part knows
 * the axis it was fitted along and the order it was fitted in, and `exploded`
 * takes it apart in the reverse of that order — the ring and the port forward
 * off the face, the crown up, the cage straps out along their own radials, the
 * base never. At `exploded={0}` every offset is exactly zero: it is back
 * together, not nearly.
 *
 * Modelled once in world units — `x` starboard, `y` up, `z` aft, the face the
 * reader sees at `-z` — and projected, so the teardown reads from all four
 * cameras with no second drawing. Projection is linear, which is why one world
 * offset per part is all the exploded view costs.
 *
 * Solved: the explode schedule, the transfer and its conservation, the recital
 * count, the gauge, the beam's reach, the cage and its depth ordering.
 * Illustrated: the glow, the glass, the knurl, the prisms and the bolts. There
 * is no thermal model and no discharge curve.
 *
 * Design note: docs/power-lantern.md.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, lerp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  bandCell,
  breathe,
  cageRibs,
  chargeSegments,
  conduitBeads,
  cyclePhase,
  emissionBeam,
  explodeAssembly,
  glyphBars,
  recital as reciteAt,
  reserveState,
  stepCharge,
  type AssemblyPart,
} from "@/lib/robocn/lantern"
import {
  boxCorners,
  circleFootprint,
  elevationDraft,
  extrudedPath,
  fitTransform,
  frustumPath,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  slabPath,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type PowerLanternBehavior =
  | "charge"
  | "oath"
  | "emit"
  | "idle"
  | "service"
  | "static"

/** Where the ring is: away, held up to the port, or seated in it. */
export type LanternRing = "none" | "presented" | "docked"

/** Which channel the drag and the arrow keys hold. */
export type LanternControl = "exploded" | "charge"

/** The lantern is read face-on; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"

const VIEW_WIDTH = 220
const VIEW_HEIGHT = 250

/* Everything below is world units: x starboard, y up from the floor, z aft,
   and the face a reader sees in front elevation is -z. */

const BASE_BOTTOM = 0
const BASE_TOP = 9
const BASE_R = 36
const BASE_NECK_R = 30

const FOOT_TOP = 15
const FOOT_R = 32

const PLINTH_TOP = 24
const PLINTH_R = 29

/** The prism barrel: a body of revolution with a slight belly. */
const GLASS_BOTTOM = 24
const GLASS_SHOULDER = 34
const GLASS_NECK = 66
const GLASS_TOP = 76
const GLASS_WAIST_R = 27
const GLASS_END_R = 23
/** Horizontal prism rings cut in the glass. */
const PRISMS = 13

const CORE_BOTTOM = 30
const CORE_TOP = 70
const CORE_R = 6
const CORE_DISCS = 7

/** The cage: straps bowed out from a foot ring to a head ring. */
const STRAP_BOTTOM = 21
const STRAP_TOP = 79
const STRAP_ROOT_R = 29
const STRAP_BOW_R = 34
const STRAP_ARC = 5.5
const STRAP_THICK = 3
const STRAP_STEPS = 14

const COLLAR_BOTTOM = 78
const COLLAR_TOP = 89
const COLLAR_R = 30
const GLYPH_ARC = 8

const HOOD_BOTTOM = 89
const HOOD_TOP = 102
const HOOD_R = 30
const HOOD_NECK_R = 16

const FINIAL_BOTTOM = 102
const FINIAL_TOP = 110
const FINIAL_R = 13
const FINIAL_NECK_R = 8

/** The stem and the eye it hangs from. */
const STEM_TOP = 118
const STEM_R = 2.6
const EYE_Y = 124
const EYE_R = 6.4

/** The charge port, on the face: a boss, a bore, an iris, and a seated ring. */
const PORT_Y = 50
const PORT_FACE = 27
const PORT_PROUD = 36
const PORT_R = 14
const BORE_R = 8.6
const IRIS_BLADES = 6
const IRIS_DEPTH = 35
const RING_DEPTH = 34
const RING_R = 8.6
const RING_THICK = 2.6
/** How far off the face the ring waits while it is being presented. */
const RING_PRESENTED = 24

const GAUGE_SEGMENTS = 8
const RECITAL_LINES = 4
const RECITAL_GLYPHS = 6

/** What the ring can hold, in reservoir units: a ring is not a battery. */
export const CELL_CAPACITY = 0.12
/** Reservoir units per cycle through the conduit. */
const TRANSFER_RATE = CELL_CAPACITY / 0.8
/** Reservoir units per cycle the emitter takes at full power. */
const DRAW_RATE = 0.86
/** The window the conduit is sampled over to see whether charge is moving. */
const PROBE = 0.02

/** Explode travel per part, in world units. Later fitted, further to go. */
const TRAVEL = {
  ring: 42,
  iris: 32,
  bezel: 23,
  hanger: 40,
  finial: 32,
  hood: 25,
  collar: 18,
  strap: 24,
  cell: 13,
  core: 6,
  plinth: 3,
  base: 0,
} as const

const UP: Vec3 = { x: 0, y: 1, z: 0 }
/** Out of the face, toward the reader: the axis the port was fitted along. */
const FORE: Vec3 = { x: 0, y: 0, z: -1 }

/** The whole box the machine moves inside, teardown included. */
const ENVELOPE = boxCorners({ x: -62, y: 0, z: -80 }, { x: 62, y: 170, z: 80 })

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const ringNames: Record<LanternRing, string> = {
  none: "no ring docked",
  presented: "ring presented",
  docked: "ring docked",
}

export interface PowerLanternProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. One lantern, four projections. */
  view?: RobotView
  /** Controlled reserve, 0 to 1. Supplying it pins the reservoir. */
  charge?: number
  onChargeChange?: (charge: number) => void
  /** Controlled teardown, 0 seated to 1 all the way apart. */
  exploded?: number
  onExplodedChange?: (exploded: number) => void
  /** What it does when the channel is not supplied. */
  behavior?: PowerLanternBehavior
  /** Where the ring is: away, held up to the port, or seated in it. */
  ring?: LanternRing
  /** Controlled ring charge, 0 to 1 of the ring's own capacity. */
  cell?: number
  /** Controlled recital, 0 to 1. It lights the collar and gates the transfer. */
  recital?: number
  /** Controlled emitter power, 0 to 1. The reserve is the ceiling on it. */
  emission?: number
  /** Straps in the cage, 4 to 12. */
  ribs?: number
  /** Draw the reserve gauge on the plinth. */
  showGauge?: boolean
  showGround?: boolean
  /** Stamped on the plinth nameplate. */
  plate?: string
  /** Which channel the drag and the arrow keys hold. */
  control?: LanternControl
  interactive?: boolean
  speed?: number
  phase?: number
  paused?: boolean
  animate?: boolean
  label?: string
}

function PowerLantern({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  charge,
  onChargeChange,
  exploded,
  onExplodedChange,
  behavior = "charge",
  ring = "docked",
  cell,
  recital,
  emission,
  ribs = 8,
  showGauge = true,
  showGround = true,
  plate,
  control = "exploded",
  interactive = false,
  speed = 0.35,
  phase = 0,
  paused = false,
  animate = true,
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
  "aria-label": ariaLabel,
  ...props
}: PowerLanternProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const controlledCharge = charge !== undefined
  const controlledExploded = exploded !== undefined
  const grabsCharge = control === "charge"
  const pinned = grabsCharge
    ? controlledCharge
      ? unit(charge)
      : held
    : controlledExploded
      ? unit(exploded)
      : held

  // One loop: it eases the channel a person can hold, and its clock drives
  // every other channel through the behaviour sampler.
  const goal = React.useCallback(
    (clock: number) =>
      grabsCharge
        ? lanternBehaviorState(behavior, clock).charge
        : lanternBehaviorState(behavior, clock).exploded,
    [behavior, grabsCharge],
  )
  const motion = useRobotScalar(goal, {
    rate: grabsCharge ? 0.45 : 0.85,
    hold: pinned,
    speed,
    paused,
    phase,
    // Only both channels controlled parks the loop; one still needs the clock.
    animate:
      animate && behavior !== "static" && !(controlledCharge && controlledExploded),
  })
  const sampled = lanternBehaviorState(behavior, motion.clock)

  const reserve = controlledCharge
    ? unit(charge)
    : grabsCharge
      ? clamp(motion.value, 0, 1)
      : sampled.charge
  const apart = controlledExploded
    ? unit(exploded)
    : grabsCharge
      ? sampled.exploded
      : clamp(motion.value, 0, 1)
  const docked = ring === "docked"
  const ringFill = docked ? (cell !== undefined ? unit(cell) : sampled.cell) : 0
  const recite = recital !== undefined ? unit(recital) : sampled.recital
  const power = emission !== undefined ? unit(emission) : sampled.emission
  const ribCount = Number.isFinite(ribs) ? clamp(Math.round(ribs), 4, 12) : 8

  const camera = robotCamera(view)
  // The frame fits the whole envelope the teardown moves inside, so the framing
  // cannot breathe as parts come off — and it is allowed to enlarge, or a
  // machine that is mostly headroom would draw itself small in its own frame.
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT, 8, 1.4)
  const { point: to, box, bar, disc } = elevationDraft(camera, "front")

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 100) / 100
      setHeld(bounded)
      if (control === "charge") onChargeChange?.(bounded)
      else onExplodedChange?.(bounded)
    },
    [control, onChargeChange, onExplodedChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // Drag up to pull it apart, or to fill it: up is more of whatever is held.
    onDrag: React.useCallback((unitPoint: Vec2) => apply(1 - unitPoint.y), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const glassy = robotSurface("shell", variant, palette, 0.8)

  /* ---------------------------------------------------------------------- */
  /* the assembly                                                            */
  /* ---------------------------------------------------------------------- */

  const cage = cageRibs(ribCount, STRAP_ROOT_R)
  const parts: AssemblyPart[] = [
    { id: "base", axis: UP, travel: TRAVEL.base, order: 0 },
    { id: "plinth", axis: UP, travel: TRAVEL.plinth, order: 1 },
    { id: "core", axis: UP, travel: TRAVEL.core, order: 2 },
    { id: "cell", axis: UP, travel: TRAVEL.cell, order: 3 },
    // The whole course of straps was fitted together, so it leaves together —
    // each along its own radial rather than up the axis.
    ...cage.map((strap) => ({
      id: `rib-${strap.index}`,
      axis: { x: strap.x, y: 0, z: strap.z },
      travel: TRAVEL.strap,
      order: 4,
    })),
    { id: "collar", axis: UP, travel: TRAVEL.collar, order: 5 },
    { id: "hood", axis: UP, travel: TRAVEL.hood, order: 6 },
    { id: "finial", axis: UP, travel: TRAVEL.finial, order: 7 },
    { id: "hanger", axis: UP, travel: TRAVEL.hanger, order: 8 },
    // The port is fitted to the face, so it leaves along the face's own normal.
    { id: "bezel", axis: FORE, travel: TRAVEL.bezel, order: 9 },
    { id: "iris", axis: FORE, travel: TRAVEL.iris, order: 10 },
    // The ring is the workpiece, not part of the assembly: it comes off first.
    { id: "ring", axis: FORE, travel: TRAVEL.ring, order: 11 },
  ]

  // Projection is linear, so a world offset is a pure screen offset — and an
  // offset the camera cannot see emits no transform at all rather than an
  // identity one.
  const shift = (x: number, y: number, z: number) => {
    const screen = camera.project(x, y, z)
    return px(screen.x) === 0 && px(screen.y) === 0
      ? undefined
      : `translate(${px(screen.x)} ${px(screen.y)})`
  }

  const offsets = new Map<string, string | undefined>()
  for (const part of explodeAssembly(parts, apart)) {
    offsets.set(
      part.id,
      part.distance === 0
        ? undefined
        : shift(part.offset.x, part.offset.y, part.offset.z),
    )
  }
  const moved = (id: string) => offsets.get(id)

  /* ---------------------------------------------------------------------- */
  /* what the machine is doing                                               */
  /* ---------------------------------------------------------------------- */

  // Is charge actually moving? Ask the model rather than the behaviour name:
  // a full ring stops the conduit even while the transfer is switched on.
  const transferring =
    docked && (behavior === "charge" || behavior === "oath" || cell !== undefined || recital !== undefined)
  const probe = stepCharge(
    { reservoir: reserve, cell: ringFill * CELL_CAPACITY },
    PROBE,
    {
      rate: TRANSFER_RATE,
      cellCapacity: CELL_CAPACITY,
      docked: transferring && (recital === undefined || recite < 1),
      draw: power * DRAW_RATE,
    },
  )
  const flow = clamp(probe.transferred / (TRANSFER_RATE * PROBE), 0, 1)
  const beam = emissionBeam(reserve, power, { spread: 9, length: 52 })
  const reserveRead = reserveState(reserve)
  const signalColor =
    reserveRead === "depleted"
      ? palette.shell
      : reserveRead === "low"
        ? palette.metal
        : palette.accent
  const segments = chargeSegments(reserve, GAUGE_SEGMENTS)
  const spoken = reciteAt(recite, { lines: RECITAL_LINES, glyphs: RECITAL_GLYPHS })
  const pulse = behavior === "static" ? 0.5 : breathe(motion.clock)
  // The core is as bright as the reserve, breathing a little when it is idle.
  const coreLight = clamp(0.18 + reserve * 0.72 + (behavior === "idle" ? pulse * 0.1 : 0), 0, 1)
  const percent = Math.round(reserve * 100)
  const apartPercent = Math.round(apart * 100)

  /* ---------------------------------------------------------------------- */
  /* depth ordering                                                          */
  /* ---------------------------------------------------------------------- */

  const axisDepth = camera.depth(0, (STRAP_BOTTOM + STRAP_TOP) / 2, 0)
  const sortedStraps = cage
    .map((strap) => ({
      strap,
      depth: camera.depth(strap.x, (STRAP_BOTTOM + STRAP_TOP) / 2, strap.z),
    }))
    .sort((a, b) => a.depth - b.depth)
  const farStraps = sortedStraps.filter((entry) => entry.depth <= axisDepth)
  const nearStraps = sortedStraps.filter((entry) => entry.depth > axisDepth)

  const glyphCells = Array.from({ length: RECITAL_LINES * RECITAL_GLYPHS }, (_, index) => {
    const angle = (index * 360) / (RECITAL_LINES * RECITAL_GLYPHS)
    const theta = (angle / 180) * Math.PI
    return {
      index,
      angle,
      depth: camera.depth(
        Math.sin(theta) * COLLAR_R,
        (COLLAR_BOTTOM + COLLAR_TOP) / 2,
        -Math.cos(theta) * COLLAR_R,
      ),
      lit: index < spoken.lit,
    }
  })
  const collarDepth = camera.depth(0, (COLLAR_BOTTOM + COLLAR_TOP) / 2, 0)
  const nearGlyphs = glyphCells
    .filter((cellFace) => cellFace.depth > collarDepth)
    .sort((a, b) => a.depth - b.depth)

  /**
   * One bowed cage strap, as a single band: up one rail of the bow and back
   * down the other. Drawn as one path rather than as stacked sections, so it
   * reads as a bent strap instead of a chain of blocks.
   */
  const strapPath = (angle: number, section: "across" | "through") => {
    const theta = (angle / 180) * Math.PI
    const rail = (side: number, t: number) => {
      const y = lerp(STRAP_BOTTOM, STRAP_TOP, t)
      // The bow: rooted at both rings, standing off the glass in the middle.
      const bow = STRAP_ROOT_R + (STRAP_BOW_R - STRAP_ROOT_R) * Math.sin(t * Math.PI)
      // Across the strap inside the barrel's surface, or through its thickness:
      // two sections of the same bar, so it keeps a width from every camera
      // instead of collapsing to a line when it is seen edge-on.
      const edge = section === "across" ? theta + side * (STRAP_ARC / 180) * Math.PI : theta
      const r = section === "across" ? bow : bow + (side * STRAP_THICK) / 2
      return camera.project(Math.sin(edge) * r, y, -Math.cos(edge) * r)
    }
    const up = Array.from({ length: STRAP_STEPS + 1 }, (_, step) =>
      rail(-1, step / STRAP_STEPS),
    )
    const down = Array.from({ length: STRAP_STEPS + 1 }, (_, step) =>
      rail(1, 1 - step / STRAP_STEPS),
    )
    return `${[...up, ...down]
      .map((point, index) => `${index ? "L" : "M"} ${px(point.x)} ${px(point.y)}`)
      .join(" ")} Z`
  }

  /** A circle standing in the face plane, as world points. */
  const faceRing = (radius: number, depth: number, steps = 20): Vec3[] =>
    Array.from({ length: steps }, (_, index) => {
      const angle = (index / steps) * Math.PI * 2
      return {
        x: Math.cos(angle) * radius,
        y: PORT_Y + Math.sin(angle) * radius,
        z: -depth,
      }
    })

  const ringDepth = ring === "presented" ? RING_DEPTH + RING_PRESENTED : RING_DEPTH

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Power lantern, ${percent} percent reserve, ${ringNames[ring] ?? ringNames.none}, ${apartPercent} percent apart, ${viewNames[view] ?? viewNames.front}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(grabsCharge ? reserve : apart) : undefined}
      aria-valuetext={
        interactive
          ? grabsCharge
            ? `${percent} percent reserve`
            : `${apartPercent} percent apart`
          : undefined
      }
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.2)
        const current = grabsCharge ? reserve : apart
        if (delta !== 0) apply(current + delta)
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
          <path d={`M ${VIEW_WIDTH / 2} 10 V ${VIEW_HEIGHT - 16}`} strokeDasharray="3 4" />
        </g>
      )}

      <g
        data-lantern
        data-view={view}
        data-exploded={px(apart)}
        data-charge={px(reserve)}
        data-reserve={reserveRead}
        transform={frame || undefined}
      >
        {showGround && (
          <path
            data-ground
            d={extrudedPath(circleFootprint(0, 0, 40, 20), camera, 0, 0)}
            fill={palette.dark}
            opacity={0.13}
          />
        )}

        {/* ---------------------------------------------------------------- */}
        {/* base: the flared foot, and the only part that never moves         */}
        {/* ---------------------------------------------------------------- */}
        <g data-part="base" transform={moved("base")}>
          <path
            d={frustumPath(
              circleFootprint(0, 0, BASE_R, 22),
              circleFootprint(0, 0, BASE_NECK_R, 22),
              camera,
              BASE_BOTTOM,
              BASE_TOP,
            )}
            {...cast}
          />
          <path
            d={extrudedPath(circleFootprint(0, 0, FOOT_R, 22), camera, FOOT_TOP, BASE_TOP)}
            {...machined}
          />
          {cageRibs(6, BASE_R - 4).map((foot) => (
            <path
              key={foot.index}
              d={extrudedPath(
                bandCell(foot.angle, BASE_R - 1, 10, 6, 4),
                camera,
                BASE_BOTTOM + 2.6,
                BASE_BOTTOM,
              )}
              {...machined}
            />
          ))}
        </g>

        {/* ---------------------------------------------------------------- */}
        {/* plinth: the collar the glass stands on, the gauge, the nameplate  */}
        {/* ---------------------------------------------------------------- */}
        <g data-part="plinth" transform={moved("plinth")}>
          <path
            d={frustumPath(
              circleFootprint(0, 0, FOOT_R, 22),
              circleFootprint(0, 0, PLINTH_R, 22),
              camera,
              FOOT_TOP,
              PLINTH_TOP,
            )}
            {...shell}
          />
          {/* Vent slots round the skirt: the reservoir has to breathe. */}
          {cageRibs(ribCount * 2, PLINTH_R - 1).map((vent) => (
            <path
              key={vent.index}
              d={extrudedPath(
                bandCell(vent.angle, PLINTH_R + 0.4, 4, 1.6, 3),
                camera,
                FOOT_TOP + 6,
                FOOT_TOP + 1.5,
              )}
              {...cast}
            />
          ))}
          {showGauge && (
            <g data-gauge data-level={px(reserve)}>
              <path d={box(-13, BASE_TOP - 1, 13, FOOT_TOP - 1, 1.6, FOOT_R - 1)} {...cast} />
              {segments.map((fill, index) => {
                const x0 = -11.6 + index * 2.9
                return (
                  <path
                    key={index}
                    data-segment={index}
                    data-fill={px(fill)}
                    d={box(x0, BASE_TOP + 0.4, x0 + 2.1, FOOT_TOP - 2.4, 1.9, FOOT_R - 0.6)}
                    fill={fill > 0 ? signalColor : palette.dark}
                    fillOpacity={fill > 0 ? 0.35 + fill * 0.65 : 0.5}
                    stroke={palette.dark}
                    strokeWidth={0.4}
                  />
                )
              })}
            </g>
          )}
          {plate && (
            <>
              <path d={box(-12, BASE_BOTTOM + 2.4, 12, BASE_BOTTOM + 8.4, 1.2, BASE_R - 2)} {...machined} />
              {(view === "front" || view === "iso") && (
                <text
                  x={px(to({ x: 0, y: BASE_BOTTOM + 4.4 }, BASE_R - 1.2).x)}
                  y={px(to({ x: 0, y: BASE_BOTTOM + 4.4 }, BASE_R - 1.2).y)}
                  textAnchor="middle"
                  fontFamily="ui-monospace, monospace"
                  fontSize={4.2}
                  letterSpacing={0.4}
                  fill={palette.foreground}
                  opacity={0.85}
                >
                  {plate}
                </text>
              )}
            </>
          )}
        </g>

        {/* The straps behind the glass, then the glass, then the ones in
            front of it: that is what makes the cage a cage. */}
        {farStraps.map(({ strap }) => (
          <g key={strap.index} data-part="rib" data-rib={strap.index} transform={moved(`rib-${strap.index}`)}>
            <path d={strapPath(strap.angle, "through")} {...machined} />
            <path d={strapPath(strap.angle, "across")} {...machined} />
          </g>
        ))}

        {/* ---------------------------------------------------------------- */}
        {/* the emitter column, and the prism barrel over it                  */}
        {/* ---------------------------------------------------------------- */}
        <g data-part="core" transform={moved("core")}>
          <path
            d={extrudedPath(circleFootprint(0, 0, CORE_R, 14), camera, CORE_TOP, CORE_BOTTOM)}
            {...cast}
          />
          {Array.from({ length: CORE_DISCS }, (_, index) => {
            const y = lerp(CORE_BOTTOM + 3, CORE_TOP - 3, index / (CORE_DISCS - 1))
            return (
              <g key={index} transform={camera.plane(y) || undefined}>
                <circle
                  r={CORE_R + 1.8}
                  fill="none"
                  stroke={palette.accent}
                  strokeWidth={1.5}
                  opacity={0.3 + coreLight * 0.6}
                />
              </g>
            )
          })}
          <path
            data-filament
            d={bar({ x: 0, y: CORE_BOTTOM + 2 }, { x: 0, y: CORE_TOP - 2 }, 1.2, 1.2)}
            fill={palette.glow}
            opacity={0.35 + coreLight * 0.55}
          />
        </g>

        <g data-part="cell" transform={moved("cell")}>
          {/* The barrel: a belly between two ends, lit from the column in it. */}
          {([
            [GLASS_BOTTOM, GLASS_SHOULDER, GLASS_END_R, GLASS_WAIST_R],
            [GLASS_SHOULDER, GLASS_NECK, GLASS_WAIST_R, GLASS_WAIST_R],
            [GLASS_NECK, GLASS_TOP, GLASS_WAIST_R, GLASS_END_R],
          ] as const).map(([bottom, top, rb, rt], index) => (
            <path
              key={index}
              data-glass={index}
              d={frustumPath(
                circleFootprint(0, 0, rb, 22),
                circleFootprint(0, 0, rt, 22),
                camera,
                bottom,
                top,
              )}
              {...glassy}
              fill={variant === "solid" ? palette.glow : glassy.fill}
              fillOpacity={variant === "solid" ? 0.1 + coreLight * 0.26 : glassy.fillOpacity}
            />
          ))}
          {/* Prism rings: the lens is cut in steps, and they read as bands. */}
          {Array.from({ length: PRISMS }, (_, index) => {
            const y = lerp(GLASS_BOTTOM + 1.5, GLASS_TOP - 1.5, (index + 0.5) / PRISMS)
            const r =
              y < GLASS_SHOULDER
                ? lerp(GLASS_END_R, GLASS_WAIST_R, (y - GLASS_BOTTOM) / (GLASS_SHOULDER - GLASS_BOTTOM))
                : y > GLASS_NECK
                  ? lerp(GLASS_WAIST_R, GLASS_END_R, (y - GLASS_NECK) / (GLASS_TOP - GLASS_NECK))
                  : GLASS_WAIST_R
            return (
              <g key={index} data-prism={index} transform={camera.plane(y) || undefined}>
                {/* Only the near half of each ring: a prism-cut lens is not a
                    wire hoop, and drawing the far half too reads as a coil. */}
                <path
                  d={`M ${px(-r)} 0 A ${px(r)} ${px(r)} 0 0 1 ${px(r)} 0`}
                  fill="none"
                  stroke={palette.dark}
                  strokeWidth={index % 2 ? 2.6 : 1.2}
                  opacity={index % 2 ? 0.34 : 0.2}
                />
              </g>
            )
          })}
          {/* The rings the glass is clamped between: the burner deck under it
              and the head ring over it. Machined rather than cast, or the deck
              reads through the glass as something the barrel is full of. */}
          <path
            d={extrudedPath(circleFootprint(0, 0, GLASS_END_R + 2, 22), camera, GLASS_BOTTOM + 2.6, GLASS_BOTTOM - 1.6)}
            {...machined}
          />
          <g transform={camera.plane(GLASS_BOTTOM + 2.7) || undefined}>
            <circle
              r={px(CORE_R + 5)}
              fill="none"
              stroke={palette.accent}
              strokeWidth={1.4}
              opacity={0.25 + coreLight * 0.4}
            />
          </g>
          <path
            d={extrudedPath(circleFootprint(0, 0, GLASS_END_R + 2, 22), camera, GLASS_TOP + 1.6, GLASS_TOP - 2.6)}
            {...machined}
          />
        </g>

        {/* The conduit, up the column inside the glass to the port's height. */}
        {transferring && (
          <g data-conduit data-flow={px(flow)}>
            <path
              d={bar({ x: 0, y: CORE_BOTTOM + 4 }, { x: 0, y: PORT_Y }, 0.9, 0.9)}
              fill={palette.accent}
              opacity={0.15 + flow * 0.5}
            />
            {conduitBeads(flow, motion.clock, 3).map((beadAt, index) => {
              const point = to({ x: 0, y: lerp(CORE_BOTTOM + 4, PORT_Y, beadAt) })
              return (
                <circle
                  key={index}
                  data-bead={index}
                  cx={px(point.x)}
                  cy={px(point.y)}
                  r={1.4}
                  fill={palette.glow}
                  opacity={flow * 0.85}
                />
              )
            })}
          </g>
        )}

        {nearStraps.map(({ strap }) => (
          <g key={strap.index} data-part="rib" data-rib={strap.index} transform={moved(`rib-${strap.index}`)}>
            <path d={strapPath(strap.angle, "through")} {...machined} />
            <path d={strapPath(strap.angle, "across")} {...machined} />
          </g>
        ))}

        {/* ---------------------------------------------------------------- */}
        {/* the charge port, on the face                                      */}
        {/* ---------------------------------------------------------------- */}
        <g data-part="bezel" data-dock={ring} transform={moved("bezel")}>
          <path
            d={disc(
              { x: 0, y: PORT_Y },
              PORT_R,
              (PORT_PROUD - PORT_FACE) / 2,
              (PORT_FACE + PORT_PROUD) / 2,
              22,
            )}
            {...machined}
          />
          <g transform={camera.wall(PORT_PROUD + 0.2) || undefined}>
            <circle cx={0} cy={px(-PORT_Y)} r={BORE_R} fill={palette.dark} opacity={0.8} />
            <circle
              cx={0}
              cy={px(-PORT_Y)}
              r={px(PORT_R - 1.6)}
              fill="none"
              stroke={palette.dark}
              strokeWidth={0.8}
              opacity={0.55}
            />
            {/* Fixing bolts round the boss. */}
            {Array.from({ length: 6 }, (_, index) => {
              const turn = (index / 6) * Math.PI * 2
              return (
                <circle
                  key={index}
                  cx={px(Math.cos(turn) * (PORT_R - 3))}
                  cy={px(-PORT_Y + Math.sin(turn) * (PORT_R - 3))}
                  r={1}
                  fill={palette.dark}
                  opacity={0.7}
                />
              )
            })}
            {/* The port lights with what is crossing it. */}
            {(docked || flow > 0) && (
              <circle
                data-port-glow
                cx={0}
                cy={px(-PORT_Y)}
                r={px(BORE_R + 1.6)}
                fill="none"
                stroke={palette.glow}
                strokeWidth={1.6}
                opacity={0.25 + flow * 0.65}
              />
            )}
          </g>
        </g>

        {/* The iris closes the bore when there is nothing in it. */}
        <g data-part="iris" data-open={ring === "none" ? "false" : "true"} transform={moved("iris")}>
          <g transform={camera.wall(IRIS_DEPTH) || undefined}>
            {Array.from({ length: IRIS_BLADES }, (_, index) => {
              const turn = (index * 360) / IRIS_BLADES
              const reach = ring === "none" ? BORE_R : BORE_R * 0.42
              return (
                <path
                  key={index}
                  data-blade={index}
                  d={`M 0 ${px(-BORE_R)} L ${px(reach * 0.92)} ${px(-reach * 0.18)} L ${px(reach * 0.18)} ${px(reach * 0.55)} Z`}
                  transform={`translate(0 ${px(-PORT_Y)}) rotate(${px(turn)})`}
                  fill={palette.metal}
                  fillOpacity={0.92}
                  stroke={palette.dark}
                  strokeWidth={0.4}
                />
              )
            })}
          </g>
        </g>

        {ring !== "none" && (
          <g data-part="ring" data-ring={ring} data-cell={px(ringFill)} transform={moved("ring")}>
            <g transform={camera.wall(ringDepth) || undefined}>
              <circle
                cx={0}
                cy={px(-PORT_Y)}
                r={RING_R}
                fill="none"
                stroke={palette.metal}
                strokeWidth={RING_THICK}
              />
              {/* The ring's own charge, as the arc of it that is lit. */}
              <circle
                data-ring-charge
                cx={0}
                cy={px(-PORT_Y)}
                r={RING_R}
                fill="none"
                stroke={palette.accent}
                strokeWidth={RING_THICK + 0.6}
                strokeDasharray={`${px(2 * Math.PI * RING_R * ringFill)} ${px(2 * Math.PI * RING_R)}`}
                transform={`rotate(-90 0 ${px(-PORT_Y)})`}
                opacity={0.95}
              />
              <circle
                cx={0}
                cy={px(-PORT_Y - RING_R)}
                r={2.2}
                fill={palette.glow}
                opacity={0.55 + ringFill * 0.45}
                stroke={palette.dark}
                strokeWidth={0.4}
              />
            </g>
          </g>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* the collar, the hood, the finial, and the eye it hangs from       */}
        {/* ---------------------------------------------------------------- */}
        <g data-part="collar" transform={moved("collar")}>
          <path
            d={extrudedPath(circleFootprint(0, 0, COLLAR_R, 22), camera, COLLAR_TOP, COLLAR_BOTTOM)}
            {...shell}
          />
          <path
            d={extrudedPath(circleFootprint(0, 0, COLLAR_R + 1, 22), camera, COLLAR_BOTTOM + 2, COLLAR_BOTTOM)}
            {...cast}
          />
          <path
            d={extrudedPath(circleFootprint(0, 0, COLLAR_R + 1, 22), camera, COLLAR_TOP, COLLAR_TOP - 2)}
            {...cast}
          />
          {nearGlyphs.map((cellFace) => {
            const bars = glyphBars(cellFace.index)
            return (
              <g key={cellFace.index} data-glyph={cellFace.index} data-lit={cellFace.lit ? "true" : "false"}>
                <path
                  d={extrudedPath(
                    bandCell(cellFace.angle, COLLAR_R + 0.5, GLYPH_ARC, 1.4, 4),
                    camera,
                    COLLAR_TOP - 2.6,
                    COLLAR_BOTTOM + 2.6,
                  )}
                  fill={cellFace.lit ? palette.accent : palette.dark}
                  fillOpacity={cellFace.lit ? 0.9 : 0.42}
                  stroke={palette.dark}
                  strokeWidth={0.4}
                />
                {bars.map((height, barIndex) => (
                  <path
                    key={barIndex}
                    d={extrudedPath(
                      bandCell(
                        cellFace.angle + (barIndex - 1) * (GLYPH_ARC * 0.55),
                        COLLAR_R + 1.1,
                        GLYPH_ARC * 0.2,
                        0.8,
                        3,
                      ),
                      camera,
                      COLLAR_BOTTOM + 3.2 + height * 4.6,
                      COLLAR_BOTTOM + 3.2,
                    )}
                    fill={cellFace.lit ? palette.glow : palette.metal}
                    fillOpacity={cellFace.lit ? 0.95 : 0.3}
                  />
                ))}
              </g>
            )
          })}
        </g>

        <g data-part="hood" transform={moved("hood")}>
          <path
            d={frustumPath(
              circleFootprint(0, 0, HOOD_R, 22),
              circleFootprint(0, 0, HOOD_NECK_R, 16),
              camera,
              HOOD_BOTTOM,
              HOOD_TOP,
            )}
            {...shell}
          />
          {/* Two turned seams across the dome. */}
          {[0.34, 0.68].map((t) => (
            <g key={t} transform={camera.plane(lerp(HOOD_BOTTOM, HOOD_TOP, t)) || undefined}>
              <circle
                r={px(lerp(HOOD_R, HOOD_NECK_R, t))}
                fill="none"
                stroke={palette.dark}
                strokeWidth={1.1}
                opacity={0.45}
              />
            </g>
          ))}
        </g>

        <g data-part="finial" transform={moved("finial")}>
          <path
            d={frustumPath(
              circleFootprint(0, 0, FINIAL_R, 18),
              circleFootprint(0, 0, FINIAL_NECK_R, 14),
              camera,
              FINIAL_BOTTOM,
              FINIAL_TOP,
            )}
            {...machined}
          />
          {cageRibs(12, FINIAL_R - 0.6).map((knurl) => (
            <path
              key={knurl.index}
              d={extrudedPath(
                bandCell(knurl.angle, FINIAL_R + 0.3, 5, 1.2, 3),
                camera,
                FINIAL_BOTTOM + 4.4,
                FINIAL_BOTTOM + 1,
              )}
              {...cast}
            />
          ))}
        </g>

        <g data-part="hanger" transform={moved("hanger")}>
          <path
            d={extrudedPath(circleFootprint(0, 0, STEM_R, 10), camera, STEM_TOP, FINIAL_TOP - 1)}
            {...machined}
          />
          {/* The eye: a loop standing in the machine's own fore-and-aft plane. */}
          <g transform={camera.wall(0) || undefined}>
            <circle
              cx={0}
              cy={px(-EYE_Y)}
              r={EYE_R}
              fill="none"
              stroke={palette.metal}
              strokeWidth={2.6}
            />
          </g>
        </g>

        {/* The emission cone: out of the port, as far as the reserve pays for. */}
        {beam.intensity > 0.001 && (
          <g data-beam data-intensity={px(beam.intensity)} data-reach={px(beam.length)}>
            <path
              d={slabPath(
                [
                  ...faceRing(BORE_R * 0.85, PORT_PROUD),
                  ...faceRing(BORE_R * 0.85 + beam.halfWidth, PORT_PROUD + beam.length),
                ],
                camera,
              )}
              fill={palette.glow}
              opacity={0.1 + beam.intensity * 0.22}
            />
            <path
              d={slabPath(
                [
                  ...faceRing(1.6, PORT_PROUD),
                  ...faceRing(1.6 + beam.halfWidth * 0.22, PORT_PROUD + beam.length),
                ],
                camera,
              )}
              fill={palette.glow}
              opacity={0.3 + beam.intensity * 0.45}
            />
          </g>
        )}

        {variant === "blueprint" && (
          <text
            x={px(to({ x: 0, y: -12 }).x)}
            y={px(to({ x: 0, y: -12 }).y)}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize={6}
            fill={palette.foreground}
          >
            {`${percent}% reserve · ${spoken.lit}/${spoken.total} glyphs · ${apartPercent}% apart`}
          </text>
        )}
      </g>

      {label && (
        <text
          x={VIEW_WIDTH / 2}
          y={VIEW_HEIGHT - 7}
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

/** Where the lantern's channels stand at `clock`. Pure, and the loop's goal. */
export interface LanternState {
  /** The reserve, 0 to 1. */
  charge: number
  /** What is in the ring, 0 to 1 of its own capacity. */
  cell: number
  /** How far through the recital, 0 to 1. */
  recital: number
  /** What the emitter is being asked for, 0 to 1. */
  emission: number
  /** How far apart the assembly is, 0 to 1. */
  exploded: number
}

const REST: LanternState = { charge: 0.62, cell: 0, recital: 0, emission: 0, exploded: 0 }

/** The emitter gate: a trapezoid, so the lamp comes up rather than snapping. */
const GATE = { rise: 0.12, full: 0.22, fall: 0.7, end: 0.8 }

function gateAt(t: number) {
  if (t <= GATE.rise || t >= GATE.end) return 0
  if (t < GATE.full) return (t - GATE.rise) / (GATE.full - GATE.rise)
  if (t <= GATE.fall) return 1
  return (GATE.end - t) / (GATE.end - GATE.fall)
}

/** The integral of the gate up to `t`: what the reserve has actually paid. */
function gateArea(t: number) {
  const up = GATE.full - GATE.rise
  const down = GATE.end - GATE.fall
  if (t <= GATE.rise) return 0
  if (t < GATE.full) return ((t - GATE.rise) ** 2) / (2 * up)
  const ramp = up / 2
  if (t <= GATE.fall) return ramp + (t - GATE.full)
  const flat = ramp + (GATE.fall - GATE.full)
  if (t < GATE.end) {
    const into = t - GATE.fall
    return flat + into - (into ** 2) / (2 * down)
  }
  return flat + down / 2
}

/**
 * What the lantern is doing at `clock`, as a pure function of it.
 *
 * `charge` and `oath` run the transfer model itself rather than a tween, so the
 * reserve is down by exactly what the ring took; `oath` solves the rate from
 * the ring's capacity and the length of the recital, which is why the ring
 * fills on the last glyph. `emit` pays the *integral* of the emitter gate, not
 * its peak. `service` is the teardown, all the way apart and exactly back.
 */
export function lanternBehaviorState(
  behavior: PowerLanternBehavior,
  clock: number,
): LanternState {
  if (!Number.isFinite(clock)) return REST
  const t = cyclePhase(clock)
  switch (behavior) {
    case "charge": {
      const step = stepCharge({ reservoir: 1, cell: 0 }, t, {
        rate: TRANSFER_RATE,
        cellCapacity: CELL_CAPACITY,
        docked: true,
      })
      return {
        charge: step.state.reservoir,
        cell: step.state.cell / CELL_CAPACITY,
        recital: 0,
        emission: 0,
        exploded: 0,
      }
    }
    case "oath": {
      const span = 0.85
      const spoken = Math.min(1, t / span)
      const step = stepCharge({ reservoir: 1, cell: 0 }, Math.min(t, span), {
        rate: CELL_CAPACITY / span,
        cellCapacity: CELL_CAPACITY,
        docked: true,
      })
      return {
        charge: step.state.reservoir,
        cell: step.state.cell / CELL_CAPACITY,
        recital: spoken,
        emission: 0,
        exploded: 0,
      }
    }
    case "emit": {
      // Constant draw over the gate's own area is exactly the varying draw over
      // the cycle, because the model is linear in time with no transfer on.
      const step = stepCharge({ reservoir: 1, cell: 0 }, gateArea(t), {
        draw: DRAW_RATE,
        docked: false,
      })
      return {
        charge: step.state.reservoir,
        cell: 0,
        recital: 0,
        emission: gateAt(t),
        exploded: 0,
      }
    }
    case "service":
      return { ...REST, exploded: 1 - Math.abs(2 * t - 1) }
    case "idle":
    case "static":
    default:
      return REST
  }
}

const unit = (value: number | undefined) =>
  Number.isFinite(value) ? clamp(value as number, 0, 1) : 0

export { PowerLantern }
