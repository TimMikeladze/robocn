"use client"

/**
 * cross-trainer — a crank and a rocker, and the closed curve their coupler
 * draws.
 *
 * The foot does not follow an ellipse somebody traced. The pedal arm is the
 * **coupler** of a four-bar: its rear end is pinned to the crank, its front end
 * hangs off the swing arm, and the footpad is a point rigidly fixed on it. The
 * path that point draws is a coupler curve — closed, egg-shaped, and distinctly
 * not an ellipse. `stride` is the horizontal extent of that curve, measured off
 * the solved loop over a whole revolution, so changing the crank radius or any
 * link length changes both the number and the shape of the path.
 *
 * The grip is the same swing arm carried on past its pivot, so arms and feet
 * cannot drift out of phase: they are one linkage. The two sides run half a
 * revolution apart, which is the crank, not an offset anyone added.
 *
 * The mechanism is solved in `src/lib/robocn/gym.ts` over `solveFourBar` from
 * `linkage.ts` — pure, no React, tested on its own. The drawing only reads the
 * pose it produces.
 *
 * Illustrated: there is no resistance model here at all. The flywheel is drawn,
 * not spun — nothing computes inertia, brake torque or the effort the path
 * costs. `rowing-erg` is the machine in this family that does dynamics.
 *
 * Drawn once in the profile elevation and pushed through `robotCamera`, so all
 * four views are the same geometry rather than four drawings that drift apart.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, toDegrees, type Vec2 } from "@/lib/robocn/kinematics"
import {
  defaultTrainerGeometry,
  solveTrainer,
  trainerFootPath,
  type TrainerGeometry,
} from "@/lib/robocn/gym"
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

/** What the machine does with nobody driving it. Always includes `static`. */
export type CrossTrainerBehavior = "stride" | "sprint" | "coast" | "static"

const VIEW_WIDTH = 230
const VIEW_HEIGHT = 250
const NATIVE_VIEW: RobotView = "profile"

/** Where the crank shaft sits in the drawing. The solver works about it. */
const CRANK: Vec2 = { x: -44, y: 128 }
/** Half the track between the two pedal arms, out of the drawing plane. */
const PEDAL_TRACK = 21
const BASE_Y = 11

/** World units. x along the drawing, y up from the ground, z out of the plane. */
const ENVELOPE = boxCorners({ x: -36, y: 0, z: -118 }, { x: 36, y: 240, z: 92 })

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const wrap360 = (value: number) =>
  Number.isFinite(value) ? ((value % 360) + 360) % 360 : 0

/**
 * Where the crank shaft lands in the viewBox from one camera. Recomputed inside
 * the drag handler so the only thing it closes over is the view.
 */
function crankHub(view: RobotView): Vec2 {
  const camera = robotCamera(view)
  const frame = fitFrame(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  return frame.toViewBox(camera.project(0, CRANK.y, -CRANK.x))
}

/**
 * Crank angle at `clock`, in degrees and **unwrapped**, so the easing never has
 * to cross a seam and rewind a revolution. Every behaviour is a pure function
 * of the clock, exported so motion can be tested by sampling it rather than by
 * faking animation frames.
 */
export function crossTrainerCrank(behavior: CrossTrainerBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 210
  switch (behavior) {
    // Pushing hard, then riding it: fast through the drive, slower coming round.
    case "sprint":
      return clock * 720 + Math.sin(clock * Math.PI * 2) * 70
    // Letting it run down: the turns get shorter and never quite stop.
    case "coast":
      return 900 * (1 - Math.exp(-clock * 0.6))
    default:
      return clock * 360
  }
}

export interface CrossTrainerProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled crank angle in degrees. Supplying it stops the loop. */
  crankAngle?: number
  onCrankAngleChange?: (crankAngle: number) => void
  behavior?: CrossTrainerBehavior
  /** The driven link. Longer crank, longer stride — but not twice it. */
  crank?: number
  /** The pedal arm between the crank pin and the swing arm. */
  coupler?: number
  /** How far along the pedal arm the footpad is fixed. */
  padAlong?: number
  /** Draw the closed path the footpad actually follows. */
  showPath?: boolean
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

function CrossTrainer({
  crankAngle,
  onCrankAngleChange,
  behavior = "stride",
  crank = defaultTrainerGeometry.crank,
  coupler = defaultTrainerGeometry.coupler,
  padAlong = defaultTrainerGeometry.padAlong,
  showPath = true,
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
}: CrossTrainerProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = crankAngle !== undefined

  const hold = controlled ? (Number.isFinite(crankAngle) ? (crankAngle as number) : 0) : held
  const goal = React.useCallback((clock: number) => crossTrainerCrank(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    // Fast enough to keep up with its own goal, or the crank lags a revolution
    // behind and the pedal arms stop matching the wheel.
    rate: Math.max(260, Math.abs(speed) * 900),
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const turn = wrap360(motion.value)

  const geometry: TrainerGeometry = React.useMemo(
    () => ({
      ...defaultTrainerGeometry,
      crank: Math.abs(Number.isFinite(crank) ? crank : defaultTrainerGeometry.crank),
      coupler: Math.abs(Number.isFinite(coupler) ? coupler : defaultTrainerGeometry.coupler),
      padAlong: Number.isFinite(padAlong) ? padAlong : defaultTrainerGeometry.padAlong,
    }),
    [crank, coupler, padAlong],
  )

  // The path and its stride belong to the linkage, not to this frame, so they
  // are solved once per geometry rather than once per frame.
  const track = React.useMemo(() => trainerFootPath(geometry, 72), [geometry])
  const near = solveTrainer(turn, geometry)
  const far = solveTrainer(turn + 180, geometry)

  const camera = robotCamera(view)
  const frame = fitFrame(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT).transform
  const { point: to, path: line, solid, box, bar, disc } = elevationDraft(camera, "profile")

  const apply = React.useCallback(
    (next: number) => {
      setHeld(next)
      onCrankAngleChange?.(wrap360(next))
    },
    [onCrankAngleChange],
  )
  // The pointer's bearing about the crank centre is the crank angle: grabbing
  // the machine turns the wheel by hand.
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => {
        const hub = crankHub(view)
        const x = unit.x * VIEW_WIDTH - hub.x
        const y = unit.y * VIEW_HEIGHT - hub.y
        // Dead zone at the hub, where a bearing is all noise.
        if (Math.hypot(x, y) < 4) return
        // Screen y runs down, so the bearing is negated to come out as a
        // counter-clockwise crank angle like everything else in the set.
        apply(wrap360(toDegrees(Math.atan2(-y, x))))
      },
      [apply, view],
    ),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  /* ------------------------------------------------ the linkage, in place */

  const at = React.useCallback(
    (point: Vec2): Vec2 => ({ x: CRANK.x + point.x, y: CRANK.y + point.y }),
    [],
  )
  const mast = at(near.rockerPivot)
  const sides = [
    { pose: near, depth: PEDAL_TRACK, key: "near" },
    { pose: far, depth: -PEDAL_TRACK, key: "far" },
  ]
  const path = track.path.map(at)

  const stride = Math.round(track.stride * 10) / 10
  const rise = Math.round(track.rise * 10) / 10

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Cross trainer, crank at ${px(turn)} degrees, stride ${stride} by ${rise} off a crank of ${px(geometry.crank)}, ${viewNames[view] ?? viewNames.profile}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 360 : undefined}
      aria-valuenow={interactive ? px(turn) : undefined}
      aria-valuetext={interactive ? `${px(turn)} degrees, stride ${stride}` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 6, 30)
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
              d={solid([{ x: -88, y: 0 }, { x: 116, y: 0 }], 36)}
              fill={palette.dark}
              opacity={0.12}
            />
            <path
              d={line([{ x: -88, y: 0 }, { x: 116, y: 0 }])}
              fill="none"
              stroke={palette.dark}
              strokeWidth={1}
              opacity={0.5}
            />
          </>
        )}

        <g data-frame>
          <path d={box(-86, 0, 114, BASE_Y, 32)} {...cast} />
          {/* The shroud the crank runs inside, and the mast the arms hang off. */}
          <path d={bar({ x: CRANK.x, y: BASE_Y }, CRANK, 13, 15)} {...shell} />
          <path d={bar({ x: mast.x, y: BASE_Y }, mast, 7, 9)} {...shell} />
          <path d={box(mast.x - 12, mast.y + 6, mast.x + 12, mast.y + 20, 10)} {...cast} />
        </g>

        {/* The path the footpad draws. Solved over a whole turn, not traced. */}
        {showPath && (
          <path
            data-foot-path
            data-stride={px(track.stride)}
            d={line(path, 0, true)}
            fill="none"
            stroke={palette.glow}
            strokeWidth={1.2}
            strokeDasharray="4 3"
            opacity={0.5}
          />
        )}

        {/* The flywheel on the crank shaft. Drawn, not spun. */}
        <g data-flywheel>
          <path d={disc(CRANK, geometry.crank + 10, 4, -6)} {...machined} />
          <path d={disc(CRANK, geometry.crank - 4, 4.6, -6)} {...cast} />
          {[0, 60, 120].map((spoke) => {
            const radians = ((turn + spoke) * Math.PI) / 180
            const reach = geometry.crank + 6
            return (
              <path
                key={spoke}
                d={line(
                  [
                    { x: CRANK.x - Math.cos(radians) * reach, y: CRANK.y - Math.sin(radians) * reach },
                    { x: CRANK.x + Math.cos(radians) * reach, y: CRANK.y + Math.sin(radians) * reach },
                  ],
                  -10,
                )}
                fill="none"
                stroke={palette.metal}
                strokeWidth={1.4}
                opacity={0.8}
              />
            )
          })}
          <path d={disc(CRANK, 7, 6, -6)} {...cast} />
        </g>

        {/* Both sides of the linkage, half a revolution apart. */}
        {sides.map(({ pose, depth, key }) => {
          const pin = at(pose.crankPin)
          const couplerPin = at(pose.couplerPin)
          const foot = at(pose.foot)
          const grip = at(pose.grip)
          const dim = key === "far" ? 0.55 : 1
          return (
            <g key={key} data-side={key} opacity={dim}>
              {/* Swing arm: the rocker, carried on past its pivot to the grip. */}
              <g data-swing-arm>
                <path d={bar(grip, couplerPin, 3.4, 3.4, depth * 0.7)} {...machined} />
                <path d={disc(grip, 5.5, 5, depth * 0.7)} {...shell} />
                <path d={disc(grip, 2.2, 6, depth * 0.7)} fill={palette.accent} stroke="none" />
                <path d={disc(mast, 5, 5, depth * 0.7)} {...cast} />
              </g>

              {/* Pedal arm: the coupler, with the footpad rigid on it. */}
              <g data-pedal-arm>
                <path d={bar(pin, foot, 3.6, 3.6, depth)} {...machined} />
                <path d={disc(pin, 4.4, 3.4, depth)} {...cast} />
                <path d={disc(couplerPin, 4, 3.4, depth)} {...cast} />
              </g>

              <g data-footpad data-foot-x={px(pose.foot.x)}>
                <path
                  d={bar(
                    { x: foot.x - 15, y: foot.y + 3 },
                    { x: foot.x + 15, y: foot.y + 3 },
                    4,
                    9,
                    depth,
                  )}
                  {...shell}
                />
              </g>

              {/* The crank throw, so the two sides visibly oppose each other. */}
              <path d={bar(CRANK, pin, 3, 3, depth * 0.45)} {...cast} />
            </g>
          )
        })}

        {variant === "blueprint" && (
          <text
            x={px(to({ x: 52, y: 78 }).x)}
            y={px(to({ x: 52, y: 78 }).y)}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize={7}
            fill={palette.foreground}
          >
            {`stride ${stride}`}
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

export { CrossTrainer }
