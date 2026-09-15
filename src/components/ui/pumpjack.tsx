"use client"

/**
 * pumpjack — the beam pump, solved as the four-bar it is.
 *
 * The crank does not choose where the beam goes. `solveFourBar` closes the
 * loop — crank, pitman, walking beam — so the beam's swing, and therefore the
 * polished-rod stroke, is a *consequence* of the four link lengths rather than
 * a number anybody typed.
 *
 * The horsehead is why the rod stays vertical: its face is an arc centred on
 * the saddle bearing, so the wireline leaves it at a point fixed in space and
 * the carrier bar moves by exactly radius × beam angle. That is the stroke,
 * and it is computed, not tweened.
 *
 * `explode` takes it apart in the reverse of the order it was built, through
 * the shared `assembly-geometry` schedule. It parks the linkage first — an
 * exploded view of a *moving* four-bar is nonsense, since every part would be
 * floating off a seat that is itself swinging — and the angle it parks at is
 * scanned out of the loop rather than typed, because "beam level" is an
 * inverse four-bar problem. The handed pairs come off sideways, which reads in
 * `iso` and `front` and is foreshortened to almost nothing in `profile`, the
 * way a real side elevation cannot show a lateral move either.
 *
 * Nothing here is dynamics: no fluid, no rod load, no torque, no counterbalance
 * calculation. `balance` changes where the mass is drawn, not what the linkage
 * does.
 *
 * Design note: docs/pumpjack-teardown.md.
 */

import * as React from "react"

import { arrowStep, useRobotClock, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import {
  assemblyEnvelope,
  explodeAssembly,
  type AssemblyPart,
} from "@/lib/robocn/assembly"
import { clamp, toRadians, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  rigidPoint,
  solveFourBar,
  type FourBarGeometry,
} from "@/lib/robocn/linkage"
import {
  boxCorners,
  elevationDraft,
  fitFrame,
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

export type PumpjackBehavior = "pump" | "slow" | "service" | "static"
/** Where the counterbalance mass sits — the three arrangements that exist. */
export type PumpjackBalance = "crank" | "beam" | "air"
/** Which axis a person grabs when the machine is interactive. */
export type PumpjackControl = "crank" | "explode"

const VIEW_WIDTH = 270
const VIEW_HEIGHT = 220
const NATIVE_VIEW: RobotView = "profile"

/** Saddle bearing: the walking beam's pivot, on top of the samson post. */
const SADDLE: Vec2 = { x: 106, y: 124 }
/** Gearbox output, which the crank turns about. */
const CRANK_PIVOT: Vec2 = { x: 162, y: 48 }

const GEOMETRY: FourBarGeometry = {
  ground: SADDLE.x - CRANK_PIVOT.x,
  rise: SADDLE.y - CRANK_PIVOT.y,
  crank: 14,
  coupler: 78,
  rocker: 56,
}

/** Radius of the horsehead's face, and therefore how far out the well stands. */
const HEAD_RADIUS = 82
/** The beam proper: saddle bearing to the horsehead's mounting flange. */
const BEAM_ARM = 70
const WELL_X = SADDLE.x - HEAD_RADIUS
/** Carrier-bar height with the beam level. */
const CARRIER_REST = 88
/** How far off centre the crank, its pitmans and its weights run. */
const CRANK_LATERAL = 26

const SEATED = { min: { x: -30, y: 0, z: -236 }, max: { x: 30, y: 176, z: 4 } }
const ENVELOPE = boxCorners(SEATED.min, SEATED.max)

/* -------------------------------------------------------------------------- */
/* the teardown                                                                */
/* -------------------------------------------------------------------------- */

/**
 * World axes, so the fit axes read the way `assembly-geometry` means them: `x`
 * starboard, `y` up, `z` aft. The drawing runs along `-z`, so the horsehead —
 * fitted onto the nose of the beam — comes off along `+z`.
 */
const UP: Vec3 = { x: 0, y: 1, z: 0 }
const DOWN: Vec3 = { x: 0, y: -1, z: 0 }
const FORE: Vec3 = { x: 0, y: 0, z: 1 }
const AFT: Vec3 = { x: 0, y: 0, z: -1 }
const PORT: Vec3 = { x: -1, y: 0, z: 0 }
const STARBOARD: Vec3 = { x: 1, y: 0, z: 0 }

/**
 * The machine as it was put together, so it can be taken apart backwards. Order
 * 0 is the bench and comes off last; the rod is the highest order and comes off
 * first, which is the order a crew actually works in.
 *
 * The wellhead is absent on purpose: it is the well, not the pump. Nobody takes
 * the well apart to service the machine standing over it, so it stays put and
 * gives the drawing a fixed reference.
 */
export function pumpjackParts(): AssemblyPart[] {
  return [
    { id: "skid", axis: UP, travel: 0, order: 0 },
    // Up the stack, each stage clears the one under it, so the travels have to
    // grow with height or the parts land on top of each other at full spread.
    { id: "post", axis: UP, travel: 20, order: 1 },
    { id: "gearbox", axis: UP, travel: 30, order: 1 },
    { id: "mover", axis: UP, travel: 52, order: 1 },
    { id: "saddle", axis: UP, travel: 44, order: 2 },
    { id: "beam", axis: UP, travel: 72, order: 3 },
    { id: "horsehead", axis: FORE, travel: 56, order: 4 },
    { id: "equalizer", axis: AFT, travel: 42, order: 4 },
    // Outward in the order they come off, so the pitman clears the crank pin it
    // was on and the weight clears the arm it was bolted to.
    { id: "crank-port", axis: PORT, travel: 44, order: 5 },
    { id: "crank-starboard", axis: STARBOARD, travel: 44, order: 5 },
    { id: "weight-port", axis: PORT, travel: 62, order: 6 },
    { id: "weight-starboard", axis: STARBOARD, travel: 62, order: 6 },
    { id: "pitman-port", axis: PORT, travel: 80, order: 7 },
    { id: "pitman-starboard", axis: STARBOARD, travel: 80, order: 7 },
    { id: "rod", axis: DOWN, travel: 34, order: 8 },
  ]
}

/**
 * The crank angle that stands the walking beam level, and the beam angle it
 * actually achieves. Scanned rather than typed: the loop is easy to solve
 * forwards and awkward backwards, and a quarter-degree sweep costs nothing once
 * at module scope. Exported so a test can hold the claim.
 */
export function pumpjackService(): { crankAngle: number; beamAngle: number } {
  let crankAngle = 0
  let beamAngle = Infinity
  for (let angle = 0; angle < 360; angle += 0.25) {
    const rocker = solveFourBar(angle, GEOMETRY, { branch: "down" }).rockerAngle
    const beam = rocker > 180 ? rocker - 360 : rocker
    if (Math.abs(beam) < Math.abs(beamAngle)) {
      beamAngle = beam
      crankAngle = angle
    }
  }
  return { crankAngle, beamAngle }
}

/** Where the machine parks to be worked on. */
export const PUMPJACK_SERVICE_ANGLE = pumpjackService().crankAngle

const midpoint = (a: Vec2, b: Vec2): Vec2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/** Shortest way round from one angle to another, in degrees. */
const shortestArc = (from: number, to: number) => {
  const delta = ((to - from) % 360 + 540) % 360 - 180
  return delta
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface PumpjackProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled crank angle in degrees. Supplying it stops the loop. */
  crankAngle?: number
  onCrankAngleChange?: (angle: number) => void
  behavior?: PumpjackBehavior
  /**
   * How far apart the machine is, 0 assembled to 1 fully exploded. Anything
   * above 0 parks the linkage at the service angle and stops the loop.
   */
  explode?: number
  onExplodeChange?: (explode: number) => void
  /**
   * How much the parts' travel windows overlap, 0 strictly one stage at a time
   * to 1 everything at once.
   */
  explodeOverlap?: number
  /** Dashed leaders from each displaced part back to its seat. */
  showLeaders?: boolean
  /** Which axis dragging and the arrow keys drive. */
  control?: PumpjackControl
  /** Where the counterbalance mass is carried. */
  balance?: PumpjackBalance
  /** Draw the wellhead, stuffing box and flow line under the polished rod. */
  showWell?: boolean
  showGround?: boolean
  view?: RobotView
  speed?: number
  phase?: number
  paused?: boolean
  animate?: boolean
  interactive?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

const wrap360 = (value: number) =>
  Number.isFinite(value) ? ((value % 360) + 360) % 360 : 0

const signed = (degrees: number) => (degrees > 180 ? degrees - 360 : degrees)

/** The crank centre in viewBox units, for one camera. */
function crankHub(view: RobotView): Vec2 {
  const camera = robotCamera(view)
  const frame = fitFrame(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  return frame.toViewBox(camera.project(0, CRANK_PIVOT.y, -CRANK_PIVOT.x))
}

function Pumpjack({
  crankAngle,
  onCrankAngleChange,
  behavior = "pump",
  explode,
  onExplodeChange,
  explodeOverlap = 0.45,
  showLeaders = true,
  control = "crank",
  balance = "crank",
  showWell = true,
  showGround = true,
  view = NATIVE_VIEW,
  speed = 0.35,
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
}: PumpjackProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const [tornDown, setTornDown] = React.useState<number | null>(null)
  const controlled = crankAngle !== undefined
  const grabsExplode = control === "explode"

  const controlledExplode = explode !== undefined

  const camera = robotCamera(view)

  // The teardown runs on its own clock: `service` parks the crank, so there is
  // no revolution for it to ride on.
  const teardownClock = useRobotClock({
    speed,
    phase,
    paused,
    animate: animate && !controlledExplode && behavior === "service",
  })
  const apart = clamp(
    controlledExplode
      ? Number.isFinite(explode) ? (explode as number) : 0
      : (tornDown ?? pumpjackTeardown(behavior, teardownClock)),
    0,
    1,
  )

  const parts = pumpjackParts()
  // The frame grows with the teardown and with nothing else: it zooms out when
  // the machine comes apart, never as the machine works.
  const room = assemblyEnvelope(parts, apart, SEATED)
  const frame = fitFrame(
    apart > 0 ? boxCorners(room.min, room.max) : ENVELOPE,
    camera,
    VIEW_WIDTH,
    VIEW_HEIGHT,
  )
  const { point: to, path: line, solid, box, bar, disc } = elevationDraft(camera, "profile")

  const hold = controlled ? (Number.isFinite(crankAngle) ? (crankAngle as number) : 0) : held
  const goal = React.useCallback(
    (clock: number) => pumpjackCrank(behavior, clock),
    [behavior],
  )
  const motion = useRobotScalar(goal, {
    // The crank has to keep up with its own goal, or it lags a revolution
    // behind and the beam stops matching the pitman.
    rate: Math.max(240, Math.abs(speed) * 900),
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static" && apart === 0,
  })
  // An exploded view of a *moving* four-bar is nonsense — every part would be
  // floating off a seat that is itself swinging — so the crank eases onto the
  // service angle over the first sixth of the teardown, on the shortest arc, and
  // is fully parked before anything has travelled far.
  const running = wrap360(motion.value)
  const parked = clamp(apart * 6, 0, 1)
  const turn = parked === 0
    ? running
    : wrap360(running + shortestArc(running, PUMPJACK_SERVICE_ANGLE) * parked)

  const apply = React.useCallback(
    (next: number) => {
      setHeld(next)
      onCrankAngleChange?.(wrap360(next))
    },
    [onCrankAngleChange],
  )
  const applyExplode = React.useCallback(
    (next: number) => {
      setTornDown(clamp(next, 0, 1))
      onExplodeChange?.(clamp(next, 0, 1))
    },
    [onExplodeChange],
  )

  // The pointer's bearing about the crank centre is the crank angle: grabbing
  // it turns the gearbox by hand. The hub is recomputed from the camera inside
  // the handler, so the only thing it closes over is the view.
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => {
        // Taking it apart is a straight pull across the frame; turning the
        // gearbox is the pointer's bearing about the crank centre.
        if (grabsExplode) {
          applyExplode(unit.x)
          return
        }
        const hub = crankHub(view)
        const dx = unit.x * VIEW_WIDTH - hub.x
        const dy = unit.y * VIEW_HEIGHT - hub.y
        if (Math.hypot(dx, dy) < 4) return
        apply((Math.atan2(-dy, dx) * 180) / Math.PI)
      },
      [apply, applyExplode, grabsExplode, view],
    ),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const pose = solveFourBar(turn, GEOMETRY, { branch: "down" })
  const local = (point: Vec2): Vec2 => ({
    x: CRANK_PIVOT.x + point.x,
    y: CRANK_PIVOT.y + point.y,
  })
  const crankPin = local(pose.crankPin)
  const tailBearing = local(pose.couplerPin)
  const beamAngle = signed(pose.rockerAngle)
  const headAngle = beamAngle + 180
  const beamHead = rigidPoint(SADDLE, headAngle, BEAM_ARM)
  // The wireline leaves the face at a point fixed in space, so the rod moves by
  // exactly the arc the face has rolled through: radius × beam angle.
  const carrierY = CARRIER_REST - HEAD_RADIUS * toRadians(beamAngle)

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  /** The horsehead face: an arc of the head radius, about the saddle bearing. */
  const headFace = Array.from({ length: 9 }, (_, index) =>
    rigidPoint(SADDLE, headAngle - 18 + (index / 8) * 36, HEAD_RADIUS),
  )
  const headBack = [
    rigidPoint(SADDLE, headAngle + 17, BEAM_ARM - 8),
    rigidPoint(SADDLE, headAngle - 17, BEAM_ARM - 8),
  ]
  const annotation = to(rigidPoint(CRANK_PIVOT, turn + 180, 48))
  const readout = px(turn)

  /* ---- the teardown ------------------------------------------------------ */

  // Projection is linear, so a world offset is a pure screen offset — and a
  // seated part emits no transform at all rather than an identity one.
  const displaced = new Map<string, { transform?: string; rank: number; screen: Vec2 }>()
  for (const part of explodeAssembly(parts, apart, { overlap: explodeOverlap })) {
    const screen = camera.project(part.offset.x, part.offset.y, part.offset.z)
    const still = px(screen.x) === 0 && px(screen.y) === 0
    displaced.set(part.id, {
      transform: still ? undefined : `translate(${px(screen.x)} ${px(screen.y)})`,
      rank: part.rank,
      screen,
    })
  }
  /** Props for a part group: its displacement, its rank, and a test hook. */
  const moved = (id: string) => {
    const state = displaced.get(id)
    return {
      "data-part": id,
      "data-rank": state?.rank ?? 0,
      transform: state?.transform,
    }
  }
  /**
   * The leader back to the seat: the displacement negated. Drawn from where the
   * part sits now, which is why it is inside the part's own transform.
   */
  const leader = (id: string, anchor: Vec2, depth = 0) => {
    const state = displaced.get(id)
    if (!showLeaders || !state || !state.transform) return null
    const seat = to(anchor, depth)
    return (
      <path
        data-leader={id}
        d={`M ${px(seat.x)} ${px(seat.y)} L ${px(seat.x - state.screen.x)} ${px(seat.y - state.screen.y)}`}
        fill="none"
        stroke={palette.grid}
        strokeWidth={0.6}
        strokeDasharray="3 3"
        opacity={0.75}
      />
    )
  }

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        (apart > 0
          ? `Beam pump, ${Math.round(apart * 100)} percent apart, parked at ${readout} degrees, ${viewNames[view] ?? viewNames.profile}`
          : `Beam pump, crank at ${readout} degrees, carrier bar at ${px(carrierY)} units, ${viewNames[view] ?? viewNames.profile}`)
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? (grabsExplode ? 100 : 360) : undefined}
      aria-valuenow={interactive ? (grabsExplode ? Math.round(apart * 100) : readout) : undefined}
      aria-valuetext={
        interactive
          ? grabsExplode
            ? `${Math.round(apart * 100)} percent apart`
            : `crank at ${readout} degrees`
          : undefined
      }
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        if (grabsExplode) {
          const step = arrowStep(event.key, event.shiftKey ? 0.1 : 0.04, 0.25)
          if (step !== 0) applyExplode(apart + step)
          else if (event.key === "Home") applyExplode(0)
          else if (event.key === "End") applyExplode(1)
          else return
          event.preventDefault()
          return
        }
        const delta = arrowStep(event.key, event.shiftKey ? 15 : 5, 45)
        if (delta !== 0) apply(turn + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(180)
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
        <path
          d={`M 10 ${VIEW_HEIGHT - 22} H ${VIEW_WIDTH - 10}`}
          fill="none"
          stroke={palette.grid}
          strokeWidth={0.5}
          strokeDasharray="3 4"
          opacity={0.4}
        />
      )}

      <g data-view={view} data-exploded={px(apart)} transform={frame.transform || undefined}>
        {showGround && (
          <>
            <path data-ground d={solid([{ x: -4, y: 0 }, { x: 236, y: 0 }], 30)} fill={palette.dark} opacity={0.12} />
            <path d={line([{ x: -4, y: 0 }, { x: 236, y: 0 }])} fill="none" stroke={palette.dark} strokeWidth={1} opacity={0.5} />
          </>
        )}

        {/* Skid: everything above the grade bolts to it. */}
        <g {...moved("skid")}>
          <path data-skid d={box(76, 0, 232, 11, 22)} {...cast} />
        </g>

        {/* Prime mover and belt guard, outboard of the gearbox. */}
        {leader("mover", { x: 213, y: 22 })}
        <g {...moved("mover")}>
          <path d={box(198, 11, 228, 34, 14)} {...machined} />
          <path d={disc({ x: 210, y: 23 }, 7, 3, 16)} {...cast} />
          <path d={box(176, 15, 200, 32, 4, 12)} {...cast} fillOpacity={0.4} />
        </g>

        {/* Gearbox. The crank runs on its output shaft, outboard again. */}
        {leader("gearbox", { x: 164, y: 30 })}
        <g {...moved("gearbox")}>
          <path data-gearbox d={box(140, 8, 188, 52, 18)} {...shell} />
          <path d={box(146, 52, 182, 58, 16)} {...machined} />
          <path d={line([{ x: 148, y: 18 }, { x: 180, y: 18 }])} fill="none" stroke={palette.dark} strokeWidth={1.4} />
          <path d={line([{ x: 148, y: 40 }, { x: 180, y: 40 }])} fill="none" stroke={palette.dark} strokeWidth={1.4} />
        </g>

        {/* Samson post: an A-frame with two braces, carrying the saddle bearing. */}
        {leader("post", { x: 106, y: 68 })}
        <g data-post {...moved("post")}>
          <path d={bar({ x: 86, y: 11 }, { x: SADDLE.x - 3, y: SADDLE.y - 4 }, 4, 16)} {...shell} />
          <path d={bar({ x: 126, y: 11 }, { x: SADDLE.x + 3, y: SADDLE.y - 4 }, 4, 16)} {...shell} />
          <path d={bar({ x: 92, y: 52 }, { x: 120, y: 52 }, 2.4, 14)} {...machined} />
          <path d={bar({ x: 96, y: 86 }, { x: 116, y: 86 }, 2.2, 14)} {...machined} />
        </g>

        {/* Walking beam, on the saddle bearing; the horsehead slides off its nose. */}
        {leader("beam", rigidPoint(SADDLE, beamAngle, 20))}
        <g data-beam data-angle={px(beamAngle)} {...moved("beam")}>
          <path d={bar(beamHead, tailBearing, 7, 9)} {...shell} />
          <path d={bar(rigidPoint(SADDLE, beamAngle, -24), rigidPoint(SADDLE, beamAngle, 36), 3, 10)} {...machined} />
          {balance === "beam" && (
            <path
              data-counterweight
              d={bar(rigidPoint(SADDLE, beamAngle, BEAM_ARM - 6), rigidPoint(SADDLE, beamAngle, BEAM_ARM + 14), 12, 11)}
              {...shell}
            />
          )}
        </g>
        {leader("horsehead", beamHead)}
        <g {...moved("horsehead")}>
          <path data-horsehead d={solid([...headFace, ...headBack], 9)} {...shell} />
          <path d={line(headFace, 9)} fill="none" stroke={palette.dark} strokeWidth={1.2} opacity={0.8} />
        </g>
        {leader("equalizer", tailBearing)}
        <g {...moved("equalizer")}>
          <path data-equalizer d={disc(tailBearing, 5, CRANK_LATERAL + 2)} {...cast} />
        </g>
        {leader("saddle", SADDLE)}
        <g {...moved("saddle")}>
          <path d={disc(SADDLE, 9, 12)} {...cast} />
          <path d={disc(SADDLE, 3.4, 13)} {...machined} />
        </g>

        {/* Bridle, carrier bar, polished rod. */}
        {leader("rod", { x: WELL_X, y: carrierY })}
        <g data-rod data-position={px(carrierY)} {...moved("rod")}>
          {[-5, 5].map((offset) => (
            <path
              key={offset}
              d={line([{ x: WELL_X, y: SADDLE.y }, { x: WELL_X, y: carrierY }], offset)}
              fill="none"
              stroke={palette.metal}
              strokeWidth={1.2}
            />
          ))}
          <path d={box(WELL_X - 9, carrierY - 3, WELL_X + 9, carrierY + 3, 7)} {...machined} />
          <path d={bar({ x: WELL_X, y: carrierY }, { x: WELL_X, y: 34 }, 2, 2)} {...machined} />
        </g>

        {showWell && (
          <g data-wellhead>
            <path d={box(WELL_X - 6, 22, WELL_X + 6, 34, 6)} {...machined} />
            <path d={box(WELL_X - 9, 8, WELL_X + 9, 22, 9)} {...shell} />
            <path d={box(WELL_X - 13, 0, WELL_X + 13, 8, 13)} {...cast} />
            <path
              data-flow
              d={line([{ x: WELL_X - 9, y: 15 }, { x: -2, y: 15 }])}
              fill="none"
              stroke={palette.accent}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <path d={disc({ x: WELL_X - 22, y: 15 }, 4.5, 5)} {...cast} />
          </g>
        )}

        {/* Crank, pitman and counterbalance: a handed pair either side of the
            gearbox, and the one place in the set where parts come off sideways.
            Port draws before starboard, which is the right order at every one of
            the four cameras — none of them has +x further away than -x. */}
        {([-CRANK_LATERAL, CRANK_LATERAL] as const).map((offset) => {
          const side = offset < 0 ? "port" : "starboard"
          return (
            <g key={offset} data-crank data-side={offset < 0 ? "left" : "right"}>
              {balance === "crank" && (
                <>
                  {leader(`weight-${side}`, rigidPoint(CRANK_PIVOT, turn + 180, 21), offset)}
                  <g {...moved(`weight-${side}`)}>
                    <path
                      data-counterweight
                      d={bar(rigidPoint(CRANK_PIVOT, turn + 180, 14), rigidPoint(CRANK_PIVOT, turn + 180, 28), 10, 6, offset)}
                      {...shell}
                    />
                  </g>
                </>
              )}
              {leader(`crank-${side}`, rigidPoint(CRANK_PIVOT, turn + 180, 30), offset)}
              <g {...moved(`crank-${side}`)}>
                <path d={bar(rigidPoint(CRANK_PIVOT, turn + 180, 30), crankPin, 5, 3, offset)} {...machined} />
                <path d={disc(crankPin, 3.4, 4, offset)} {...cast} />
              </g>
              {leader(`pitman-${side}`, midpoint(crankPin, tailBearing), offset)}
              <g {...moved(`pitman-${side}`)}>
                <path data-pitman d={bar(crankPin, tailBearing, 3.4, 3, offset)} {...machined} />
              </g>
            </g>
          )
        })}
        {/* The output shaft: the gearbox again, drawn after the cranks so it
            caps them. It carries the same displacement without repeating the id. */}
        <g transform={displaced.get("gearbox")?.transform}>
          <path d={disc(CRANK_PIVOT, 8, CRANK_LATERAL + 6)} {...cast} />
        </g>

        {balance === "air" && (
          <g data-counterweight transform={displaced.get("mover")?.transform}>
            <path d={box(178, 11, 198, 32, 8)} {...cast} />
            <path d={bar({ x: 188, y: 30 }, rigidPoint(SADDLE, beamAngle, 44), 4, 6)} {...machined} />
          </g>
        )}

        {variant === "blueprint" && (
          <>
            <g fill="none" stroke={palette.grid} strokeWidth={0.6} opacity={0.7}>
              <path d={`${line([CRANK_PIVOT, crankPin, tailBearing, SADDLE])} Z`} strokeDasharray="4 3" />
              <path d={line([SADDLE, beamHead])} strokeDasharray="4 3" />
              <path d={line([{ x: WELL_X, y: 40 }, { x: WELL_X, y: 118 }])} strokeDasharray="2 3" />
            </g>
            <text
              x={px(annotation.x)}
              y={px(annotation.y)}
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
              fontSize={6}
              fill={palette.foreground}
            >
              {px(pose.transmissionAngle)}°
            </text>
          </>
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

/**
 * Crank angle at `clock`, unwrapped so the easing never has to cross a seam.
 *
 * `pump` is one revolution a cycle. `slow` is what a pump-off controller does:
 * two revolutions, then a rest — a real duty cycle rather than the same motion
 * at a different rate.
 */
export function pumpjackCrank(behavior: PumpjackBehavior, clock: number) {
  // Parked for service: the crank holds while the machine comes apart.
  if (behavior === "service") return PUMPJACK_SERVICE_ANGLE
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  if (behavior === "slow") {
    const whole = Math.floor(clock)
    return whole * 720 + Math.min((clock - whole) / 0.6, 1) * 720
  }
  return clock * 360
}

/**
 * How far apart the machine is at `clock`. Only `service` takes it apart, and it
 * runs the teardown out and back over one cycle so the assembly is the resting
 * state at both ends rather than only at the start.
 */
export function pumpjackTeardown(behavior: PumpjackBehavior, clock: number) {
  if (behavior !== "service" || !Number.isFinite(clock)) return 0
  const cycle = ((clock % 1) + 1) % 1
  return 1 - Math.abs(2 * cycle - 1)
}

/** Carrier-bar height for a crank angle: the stroke, solved through the loop. */
export function pumpjackCarrier(crankAngle: number) {
  const pose = solveFourBar(crankAngle, GEOMETRY, { branch: "down" })
  return CARRIER_REST - HEAD_RADIUS * toRadians(signed(pose.rockerAngle))
}

export { Pumpjack }
