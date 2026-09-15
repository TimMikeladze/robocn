"use client"

/**
 * construct-ring — a signet emitter ring that lights, comes apart, and forges
 * what the reader draws into a construct of solid light.
 *
 * The form is the heavy signet archetype: a broad knurled band with flared
 * shoulders, a collar, a bezel plate flanked by two crystal inlays, and a domed
 * lens whose face carries an abstract iris — a bore, four radial inlays and a
 * spiral gauge. The face points up the hand rather than at the reader, which is
 * why the iso camera is the one it is drawn for: from there you get the band
 * and the face at once.
 *
 * The axis nothing else in the set has is the **input**. Every other
 * interactive machine maps a pointer to one scalar; this one takes the shape of
 * the gesture. A stroke is resampled by arc length, measured into a frame
 * (centroid, principal axis, spans, closure, area, circularity, corners) and
 * classified into an archetype, which is then fitted to that frame and filled
 * by a real scanline clip. All of that is `src/lib/robocn/construct.ts` — pure,
 * no React, tested on its own.
 *
 * Solved: the stroke frame, the classifier, the outline fit, the lattice, the
 * draw a construct costs, and the explode schedule. Illustrated: the archetype
 * outlines themselves — a glove is a glove because it is drawn as one — the
 * glow, the emission column, the knurl and the crystal. There is no physics on
 * a construct: nothing swings, nothing collides, nothing has mass.
 *
 * The ring is modelled once in world units — x starboard, y up, z along the
 * finger — and pushed through `robotCamera`, so all four views are the same
 * geometry. A construct is **not** projected: it is light thrown at the reader
 * and lives in the picture plane, because the stroke that made it was drawn
 * there.
 *
 * Design note: docs/construct-ring.md.
 */

import * as React from "react"

import { arrowStep, useReducedMotion, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, lerp, type Vec2 } from "@/lib/robocn/kinematics"
import { explodeAssembly, type AssemblyPart } from "@/lib/robocn/assembly"
import {
  classifyStroke,
  constructArchetypes,
  constructCost,
  constructDetail,
  constructLattice,
  constructOutline,
  constructSettle,
  neutralFrame,
  strokeFrame,
  type ConstructArchetype,
  type StrokeFrame,
} from "@/lib/robocn/construct"
import {
  boxCorners,
  elevationDraft,
  fitFrame,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotCameraAt,
  robotSurface,
  robotViews,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

/** What the ring does with nobody driving it. Always includes `static`. */
export type ConstructRingBehavior = "conjure" | "charge" | "flare" | "idle" | "static"

export type { ConstructArchetype }

/** What a forged stroke reports back to the caller. */
export interface ConstructReport {
  archetype: ConstructArchetype
  /** What holding it draws from the reserve, 0 to 1. */
  cost: number
  frame: StrokeFrame
}

const VIEW_WIDTH = 260
const VIEW_HEIGHT = 260
const NATIVE_VIEW: RobotView = "iso"

/** The band of the viewBox the ring itself is fitted into, at the bottom. */
const RING_BAND = 150
const RING_TOP = VIEW_HEIGHT - RING_BAND

/** Where a construct sits when nobody drew one, in viewBox units. */
const FIELD_CENTER: Vec2 = { x: VIEW_WIDTH / 2, y: 58 }
const FIELD_SPAN = 86

/* World units: x starboard, y up from the bench, z along the finger. */
const BAND_CENTER: Vec2 = { x: 0, y: 34 }
const BAND_OUTER = 34
const BAND_BORE = 23
const BAND_HALF = 11
const BAND_TOP = BAND_CENTER.y + BAND_OUTER
const SHOULDER_HALF = 11
const COLLAR_BOTTOM = BAND_TOP - 4
const COLLAR_TOP = BAND_TOP + 3
const BEZEL_BOTTOM = COLLAR_TOP
const BEZEL_TOP = BEZEL_BOTTOM + 10
const BEZEL_HALF_WIDTH = 19
const BEZEL_HALF_DEPTH = 12
const INLAY_HALF_DEPTH = 6.5
const LENS_BASE = BEZEL_TOP
const LENS_RISE = 8
const LENS_R = 15
/** The face the iris is drawn on, as a world height. */
const LENS_FACE = LENS_BASE + LENS_RISE * 0.7

const ENVELOPE = boxCorners({ x: -48, y: 0, z: -26 }, { x: 48, y: 96, z: 26 })

/** How long a conjured construct lives, in clock units. */
const CONSTRUCT_LIFE = 1.6
/** How long a drawn construct takes to materialise, in clock units. */
const FORGE_RISE = 0.22
/** Samples of a pointer path closer than this are the same sample. */
const STROKE_STEP = 2.4

/** An arc of the band, from `from` to `to` degrees, at one radius. */
const shankArc = (from: number, to: number, radius: number, steps = 10): Vec2[] =>
  Array.from({ length: steps }, (_, index) => {
    const t = ((from + ((to - from) * index) / (steps - 1)) * Math.PI) / 180
    return {
      x: BAND_CENTER.x + Math.cos(t) * radius,
      y: BAND_CENTER.y + Math.sin(t) * radius,
    }
  })

/** A circle in the band's own plane, for the ring's near face. */
const ringFace = (radius: number, steps = 30): Vec2[] =>
  Array.from({ length: steps }, (_, index) => {
    const t = (index / steps) * Math.PI * 2
    return {
      x: BAND_CENTER.x + Math.cos(t) * radius,
      y: BAND_CENTER.y + Math.sin(t) * radius,
    }
  })

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/** The teardown, in the order the ring was put together. */
const RING_PARTS: AssemblyPart[] = [
  { id: "band", axis: { x: 0, y: -1, z: 0 }, travel: 0, order: 0 },
  { id: "shank-port", axis: { x: -1, y: 0.2, z: 0 }, travel: 16, order: 1 },
  { id: "shank-starboard", axis: { x: 1, y: 0.2, z: 0 }, travel: 16, order: 1 },
  { id: "collar", axis: { x: 0, y: 1, z: 0 }, travel: 14, order: 2 },
  { id: "bezel", axis: { x: 0, y: 1, z: 0 }, travel: 24, order: 3 },
  { id: "inlay-port", axis: { x: -1, y: 0.35, z: 0 }, travel: 26, order: 4 },
  { id: "inlay-starboard", axis: { x: 1, y: 0.35, z: 0 }, travel: 26, order: 4 },
  { id: "lens", axis: { x: 0, y: 1, z: 0 }, travel: 40, order: 5 },
]

/* -------------------------------------------------------------------------- */
/* the behaviours — pure functions of the clock                                */
/* -------------------------------------------------------------------------- */

/** The reserve the ring holds at `clock` with nobody driving it, 0 to 1. */
export function constructRingReserve(
  behavior: ConstructRingBehavior,
  clock: number,
): number {
  if (!Number.isFinite(clock)) return 0.7
  const t = ((clock % 1) + 1) % 1
  switch (behavior) {
    case "charge":
      return clamp(0.18 + t * 0.82, 0, 1)
    case "flare":
      return clamp(0.72 + Math.sin(clock * Math.PI * 2) * 0.24, 0, 1)
    case "idle":
      return clamp(0.56 + Math.sin(clock * Math.PI * 2) * 0.07, 0, 1)
    case "conjure":
      return clamp(0.94 - t * 0.18, 0, 1)
    default:
      return 0.7
  }
}

/**
 * The construct the ring is holding at `clock`: which archetype, and how solid
 * it is. `charge` and `idle` forge nothing, so they report a null archetype.
 */
export function constructRingConjuring(
  behavior: ConstructRingBehavior,
  clock: number,
): { archetype: ConstructArchetype | null; settle: number; index: number } {
  if (behavior === "charge" || behavior === "idle") {
    return { archetype: null, settle: 0, index: 0 }
  }
  const time = Number.isFinite(clock) ? clock : 0
  if (behavior === "static") {
    return { archetype: "bubble", settle: 1, index: 0 }
  }
  if (behavior === "flare") {
    return { archetype: "glove", settle: 1, index: 3 }
  }
  const step = Math.floor(time / CONSTRUCT_LIFE)
  const index = ((step % constructArchetypes.length) + constructArchetypes.length) %
    constructArchetypes.length
  const age = time - step * CONSTRUCT_LIFE
  return { archetype: constructArchetypes[index], settle: constructSettle(age, CONSTRUCT_LIFE), index }
}

/**
 * Where a conjured construct stands, when no stroke drew one. Deterministic in
 * the archetype's own index, so the same clock always draws the same picture.
 */
export function conjuredFrame(index: number): StrokeFrame {
  const i = Number.isFinite(index) ? index : 0
  const along = FIELD_SPAN + (i % 3) * 13
  const across = along / (1.08 + (i % 4) * 0.2)
  return {
    ...neutralFrame(along),
    center: { x: FIELD_CENTER.x + Math.sin(i * 2.1) * 16, y: FIELD_CENTER.y + Math.cos(i * 1.7) * 9 },
    angle: ((i * 43) % 90) - 45,
    along,
    across,
    aspect: along / across,
  }
}

/** An angle wrapped into (-180, 180]. */
const wrap180 = (degrees: number) => {
  const value = Number.isFinite(degrees) ? degrees : 0
  const wrapped = ((((value + 180) % 360) + 360) % 360) - 180
  return wrapped === -180 ? 180 : wrapped
}

/**
 * Any pair of angles, put back on the sphere. Azimuth wraps, and an elevation
 * dragged past the pole carries on *over* it — the camera comes down the far
 * side, which is azimuth turned half a turn and the elevation mirrored, rather
 * than stopping dead at the top. The camera has no roll axis, so it arrives
 * upright rather than upside down; nothing else about the machine cares.
 */
export function normalizeOrbit(azimuth: number, elevation: number) {
  let tilt = wrap180(elevation)
  let turn = Number.isFinite(azimuth) ? azimuth : 0
  if (tilt > 90) {
    tilt = 180 - tilt
    turn += 180
  } else if (tilt < -90) {
    tilt = -180 - tilt
    turn += 180
  }
  return { azimuth: wrap180(turn), elevation: tilt }
}

/** Degrees of turn per view unit of pointer travel. */
const ORBIT_RATE = 1.6

/* -------------------------------------------------------------------------- */
/* the component                                                               */
/* -------------------------------------------------------------------------- */

export interface ConstructRingProps
  extends Omit<React.ComponentProps<"svg">, "color" | "onSelect">,
    RobotPaletteProps {
  /** Controlled reserve, 0 spent to 1 charged. Supplying it stops the loop. */
  reserve?: number
  onReserveChange?: (reserve: number) => void
  /** Controlled construct. `null` holds none; supplying it stops the cycle. */
  construct?: ConstructArchetype | null
  /** Fires whenever a stroke is forged into a construct. */
  onConstructChange?: (report: ConstructReport) => void
  behavior?: ConstructRingBehavior
  /** Take the ring apart, 0 seated to 1 clear. */
  exploded?: number
  /** Let the reader draw constructs with a pointer, a finger, or Enter. */
  drawable?: boolean
  /** The field the constructs are forged in: a frame and its corner ticks. */
  showField?: boolean
  showGround?: boolean
  /** Where the camera stands. Defaults to the view the ring was drawn in. */
  view?: RobotView
  /**
   * Controlled camera, in degrees. Supplying either one turns the ring to that
   * angle and `view` only names the drawing plane. Azimuth wraps at 360;
   * elevation carries over the pole rather than stopping at it.
   */
  azimuth?: number
  elevation?: number
  onOrbitChange?: (orbit: { azimuth: number; elevation: number }) => void
  /** Turn the ring with a drag, a finger, or the arrow keys. */
  rotatable?: boolean
  speed?: number
  phase?: number
  paused?: boolean
  animate?: boolean
  /** Makes the ring a slider over its own reserve. */
  interactive?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function ConstructRing({
  reserve,
  onReserveChange,
  construct,
  onConstructChange,
  behavior = "conjure",
  exploded = 0,
  drawable = false,
  showField = true,
  showGround = true,
  view = NATIVE_VIEW,
  azimuth,
  elevation,
  onOrbitChange,
  rotatable = true,
  speed = 0.5,
  phase = 0,
  paused = false,
  animate = true,
  interactive = false,
  label,
  size = "md",
  variant = "solid",
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
}: ConstructRingProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const [stroke, setStroke] = React.useState<Vec2[] | null>(null)
  const [drawn, setDrawn] = React.useState<
    { archetype: ConstructArchetype; frame: StrokeFrame; born: number } | null
  >(null)
  const [keyed, setKeyed] = React.useState(0)
  const [turned, setTurned] = React.useState<{ azimuth: number; elevation: number } | null>(null)

  const controlled = reserve !== undefined
  const hold = controlled ? (Number.isFinite(reserve) ? clamp(reserve as number, 0, 1) : 0) : held

  // Reduced motion parks the loop, so it counts as "not running": a parked
  // clock would otherwise leave the construct at the start of its rise, which
  // is nothing at all.
  const reduced = useReducedMotion()
  const running = animate && !reduced && !controlled && behavior !== "static"
  const goal = React.useCallback(
    (clock: number) => constructRingReserve(behavior, clock),
    [behavior],
  )
  const motion = useRobotScalar(goal, {
    rate: 0.9,
    hold,
    speed,
    paused,
    phase,
    animate: running,
  })
  const clock = Number.isFinite(motion.clock) ? motion.clock : 0
  // The clock a stroke was forged at, read in a handler rather than in render.
  const clockRef = React.useRef(clock)
  React.useEffect(() => {
    clockRef.current = clock
  }, [clock])

  /* Which construct is on: a drawn one wins over a controlled one, which wins
     over the behaviour's own cycle. */
  const conjured = constructRingConjuring(behavior, clock)
  const pinned = construct !== undefined
  let archetype: ConstructArchetype | null = null
  let frame: StrokeFrame = conjuredFrame(conjured.index)
  let settle = 0
  if (drawn) {
    archetype = drawn.archetype
    frame = drawn.frame
    settle = running ? clamp((clock - drawn.born) / FORGE_RISE, 0, 1) : 1
  } else if (pinned) {
    archetype = construct
    frame = conjuredFrame(constructArchetypes.indexOf(construct as ConstructArchetype))
    settle = 1
  } else {
    archetype = conjured.archetype
    settle = running ? conjured.settle : conjured.archetype ? 1 : 0
  }
  if (archetype && !constructArchetypes.includes(archetype)) archetype = "bubble"

  const outline = archetype ? constructOutline(archetype, frame) : []
  const lattice = archetype
    ? constructLattice(outline, { spacing: Math.max(5, frame.along / 9), angle: frame.angle + 34 })
    : []
  const seams = archetype ? constructDetail(archetype, frame) : []
  const cost = archetype ? constructCost(outline) : 0

  // Charge spent is charge gone: the gauge reads the construct it is holding.
  const base = clamp(motion.value, 0, 1)
  const level = clamp(base - cost * settle * 0.55, 0, 1)

  /* The camera. A controlled angle wins; then whatever the reader dragged it
     to; then the named view, so a ring nobody has touched is byte-identical to
     the one before it could be turned. */
  const native = robotViews[view] ?? robotViews[NATIVE_VIEW]
  const commanded =
    azimuth !== undefined || elevation !== undefined
      ? normalizeOrbit(azimuth ?? native.azimuth, elevation ?? native.elevation)
      : null
  const orbit = commanded ?? turned
  const camera = orbit ? robotCameraAt(orbit.azimuth, orbit.elevation, view) : robotCamera(view)
  const fit = fitFrame(ENVELOPE, camera, VIEW_WIDTH, RING_BAND)
  const draft = elevationDraft(camera, "front")
  const { path: line, solid, box, bar, disc } = draft

  /** A world point on the ring, in viewBox units — where the emission starts. */
  const toViewBox = (point: Vec2) => {
    const screen = fit.toViewBox(draft.point(point))
    return { x: screen.x, y: screen.y + RING_TOP }
  }

  /* The teardown. A world offset projects to a pure screen offset, so one
     schedule serves all four cameras. */
  const teardown = clamp(Number.isFinite(exploded) ? exploded : 0, 0, 1)
  const parts = explodeAssembly(RING_PARTS, teardown, { overlap: 0.5 })
  const offsets = Object.fromEntries(parts.map((part) => [part.id, part.offset])) as Record<
    string,
    { x: number; y: number; z: number }
  >
  const at = (id: string, point: Vec2): Vec2 => {
    const offset = offsets[id] ?? { x: 0, y: 0, z: 0 }
    return { x: point.x + offset.x, y: point.y + offset.y }
  }
  const lift = (id: string) => offsets[id]?.y ?? 0
  const slide = (id: string) => offsets[id]?.x ?? 0

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 100) / 100
      setHeld(bounded)
      onReserveChange?.(bounded)
    },
    [onReserveChange],
  )

  /**
   * Turn the camera to an angle, wrapped onto the sphere. The gesture keeps its
   * own running angles in `rawRef`, because a drag can deliver several moves
   * inside one task and a turn computed from the last *rendered* angle would
   * throw most of them away.
   */
  const turn = React.useCallback(
    (nextAzimuth: number, nextElevation: number) => {
      const next = normalizeOrbit(nextAzimuth, nextElevation)
      setTurned(next)
      onOrbitChange?.(next)
    },
    [onOrbitChange],
  )

  // The plain slider path, for a ring that is not a sketch surface.
  const sliding = useRobotDrag(svgRef, {
    enabled: interactive && !drawable && !rotatable,
    onDrag: React.useCallback((unit: Vec2) => apply(1 - unit.y), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  /* Drawing. The same gesture as the slider, told apart by where it starts:
     inside the ring adjusts the reserve, outside it forges. */
  const mode = React.useRef<"draw" | "reserve" | "orbit" | null>(null)
  /** Where the orbiting pointer was last frame, in viewBox units. */
  const lastPoint = React.useRef<Vec2 | null>(null)
  /**
   * The angles the gesture is working from, ahead of the next render and
   * *before* they are put back on the sphere. Keeping them raw is what lets a
   * drag carry on over the pole: once past 90 the wrapped elevation comes back
   * down, so a gesture that read the wrapped value would bounce off the top.
   */
  const rawRef = React.useRef<{ azimuth: number; elevation: number } | null>(null)
  /* The stroke lives in a ref as well as in state: several pointer events can
     land in one task, and React would batch the renders away. The ref is what
     the gesture reads; the state is what the drawing reads. */
  const strokeRef = React.useRef<Vec2[]>([])
  const toView = React.useCallback((event: React.PointerEvent): Vec2 => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width < 1 || rect.height < 1) return { x: 0, y: 0 }
    return {
      x: ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT,
    }
  }, [])

  const forge = React.useCallback(
    (points: Vec2[]) => {
      const measured = strokeFrame(points)
      const verdict = classifyStroke(measured)
      setDrawn({ archetype: verdict.archetype, frame: measured, born: clockRef.current })
      onConstructChange?.({
        archetype: verdict.archetype,
        cost: constructCost(constructOutline(verdict.archetype, measured)),
        frame: measured,
      })
    },
    [onConstructChange],
  )

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawable && !rotatable) return
    const point = toView(event)
    /* One gesture, three jobs, told apart by where it starts and what is on:
       in the field with `drawable` it forges; anywhere with `rotatable` it
       turns the ring; and failing both, on the ring it scrubs the reserve. */
    if (drawable && point.y <= RING_TOP) {
      mode.current = "draw"
      strokeRef.current = [point]
      setStroke(strokeRef.current)
    } else if (rotatable) {
      mode.current = "orbit"
      lastPoint.current = point
      rawRef.current = orbit ?? { ...native }
    } else if (interactive) {
      mode.current = "reserve"
      apply(clamp(1 - (point.y - RING_TOP) / RING_BAND, 0, 1))
    } else {
      return
    }
    // Capture is a convenience: a pointer id the browser does not know about
    // (a synthetic event, a test) must not take the gesture down with it.
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    } catch {
      /* no capture; the gesture still tracks on the element */
    }
  }

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!mode.current) return
    const point = toView(event)
    if (mode.current === "reserve") {
      apply(clamp(1 - (point.y - RING_TOP) / RING_BAND, 0, 1))
      return
    }
    if (mode.current === "orbit") {
      // Turn by how far the pointer moved, not by where it is: a drag can go
      // round and round without ever running out of canvas.
      const from = lastPoint.current ?? point
      const here = rawRef.current ?? orbit ?? native
      const next = {
        azimuth: here.azimuth + (point.x - from.x) * ORBIT_RATE,
        elevation: here.elevation - (point.y - from.y) * ORBIT_RATE,
      }
      lastPoint.current = point
      rawRef.current = next
      turn(next.azimuth, next.elevation)
      return
    }
    const last = strokeRef.current.at(-1)
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < STROKE_STEP) return
    strokeRef.current = [...strokeRef.current, point]
    setStroke(strokeRef.current)
  }

  const endStroke = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!mode.current) return
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    } catch {
      /* it was never captured */
    }
    const path = strokeRef.current
    lastPoint.current = null
    if (mode.current === "orbit") {
      rawRef.current = null
    } else if (mode.current === "reserve") setHeld(null)
    else if (path.length > 1) forge(path)
    else if (path.length === 1) {
      // A tap is a gesture too: forge something small where it landed.
      forge([path[0], { x: path[0].x + 26, y: path[0].y + 18 }])
    }
    mode.current = null
    strokeRef.current = []
    setStroke(null)
  }

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const lit = variant === "outline" || variant === "wire"

  const percent = Math.round(level * 100)
  const source = toViewBox({ x: 0, y: LENS_FACE + lift("lens") })
  const bloom = 0.35 + level * 0.65

  /* The construct, materialising about its own centre. */
  const swell = lerp(0.84, 1, settle)
  const constructTransform = `translate(${px(frame.center.x)} ${px(frame.center.y)}) scale(${px(swell)}) translate(${px(-frame.center.x)} ${px(-frame.center.y)})`
  const outlinePath = outline.length
    ? `${outline.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
    : ""

  /** The emission column, from the lens face to the construct it is holding. */
  const beam = (() => {
    if (!archetype || settle <= 0.02) return null
    const target = frame.center
    const dx = target.x - source.x
    const dy = target.y - source.y
    const span = Math.hypot(dx, dy)
    if (!(span > 1)) return null
    const nx = -dy / span
    const ny = dx / span
    const root = 3.5
    const mouth = Math.max(8, frame.across * 0.34) * settle
    return `M ${px(source.x + nx * root)} ${px(source.y + ny * root)} L ${px(target.x + nx * mouth)} ${px(target.y + ny * mouth)} L ${px(target.x - nx * mouth)} ${px(target.y - ny * mouth)} L ${px(source.x - nx * root)} ${px(source.y - ny * root)} Z`
  })()

  /** The iris on the lens face: bore, four radial inlays, and the gauge arc. */
  const gauge = (() => {
    const sweep = clamp(level, 0, 1) * 300
    const start = -240
    const end = start + sweep
    const r = 11.5
    const point = (degrees: number) => ({
      x: Math.cos((degrees * Math.PI) / 180) * r,
      y: Math.sin((degrees * Math.PI) / 180) * r,
    })
    const a = point(start)
    const b = point(end)
    if (sweep < 1) return ""
    return `M ${px(a.x)} ${px(a.y)} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${px(b.x)} ${px(b.y)}`
  })()

  const lensDome = Array.from({ length: 15 }, (_, index) => {
    const t = (index / 14) * Math.PI
    return { x: Math.cos(Math.PI - t) * LENS_R, y: LENS_BASE + Math.sin(t) * LENS_RISE }
  })

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive || rotatable ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Construct ring, ${percent} percent reserve, ${
          archetype ? `holding a ${archetype} construct` : "holding no construct"
        }${teardown > 0.01 ? `, ${Math.round(teardown * 100)} percent apart` : ""}, ${
          orbit
            ? `turned to ${px(orbit.azimuth)} degrees round and ${px(orbit.elevation)} degrees up`
            : (viewNames[view] ?? viewNames.iso)
        }`
      }
      /* Turning is the axis a person reaches for first, so when the ring can be
         turned that is the value the slider reports; the reserve stays a prop. */
      aria-valuemin={rotatable ? -180 : interactive ? 0 : undefined}
      aria-valuemax={rotatable ? 180 : interactive ? 1 : undefined}
      aria-valuenow={
        rotatable ? px(orbit?.azimuth ?? native.azimuth) : interactive ? px(level) : undefined
      }
      aria-valuetext={
        rotatable
          ? `${px(orbit?.azimuth ?? native.azimuth)} degrees round, ${px(
              orbit?.elevation ?? native.elevation,
            )} degrees up`
          : interactive
            ? `${percent} percent reserve`
            : undefined
      }
      tabIndex={tabIndex ?? (interactive || drawable || rotatable ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.defaultPrevented) return
        // Enter forges the next archetype, so the feature has a keyboard path.
        if (drawable && (event.key === "Enter" || event.key === " ")) {
          const next = (keyed + 1) % constructArchetypes.length
          setKeyed(next)
          const chosen = constructArchetypes[next]
          setDrawn({ archetype: chosen, frame: conjuredFrame(next), born: clockRef.current })
          onConstructChange?.({
            archetype: chosen,
            cost: constructCost(constructOutline(chosen, conjuredFrame(next))),
            frame: conjuredFrame(next),
          })
          event.preventDefault()
          return
        }
        if (drawable && (event.key === "Escape" || event.key === "Backspace")) {
          setDrawn(null)
          event.preventDefault()
          return
        }
        if (rotatable) {
          // Arrows walk the camera round and over the ring; Home puts it back
          // on the named view.
          const step = event.shiftKey ? 45 : 15
          const here = orbit ?? native
          if (event.key === "ArrowLeft") turn(here.azimuth - step, here.elevation)
          else if (event.key === "ArrowRight") turn(here.azimuth + step, here.elevation)
          else if (event.key === "ArrowUp") turn(here.azimuth, here.elevation + step * 0.7)
          else if (event.key === "ArrowDown") turn(here.azimuth, here.elevation - step * 0.7)
          else if (event.key === "Home") {
            rawRef.current = null
            setTurned(null)
            onOrbitChange?.({ ...native })
          } else return
          event.preventDefault()
          return
        }
        if (!interactive) return
        const delta = arrowStep(event.key, 0.05, 0.2)
        if (delta !== 0) apply(level + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else return
        event.preventDefault()
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      width={width}
      height={px((width * VIEW_HEIGHT) / VIEW_WIDTH)}
      onBlur={(event) => {
        onBlur?.(event)
        if (!sliding && mode.current === null) setHeld(null)
      }}
      className={cn(
        "max-w-full select-none",
        (interactive || drawable || rotatable) &&
          "touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]",
        (rotatable || (interactive && !drawable)) && "cursor-grab",
        sliding && "cursor-grabbing",
        drawable && "cursor-crosshair",
        className,
      )}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {/* The field the constructs are forged in. */}
      {showField && (
        <g data-field opacity={variant === "blueprint" ? 0.65 : 0.4}>
          <rect
            x={10}
            y={10}
            width={VIEW_WIDTH - 20}
            height={RING_TOP - 22}
            rx={6}
            fill="none"
            stroke={palette.grid}
            strokeWidth={0.6}
            strokeDasharray="4 6"
          />
          {[
            [10, 10],
            [VIEW_WIDTH - 10, 10],
            [10, RING_TOP - 12],
            [VIEW_WIDTH - 10, RING_TOP - 12],
          ].map(([x, y]) => (
            <path
              key={`${x}:${y}`}
              d={`M ${x - 5} ${y} H ${x + 5} M ${x} ${y - 5} V ${y + 5}`}
              stroke={palette.grid}
              strokeWidth={0.8}
            />
          ))}
        </g>
      )}

      {/* The emission column, from the lens to whatever it is holding. */}
      {beam && (
        <path
          data-emission
          d={beam}
          fill={palette.glow}
          opacity={0.06 + settle * bloom * 0.14}
          stroke="none"
        />
      )}

      {/* The construct itself: picture-plane light, not a projected solid. */}
      {archetype && settle > 0.01 && outlinePath && (
        <g
          data-construct
          data-archetype={archetype}
          data-settle={px(settle)}
          transform={constructTransform}
          opacity={px(clamp(settle, 0, 1))}
        >
          <path
            d={outlinePath}
            fill={lit ? "none" : palette.glow}
            opacity={lit ? 1 : 0.2 + bloom * 0.16}
            stroke="none"
          />
          <g data-lattice opacity={0.5 + bloom * 0.3}>
            {lattice.map(([a, b], index) => (
              <path
                key={index}
                d={`M ${px(a.x)} ${px(a.y)} L ${px(b.x)} ${px(b.y)}`}
                stroke={palette.accent}
                strokeWidth={1.2}
                strokeLinecap="round"
                opacity={0.45 + (index % 3) * 0.14}
              />
            ))}
          </g>
          <g data-seams opacity={0.7}>
            {seams.map((seam, index) => (
              <path
                key={index}
                d={seam.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")}
                fill="none"
                stroke={palette.accent}
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </g>
          <path
            d={outlinePath}
            fill="none"
            stroke={palette.accent}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <path
            d={outlinePath}
            fill="none"
            stroke={palette.glow}
            strokeWidth={5}
            strokeLinejoin="round"
            opacity={0.18 + bloom * 0.2}
          />
        </g>
      )}

      {/* The stroke under the pointer, before it is forged. */}
      {stroke && stroke.length > 1 && (
        <path
          data-stroke
          d={stroke.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")}
          fill="none"
          stroke={palette.accent}
          strokeWidth={2}
          strokeDasharray="5 4"
          strokeLinecap="round"
          opacity={0.85}
        />
      )}

      <g
        data-view={view}
        data-azimuth={px(orbit?.azimuth ?? native.azimuth)}
        data-elevation={px(orbit?.elevation ?? native.elevation)}
        transform={`translate(0 ${RING_TOP})`}
      >
        <g transform={fit.transform || undefined}>
          {showGround && (
            <>
              <path
                data-ground
                d={solid([{ x: -30, y: 0.5 }, { x: 30, y: 0.5 }], 16)}
                fill={palette.dark}
                opacity={0.14}
              />
              <path
                d={line([{ x: -44, y: 0 }, { x: 44, y: 0 }])}
                fill="none"
                stroke={palette.dark}
                strokeWidth={1}
                opacity={0.45}
              />
            </>
          )}

          {/* The band: a knurled hoop with a bore straight through it. */}
          <g data-band>
            {/* The whole cylinder, then the bore behind it, then the near face,
               so the hole is a hole rather than a disc painted on. */}
            <path d={disc(BAND_CENTER, BAND_OUTER, BAND_HALF, 0, 30)} {...machined} />
            <path
              d={disc(BAND_CENTER, BAND_BORE, BAND_HALF * 0.98, 0, 26)}
              {...cast}
              opacity={variant === "solid" ? 0.82 : undefined}
            />
            {/* The far wall of the bore, catching what light there is. */}
            <path
              d={line(ringFace(BAND_BORE - 0.6), BAND_HALF * 0.92, true)}
              fill="none"
              stroke={palette.metal}
              strokeWidth={1.6}
              opacity={0.55}
            />
            <path
              d={`${line(ringFace(BAND_OUTER), -BAND_HALF, true)} ${line(
                [...ringFace(BAND_BORE)].reverse(),
                -BAND_HALF,
                true,
              )}`}
              fillRule="evenodd"
              {...machined}
            />
            {Array.from({ length: 26 }, (_, index) => {
              const t = (index / 26) * Math.PI * 2
              const inner = {
                x: BAND_CENTER.x + Math.cos(t) * (BAND_BORE + 2.5),
                y: BAND_CENTER.y + Math.sin(t) * (BAND_BORE + 2.5),
              }
              const outer = {
                x: BAND_CENTER.x + Math.cos(t) * (BAND_OUTER - 2),
                y: BAND_CENTER.y + Math.sin(t) * (BAND_OUTER - 2),
              }
              return (
                <path
                  key={index}
                  d={line([inner, outer], -BAND_HALF)}
                  fill="none"
                  stroke={palette.dark}
                  strokeWidth={0.7}
                  opacity={0.3}
                />
              )
            })}
          </g>

          {/* The shank plates: the flanks of the band, proud of it. */}
          {([-1, 1] as const).map((side) => {
            const id = side < 0 ? "shank-port" : "shank-starboard"
            const from = side < 0 ? 104 : 14
            const to = side < 0 ? 166 : 76
            const plate = [
              ...shankArc(from, to, BAND_OUTER - 0.6),
              ...shankArc(to, from, BAND_BORE + 3),
            ].map((point) => at(id, point))
            return (
              <g key={id} data-shank={side < 0 ? "port" : "starboard"}>
                <path d={solid(plate, BAND_HALF * 1.04)} {...shell} />
                <path
                  d={line(
                    shankArc(from + 8, to - 8, (BAND_OUTER + BAND_BORE) / 2 + 1).map((point) =>
                      at(id, point),
                    ),
                    -BAND_HALF * 1.05,
                  )}
                  fill="none"
                  stroke={palette.dark}
                  strokeWidth={0.8}
                  opacity={0.45}
                />
              </g>
            )
          })}

          {/* Collar, bezel plate and the two crystal inlays that flank it. */}
          <g data-collar>
            <path
              d={box(-21, COLLAR_BOTTOM + lift("collar"), 21, COLLAR_TOP + lift("collar"), 13)}
              {...cast}
            />
          </g>

          <g data-bezel>
            <path
              d={box(
                -BEZEL_HALF_WIDTH,
                BEZEL_BOTTOM + lift("bezel"),
                BEZEL_HALF_WIDTH,
                BEZEL_TOP + lift("bezel"),
                BEZEL_HALF_DEPTH,
              )}
              {...shell}
            />
          </g>

          {([-1, 1] as const).map((side) => {
            const id = side < 0 ? "inlay-port" : "inlay-starboard"
            const dx = slide(id)
            const dy = lift(id)
            return (
              <g key={id} data-inlay={side < 0 ? "port" : "starboard"}>
                <path
                  d={box(
                    side < 0 ? -27 + dx : 19 + dx,
                    BEZEL_BOTTOM + 1.5 + dy,
                    side < 0 ? -19 + dx : 27 + dx,
                    BEZEL_TOP - 0.5 + dy,
                    INLAY_HALF_DEPTH,
                  )}
                  fill={palette.accent}
                  stroke={palette.dark}
                  strokeWidth={0.8}
                  opacity={0.55 + bloom * 0.45}
                />
              </g>
            )
          })}

          {/* The lens: a dome, and the iris drawn on its face. */}
          <g data-lens>
            <path
              d={solid(
                lensDome.map((p) => at("lens", p)),
                BEZEL_HALF_DEPTH * 0.86,
              )}
              fill={palette.glow}
              stroke={palette.accent}
              strokeWidth={1.2}
              opacity={0.3 + bloom * 0.5}
            />
            <g
              data-bore
              transform={camera.plane(LENS_FACE + lift("lens")) || undefined}
              opacity={0.85}
            >
              <circle r={13} fill={palette.dark} opacity={0.75} />
              <circle r={13} fill="none" stroke={palette.metal} strokeWidth={1.4} />
              {/* The spiral in the bore — abstract, and not a mark of anything. */}
              <path
                d={Array.from({ length: 40 }, (_, index) => {
                  const t = (index / 39) * Math.PI * 3.4
                  const r = 2 + (index / 39) * 8.4
                  return `${index ? "L" : "M"} ${px(Math.cos(t) * r)} ${px(Math.sin(t) * r)}`
                }).join(" ")}
                fill="none"
                stroke={palette.accent}
                strokeWidth={0.9}
                opacity={0.4 + bloom * 0.4}
              />
              <circle r={4.6} fill={palette.accent} opacity={0.35 + bloom * 0.55} />
              {[0, 90, 180, 270].map((degrees) => {
                const radians = (degrees * Math.PI) / 180
                return (
                  <path
                    key={degrees}
                    d={`M ${px(Math.cos(radians) * 5.4)} ${px(Math.sin(radians) * 5.4)} L ${px(Math.cos(radians) * 12)} ${px(Math.sin(radians) * 12)}`}
                    stroke={palette.glow}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    opacity={0.45 + bloom * 0.45}
                  />
                )
              })}
              {gauge && (
                <path
                  data-gauge
                  d={gauge}
                  fill="none"
                  stroke={palette.accent}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                />
              )}
            </g>
          </g>

          {variant === "blueprint" && (
            <text
              x={px(draft.point({ x: 44, y: BEZEL_TOP }).x)}
              y={px(draft.point({ x: 44, y: BEZEL_TOP }).y)}
              textAnchor="start"
              fontFamily="ui-monospace, monospace"
              fontSize={6}
              fill={palette.foreground}
            >
              {`${percent}%`}
            </text>
          )}
        </g>
      </g>

      {label && (
        <text
          x={VIEW_WIDTH / 2}
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

export { ConstructRing }
