"use client"

/**
 * rod-pump — the downhole end of a beam-pumped well, in section, with the card
 * it is drawing beside it.
 *
 * `pumpjack` is the surface unit. This is what the rods are actually doing at
 * the bottom of the hole, and it is the first machine in the set whose whole
 * subject is a *cutaway*: casing, cement, tubing and working barrel are opaque
 * where the section plane cuts them and ghosted where they are round, so the
 * plunger, the two balls and the fluid inside can be read at all.
 *
 * **Solved**, in `src/lib/robocn/rodpump.ts` — pure, no React, tested on its
 * own: the plunger travel off a crank; the fluid load `Fo = 0.34·D²·G·L` and
 * the displacement `PD = 0.1166·D²·S·N`; the travel at which each ball lifts,
 * from an isothermal compression of the gas trapped below the plunger; the
 * liquid level in the barrel; and the dynamometer card, which is that load
 * plotted against that travel rather than six drawn shapes. The dot cannot
 * leave the card, because the card is the dot sampled over a cycle.
 *
 * **Illustrated:** the rock, its bedding, the cement sheath, the perforation
 * tunnels and the inflow streaks; the fluid as coloured regions; the gas
 * bubbles. Those are drawing, and nothing reads a rate off them.
 *
 * **Absent:** there is no wave equation. The surface card is not propagated
 * down the rod string — no stretch, damping, inertia, buoyancy, friction, or
 * slippage rate — so this is the *downhole* card, which is the one a pump
 * failure is read from anyway.
 *
 * Drawn once in the front elevation and pushed through `robotCamera`, so all
 * four views are the same geometry rather than four drawings that drift apart.
 * In plan the section plane is seen edge-on and the well reads as the
 * concentric tubulars it is.
 *
 * Design note: docs/rod-pump.md.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, lerp, type Vec2 } from "@/lib/robocn/kinematics"
import {
  cycleForTravel,
  defaultPumpGeometry,
  pumpCard,
  pumpPhase,
  solveRodPump,
  SEAL_BAND,
  type PumpCondition,
  type PumpGeometry,
  type PumpState,
} from "@/lib/robocn/rodpump"
import {
  boxCorners,
  circleFootprint,
  elevationDraft,
  extrudedPath,
  fitTransform,
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

/** What the pump does with nobody driving it. Always includes `static`. */
export type RodPumpBehavior = "pump" | "slow" | "static"

const VIEW_WIDTH = 220
const VIEW_HEIGHT = 320
const NATIVE_VIEW: RobotView = "front"

/**
 * World units: x across the section, y up the well, z out of the cut plane.
 * The radii are the real thing in proportion — 5½ in casing, 2⅜ in tubing, a
 * 1¾ in pump — opened out far enough that a ball off its seat reads at 150px.
 */
const TOP = 276
/** The rock is drawn wider than the frame, so the section bleeds off it. */
const ROCK = 130
const ROCK_DEPTH = 76
const PERF_REACH = 96
const CEMENT = 62
const CASING_OD = 54
const CASING_ID = 47
const TUBING_OD = 30
const TUBING_ID = 25
const BARREL_OD = 22
const BARREL_ID = 14
const PLUNGER_R = 13.4
const BORE_R = 5.5
const ROD_R = 4
const BALL_R = 6.4

/** The pump, bottom up. */
const HOLDDOWN_LOW = 46
const HOLDDOWN_HIGH = 74
const SEAT_LOW = 70
const SEAT_HIGH = 82
const CAGE_HIGH = 104
const BARREL_LOW = 88
const BARREL_HIGH = 248
/** The plunger assembly, measured from its own foot: seat, cage, then tube. */
const TV_SEAT = 5
const TV_CAGE = 28
const PLUNGER_ASSY = 76
/** The stroke the plunger works through, and where its foot sits on bottom. */
const PLUNGER_LOW = 108
const STROKE = 58
/** How far a ball lifts off its seat. */
const LIFT = 5.5
/**
 * The tubulars and the rock are drawn past the envelope at both ends, so the
 * section runs off the frame the way a section drawing does instead of showing
 * the rounded end of a cylinder.
 */
const BLEED = 72
/** The perforated interval, and the bedding the rock is drawn with. */
const PERFS = [20, 38, 56]
const BEDS = [12, 30, 48, 66, 94, 128, 166, 206, 248]

/** The card, in viewBox units: an instrument, so it never turns with the camera. */
const CARD = { x: 150, y: 42, w: 58, h: 44 }
/** Room the card needs: the well stands off centre to leave it clear rock. */
const CARD_SHIFT = -26

/**
 * The envelope is the *well*, not the rock — the rock is scenery and is meant
 * to run off the edges of the frame the way a section drawing does.
 */
const ENVELOPE = boxCorners(
  { x: -CEMENT, y: 0, z: -CEMENT },
  { x: CEMENT, y: TOP, z: CEMENT },
)

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const conditionNames: Record<PumpCondition, string> = {
  full: "full pump",
  gas: "gas interference",
  pound: "fluid pound",
  "tv-leak": "travelling valve leak",
  "sv-leak": "standing valve leak",
  tagging: "tagging bottom",
}

/**
 * The four sides of a card, named. `picking-up` and `releasing` are the
 * intervals where both balls are down and the plunger is only changing the
 * pressure in the barrel — instants in a pump that fills, long arcs in a gassy
 * one, and the whole of a fluid pound's downstroke.
 */
const stateLabels: Record<PumpState, string> = {
  "picking-up": "PICKING UP",
  filling: "FILLING",
  releasing: "RELEASING",
  discharging: "DISCHARGING",
}

const stateNames: Record<PumpState, string> = {
  "picking-up": "picking up, both valves shut",
  filling: "filling, standing valve open",
  releasing: "releasing, both valves shut",
  discharging: "discharging through the plunger",
}

/** The caption the card carries, short enough for the frame it sits in. */
const conditionLabels: Record<PumpCondition, string> = {
  full: "FULL PUMP",
  gas: "GAS INTERFERENCE",
  pound: "FLUID POUND",
  "tv-leak": "TV LEAK",
  "sv-leak": "SV LEAK",
  tagging: "TAGGING",
}

/**
 * Where in the pump cycle the machine should be at `clock`, unwrapped so the
 * easing never has to cross the seam at the bottom of the stroke.
 *
 * `pump` is one stroke a cycle. `slow` is what a pump-off controller does:
 * two strokes, then a rest — a duty cycle rather than the same motion slower.
 */
export function rodPumpCycle(behavior: RodPumpBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0.25
  if (behavior === "slow") {
    const whole = Math.floor(clock)
    return whole * 2 + Math.min((clock - whole) / 0.6, 1) * 2
  }
  return clock
}

export interface RodPumpProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /**
   * Controlled position in the pump cycle: 0 and 1 with the plunger on bottom,
   * 0.5 on top. Supplying it stops the loop.
   */
  cycle?: number
  onCycleChange?: (cycle: number) => void
  behavior?: RodPumpBehavior
  /** Which card the pump is drawing. `full` is the one the rest are read against. */
  condition?: PumpCondition
  /**
   * Pump dimensions and the well they work against. Merged over the defaults,
   * and every readout — fluid load, production, valve timing, the card itself —
   * comes out of it.
   */
  geometry?: Partial<PumpGeometry>
  /** Fluid standing in the casing annulus, 0 at the foot of the window to 1 at the top. */
  fluidLevel?: number
  /** The dynamometer card, drawn beside the well the way a controller shows it. */
  showCard?: boolean
  /** The rock, its bedding, the cement sheath and the perforations. */
  showFormation?: boolean
  /** Fluid in the annulus, the tubing and the barrel. */
  showFluid?: boolean
  /** Where the camera stands. Defaults to the view the machine was drawn in. */
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

function RodPump({
  cycle,
  onCycleChange,
  behavior = "pump",
  condition = "full",
  geometry: geometryOverride,
  fluidLevel = 0.45,
  showCard = true,
  showFormation = true,
  showFluid = true,
  view = NATIVE_VIEW,
  speed = 0.3,
  // Parked — `animate={false}`, or a reduced-motion preference — a pump should
  // still be doing something, so it rests part way up the stroke rather than on
  // bottom at the instant of reversal where both valves are shut.
  phase = 0.2,
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
}: RodPumpProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = cycle !== undefined
  const geometry: PumpGeometry = { ...defaultPumpGeometry, ...geometryOverride }
  const fault = conditionNames[condition] ? condition : "full"

  // Controlled wins and pins the value; the clock keeps running underneath, so
  // release reads as the rods picking the stroke back up rather than a jump.
  const hold = controlled ? (Number.isFinite(cycle) ? (cycle as number) : 0) : held
  const goal = React.useCallback((clock: number) => rodPumpCycle(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    // Cycles a second. The plunger has to keep up with its own goal or it lags
    // a whole stroke behind and the valves stop matching the travel.
    rate: Math.max(2, Math.abs(speed) * 6),
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const running = Number.isFinite(motion.value) ? motion.value : 0
  const pose = solveRodPump(running, fault, geometry)
  const card = pumpCard(fault, geometry, 160)
  const reference = pumpCard("full", geometry, 96)
  const level = clamp(Number.isFinite(fluidLevel) ? fluidLevel : 0.45, 0, 1)

  // The drag anchors on where the pump already is, so a pointer that carries
  // the plunger past the top of the stroke turns it over into the downstroke
  // instead of reversing it. Kept in a ref, or `onDrag` rebinds every render.
  const cycleRef = React.useRef(running)
  React.useEffect(() => {
    cycleRef.current = running
  }, [running])

  const apply = React.useCallback(
    (next: number) => {
      const value = Number.isFinite(next) ? next : 0
      cycleRef.current = value
      setHeld(value)
      onCycleChange?.(pumpPhase(value))
    },
    [onCycleChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => apply(cycleForTravel(1 - unit.y, cycleRef.current)),
      [apply],
    ),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const camera = robotCamera(view)
  const fitted = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  // The card is an instrument beside the well, not a part of it: when it is on,
  // the whole projection stands off centre so it has clear rock to sit on.
  const frame = showCard ? `translate(${CARD_SHIFT} 0) ${fitted}`.trim() : fitted
  const { point: to, path: line, box } = elevationDraft(camera, "front")

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const painted = variant === "solid" || variant === "blueprint"
  /**
   * How solid the round body of a tubular is drawn. Along the cut plane you are
   * looking *through* the pipe at what the section reveals, so it washes right
   * back; down the well there is no cut in view and a pipe is simply a pipe.
   * One number off the camera, rather than a second set of artwork per view.
   */
  const solidity = px(0.2 + 0.62 * Math.abs(camera.flatten))
  const behind = px(solidity * 0.55)

  /**
   * A tubular, as the cylinder it is: a cylinder's silhouette is the hull of
   * its two end circles, so this is exact from every camera and collapses to
   * the right ring in plan.
   */
  const tube = (radius: number, from: number, until: number) =>
    extrudedPath(
      circleFootprint(0, 0, Math.abs(radius), 18),
      camera,
      Math.max(from, until),
      Math.min(from, until),
    )

  /** A region of the cut face: a wall, a column of fluid, a perforation. */
  const region = (points: Vec2[]) => line(points, 0, true)

  /** The two faces the section plane leaves between two radii. */
  const walls = (inner: number, outer: number, from: number, until: number) =>
    until <= from
      ? ""
      : [-1, 1]
          .map((side) =>
            region([
              { x: side * inner, y: from },
              { x: side * outer, y: from },
              { x: side * outer, y: until },
              { x: side * inner, y: until },
            ]),
          )
          .join(" ")

  /** The bore behind a tubular: what the near half being gone lets you see. */
  const bore = (radius: number, from: number, until: number) =>
    region([
      { x: -radius, y: from },
      { x: radius, y: from },
      { x: radius, y: until },
      { x: -radius, y: until },
    ])

  /** A ball on or off its seat. Rotationally symmetric, so always a circle. */
  const ballAt = (y: number) => to({ x: 0, y }, 0)

  /**
   * A ball, and what a few million cycles have done to it. A seat face that is
   * no longer perfectly round is exactly why fluid starts slipping past, so the
   * wear is drawn on the ball itself: the contact band cuts in and the surface
   * pits, in proportion to the leak the condition is carrying.
   */
  const ball = (y: number, wear: number, which: string) => {
    const at = ballAt(y)
    return (
      <g data-ball={which} data-wear={px(wear)}>
        <circle
          cx={px(at.x)}
          cy={px(at.y)}
          r={BALL_R}
          fill={painted ? palette.metal : "none"}
          stroke={palette.dark}
          strokeWidth={px(0.8 + wear * 0.8)}
        />
        {/* Highlight: a ball is the one polished thing down here. */}
        <circle
          cx={px(at.x - BALL_R * 0.3)}
          cy={px(at.y - BALL_R * 0.3)}
          r={px(BALL_R * 0.3)}
          fill={painted ? palette.shell : "none"}
          opacity={px(0.45 * (1 - wear * 0.7))}
        />
        {/* The seat contact band, and the pits worn into it. */}
        {wear > 0.02 && (
          <>
            <path
              d={`M ${px(at.x - BALL_R * 0.72)} ${px(at.y + BALL_R * 0.5)} A ${BALL_R} ${BALL_R} 0 0 0 ${px(at.x + BALL_R * 0.72)} ${px(at.y + BALL_R * 0.5)}`}
              fill="none"
              stroke={palette.dark}
              strokeWidth={px(0.7 + wear * 1.8)}
              strokeLinecap="round"
              opacity={px(0.3 + wear * 0.55)}
            />
            {[-0.5, 0.1, 0.62].slice(0, 1 + Math.round(wear * 2)).map((offset, index) => (
              <circle
                key={offset}
                cx={px(at.x + BALL_R * offset)}
                cy={px(at.y + BALL_R * (0.42 + (index % 2) * 0.18))}
                r={px(0.5 + wear * 0.8)}
                fill={palette.dark}
                opacity={px(0.4 + wear * 0.4)}
              />
            ))}
          </>
        )}
      </g>
    )
  }

  /**
   * Fluid on the move: chevrons marching up a bore at the rate the plunger is
   * actually shifting it, so they stall at both ends of the stroke and run
   * fastest through the middle. `up` false is fluid going the wrong way — slip
   * past a seated ball that no longer seals.
   */
  const stream = (
    key: string,
    x: number,
    from: number,
    until: number,
    up: boolean,
    count: number,
    strength: number,
  ) => {
    const span = until - from
    if (span <= 2 || strength <= 0.02) return null
    return Array.from({ length: count }, (_, index) => {
      const t = ((index + drift) % count) / count
      const y = from + (up ? t : 1 - t) * span
      const nose = up ? 3.2 : -3.2
      const a = to({ x: x - 2.8, y }, 0)
      const b = to({ x, y: y + nose }, 0)
      const c = to({ x: x + 2.8, y }, 0)
      return (
        <path
          key={`${key}:${index}`}
          d={`M ${px(a.x)} ${px(a.y)} L ${px(b.x)} ${px(b.y)} L ${px(c.x)} ${px(c.y)}`}
          fill="none"
          stroke={palette.accent}
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={px(0.95 * strength * Math.sin(t * Math.PI))}
        />
      )
    })
  }

  // Fluid marches with the volume the plunger has displaced, not with the
  // clock: it stalls where the plunger stalls and runs where the plunger runs,
  // because it is the same fluid. `flowed` is the fraction of this half-stroke
  // already swept, so it always climbs and resets where the flow is zero anyway.
  const shifting = Math.abs(pose.speed)
  const flowed = pose.direction > 0 ? pose.travel : 1 - pose.travel
  const drift = ((flowed * 6) % 1 + 1) % 1
  const wearing = clamp(Number.isFinite(geometry.leak) ? geometry.leak : 0, 0, 1)
  const tvWear = fault === "tv-leak" ? wearing : 0
  const svWear = fault === "sv-leak" ? wearing : 0

  const foot = PLUNGER_LOW + pose.travel * STROKE
  const head = foot + PLUNGER_ASSY
  // A worn ball has cut its own groove, so it beds a little deeper than a new
  // one before it is carried off its seat by the flow.
  const tvBall = foot + TV_SEAT + BALL_R - tvWear * 0.9 + pose.travelling * LIFT
  const svBall = SEAT_HIGH + BALL_R - 2 - svWear * 0.9 + pose.standing * LIFT
  const liquid = PLUNGER_LOW + pose.charge * STROKE
  const annulus = level * TOP
  // The tailpipe and the annulus are the same body of fluid, so the pump only
  // has something to draw on while the level is above its intake.
  const intake = Math.min(annulus, SEAT_LOW)
  const percent = Math.round(pose.travel * 100)
  const direction = pose.direction > 0 ? "upstroke" : "downstroke"

  const cardScale = Math.max(card.peak, reference.peak, 1)
  const onCard = (point: Vec2) => ({
    x: CARD.x + clamp(point.x, 0, 1) * CARD.w,
    y: CARD.y + CARD.h - clamp(point.y / cardScale, 0, 1) * CARD.h,
  })
  const trace = (points: Vec2[]) =>
    `${points
      .map((point, index) => {
        const screen = onCard(point)
        return `${index ? "L" : "M"} ${px(screen.x)} ${px(screen.y)}`
      })
      .join(" ")} Z`
  const dot = onCard({ x: pose.travel, y: pose.load })

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Rod pump in section, ${conditionNames[fault]}, ${stateNames[pose.state]}, plunger ${percent} percent up the stroke on the ${direction}, ${Math.round(pose.rodLoad)} pounds on the rods, ${viewNames[view] ?? viewNames.front}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(pose.phase) : undefined}
      aria-valuetext={interactive ? `${percent} percent up the stroke, ${direction}` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.02, 0.1)
        if (delta !== 0) apply(running + delta)
        else if (event.key === "Home") apply(Math.round(running))
        else if (event.key === "End") apply(Math.floor(running) + 0.5)
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
      <g data-view={view} transform={frame || undefined}>
        {showFormation && (
          <g data-formation>
            {/* The rock the well is cut through: the block's mass washed back,
                then the sectioned face it leaves. */}
            <path d={box(-ROCK, -BLEED, ROCK, TOP + BLEED, ROCK_DEPTH)} fill={palette.dark} opacity={0.1} />
            {[-1, 1].map((side) => (
              <path
                key={side}
                d={region([
                  { x: side * CEMENT, y: -BLEED },
                  { x: side * ROCK, y: -BLEED },
                  { x: side * ROCK, y: TOP + BLEED },
                  { x: side * CEMENT, y: TOP + BLEED },
                ])}
                fill={painted ? palette.dark : "none"}
                stroke={palette.dark}
                strokeWidth={0.7}
                opacity={painted ? 0.24 : 0.5}
              />
            ))}
            {BEDS.map((y) => (
              <path
                key={y}
                d={`${line([{ x: -ROCK, y }, { x: -CEMENT, y }])} ${line([{ x: CEMENT, y }, { x: ROCK, y }])}`}
                fill="none"
                stroke={palette.dark}
                strokeWidth={PERFS.some((perf) => Math.abs(perf - y) < 16) ? 2.6 : 1}
                opacity={0.22}
              />
            ))}
            {/* Cement sheath, filling the annulus between the casing and the hole. */}
            <path
              d={walls(CASING_OD, CEMENT, -BLEED, TOP + BLEED)}
              fill={painted ? palette.metal : "none"}
              stroke={palette.dark}
              strokeWidth={0.7}
              opacity={painted ? 0.4 : 0.7}
            />
          </g>
        )}

        {/* Casing: the round body ghosted, the bore behind it, the cut wall. */}
        <g data-casing>
          <path d={tube(CASING_OD, -BLEED, TOP + BLEED)} {...machined} opacity={px(solidity * 0.75)} />
          <path
            d={bore(CASING_ID, -BLEED, TOP + BLEED)}
            fill={painted ? palette.dark : "none"}
            opacity={px(behind * 0.6)}
          />
          <path d={walls(CASING_ID, CASING_OD, -BLEED, TOP + BLEED)} {...machined} />
          {[100, 236].map((y) => (
            <path key={y} d={walls(CASING_ID, CASING_OD + 4, y - 6, y + 6)} {...cast} />
          ))}
        </g>

        {showFluid && (
          // What the well has stood up in the annulus. A level you supply.
          <g data-annulus data-level={px(level)}>
            <path
              d={walls(TUBING_OD, CASING_ID, -BLEED, annulus)}
              fill={palette.accent}
              opacity={0.28}
            />
            <path
              d={`${line([{ x: -CASING_ID, y: annulus }, { x: -TUBING_OD, y: annulus }])} ${line([{ x: TUBING_OD, y: annulus }, { x: CASING_ID, y: annulus }])}`}
              fill="none"
              stroke={palette.accent}
              strokeWidth={1.4}
              opacity={0.85}
            />
          </g>
        )}

        {showFormation && (
          <g data-perforation>
            {PERFS.flatMap((y) =>
              [-1, 1].map((side) => (
                <g key={`${y}:${side}`}>
                  <path
                    d={region([
                      { x: side * CASING_ID, y: y - 4 },
                      { x: side * PERF_REACH, y: y - 1.6 },
                      { x: side * PERF_REACH, y: y + 1.6 },
                      { x: side * CASING_ID, y: y + 4 },
                    ])}
                    fill={painted ? palette.dark : "none"}
                    stroke={palette.metal}
                    strokeWidth={0.7}
                    opacity={0.62}
                  />
                  <path
                    d={line([
                      { x: side * (PERF_REACH - 5), y },
                      { x: side * (CASING_ID + 3), y },
                    ])}
                    fill="none"
                    stroke={palette.accent}
                    strokeWidth={0.9}
                    strokeLinecap="round"
                    opacity={0.45}
                  />
                </g>
              )),
            )}
          </g>
        )}

        {/* Tubing, hung from the surface; the pump lands in the bottom of it. */}
        <g data-tubing>
          <path d={tube(TUBING_OD, -BLEED, TOP + BLEED)} {...machined} opacity={px(solidity * 0.75)} />
          <path
            d={bore(TUBING_ID, -BLEED, TOP + BLEED)}
            fill={painted ? palette.dark : "none"}
            opacity={px(behind * 0.7)}
          />
          <path d={walls(TUBING_ID, TUBING_OD, -BLEED, TOP + BLEED)} {...machined} />
          <path d={walls(TUBING_ID, TUBING_OD + 3.5, 256, 270)} {...cast} />
        </g>

        {/* The gas anchor below the pump: slotted, so the intake takes liquid
            off the bottom of the annulus rather than gas off the top of it. */}
        <g data-intake>
          <path d={tube(BARREL_OD - 3, -BLEED, HOLDDOWN_LOW)} {...machined} opacity={solidity} />
          {showFluid && intake > -BLEED && (
            <>
              <path d={bore(BORE_R + 1, -BLEED, intake)} fill={palette.accent} opacity={0.45} />
              <path
                d={bore(BORE_R + 1, HOLDDOWN_LOW, Math.min(intake, SEAT_LOW))}
                fill={palette.accent}
                opacity={0.45}
              />
            </>
          )}
          <path d={walls(BORE_R + 1, BARREL_OD - 3, -BLEED, HOLDDOWN_LOW)} {...machined} />
          {[10, 22, 34].map((y) => (
            <path
              key={y}
              d={walls(BORE_R + 1, BARREL_OD - 3, y, y + 6)}
              fill={palette.dark}
              opacity={0.55}
            />
          ))}
        </g>

        {/* The hold-down: cup seals that land the pump in its seating nipple. */}
        <g data-holddown>
          <path d={tube(TUBING_ID, HOLDDOWN_LOW, HOLDDOWN_HIGH)} {...machined} opacity={solidity} />
          <path d={walls(BORE_R, BARREL_OD - 3, HOLDDOWN_LOW, HOLDDOWN_HIGH)} {...machined} />
          {[-1, 1].map((side) => (
            <g key={side}>
              <path
                d={region([
                  { x: side * (BARREL_OD - 3), y: HOLDDOWN_LOW + 3 },
                  { x: side * (TUBING_ID - 0.5), y: HOLDDOWN_LOW + 10 },
                  { x: side * (TUBING_ID - 0.5), y: HOLDDOWN_HIGH - 5 },
                  { x: side * (BARREL_OD - 3), y: HOLDDOWN_HIGH - 8 },
                ])}
                {...cast}
              />
              {[0, 1, 2].map((index) => (
                <path
                  key={index}
                  d={line([
                    { x: side * (BARREL_OD - 2), y: HOLDDOWN_LOW + 12 + index * 5 },
                    { x: side * (TUBING_ID - 1), y: HOLDDOWN_LOW + 12 + index * 5 },
                  ])}
                  fill="none"
                  stroke={palette.metal}
                  strokeWidth={0.8}
                  opacity={0.85}
                />
              ))}
            </g>
          ))}
        </g>

        {/* Working barrel: the bore the plunger runs in. */}
        <g data-barrel>
          <path d={tube(BARREL_OD, BARREL_LOW, BARREL_HIGH)} {...shell} opacity={solidity} />
          <path
            d={bore(BARREL_ID, BARREL_LOW, BARREL_HIGH)}
            fill={painted ? palette.dark : "none"}
            opacity={behind}
          />
          <path d={walls(BARREL_ID, BARREL_OD, BARREL_LOW, BARREL_HIGH)} {...shell} />
          <path d={walls(BARREL_ID, BARREL_OD + 3, BARREL_LOW, BARREL_LOW + 12)} {...cast} />
          <path d={walls(BARREL_ID, BARREL_OD + 3, BARREL_HIGH - 12, BARREL_HIGH)} {...cast} />
        </g>

        {showFluid && (
          <>
            {/* The produced column: what the plunger has already lifted,
                standing in the tubing above it all the way to surface. */}
            <g data-production>
              <path
                d={walls(ROD_R, BARREL_ID, head, BARREL_HIGH)}
                fill={palette.accent}
                opacity={0.34}
              />
              <path
                d={walls(ROD_R, TUBING_ID, BARREL_HIGH, TOP + BLEED)}
                fill={palette.accent}
                opacity={0.34}
              />
            </g>

            {/* The pump chamber: what the standing valve has let in, and the
                gas or void the plunger has still to fall through to reach it. */}
            <g data-chamber data-charge={px(pose.charge)}>
              <path
                d={bore(BARREL_ID, CAGE_HIGH, Math.max(liquid, CAGE_HIGH))}
                fill={palette.accent}
                opacity={0.5}
              />
              {liquid < foot - 1 && (
                <g data-void>
                  <path d={bore(BARREL_ID, liquid, foot)} fill={palette.dark} opacity={0.4} />
                  {fault === "gas" &&
                    [0, 1, 2, 3, 4].map((index) => {
                      const at = lerp(liquid + 4, foot - 4, (index + 0.5) / 5)
                      const across = index % 2 === 0 ? -6.5 : 6.5
                      const seat = to({ x: across, y: at }, 0)
                      return (
                        <circle
                          key={index}
                          cx={px(seat.x)}
                          cy={px(seat.y)}
                          r={px(1.6 + (index % 3) * 0.6)}
                          fill="none"
                          stroke={palette.accent}
                          strokeWidth={0.8}
                          opacity={0.85}
                        />
                      )
                    })}
                </g>
              )}
            </g>
          </>
        )}

        {/* Standing valve: seat, ball and cage, in the foot of the barrel. It
            lifts on the upstroke and the formation charges the barrel. */}
        <g data-standing-valve data-open={px(pose.standing)} data-flow={px(pose.standingFlow)}>
          <path d={walls(BORE_R, BARREL_ID, SEAT_LOW, SEAT_HIGH)} {...machined} />
          <path d={walls(BALL_R + 1, BARREL_ID - 0.5, SEAT_HIGH, CAGE_HIGH)} {...machined} />
          <path d={walls(0, BARREL_ID - 0.5, CAGE_HIGH - 4, CAGE_HIGH)} {...machined} />
          {[-1, 1].map((side) => (
            <path
              key={side}
              d={line([
                { x: side * (BALL_R + 1), y: SEAT_HIGH + 1 },
                { x: side * (BORE_R - 1), y: SEAT_HIGH - 5 },
              ])}
              fill="none"
              stroke={palette.dark}
              strokeWidth={1.2}
            />
          ))}
          {ball(svBall, svWear, "standing")}
        </g>

        {/* The plunger, and the travelling valve in its foot. Shut going up, so
            the column rides on the rods; open coming down, so it transfers. */}
        <g data-plunger data-travel={px(pose.travel)}>
          <path d={tube(PLUNGER_R, foot, head)} {...machined} opacity={solidity} />
          {/* The plunger's own bore is part of the production column: whatever
              the travelling valve passes goes up through here. */}
          {showFluid && (
            <path
              d={bore(BALL_R + 1, foot + TV_SEAT, head)}
              fill={palette.accent}
              opacity={0.34}
            />
          )}
          <path d={walls(BORE_R, PLUNGER_R, foot, foot + TV_SEAT)} {...machined} />
          <path d={walls(BALL_R + 1, PLUNGER_R - 1, foot + TV_SEAT, foot + TV_CAGE)} {...machined} />
          <path d={walls(0, PLUNGER_R - 1, foot + TV_CAGE - 4, foot + TV_CAGE)} {...machined} />
          <path d={walls(BALL_R + 1, PLUNGER_R, foot + TV_CAGE, head - 8)} {...machined} />
          <path d={walls(BALL_R + 1, PLUNGER_R - 0.5, head - 8, head)} {...cast} />
          {[0, 1, 2, 3].map((index) => (
            <path
              key={index}
              d={walls(PLUNGER_R - 2.5, PLUNGER_R, foot + TV_CAGE + 4 + index * 6, foot + TV_CAGE + 6.5 + index * 6)}
              fill={palette.dark}
              opacity={0.55}
            />
          ))}
          {[-1, 1].map((side) => (
            <path
              key={side}
              d={line([
                { x: side * (BALL_R + 1), y: foot + TV_SEAT + 1 },
                { x: side * (BORE_R - 1), y: foot + TV_SEAT - 5 },
              ])}
              fill="none"
              stroke={palette.dark}
              strokeWidth={1.2}
            />
          ))}
          <g data-travelling-valve data-open={px(pose.travelling)} data-flow={px(pose.travellingFlow)}>
            {ball(tvBall, tvWear, "travelling")}
          </g>
        </g>

        {/* The rod string, up to surface. Its couplings ride with the plunger. */}
        <g data-rod data-load={px(pose.load)}>
          <path d={tube(ROD_R, head, TOP)} {...machined} />
          {[head + 20, head + 62]
            .filter((y) => y < TOP - 8)
            .map((y) => (
              <path key={px(y)} d={tube(ROD_R + 2.6, y - 5, y + 5)} {...cast} />
            ))}
        </g>

        {showFluid && (
          /*
           * The fluid actually moving, and which way. Going up: the standing
           * valve is open and the formation is charging the barrel while the
           * plunger lifts the whole column above it. Coming down: the
           * travelling valve is open and the barrel passes its charge up
           * through the plunger instead. Every run is gated on the valve that
           * has to be open for it, so a pump falling through a void moves
           * nothing at all.
           */
          <g data-flow data-direction={pose.direction}>
            {pose.standingFlow > 0.02 && (
              <>
                {intake > HOLDDOWN_LOW &&
                  stream("intake", 0, HOLDDOWN_LOW - 10, SEAT_LOW - 1, true, 3, pose.standingFlow)}
                {PERFS.map((y) =>
                  [-1, 1].map((side) => {
                    // Into the annulus, not into the cement: the tunnel ends at
                    // the casing and the fluid turns down the hole from there.
                    const tip = to({ x: side * (TUBING_OD + 5), y }, 0)
                    const tail = to({ x: side * (CASING_ID - 3), y }, 0)
                    const wing = to({ x: side * (TUBING_OD + 11), y: y + 3 }, 0)
                    const under = to({ x: side * (TUBING_OD + 11), y: y - 3 }, 0)
                    return (
                      <path
                        key={`${y}:${side}`}
                        d={`M ${px(wing.x)} ${px(wing.y)} L ${px(tip.x)} ${px(tip.y)} L ${px(under.x)} ${px(under.y)} M ${px(tip.x)} ${px(tip.y)} L ${px(tail.x)} ${px(tail.y)}`}
                        fill="none"
                        stroke={palette.accent}
                        strokeWidth={1.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={px(0.9 * pose.standingFlow)}
                      />
                    )
                  }),
                )}
              </>
            )}
            {/* Lifting: the whole column above the plunger goes up with it. */}
            {pose.direction > 0 &&
              [-1, 1].map((side) => (
                <React.Fragment key={side}>
                  {stream(`lift:${side}`, side * 9, head + 4, BARREL_HIGH - 4, true, 3, shifting)}
                  {stream(`tube:${side}`, side * 15, BARREL_HIGH + 4, TOP, true, 4, shifting)}
                </React.Fragment>
              ))}
            {/* Transferring: through the plunger and on up the tubing. */}
            {pose.travellingFlow > 0.02 && (
              <>
                {stream("transfer", 0, foot + TV_CAGE + 2, head - 2, true, 3, pose.travellingFlow)}
                {stream(
                  "above",
                  0,
                  head + 6,
                  Math.min(head + 44, BARREL_HIGH),
                  true,
                  2,
                  pose.travellingFlow * 0.7,
                )}
              </>
            )}
            {/*
             * Slip. A ball and its seat take a hammering every stroke, and once
             * the contact face is no longer round the valve holds pressure but
             * no longer seals: fluid goes back down past a ball that is sitting
             * exactly where it should be. That is the failure, and this is what
             * it looks like.
             */}
            {tvWear > 0.02 &&
              pose.travelling < 0.05 &&
              [-1, 1].map((side) => (
                <React.Fragment key={side}>
                  {stream(
                    `tv-slip:${side}`,
                    side * 3,
                    foot - 12,
                    foot + TV_SEAT,
                    false,
                    2,
                    tvWear * (0.35 + 0.65 * shifting),
                  )}
                </React.Fragment>
              ))}
            {svWear > 0.02 &&
              pose.standing < 0.05 &&
              [-1, 1].map((side) => (
                <React.Fragment key={side}>
                  {stream(
                    `sv-slip:${side}`,
                    side * 3,
                    SEAT_LOW - 14,
                    SEAT_LOW + 2,
                    false,
                    2,
                    svWear * (0.35 + 0.65 * shifting),
                  )}
                </React.Fragment>
              ))}
          </g>
        )}

        {variant === "blueprint" && (
          <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.65}>
            <path
              d={`${line([{ x: -CEMENT - 20, y: PLUNGER_LOW }, { x: -BARREL_OD - 4, y: PLUNGER_LOW }])} ${line([{ x: -CEMENT - 20, y: PLUNGER_LOW + STROKE }, { x: -BARREL_OD - 4, y: PLUNGER_LOW + STROKE }])}`}
              strokeDasharray="3 3"
            />
            <path
              d={line([
                { x: -CEMENT - 12, y: PLUNGER_LOW },
                { x: -CEMENT - 12, y: PLUNGER_LOW + STROKE },
              ])}
            />
            <text
              x={px(to({ x: -CEMENT - 9, y: PLUNGER_LOW + STROKE / 2 }, 0).x)}
              y={px(to({ x: -CEMENT - 9, y: PLUNGER_LOW + STROKE / 2 }, 0).y)}
              textAnchor="start"
              fontFamily="ui-monospace, monospace"
              fontSize={5}
              fill={palette.foreground}
              stroke="none"
            >
              {`${px(Math.abs(geometry.strokeLength))} IN`}
            </text>
          </g>
        )}
      </g>

      {showCard && (
        <g data-card data-condition={fault} data-load={px(pose.load)}>
          <rect
            x={CARD.x - 7}
            y={CARD.y - 16}
            width={CARD.w + 14}
            height={CARD.h + 52}
            rx={3}
            fill={palette.dark}
            opacity={0.46}
          />
          <path
            d={`M ${CARD.x} ${CARD.y - 3} V ${CARD.y + CARD.h} H ${CARD.x + CARD.w}`}
            fill="none"
            stroke={palette.grid}
            strokeWidth={0.7}
            opacity={0.85}
          />
          <path d={trace(card.points)} fill={palette.accent} fillOpacity={0.16} stroke="none" />
          {/* The full-pump card this one is read against, over the fill so it
              can actually be compared with it. */}
          {fault !== "full" && (
            <path
              data-reference
              d={trace(reference.points)}
              fill="none"
              stroke={palette.foreground}
              strokeWidth={0.8}
              strokeDasharray="2.5 2.5"
              opacity={0.42}
            />
          )}
          <path
            data-trace
            d={trace(card.points)}
            fill="none"
            stroke={palette.foreground}
            strokeWidth={1.3}
            strokeLinejoin="round"
          />
          <circle data-dot cx={px(dot.x)} cy={px(dot.y)} r={3.6} fill={palette.glow} opacity={0.3} />
          <circle cx={px(dot.x)} cy={px(dot.y)} r={2.1} fill={palette.accent} />
          <text
            x={CARD.x}
            y={CARD.y - 8}
            fontFamily="ui-monospace, monospace"
            fontSize={5}
            fill={palette.foreground}
          >
            {conditionLabels[fault]}
          </text>
          {/* The barrel's own pressure, between pump intake and discharge —
              the one number both balls answer to. Cross the lower mark and the
              standing valve lifts; cross the upper one and the travelling valve
              does. In between, both are down and nothing is going anywhere. */}
          <g data-chamber-gauge data-pressure={px(pose.chamber)}>
            <rect
              x={CARD.x}
              y={CARD.y + CARD.h + 5}
              width={CARD.w}
              height={3.4}
              rx={1.7}
              fill={palette.dark}
              opacity={0.45}
            />
            <rect
              x={CARD.x}
              y={CARD.y + CARD.h + 5}
              width={px(Math.max(CARD.w * pose.chamber, 1.6))}
              height={3.4}
              rx={1.7}
              fill={palette.accent}
            />
            {[SEAL_BAND, 1 - SEAL_BAND].map((mark) => (
              <path
                key={mark}
                d={`M ${px(CARD.x + CARD.w * mark)} ${CARD.y + CARD.h + 3.6} v 6.2`}
                stroke={palette.foreground}
                strokeWidth={0.7}
                opacity={0.6}
              />
            ))}
          </g>
          <text
            x={CARD.x}
            y={CARD.y + CARD.h + 17}
            fontFamily="ui-monospace, monospace"
            fontSize={4.8}
            fill={palette.foreground}
            opacity={0.85}
          >
            {stateLabels[pose.state]}
          </text>
          <text
            x={CARD.x}
            y={CARD.y + CARD.h + 24}
            fontFamily="ui-monospace, monospace"
            fontSize={4.8}
            fill={palette.foreground}
            opacity={0.8}
          >
            {`${Math.round(pose.rodLoad)} LB · ${Math.round(pose.production)} BPD`}
          </text>
          <text
            x={CARD.x}
            y={CARD.y + CARD.h + 31}
            fontFamily="ui-monospace, monospace"
            fontSize={4.8}
            fill={palette.foreground}
            opacity={0.8}
          >
            {`${percent}% ${direction === "upstroke" ? "UP" : "DOWN"}`}
          </text>
        </g>
      )}

      {label && (
        <text
          x={10}
          y={VIEW_HEIGHT - 9}
          textAnchor="start"
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

export { RodPump }
