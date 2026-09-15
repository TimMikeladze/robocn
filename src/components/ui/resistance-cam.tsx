"use client"

/**
 * resistance-cam — a lever on a variable-radius cam, so the resistance tracks
 * a strength curve instead of being flat.
 *
 * The cable sits in the cam's groove and leaves it on a tangent, which makes
 * two things exactly true at once, and both of them are the machine:
 *
 *   - **The moment arm is the cam radius.** The perpendicular distance from the
 *     pivot to the cable is the radius the groove has turned round to, so the
 *     resistance at the hand is the profile, read as a graph.
 *   - **The payout is the integral of r dθ.** So the stack does *not* rise
 *     linearly with the lever: turn the cam through its fat part and the stack
 *     runs away from the handle, and through its thin part and it barely moves.
 *
 * The snail drawn here is that same `r(θ)` in polar — the cam **is** the
 * resistance curve, not an illustration of one. The cam is keyed to the lever,
 * so it turns forward with it.
 *
 * The mechanism is solved in `src/lib/robocn/gym.ts` — pure, no React, tested on
 * its own. The drawing only reads the pose it produces, and the stack it lifts
 * is the same `reeveStack` the cable station runs on, reeved one to one.
 *
 * Illustrated: the strength curve the profile is shaped to is a raised cosine
 * chosen for the drawing, not a measurement of any joint. Frictionless, and the
 * cable does not stretch.
 *
 * Drawn once in the profile elevation and pushed through `robotCamera`, so all
 * four views are the same geometry rather than four drawings that drift apart.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import {
  camOutline,
  defaultCamGeometry,
  reeveStack,
  solveCam,
  type CamGeometry,
} from "@/lib/robocn/gym"
import {
  boxCorners,
  elevationDraft,
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

/** What the machine does with nobody driving it. Always includes `static`. */
export type ResistanceCamBehavior = "curl" | "slow" | "hold" | "static"

const VIEW_WIDTH = 240
const VIEW_HEIGHT = 220
const NATIVE_VIEW: RobotView = "profile"

/** World units. x along the drawing, y up from the ground, z out of the plane. */
const ENVELOPE = boxCorners({ x: -32, y: 0, z: -100 }, { x: 32, y: 166, z: 96 })

/** The shaft the lever and the cam are keyed to. */
const PIVOT: Vec2 = { x: 22, y: 126 }
/** Where the lever sits with the cam at the start of its sweep. */
const LEVER_REST = -86
const STACK_X = -66
const BASE_Y = 11
const PLATE_HALF = 15
const PLATE_DEPTH = 12
const PLATE_HEIGHT = 7
const PLATE_GAP = 1.2
const PLATES = 8
const CROWN_Y = 150

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/**
 * Lever travel at `clock`, 0 at the bottom of the sweep to 1 at the top. Every
 * behaviour is a pure function of the clock, exported so motion can be tested
 * by sampling it rather than by faking animation frames.
 */
export function resistanceCamAngle(behavior: ResistanceCamBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0.42
  const t = ((clock % 1) + 1) % 1
  switch (behavior) {
    // Up fast, down under control — which is how the cam is meant to be used.
    case "slow":
      return t < 0.32 ? (1 - Math.cos((t / 0.32) * Math.PI)) / 2 : (1 + Math.cos(((t - 0.32) / 0.68) * Math.PI)) / 2
    case "hold":
      return clamp(0.56 + Math.sin(t * Math.PI * 14) * 0.03, 0, 1)
    default:
      return (1 - Math.cos(t * Math.PI * 2)) / 2
  }
}

export interface ResistanceCamProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled lever travel, 0 at the bottom of the sweep to 1 at the top. Supplying it stops the loop. */
  angle?: number
  onAngleChange?: (angle: number) => void
  behavior?: ResistanceCamBehavior
  /** The cam's smallest and largest working radius. */
  baseRadius?: number
  peakRadius?: number
  /** Where the profile peaks, as a fraction of the sweep: the strength curve. */
  peak?: number
  /** Which plate the selector pin is in, counted from the top. */
  pin?: number
  /** What one plate weighs, for the readout. */
  plateWeight?: number
  /** Draw the cam's profile as the resistance curve it is. */
  showProfile?: boolean
  showGround?: boolean
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

function ResistanceCam({
  angle,
  onAngleChange,
  behavior = "curl",
  baseRadius = defaultCamGeometry.baseRadius,
  peakRadius = defaultCamGeometry.peakRadius,
  peak = 0.46,
  pin = 4,
  plateWeight = 5,
  showProfile = true,
  showGround = true,
  view = NATIVE_VIEW,
  speed = 0.3,
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
}: ResistanceCamProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = angle !== undefined

  // Controlled wins and pins the value; the clock keeps running underneath, so
  // release reads as the lever coming back down rather than a jump.
  const hold = controlled ? (Number.isFinite(angle) ? clamp(angle as number, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => resistanceCamAngle(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: 1.3,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const travel = clamp(motion.value, 0, 1)

  const cam: CamGeometry = React.useMemo(() => {
    const base = Math.abs(Number.isFinite(baseRadius) ? baseRadius : defaultCamGeometry.baseRadius)
    const top = Math.abs(Number.isFinite(peakRadius) ? peakRadius : defaultCamGeometry.peakRadius)
    return {
      ...defaultCamGeometry,
      baseRadius: Math.min(base, top),
      peakRadius: Math.max(base, top),
      peakAngle: clamp(Number.isFinite(peak) ? peak : 0.46, 0, 1) * defaultCamGeometry.sweep,
    }
  }, [baseRadius, peakRadius, peak])

  const pose = solveCam(travel * cam.sweep, cam)
  // One to one off the cam, so what the cam pays out is what the stack rises.
  const lift = reeveStack(pose.payout, {
    plates: PLATES,
    plateHeight: PLATE_HEIGHT,
    plateGap: PLATE_GAP,
    lines: 1,
    plateWeight: Number.isFinite(plateWeight) ? plateWeight : 5,
    pin: Math.round(Number.isFinite(pin) ? pin : 0),
    headroom: 52,
  })

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const { point: to, path: line, solid, box, bar, disc } = elevationDraft(camera, "profile")

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 100) / 100
      setHeld(bounded)
      onAngleChange?.(bounded)
    },
    [onAngleChange],
  )
  const dragging = useRobotDrag(svgRef, {
    // `onDrag` must stay in a `useCallback` or the listeners rebind every render.
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(1 - unit.y), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const plate = robotSurface("shell", variant, palette, 0.8)

  /* ------------------------------------------------- the cam and the lever */

  const at = React.useCallback(
    (point: Vec2): Vec2 => ({ x: PIVOT.x + point.x, y: PIVOT.y + point.y }),
    [],
  )
  const outline = camOutline(pose, cam, 40).map(at)
  const departure = at(pose.departure)
  const anchor = at(pose.anchor)

  // The lever is keyed to the cam, so it turns through exactly the same sweep.
  const leverAngle = LEVER_REST + pose.angle
  const lever = toRadians(leverAngle)
  const pad: Vec2 = {
    x: PIVOT.x + Math.cos(lever) * cam.lever,
    y: PIVOT.y + Math.sin(lever) * cam.lever,
  }

  const pitch = PLATE_HEIGHT + PLATE_GAP
  const topPlate = BASE_Y + (PLATES - 1) * pitch + lift.rise
  const blockY = topPlate + PLATE_HEIGHT + 11
  // Down to the floor sheave, along to the stack column, up to the riser.
  const cable: Vec2[] = [
    departure,
    anchor,
    { x: STACK_X, y: anchor.y },
    { x: STACK_X, y: blockY },
  ]
  /* The cam face, closed back through the hub: a lobe, not its convex hull. */
  const lobe: Vec2[] = [at({ x: 0, y: 0 }), ...outline]

  const arm = Math.round(pose.momentArm * 10) / 10
  const degrees = Math.round(pose.angle)
  const resistance = Math.round(lift.weight * pose.leverage * 10) / 10

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Resistance cam, lever ${degrees} degrees into its sweep, moment arm ${arm} at the cam so the hand holds ${resistance} of ${lift.weight}, ${viewNames[view] ?? viewNames.profile}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(travel) : undefined}
      aria-valuetext={interactive ? `${degrees} degrees, moment arm ${arm}` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.2)
        if (delta !== 0) apply(travel + delta)
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
        <path
          d={`M 10 ${VIEW_HEIGHT - 24} H ${VIEW_WIDTH - 10}`}
          fill="none"
          stroke={palette.grid}
          strokeWidth={0.5}
          strokeDasharray="3 4"
          opacity={0.4}
        />
      )}

      <g data-view={view} transform={frame || undefined}>
        {showGround && (
          <>
            <path
              data-ground
              d={solid([{ x: -90, y: 0 }, { x: 80, y: 0 }], 32)}
              fill={palette.dark}
              opacity={0.12}
            />
            <path
              d={line([{ x: -90, y: 0 }, { x: 80, y: 0 }])}
              fill="none"
              stroke={palette.dark}
              strokeWidth={1}
              opacity={0.5}
            />
          </>
        )}

        <g data-frame>
          <path d={box(-88, 0, 76, BASE_Y, 28)} {...cast} />
          {[-1, 1].map((side) => (
            <path
              key={side}
              d={bar(
                { x: STACK_X + side * (PLATE_HALF + 3), y: BASE_Y },
                { x: STACK_X + side * (PLATE_HALF + 3), y: CROWN_Y },
                1.7,
                1.7,
              )}
              {...machined}
            />
          ))}
          <path
            d={bar({ x: STACK_X - 20, y: CROWN_Y }, { x: STACK_X + 20, y: CROWN_Y }, 4, 5)}
            {...shell}
          />
          {/* The mast the shaft is carried on, and the seat pad in front of it. */}
          <path d={bar({ x: PIVOT.x, y: BASE_Y }, { x: PIVOT.x, y: PIVOT.y }, 5.5, 7)} {...shell} />
          <path d={bar({ x: STACK_X + 16, y: 50 }, { x: PIVOT.x, y: 50 }, 2.4, 3.4)} {...machined} />
          {/* Seat and backrest, set clear of the arc the roller swings on. */}
          <path d={box(PIVOT.x + 8, 52, PIVOT.x + 58, 62, 14)} {...shell} />
          <path d={bar({ x: PIVOT.x + 54, y: 54 }, { x: PIVOT.x + 68, y: 96 }, 3.6, 13)} {...shell} />
          <path d={bar({ x: PIVOT.x + 30, y: 0 }, { x: PIVOT.x + 30, y: 52 }, 4, 5)} {...cast} />
        </g>

        {/* The stack, lifted by whatever the cam paid out. */}
        <g data-stack data-rise={px(lift.rise)}>
          {lift.plates.map((entry) => (
            <g key={entry.index} data-plate data-rising={entry.rising ? "" : undefined}>
              <path
                d={box(
                  STACK_X - PLATE_HALF,
                  BASE_Y + entry.y,
                  STACK_X + PLATE_HALF,
                  BASE_Y + entry.y + PLATE_HEIGHT,
                  PLATE_DEPTH,
                )}
                {...(entry.rising ? plate : cast)}
              />
            </g>
          ))}
          <g data-pin>
            <path
              d={bar(
                { x: STACK_X + 4, y: BASE_Y + lift.plates[lift.pin].y + PLATE_HEIGHT / 2 },
                { x: STACK_X + 13, y: BASE_Y + lift.plates[lift.pin].y + PLATE_HEIGHT / 2 },
                1.5,
                1.5,
                PLATE_DEPTH + 3,
              )}
              {...machined}
            />
            <path
              d={disc(
                { x: STACK_X + 14, y: BASE_Y + lift.plates[lift.pin].y + PLATE_HEIGHT / 2 },
                3,
                2.2,
                PLATE_DEPTH + 4,
              )}
              fill={palette.accent}
              stroke="none"
            />
          </g>
          <g data-riser>
            <path d={bar({ x: STACK_X, y: BASE_Y + 4 }, { x: STACK_X, y: blockY }, 2.2, 2.2)} {...machined} />
            <path d={box(STACK_X - 10, blockY - 5, STACK_X + 10, blockY + 3, 5)} {...cast} />
          </g>
        </g>

        {/*
          The lever, keyed to the same shaft, with the roller it is pushed by.
          Drawn before the cam because the cam rides on the near side of it.
        */}
        <g data-lever data-angle={px(pose.angle)}>
          <path d={bar(PIVOT, pad, 3.6, 4, -6)} {...machined} />
          <path d={disc(pad, 6.5, 11, -6)} {...shell} />
          <path d={disc(pad, 2.4, 12, -6)} fill={palette.accent} stroke="none" />
        </g>

        {/*
          The cam. Its outline is `camRadius` in polar, turned to where the
          lever has put it — so the radius reaching the cable is the moment arm.
        */}
        <g data-cam data-arm={px(pose.momentArm)} data-spin={px(pose.spin)}>
          {/*
            Drawn as a polyline rather than a solid: a solid is wrapped in its
            convex hull, and the hull of a cam is a wedge with the profile
            thrown away — which is the one thing on this machine that has to
            survive. A cam is flat in the drawing plane, so a closed polyline at
            depth is exact here and foreshortens correctly everywhere else.
          */}
          <path d={line(lobe, 2, true)} {...cast} />
          <path d={line(lobe, 6, true)} {...machined} />
          {showProfile && (
            <path
              data-profile
              d={line(outline, 6)}
              fill="none"
              stroke={palette.accent}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {/* The working radius, drawn: pivot to the point the cable leaves at. */}
          <path
            data-moment-arm
            d={line([at({ x: 0, y: 0 }), departure], 7)}
            fill="none"
            stroke={palette.foreground}
            strokeWidth={1}
            strokeDasharray="3 2.5"
            opacity={0.75}
          />
          <path d={disc(at({ x: 0, y: 0 }), 5, 8)} {...cast} />
          <path d={disc(at({ x: 0, y: 0 }), 2.2, 9)} {...machined} />
        </g>

        {/* One cable: off the cam on a tangent, round the floor sheave, up. */}
        <g data-sheaves>
          <path d={disc(anchor, 5, 3)} {...machined} />
          <path d={disc({ x: STACK_X, y: anchor.y }, 5, 3)} {...machined} />
          <path d={disc({ x: STACK_X, y: CROWN_Y - 7 }, 4.4, 2.6)} {...machined} />
        </g>
        <path
          data-cable
          d={line(cable)}
          fill="none"
          stroke={palette.accent}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {variant === "blueprint" && (
          <text
            x={px(to({ x: PIVOT.x + 34, y: PIVOT.y + 30 }).x)}
            y={px(to({ x: PIVOT.x + 34, y: PIVOT.y + 30 }).y)}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize={7}
            fill={palette.foreground}
          >
            {`r ${arm}`}
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

export { ResistanceCam }
