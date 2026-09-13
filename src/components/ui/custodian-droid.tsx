"use client"

/**
 * custodian-droid — a floating armoured custodian.
 *
 * No limbs, no wheels, no rotor: a rounded casing hanging in the air with one
 * deep-set optic on its face. The mechanism is the casing itself. The armour is
 * a ring of segments riding radial rails over a lit chassis, and one `open`
 * number runs every one of them out into a corona — the front edge travelling
 * further than the back, so the shell blooms rather than merely dilating, and
 * the rail that carries each plate showing as a strut that lengthens.
 *
 * Everything is modelled once in world units — `x` across the face, `y` down
 * it, `z` out of it toward the room — and projected, so there is no second
 * drawing for any camera. The shell rolls with the machine's drift; the optic
 * is gimballed and stays level, which is what makes it read as floating.
 *
 * Design note: docs/custodian-droid.md.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import {
  capsulePath,
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

export type CustodianDroidBehavior = "watch" | "survey" | "alert" | "static"

/** The droid is drawn straight on; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"

const VIEW_WIDTH = 200
const VIEW_HEIGHT = 210
/** The optical axis at rest, in view units. */
const ORIGIN = { x: 100, y: 94 }

/* Everything below is in world units about the optical axis:
   `x` across the face, `y` *down* it, `z` out of it toward the room. */

/** The casing outline the armour segments are cut from. */
const CASE_HALF_W = 62
const CASE_HALF_H = 49
const CASE_RADIUS = 20
const CASE_FRONT = 38
const CASE_BACK = -42
/** Where the armour ring starts, outside the optic recess. */
const R_INNER = 34
/** Travel at the front and back edges: the difference is the bloom. */
const TRAVEL_FRONT = 22
const TRAVEL_BACK = 12
/** Degrees of gap left between neighbouring segments when they are seated. */
const SEAM = 1.1
/** The corner break: how far the outermost rim of a solid sits inside the body
 *  behind it, and how deep that chamfer runs. A casing with square rims reads
 *  as a slab from the side; this is what keeps it a rounded cube. */
const CHAMFER = 0.9
const CHAMFER_Z = 9

/** The chassis the armour stands off, and the lattice lit on its face. */
const CORE_HALF_W = 50
const CORE_HALF_H = 40
const CORE_RADIUS = 16
const CORE_FRONT = 30
const CORE_BACK = -36
const LATTICE_INNER = 35
const LATTICE_OUTER = 47
const LATTICE_RIBS = 24

/** The rail each segment rides, rooted inside the chassis. */
const RAIL_ROOT = 30

/** The optic recess, and the gimballed cell inside it. */
const BORE = 23
const PIVOT_Z = CORE_FRONT - 20
const BEZEL_OUTER = 19
const BEZEL_BORE = 15
const BEZEL_BACK = 6
const BEZEL_FRONT = 16
const GLASS_PLANE = 17
const GLASS_RADIUS = 14
const PUPIL_PLANE = 17.6
const PUPIL_RADIUS = 6.5
const PAN_LIMIT = 18
const TILT_LIMIT = 13

/** The ring of voice cells round the lens, inside the recess. */
const RING_RADIUS = 18
const RING_CELLS = 12

/** The bracket cage: three arms off the face to a ring standing proud of it. */
const CAGE_ROOT = 30
const CAGE_RING = 15
const CAGE_PROUD = 16
const CAGE_ARMS = [90, 210, 330] as const
/** How far the lower arm is drawn down past the shell, as a keel. */
const PRONG = 44

/** Where the deck is, and how far the machine floats off it. */
const GROUND = 78
const RISE = 12

/** Opening units per second while the shell eases back into its behaviour. */
const OPEN_RATE = 1.1
const ARC_STEPS = 7
const RING_STEPS = 28

/** How far the camera pulls back so the machine still fits the frame. */
const fits: Record<RobotView, number> = { plan: 0.94, front: 1, profile: 1, iso: 0.92 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface CustodianDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. One droid, four projections. */
  view?: RobotView
  /** The shell, 0 seated to 1 run all the way out. Supplying it stops the loop. */
  open?: number
  /** What it does when `open` is not supplied. */
  behavior?: CustodianDroidBehavior
  /** Cycles per second: one float, one sweep of the room. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a pair of them breaks step. */
  phase?: number
  /** Drag across it to work the shell, or use the arrow keys. */
  interactive?: boolean
  onOpenChange?: (open: number) => void
  /** Controlled optic aim in −1..1; overrides pointer tracking. */
  look?: Vec2 | null
  /** The optic follows the page pointer while `look` is null. */
  track?: boolean
  /** Lit cells in the ring round the lens, 0..1. Omit and the behaviour works it. */
  voice?: number
  /** Armour segments in the shell, 4–10. */
  plates?: number
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

function CustodianDroid({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  open,
  behavior = "watch",
  speed = 0.3,
  animate = true,
  paused = false,
  phase = 0,
  interactive = true,
  onOpenChange,
  look = null,
  track = true,
  voice,
  plates = 6,
  signal = "ready",
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
}: CustodianDroidProps) {
  const controlled = open !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const hold = controlled ? finiteClamp(open, 0, 1, 0.5) : held

  const goal = React.useCallback(
    (clock: number) => custodianDroidPose(behavior, clock).open,
    [behavior],
  )
  const motion = useRobotScalar(goal, {
    rate: OPEN_RATE,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const spread = finiteClamp(motion.value, 0, 1, 0.5)
  const scripted = custodianDroidPose(behavior, motion.clock)
  const lift = clamp(scripted.lift, 0, 1)
  const roll = clamp(scripted.roll, -1, 1) * 7
  const talk = finiteClamp(voice ?? scripted.voice, 0, 1, 0)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = round3(clamp(next, 0, 1))
      setHeld(bounded)
      onOpenChange?.(bounded)
    },
    [onOpenChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // Across the box is the whole stroke: pull it open, push it shut.
    onDrag: React.useCallback((unit: Vec2) => apply((unit.x - 0.08) / 0.84), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const pointer = usePointerTarget(svgRef, {
    enabled: track && !look,
    within: "window",
    persist: true,
    toWorld: React.useCallback(
      (unit: Vec2) => ({
        x: clamp((unit.x - 0.5) * 2, -1, 1),
        y: clamp((unit.y - 0.5) * 2, -1, 1),
      }),
      [],
    ),
  })
  const gaze = look ?? pointer.target ?? { x: 0, y: 0 }
  const pan = clamp(finite(gaze.x), -1, 1) * PAN_LIMIT
  const tilt = -clamp(finite(gaze.y), -1, 1) * TILT_LIMIT

  const segments = Math.round(finiteClamp(plates, 4, 10, 6))

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor =
    signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

  /* -------------------------------------------------------------- camera */

  const camera = robotCamera(view)
  const hover = -lift * RISE
  /** A point on the machine, carried by the float. */
  const at = (x: number, y: number, z = 0): Vec2 => {
    const point = camera.project(-x, -(y + hover), -z)
    return { x: ORIGIN.x + point.x, y: ORIGIN.y + point.y }
  }
  /** The same point on the deck, which does not float. */
  const atDeck = (x: number, y: number, z = 0): Vec2 => {
    const point = camera.project(-x, -y, -z)
    return { x: ORIGIN.x + point.x, y: ORIGIN.y + point.y }
  }
  const towardCamera = (x: number, y: number, z: number) => camera.depth(-x, -(y + hover), -z)
  /** True while there is a face to see: the front elevation and the isometric. */
  const faceVisible = towardCamera(0, 0, 1) > towardCamera(0, 0, 0)

  /**
   * The affine map from flat artwork on a plane `z` out of the face onto the
   * screen. Panel coordinates are the artwork's own — x across, y down — so a
   * grid of cells or a run of grooves is drawn once and comes out skewed
   * correctly from every camera that can see it.
   */
  const facePlane = (z: number) => {
    const base = at(0, 0, z)
    const ex = at(1, 0, z)
    const ey = at(0, 1, z)
    return `matrix(${px(ex.x - base.x)} ${px(ex.y - base.y)} ${px(ey.x - base.x)} ${px(ey.y - base.y)} ${px(base.x)} ${px(base.y)})`
  }

  /**
   * A solid: a stack of cross-sections pushed out of the face, walled with the
   * quad strip between each neighbouring pair. Stacking rims rather than
   * extruding one is what breaks the corner back: the outermost rim of a
   * casing sits inside the one behind it, so the block reads as a rounded cube
   * from every camera instead of a slab with sharp rims.
   */
  const prism = (rims: readonly { outline: readonly Vec2[]; z: number }[]) => {
    const rings = rims.map((rim) => rim.outline.map((p) => at(p.x, p.y, rim.z)))
    const wall: string[] = []
    for (let index = 0; index < rings.length - 1; index += 1) {
      const near = rings[index]
      const far = rings[index + 1]
      for (let step = 0; step < near.length; step += 1) {
        const next = (step + 1) % near.length
        // Wound the same way every time: a camera that folds the section onto
        // itself makes neighbouring quads overlap, and opposite windings would
        // cancel each other out under the nonzero fill rule.
        wall.push(facePath([near[step], near[next], far[next], far[step]]))
      }
    }
    return {
      face: polygonPath(rings[0]),
      rear: polygonPath(rings[rings.length - 1]),
      wall: wall.join(" "),
      // Every rim as one stroke-only path: the corner break and the seams
      // between neighbouring parts are the only thing a side elevation has.
      rims: rings.map((ring) => polygonPath(ring)).join(" "),
    }
  }

  /* --------------------------------------------------------------- shell */

  const armour = Array.from({ length: segments }, (_, index) => {
    const centre = roll + (index * 360) / segments
    const half = 180 / segments - SEAM
    const push = polar(centre, 1)
    const shift = (outline: readonly Vec2[], distance: number) =>
      outline.map((p) => ({ x: p.x + push.x * distance, y: p.y + push.y * distance }))
    const full = wedgeOutline(centre, half, 1)
    const broken = wedgeOutline(centre, half, CHAMFER)
    const front = shift(full, spread * TRAVEL_FRONT)
    const back = shift(full, spread * TRAVEL_BACK)
    const rims = [
      { outline: shift(broken, spread * TRAVEL_FRONT), z: CASE_FRONT },
      { outline: front, z: CASE_FRONT - CHAMFER_Z },
      { outline: back, z: CASE_BACK + CHAMFER_Z },
      { outline: shift(broken, spread * TRAVEL_BACK), z: CASE_BACK },
    ]
    // The rail: rooted in the chassis, out to the plate it carries.
    const travel = (spread * (TRAVEL_FRONT + TRAVEL_BACK)) / 2
    const rail = capsulePath(
      at(push.x * RAIL_ROOT, push.y * RAIL_ROOT, 0),
      at(push.x * (R_INNER + travel + 3), push.y * (R_INNER + travel + 3), 0),
      2.4,
    )
    // One groove run parallel to the outer edge — a fraction of the casing's
    // own reach on each bearing, so it never runs off the plate it belongs to
    // — and a bolt at each end of it. Two marks: armour, not quilting.
    const seamAngle = (t: number) => centre - half * 0.66 + t * half * 1.32
    const seamPoint = (t: number, depth: number) => {
      const angle = seamAngle(t)
      const radius =
        R_INNER + (casingRadius(angle) * CHAMFER - R_INNER) * depth + spread * TRAVEL_FRONT
      const point = polar(angle, radius)
      return at(point.x, point.y, CASE_FRONT)
    }
    const grooves = [
      polylinePath(
        Array.from({ length: ARC_STEPS }, (_, step) => seamPoint(step / (ARC_STEPS - 1), 0.62)),
      ),
    ]
    const bolts = [0.08, 0.92].map((t) => seamPoint(t, 0.24))
    // Where the plate sits on its own bearing, at the face it presents. The
    // shell is a ring nested round the chassis, so this is what decides which
    // half of it the chassis is behind — and in the front elevation it puts
    // every plate in front of the chassis, which is where they stand.
    const middle = (R_INNER + travel + casingRadius(centre) + spread * TRAVEL_FRONT) / 2
    return {
      index,
      depth: towardCamera(push.x * middle, push.y * middle, CASE_FRONT),
      ...prism(rims),
      rail,
      grooves,
      bolts,
    }
  })

  const coreOutline = rectOutline(CORE_HALF_W, CORE_HALF_H, CORE_RADIUS)
  const coreBroken = rectOutline(
    CORE_HALF_W * CHAMFER,
    CORE_HALF_H * CHAMFER,
    CORE_RADIUS * CHAMFER,
  )
  const chassis = prism([
    { outline: coreBroken, z: CORE_FRONT },
    { outline: coreOutline, z: CORE_FRONT - CHAMFER_Z },
    { outline: coreOutline, z: CORE_BACK + CHAMFER_Z },
    { outline: coreBroken, z: CORE_BACK },
  ])
  const coreDepth = towardCamera(0, 0, CORE_FRONT)

  /* --------------------------------------------------------------- optic */

  // The cell frame: `axis` out of the lens, `across` horizontal in the cell,
  // `up` completing it. `across` ignores the tilt, which is what makes the
  // trunnion line the tilt axis rather than ornament.
  const yaw = toRadians(pan)
  const pitch = toRadians(tilt)
  const axis = {
    x: Math.cos(pitch) * Math.sin(yaw),
    y: -Math.sin(pitch),
    z: Math.cos(pitch) * Math.cos(yaw),
  }
  const across = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) }
  const up = {
    x: Math.sin(pitch) * Math.sin(yaw),
    y: -Math.cos(pitch),
    z: Math.sin(pitch) * Math.cos(yaw),
  }
  /** A point in the cell: `a` across it, `b` down it, `d` along its axis. */
  const cellAt = (a: number, b: number, d: number) =>
    at(
      across.x * a + up.x * b + axis.x * d,
      across.y * a + up.y * b + axis.y * d,
      PIVOT_Z + across.z * a + up.z * b + axis.z * d,
    )
  /** A disc in the cell's own plane, sampled ready to draw. */
  const disc = (radius: number, d: number) =>
    Array.from({ length: RING_STEPS }, (_, step) => {
      const angle = (step / RING_STEPS) * Math.PI * 2
      return cellAt(Math.cos(angle) * radius, Math.sin(angle) * radius, d)
    })

  const barrel = polygonPath([...disc(BEZEL_OUTER, BEZEL_BACK), ...disc(BEZEL_OUTER, BEZEL_FRONT).reverse()])
  const bezel = polygonPath(disc(BEZEL_OUTER, BEZEL_FRONT))
  const tube = polygonPath(disc(BEZEL_BORE, BEZEL_FRONT - 1))
  const glass = polygonPath(disc(GLASS_RADIUS, GLASS_PLANE))
  const pupil = polygonPath(disc(PUPIL_RADIUS, PUPIL_PLANE))
  const spark = polygonPath(
    Array.from({ length: 10 }, (_, step) => {
      const angle = (step / 10) * Math.PI * 2
      return cellAt(-3.4 + Math.cos(angle) * 2.2, -3.4 + Math.sin(angle) * 2.2, PUPIL_PLANE + 0.3)
    }),
  )

  const cells = Array.from({ length: RING_CELLS }, (_, index) => {
    const centre = (index * 360) / RING_CELLS - 90
    const half = 180 / RING_CELLS - 3
    const corners = [
      polar(centre - half, RING_RADIUS - 2.4),
      polar(centre + half, RING_RADIUS - 2.4),
      polar(centre + half, RING_RADIUS + 2.4),
      polar(centre - half, RING_RADIUS + 2.4),
    ].map((p) => at(p.x, p.y, CORE_FRONT + 0.4))
    // Cells light out from the top of the ring, so quiet speech is a flicker.
    const bright = Math.abs(((index + 0.5) / RING_CELLS) - 0.5) * 2 < talk
    return { index, path: polygonPath(corners), lit: bright }
  })

  const cage = CAGE_ARMS.map((angle, index) => {
    const root = polar(angle, CAGE_ROOT)
    const hub = polar(angle, CAGE_RING)
    return {
      index,
      path: capsulePath(
        at(root.x, root.y, CORE_FRONT),
        at(hub.x, hub.y, CORE_FRONT + CAGE_PROUD),
        2.3,
      ),
    }
  })
  const cageRing = polygonPath(
    Array.from({ length: RING_STEPS }, (_, step) => {
      const angle = (step / RING_STEPS) * 360
      const point = polar(angle, CAGE_RING)
      return at(point.x, point.y, CORE_FRONT + CAGE_PROUD)
    }),
  )
  const keel = capsulePath(
    at(0, CAGE_ROOT, CORE_FRONT),
    at(0, PRONG, CORE_FRONT + 3),
    2.2,
  )
  /** The cage stands proud of the face; that is where the assembly sits. */
  const opticDepth = towardCamera(0, 0, CORE_FRONT + CAGE_PROUD)

  /** The optic recess, cut into the chassis face, and its machined rim. */
  const boreRing = (z: number) =>
    Array.from({ length: RING_STEPS }, (_, step) => {
      const point = polar((step / RING_STEPS) * 360, BORE)
      return at(point.x, point.y, z)
    })
  const bore = polygonPath(boreRing(CORE_FRONT - 1))
  const boreRim = polygonPath(boreRing(CORE_FRONT))
  const lamp = at(0, -(BORE + 5), CORE_FRONT)

  // The lattice is lit on the chassis face, out to the chassis's own edge on
  // each bearing — it is under the armour, and the gaps are what let it out.
  const lattice = Array.from({ length: LATTICE_RIBS }, (_, index) => {
    const angle = (index * 360) / LATTICE_RIBS
    const reach = Math.min(
      LATTICE_OUTER,
      outlineRadius(angle, CORE_HALF_W, CORE_HALF_H, CORE_RADIUS) - 4,
      // Never past the armour: what is lit is what the segments have uncovered.
      R_INNER + spread * TRAVEL_FRONT,
    )
    const inner = polar(angle, LATTICE_INNER)
    const outer = polar(angle, reach)
    return reach <= LATTICE_INNER + 2
      ? ""
      : polylinePath([at(inner.x, inner.y, CORE_FRONT), at(outer.x, outer.y, CORE_FRONT)])
  })

  const shadow = polygonPath(
    Array.from({ length: RING_STEPS }, (_, step) => {
      const angle = (step / RING_STEPS) * Math.PI * 2
      return atDeck(Math.cos(angle) * (34 + lift * 10), GROUND, Math.sin(angle) * (34 + lift * 10))
    }),
  )

  /* ----------------------------------------------------------- draw order */

  const core = (
    <g data-core key="core">
      <path d={chassis.rear} {...cast} />
      <path d={chassis.wall} {...cast} />
      <path d={chassis.rims} fill="none" stroke={palette.metal} strokeWidth={0.6} opacity={0.25} />
      <path d={chassis.face} {...cast} />
      {faceVisible && (
        <>
          {/* The lattice is lit on the chassis, under the armour: the gaps
              between the segments are what let it out. */}
          <g data-lattice fill="none" stroke={palette.glow} strokeWidth={1.1} opacity={px(0.16 + spread * 0.64)}>
            {lattice.map((rib, index) => (
              <path key={index} d={rib} />
            ))}
          </g>
          <g transform={facePlane(CORE_FRONT + 0.2)} fill="none" stroke={palette.dark} strokeWidth={0.9} opacity={0.5}>
            <circle r={R_INNER - 2} />
          </g>
          <path d={bore} fill={palette.dark} opacity={0.95} />
          <path d={boreRim} fill="none" stroke={palette.metal} strokeWidth={1.6} opacity={0.8} />
          <g data-ring>
            {cells.map((cell) => (
              <path
                key={cell.index}
                data-cell={cell.index}
                data-lit={cell.lit ? "" : undefined}
                d={cell.path}
                fill={cell.lit ? signalColor : palette.metal}
                opacity={cell.lit ? 1 : 0.45}
              />
            ))}
          </g>
          <circle
            cx={px(lamp.x)}
            cy={px(lamp.y)}
            r={2.6}
            fill={signalColor}
            className={signal === "ready" ? "robocn-pulse" : undefined}
          />
        </>
      )}
    </g>
  )

  const optic = (
    <g key="optic">
      <g data-optic>
        <path data-barrel d={barrel} {...machined} />
        <path d={bezel} {...machined} />
        <path d={tube} fill={palette.dark} />
        <path
          data-lens
          d={glass}
          fill={palette.accent}
          fillOpacity={variant === "solid" ? 0.55 : 0.3}
          stroke={palette.metal}
          strokeWidth={1}
        />
        <path d={pupil} fill={palette.glow} opacity={0.95} />
        <path d={spark} fill={palette.foreground} opacity={0.35} />
      </g>
      <g data-cage>
        {cage.map((arm) => (
          <path key={arm.index} data-arm={arm.index} d={arm.path} {...machined} />
        ))}
        <path d={keel} {...machined} />
        <path d={cageRing} fill="none" stroke={palette.metal} strokeWidth={2.2} />
      </g>
    </g>
  )

  const order = [
    ...armour.map((plate) => ({
      depth: plate.depth,
      node: (
        <g data-shell key={`plate-${plate.index}`}>
          <Plate plate={plate} shell={shell} cast={cast} machined={machined} palette={palette} variant={variant} />
        </g>
      ),
    })),
    { depth: coreDepth, node: core },
    { depth: opticDepth, node: optic },
  ].sort((a, b) => a.depth - b.depth)

  const state = dragging
    ? "worked by hand"
    : behavior === "static"
      ? "parked"
      : behavior === "alert"
        ? "on alert"
        : behavior === "survey"
          ? "surveying"
          : "watching"
  const readout = Math.round(spread * 100)
  const fit = fits[view] ?? 1

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Custodian droid, ${state}, shell open ${readout} percent, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout} percent open` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
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
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.25 : 0.1, 0.25)
        if (delta !== 0) apply(spread + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path
            d={`M 12 ${px(ORIGIN.y)} H 188 M ${ORIGIN.x} 12 V ${VIEW_HEIGHT - 14}`}
            strokeDasharray="2 3"
          />
          <circle
            cx={ORIGIN.x}
            cy={px(ORIGIN.y + hover)}
            r={px(R_INNER + TRAVEL_FRONT + 30)}
            strokeDasharray="4 3"
          />
        </g>
      )}

      <g transform={fit === 1 ? undefined : `translate(${ORIGIN.x} ${ORIGIN.y}) scale(${fit}) translate(${-ORIGIN.x} ${-ORIGIN.y})`}>
        {showGround && (
          <path data-contact d={shadow} fill={palette.dark} opacity={px(0.2 - lift * 0.08)} />
        )}

        <g data-custodian data-view={view}>
          {/* Painter's order: every part sorted by its own nearest corner, so
              the armour passes in front of the chassis from one camera and
              behind it from another without a second drawing. */}
          {order.map((part) => part.node)}
        </g>
      </g>

      {label && (
        <text
          x={ORIGIN.x}
          y={VIEW_HEIGHT - 6}
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

/* ------------------------------------------------------------------ parts */

interface PlateArt {
  index: number
  depth: number
  face: string
  rear: string
  wall: string
  rims: string
  rail: string
  grooves: string[]
  bolts: Vec2[]
}

/** One armour segment: the rail it rides, then the plate itself. */
function Plate({
  plate,
  shell,
  cast,
  machined,
  palette,
  variant,
}: {
  plate: PlateArt
  shell: React.SVGProps<SVGPathElement>
  cast: React.SVGProps<SVGPathElement>
  machined: React.SVGProps<SVGPathElement>
  palette: { dark: string }
  variant: RobotVariant
}) {
  return (
    <g key={plate.index}>
      <path data-rail={plate.index} d={plate.rail} {...machined} />
      <path d={plate.rear} {...cast} />
      {/* The side wall is a strip of real faces; only its rims are edges, so
          it is filled once, shaded once, and never stroked quad by quad. */}
      <path d={plate.wall} fill={shell.fill} fillOpacity={shell.fillOpacity} stroke="none" />
      {variant === "solid" && <path d={plate.wall} fill={palette.dark} opacity={0.16} stroke="none" />}
      <path d={plate.rims} fill="none" stroke={shell.stroke} strokeWidth={0.6} opacity={0.7} />
      <path data-plate={plate.index} d={plate.face} {...shell} />
      <g fill="none" stroke={palette.dark} strokeWidth={1} opacity={variant === "solid" ? 0.55 : 0.3}>
        {plate.grooves.map((groove, index) => (
          <path key={index} d={groove} />
        ))}
      </g>
      {plate.bolts.map((bolt, index) => (
        <circle key={index} cx={px(bolt.x)} cy={px(bolt.y)} r={1.4} fill={palette.dark} opacity={0.55} />
      ))}
    </g>
  )
}

/* ------------------------------------------------------------------ maths */

const finite = (value: number, fallback = 0) => (Number.isFinite(value) ? value : fallback)
const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback
const round3 = (value: number) => Number(value.toFixed(3))

const polar = (degrees: number, radius: number): Vec2 => ({
  x: Math.cos(toRadians(degrees)) * radius,
  y: Math.sin(toRadians(degrees)) * radius,
})

/** A quad wound so it always fills, whichever way the camera folded it. */
const facePath = (points: readonly Vec2[]) => {
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]
    const b = points[(index + 1) % points.length]
    area += a.x * b.y - b.x * a.y
  }
  return polygonPath(area < 0 ? [...points].reverse() : points)
}

const polygonPath = (points: readonly Vec2[]) =>
  points.length < 3
    ? ""
    : `${points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`

const polylinePath = (points: readonly Vec2[]) =>
  points.length < 2
    ? ""
    : points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")

/**
 * How far the casing outline stands from the optical axis along one bearing.
 * The outline is a rounded rectangle — the rectangle of half extents
 * `(w - r, h - r)` grown by `r` — so the boundary is where the distance from
 * that inner rectangle is exactly `r`, which bisects cleanly and lands on the
 * same number in Node and in the browser.
 */
function outlineRadius(
  degrees: number,
  halfWidth: number,
  halfHeight: number,
  radius: number,
): number {
  const direction = polar(degrees, 1)
  const innerW = halfWidth - radius
  const innerH = halfHeight - radius
  const outside = (t: number) => {
    const x = Math.max(Math.abs(direction.x * t) - innerW, 0)
    const y = Math.max(Math.abs(direction.y * t) - innerH, 0)
    return Math.hypot(x, y) - radius
  }
  let low = 0
  let high = Math.hypot(halfWidth, halfHeight) + radius
  for (let step = 0; step < 24; step += 1) {
    const mid = (low + high) / 2
    if (outside(mid) > 0) high = mid
    else low = mid
  }
  return (low + high) / 2
}

/** The casing's own reach on one bearing. */
const casingRadius = (degrees: number) =>
  outlineRadius(degrees, CASE_HALF_W, CASE_HALF_H, CASE_RADIUS)

/**
 * One armour segment's cross-section, in the face plane: the casing outline
 * across its own bearing, closed back along the inner arc. The segments *are*
 * the casing, so the outer edge is sampled from the outline rather than drawn
 * as its own shape.
 */
function wedgeOutline(centre: number, half: number, outerScale: number): Vec2[] {
  const steps = Math.max(4, Math.round(half / 5) + 3)
  const outer = Array.from({ length: steps }, (_, step) => {
    const angle = centre - half + (step * half * 2) / (steps - 1)
    return polar(angle, casingRadius(angle) * outerScale)
  })
  const inner = Array.from({ length: steps }, (_, step) => {
    const angle = centre + half - (step * half * 2) / (steps - 1)
    return polar(angle, R_INNER)
  })
  return [...outer, ...inner]
}

/** A rounded rectangle about the optical axis, sampled for projection. */
function rectOutline(halfWidth: number, halfHeight: number, radius: number): Vec2[] {
  const r = Math.max(0, Math.min(radius, halfWidth, halfHeight))
  const corners: Vec2[] = [
    { x: halfWidth - r, y: -(halfHeight - r) },
    { x: halfWidth - r, y: halfHeight - r },
    { x: -(halfWidth - r), y: halfHeight - r },
    { x: -(halfWidth - r), y: -(halfHeight - r) },
  ]
  if (r === 0) return corners
  return corners.flatMap((corner, index) =>
    Array.from({ length: 4 }, (_, step) => {
      const angle = toRadians(index * 90 - 90 + (step * 90) / 3)
      return { x: corner.x + Math.cos(angle) * r, y: corner.y + Math.sin(angle) * r }
    }),
  )
}

export { CustodianDroid }

/**
 * What it does with nothing on it. `open` is the shell the loop eases toward,
 * `lift` the float off the deck, `roll` the drift the shell turns through under
 * its own stabilized optic, and `voice` the ring output. All illustrative:
 * there is no thrust, no mass and no stroke load here.
 */
export function custodianDroidPose(behavior: CustodianDroidBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Half open and breathing, turning through the room as it goes.
    case "survey":
      return {
        open: 0.5 + 0.16 * Math.sin(time * Math.PI * 2),
        lift: 0.6 + 0.16 * Math.sin(time * Math.PI * 1.4),
        roll: 0.7 * Math.sin(time * Math.PI * 0.5),
        voice: 0,
      }
    // Shell thrown wide, tight fast float, talking.
    case "alert":
      return {
        open: 0.86 + 0.1 * Math.sin(time * Math.PI * 6),
        lift: 0.82 + 0.06 * Math.sin(time * Math.PI * 5),
        roll: 0.25 * Math.sin(time * Math.PI * 3),
        voice: 0.5 + 0.45 * Math.sin(time * 11),
      }
    case "static":
      return { open: 0.35, lift: 0.5, roll: 0, voice: 0 }
    // Armour seated, station-keeping, drifting round a bearing it never holds.
    default:
      return {
        open: 0.06 + 0.05 * Math.sin(time * Math.PI * 2),
        lift: 0.5 + 0.18 * Math.sin(time * Math.PI * 1.1),
        roll: 0.45 * Math.sin(time * Math.PI * 0.37),
        voice: 0,
      }
  }
}
