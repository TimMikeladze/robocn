"use client"

/**
 * battle-station — the one body in the set that is machinery, and the only
 * solid here that comes apart into the parts it was made of.
 *
 * The hull is a real tiling: equal-area latitude courses, each cut into plates
 * whose areas sum to exactly one sphere. `breakup` does not cross-fade one
 * picture into another — it launches every one of those plates down its own
 * straight line, behind a fracture front that starts at a rupture the caller
 * places and reaches the far side last. At `breakup = 0` every plate is back at
 * the position the tiling gave it, to the last bit, so the intact hull is not a
 * second drawing of anything.
 *
 * Two more things fall out rather than being drawn. The equatorial **trench**
 * is a course with no plating on it, so it is a genuine hole in the hull rather
 * than a stripe painted over one — and `plating` takes the courses away from
 * the poles inward, which shows the ribs and girdle rings underneath. And the
 * **dish** is a paraboloid: the emitter rays are the reflection of an axial ray
 * about the bowl's own normal, so they converge on the focus because the
 * surface does, not because they were aimed there.
 *
 * Nothing here is simulated. No mass, no energy, no structure and no collision:
 * plates pass through each other's paths because nothing is stopping them, and
 * `breakup` runs backwards as happily as forwards, which is the honest framing
 * — a tiling coming apart, not a thing failing.
 *
 * Design note: docs/battle-station.md.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { bodyFrame, illumination } from "@/lib/robocn/celestial"
import {
  burst,
  direction,
  dish,
  dishNormal,
  dishProfile,
  hullPlates,
  plateNormal,
  plateOutline,
  shockRing,
  type BurstOptions,
  type HullPlate,
  type PlateBurst,
} from "@/lib/robocn/hull"
import { clamp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
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

const VIEW_SIZE = 200
const ORIGIN = { x: 100, y: 100 }
const NATIVE_VIEW: RobotView = "front"

const RADIUS = 54
/** The frame the plating is bolted to, just inside the hull. */
const FRAME_RADIUS = RADIUS * 0.955
/** Points per plate edge: a parallel is a curve, and a wide plate shows it. */
const PLATE_STEPS = 3
/** Degrees of breakup per second while the machine returns to its behaviour. */
const BREAKUP_RATE = 1.4
const DEG = Math.PI / 180
const TAU = Math.PI * 2

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type StationBehavior = "patrol" | "charge" | "detonate" | "static"

export interface BattleStationProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /**
   * Where the camera stands. A bare sphere looks the same from everywhere; the
   * plating, the trench, the dish, the rupture axis and the shock plane do not.
   */
  view?: RobotView
  /** Controlled breakup, 0 intact to 1 fully apart. Supplying it stops the loop. */
  breakup?: number
  /** What the station does when `breakup` is not supplied. */
  behavior?: StationBehavior
  /** Cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag across it to work the breakup, or arrow-key it. */
  interactive?: boolean
  onBreakupChange?: (breakup: number) => void
  /** Controlled dish charge, 0 cold to 1 firing. Omit and the behaviour drives it. */
  charge?: number
  /** Controlled rotation about the pole, in degrees. Omit and the clock turns it. */
  spin?: number
  /** Degrees the pole leans out of vertical. */
  tilt?: number
  /** Armour courses, pole to pole. Clamped 3..21. */
  courses?: number
  /** Plates round the equator; every other course scales by its own cosine. Clamped 4..28. */
  perCourse?: number
  /** How much of the hull is plated, 1 complete. Courses come off pole-first. */
  plating?: number
  /** The equatorial service trench: a course carrying no plating at all. */
  trench?: boolean
  /** Meridional ribs on the frame under the plating. Clamped 0..24. */
  ribs?: number
  /** Degrees: where the focusing dish sits on the hull. */
  dishLatitude?: number
  dishLongitude?: number
  /** Degrees of hull the dish bore takes up, measured from its axis. Clamped 8..48. */
  dishSpan?: number
  /** Emitters round the bowl, clamped 0..16. Their rays are solved onto the focus. */
  emitters?: number
  /** Degrees round the body the rupture sits at. */
  rupture?: number
  /** How far a plate travels by the end, in radii. Clamped 0..6. */
  spread?: number
  /** Any integer. The same seed is the same breakup, every render. */
  seed?: number
  /** Where the light is, in degrees round the body. 0 is behind the viewer. */
  sun?: number
  signal?: "idle" | "ready" | "warning"
  label?: string
}

function BattleStation({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  breakup,
  behavior = "detonate",
  speed = 0.14,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onBreakupChange,
  charge,
  spin,
  tilt = 18,
  courses = 9,
  perCourse = 12,
  plating = 1,
  trench = true,
  ribs = 12,
  dishLatitude = 34,
  dishLongitude = 72,
  dishSpan = 26,
  emitters = 8,
  rupture = 24,
  spread = 0.75,
  seed = 5,
  sun = 38,
  signal = "ready",
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
}: BattleStationProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = breakup !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? clamp(Number.isFinite(breakup) ? breakup : 0, 0, 1) : held
  const goal = React.useCallback((clock: number) => stationGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: BREAKUP_RATE,
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
      onBreakupChange?.(bounded)
    },
    [onBreakupChange],
  )

  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  /* ---- the numbers ------------------------------------------------------ */

  const progress = clamp(Number.isFinite(motion.value) ? motion.value : 0, 0, 1)
  const power = clamp(
    charge !== undefined
      ? (Number.isFinite(charge) ? charge : 0)
      : stationCharge(behavior, motion.clock),
    0,
    1,
  )
  const turn = spin !== undefined
    ? (Number.isFinite(spin) ? spin : 0)
    : motion.clock * 90
  const lean = clamp(Number.isFinite(tilt) ? tilt : 18, -90, 90)
  const bands = Math.round(clamp(Number.isFinite(courses) ? courses : 9, 3, 21))
  const seats = Math.round(clamp(Number.isFinite(perCourse) ? perCourse : 12, 4, 28))
  const coverage = clamp(Number.isFinite(plating) ? plating : 1, 0, 1)
  const ribCount = Math.round(clamp(Number.isFinite(ribs) ? ribs : 12, 0, 24))
  const span = clamp(Number.isFinite(dishSpan) ? dishSpan : 26, 8, 48)
  const ports = Math.round(clamp(Number.isFinite(emitters) ? emitters : 8, 0, 16))
  const bearing = Number.isFinite(rupture) ? rupture : 24
  const grain = Math.round(Number.isFinite(seed) ? seed : 5)
  const sunBearing = Number.isFinite(sun) ? sun : 38

  const frame = bodyFrame({ tilt: lean, precession: 14, spin: turn })
  const camera = robotCamera(view)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const live = robotSurface("accent", variant, palette)
  const signalColor =
    signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

  /* ---- body frame to the screen ----------------------------------------- */

  const toWorld = (v: Vec3): Vec3 => ({
    x: frame.right.x * v.x + frame.up.x * v.y + frame.forward.x * v.z,
    y: frame.right.y * v.x + frame.up.y * v.y + frame.forward.y * v.z,
    z: frame.right.z * v.x + frame.up.z * v.y + frame.forward.z * v.z,
  })
  const at = (local: Vec3): Vec2 => {
    const world = toWorld(local)
    const screen = camera.project(world.x, world.y, world.z)
    return { x: ORIGIN.x + screen.x, y: ORIGIN.y + screen.y }
  }
  const depthOf = (local: Vec3) => {
    const world = toWorld(local)
    return camera.depth(world.x, world.y, world.z)
  }
  const eye = unit({
    x: camera.depth(1, 0, 0),
    y: camera.depth(0, 1, 0),
    z: camera.depth(0, 0, 1),
  })
  /**
   * Whether a point on the body is on the camera's side of it. The geometry is
   * written in the body's own frame and the camera is not, so this has to turn
   * the point into the world before it asks — the bug it replaces culled the
   * wrong half of the hull from every view but the one the body was level in.
   */
  const facesCamera = (local: Vec3) => dot3(unit(toWorld(local)), eye) > 0
  // The light, in the body's own frame, so illumination and the plating agree.
  const light = (() => {
    const world = bearingDirection(sunBearing)
    return {
      x: dot3(world, frame.right),
      y: dot3(world, frame.up),
      z: dot3(world, frame.forward),
    }
  })()

  /* ---- the hull --------------------------------------------------------- */

  const ruptureDirection = direction(12, bearing)
  const burstOptions: BurstOptions = {
    origin: ruptureDirection,
    spread: clamp(Number.isFinite(spread) ? spread : 0.75, 0, 6),
    focus: 0.45,
    tumble: 300,
    front: 0.62,
    seed: grain,
  }

  const plates = hullPlates(bands, { perCourse: seats })
  const trenchCourse = trench ? Math.floor(bands / 2) : -1
  // Plating comes off pole-first, so the courses that survive are the ones
  // nearest the equator — which is how a shell of this kind is closed up.
  const platedCourses = Math.round(coverage * bands)
  const middle = (bands - 1) / 2
  const keepsPlate = (plate: HullPlate) =>
    plate.course !== trenchCourse &&
    Math.abs(plate.course - middle) <= (platedCourses - 1) / 2 + 1e-9

  const dishAxis = direction(
    clamp(Number.isFinite(dishLatitude) ? dishLatitude : 34, -90, 90),
    Number.isFinite(dishLongitude) ? dishLongitude : 72,
  )
  const dishBore = Math.cos(span * DEG)

  const drawn = plates
    .filter(keepsPlate)
    // The dish is a hole in the plating, not a decal over it.
    .filter((plate) => dot3(plateNormal(plate), dishAxis) < dishBore)
    .map((plate) => {
      const rest = plateNormal(plate)
      const state = burst(plate, progress, burstOptions)
      const points = plateOutline(plate, PLATE_STEPS).map((corner) =>
        move(direction(corner.latitude, corner.longitude), rest, state, RADIUS),
      )
      const centre = move(rest, rest, state, RADIUS)
      return {
        plate,
        state,
        centre,
        facing: facesCamera(centre),
        lit: illumination(state.release > 0 ? unit(centre) : rest, light) > -0.05,
        depth: depthOf(centre),
        d: polygonPath(points.map(at)),
      }
    })
    // A seated plate on the far side is behind the hull and never seen; one
    // that has let go is its own body and can come round in front of anything.
    .filter((piece) => piece.facing || piece.state.release > 0)
    .sort((a, b) => a.depth - b.depth)

  /* ---- the frame under it ----------------------------------------------- */

  const ribPaths = Array.from({ length: ribCount }, (_, index) => {
    const longitude = (index / Math.max(1, ribCount)) * 360
    const points = Array.from({ length: 25 }, (_, step) => {
      const latitude = -90 + (180 * step) / 24
      return direction(latitude, longitude)
    })
    return {
      index,
      d: arcPath(points, FRAME_RADIUS, at, facesCamera),
    }
  }).filter((rib) => rib.d)

  const girdles = ([-1, 1] as const).map((side) => ({
    side: side < 0 ? ("south" as const) : ("north" as const),
    d: arcPath(
      Array.from({ length: 65 }, (_, step) => direction(side * 15, (step / 64) * 360)),
      FRAME_RADIUS,
      at,
      facesCamera,
    ),
  }))

  const equator = arcPath(
    Array.from({ length: 97 }, (_, step) => direction(0, (step / 96) * 360)),
    FRAME_RADIUS,
    at,
    facesCamera,
  )

  /* ---- the day-night line ----------------------------------------------- */

  // The great circle where the light grazes the hull, drawn only where it faces
  // the camera. It is not a shape anybody draws: it is a circle, projected.
  const terminatorPath = (() => {
    const reference: Vec3 = Math.abs(light.y) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }
    const a = unit(cross3(reference, light))
    const b = cross3(light, a)
    return arcPath(
      Array.from({ length: 97 }, (_, step) => {
        const angle = (step / 96) * TAU
        return {
          x: a.x * Math.cos(angle) + b.x * Math.sin(angle),
          y: a.y * Math.cos(angle) + b.y * Math.sin(angle),
          z: a.z * Math.cos(angle) + b.z * Math.sin(angle),
        }
      }),
      RADIUS * 1.004,
      at,
      facesCamera,
    )
  })()

  /* ---- the dish --------------------------------------------------------- */

  const bowl = (() => {
    const rim = RADIUS * Math.sin(span * DEG)
    // Deeper than the spherical cap it replaces, so it reads as a recess — and
    // deep enough that the focus stands just clear of the hull.
    const depth = RADIUS * (1 - Math.cos(span * DEG)) * 1.5
    return { surface: dish(rim, depth), rim, depth, base: RADIUS * Math.cos(span * DEG) - depth }
  })()
  // The whole dish assembly is one section of hull: it lets go as a piece.
  const dishSection = sectionState(dishAxis, progress, burstOptions)
  // Once the section has let go it is turning, so what decides whether the bowl
  // is pointed at you is its *current* axis, not the one it was bolted on at.
  const dishFace =
    dishSection.release > 0
      ? rotateAbout(dishAxis, dishSection.axis, dishSection.spin * DEG)
      : dishAxis
  const showDish = dot3(toWorld(dishFace), eye) > 0.16

  /** A point in the bowl's own axial frame, lifted into the body frame. */
  const bowlPoint = (radial: number, along: number, azimuth: number): Vec3 => {
    const axes = perpendicularAxes(dishAxis)
    const ca = Math.cos(azimuth * DEG) * radial
    const sa = Math.sin(azimuth * DEG) * radial
    const height = bowl.base + along
    const raw: Vec3 = {
      x: axes.a.x * ca + axes.b.x * sa + dishAxis.x * height,
      y: axes.a.y * ca + axes.b.y * sa + dishAxis.y * height,
      z: axes.a.z * ca + axes.b.z * sa + dishAxis.z * height,
    }
    return move(raw, dishAxis, dishSection, RADIUS, true)
  }

  // Outermost first: a bowl is seen into, so the rim cannot be painted last.
  const bowlRings = [1, 0.86, 0.62, 0.34].map((u, index) => {
    const profile = dishProfile(bowl.surface, u)
    return {
      index,
      u,
      d: polygonPath(
        Array.from({ length: 33 }, (_, step) =>
          at(bowlPoint(profile.x, profile.y, (step / 32) * 360)),
        ),
      ),
    }
  })

  const focusAlong = bowl.surface.focus
  const focusPoint = bowlPoint(0, focusAlong, 0)

  const rays = Array.from({ length: ports }, (_, index) => {
    const u = 0.86
    const azimuth = (index / Math.max(1, ports)) * 360 + 11
    const profile = dishProfile(bowl.surface, u)
    const normal = dishNormal(bowl.surface, u)
    // An axial ray reflected about the bowl's own normal. It lands on the focus
    // because the surface is a paraboloid — nothing here aims it there.
    const incoming = { x: 0, y: -1 }
    const projection = incoming.x * normal.x + incoming.y * normal.y
    const out = {
      x: incoming.x - 2 * projection * normal.x,
      y: incoming.y - 2 * projection * normal.y,
    }
    const travel = Math.abs(out.x) > 1e-9 ? -profile.x / out.x : 0
    const from = bowlPoint(profile.x, profile.y, azimuth)
    const to = bowlPoint(profile.x + out.x * travel, profile.y + out.y * travel, azimuth)
    return { index, azimuth, from: at(from), to: at(to) }
  })

  // The beam leaves the focus along the axis. Illustrated: what a focusing
  // array does after the focus is not geometry this file knows.
  const beam = (() => {
    if (power < 0.55 || !showDish) return null
    const reach = 34 + 48 * (power - 0.55) / 0.45
    const tip = bowlPoint(0, focusAlong + reach, 0)
    const flank = (side: number) =>
      at(bowlPoint(3.2 * side, focusAlong + 3, 0))
    return {
      d: polygonPath([
        flank(-1),
        at(bowlPoint(-4.4, focusAlong + reach, 0)),
        at(tip),
        at(bowlPoint(4.4, focusAlong + reach, 0)),
        flank(1),
      ]),
      core: linePath([at(bowlPoint(0, focusAlong, 0)), at(tip)]),
    }
  })()

  /* ---- the shock -------------------------------------------------------- */

  const shock = (() => {
    if (progress <= 0.02) return null
    const radius = RADIUS * (0.16 + progress * 1.7)
    const points = shockRing(
      { x: ruptureDirection.x * RADIUS, y: ruptureDirection.y * RADIUS, z: ruptureDirection.z * RADIUS },
      ruptureDirection,
      radius,
      48,
    )
    return { d: polygonPath(points.map(at)), fade: Math.max(0, 0.6 - progress * 0.58) }
  })()

  const rupturePoint = at({
    x: ruptureDirection.x * RADIUS,
    y: ruptureDirection.y * RADIUS,
    z: ruptureDirection.z * RADIUS,
  })
  const ruptureFacing = dot3(toWorld(ruptureDirection), eye) > 0

  const readout = Math.round(progress * 100)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Battle station, hull ${readout} percent broken up, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout} percent broken up` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.15 : 0.05, 0.25)
        if (delta !== 0) apply(progress + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
      width={width}
      height={width}
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
          <path d="M 8 100 H 192 M 100 8 V 192" strokeDasharray="2 3" />
          <circle cx={100} cy={100} r={px(RADIUS)} strokeDasharray="3 3" />
          <path
            data-axis
            d={linePath([
              at({ x: dishAxis.x * RADIUS * 1.5, y: dishAxis.y * RADIUS * 1.5, z: dishAxis.z * RADIUS * 1.5 }),
              at({ x: 0, y: 0, z: 0 }),
            ])}
            strokeDasharray="3 2"
          />
        </g>
      )}

      <g data-frame data-view={view}>
        {shock && (
          <path data-shock d={shock.d} fill="none" stroke={palette.glow} strokeWidth={1.4} opacity={shock.fade} />
        )}

        {/* The structure the plating is bolted to: seen through every gap. */}
        <g data-structure fill="none" stroke={palette.dark} strokeWidth={1.1} opacity={px(0.85 * (1 - progress * 0.7))}>
          {ribPaths.map((rib) => (
            <path key={rib.index} data-rib={rib.index} d={rib.d} />
          ))}
          {girdles.map((girdle) =>
            girdle.d ? <path key={girdle.side} data-girdle={girdle.side} d={girdle.d} /> : null,
          )}
        </g>

        <g data-hull>
          {drawn.map((piece) => (
            <path
              key={piece.plate.index}
              data-plate={piece.plate.index}
              data-course={piece.plate.course}
              d={piece.d}
              {...((piece.plate.seat + piece.plate.course * 2) % 3 === 0 ? machined : shell)}
              fillOpacity={
                variant === "solid" || variant === "blueprint"
                  ? (piece.lit ? 1 : 0.45) * (variant === "blueprint" ? 0.16 : 1)
                  : undefined
              }
            />
          ))}
        </g>

        {trench && equator && (
          <path data-trench d={equator} fill="none" stroke={palette.dark} strokeWidth={3.4} opacity={px(0.9 * (1 - progress))} />
        )}

        {terminatorPath && (
          <path
            data-terminator
            d={terminatorPath}
            fill="none"
            stroke={palette.dark}
            strokeWidth={0.8}
            opacity={px(0.5 * (1 - progress))}
          />
        )}

        {showDish && (
          <g data-dish>
            {bowlRings.map((ring) => (
              <path
                key={ring.index}
                data-bowl={ring.index}
                d={ring.d}
                {...(ring.u === 1 ? machined : cast)}
                fillOpacity={variant === "solid" ? (ring.u === 1 ? 1 : 0.55) : undefined}
              />
            ))}
            {rays.map((ray) => (
              <g key={ray.index}>
                <path
                  data-emitter={ray.index}
                  d={linePath([ray.from, ray.to])}
                  fill="none"
                  stroke={palette.glow}
                  strokeWidth={0.9}
                  opacity={0.25 + power * 0.7}
                />
                <circle cx={px(ray.from.x)} cy={px(ray.from.y)} r={1.5} {...live} />
              </g>
            ))}
            <circle
              data-focus
              cx={px(at(focusPoint).x)}
              cy={px(at(focusPoint).y)}
              r={px(1.8 + power * 2.6)}
              fill={palette.glow}
              opacity={0.35 + power * 0.65}
            />
          </g>
        )}

        {beam && (
          <g data-beam>
            <path d={beam.d} fill={palette.glow} opacity={0.18 + power * 0.26} stroke="none" />
            <path d={beam.core} fill="none" stroke={palette.glow} strokeWidth={1.6} opacity={0.5 + power * 0.5} />
          </g>
        )}

        {ruptureFacing && progress > 0 && progress < 0.5 && (
          <circle
            data-rupture
            cx={px(rupturePoint.x)}
            cy={px(rupturePoint.y)}
            r={px(2 + progress * 5)}
            fill={palette.glow}
            opacity={0.8 - progress}
          />
        )}

        <circle
          data-lamp
          cx={ORIGIN.x}
          cy={px(ORIGIN.y + RADIUS + 26)}
          r={2.2}
          fill={signalColor}
          className={signal === "ready" ? "robocn-pulse" : undefined}
        />
      </g>

      {label && (
        <text
          x={100}
          y={194}
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
/* behaviour                                                                   */
/* -------------------------------------------------------------------------- */

/** How far through the breakup the station is at `clock`, 0 to 1. */
export function stationGoal(behavior: StationBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  switch (behavior) {
    // Out and back, symmetrically: the tiling comes apart and reassembles,
    // which is exactly what `burst` run backwards is.
    case "detonate":
      return 0.5 - 0.5 * Math.cos(TAU * clock)
    default:
      return 0
  }
}

/** How charged the dish is at `clock`, 0 to 1. */
export function stationCharge(behavior: StationBehavior, clock: number): number {
  if (!Number.isFinite(clock)) return 0
  const t = ((clock % 1) + 1) % 1
  switch (behavior) {
    case "charge":
      // Winds up over most of the cycle, then fires and drops.
      return t < 0.8 ? t / 0.8 : 1 - (t - 0.8) / 0.2
    // Fires first, and is gone by the time the hull lets go.
    case "detonate":
      return clamp(1 - 4 * Math.abs(t - 0.22), 0, 1)
    case "patrol":
      return 0.15
    default:
      return 0.35
  }
}

/* -------------------------------------------------------------------------- */
/* geometry helpers                                                            */
/* -------------------------------------------------------------------------- */

const dot3 = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z

const cross3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

function unit(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z)
  return length > 1e-9 ? { x: v.x / length, y: v.y / length, z: v.z / length } : { x: 0, y: 0, z: 1 }
}

/** Two unit axes square to `axis` and to each other: the dish's own plane. */
function perpendicularAxes(axis: Vec3) {
  const reference: Vec3 = Math.abs(axis.y) > 0.95 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }
  const a = unit(cross3(reference, axis))
  return { a, b: cross3(axis, a) }
}

/** A horizontal direction from a bearing: 0 is behind the viewer. */
function bearingDirection(bearing: number): Vec3 {
  const a = ((Number.isFinite(bearing) ? bearing : 0) * Math.PI) / 180
  return { x: Math.sin(a), y: 0.2, z: -Math.cos(a) }
}

/** Rodrigues: turn `v` about the unit `axis` by `angle` radians. */
function rotateAbout(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const k = dot3(axis, v) * (1 - c)
  const cr = cross3(axis, v)
  return {
    x: v.x * c + cr.x * s + axis.x * k,
    y: v.y * c + cr.y * s + axis.y * k,
    z: v.z * c + cr.z * s + axis.z * k,
  }
}

/**
 * One point of a piece of hull, carried by that piece's own burst.
 *
 * The pivot is where the piece sat, so at `release === 0` the transform is the
 * identity and the intact body is the tiling untouched — which is the whole
 * reason the station does not need a second drawing of itself.
 */
function move(
  point: Vec3,
  rest: Vec3,
  state: PlateBurst,
  radius: number,
  /** The point is already in world units rather than on the unit sphere. */
  absolute = false,
): Vec3 {
  const scaled = absolute ? point : { x: point.x * radius, y: point.y * radius, z: point.z * radius }
  if (state.release <= 0) return scaled
  const pivot = { x: rest.x * radius, y: rest.y * radius, z: rest.z * radius }
  const local = { x: scaled.x - pivot.x, y: scaled.y - pivot.y, z: scaled.z - pivot.z }
  const turned = rotateAbout(local, state.axis, state.spin * DEG)
  return {
    x: state.offset.x * radius + turned.x,
    y: state.offset.y * radius + turned.y,
    z: state.offset.z * radius + turned.z,
  }
}

/** The burst of a hull section that is not a plate — the dish assembly. */
function sectionState(axis: Vec3, progress: number, options: BurstOptions): PlateBurst {
  const latitude = (Math.asin(clamp(axis.y, -1, 1)) * 180) / Math.PI
  const longitude = (Math.atan2(axis.z, axis.x) * 180) / Math.PI
  return burst(
    {
      index: 907,
      course: 0,
      seat: 0,
      south: latitude,
      north: latitude,
      west: longitude,
      east: longitude,
      latitude,
      longitude,
      area: 0,
    },
    progress,
    options,
  )
}

/**
 * A curve on the body, drawn only where it faces the camera. Split into runs so
 * a line that goes round the back comes out as two arcs rather than one chord
 * cutting across the middle.
 */
function arcPath(
  points: readonly Vec3[],
  radius: number,
  at: (v: Vec3) => Vec2,
  faces: (v: Vec3) => boolean,
): string {
  const runs: Vec2[][] = []
  let run: Vec2[] = []
  for (const point of points) {
    if (faces(point)) {
      run.push(at({ x: point.x * radius, y: point.y * radius, z: point.z * radius }))
    } else if (run.length) {
      runs.push(run)
      run = []
    }
  }
  if (run.length) runs.push(run)
  return runs
    .filter((segment) => segment.length > 1)
    .map((segment) => linePath(segment))
    .join(" ")
}

function polygonPath(points: readonly Vec2[]): string {
  if (points.length < 3) return ""
  return `${points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
}

function linePath(points: readonly Vec2[]): string {
  if (points.length < 2) return ""
  return points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")
}

export { BattleStation }
