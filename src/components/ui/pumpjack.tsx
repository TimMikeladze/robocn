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
 * Nothing here is dynamics: no fluid, no rod load, no torque, no counterbalance
 * calculation. `balance` changes where the mass is drawn, not what the linkage
 * does.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { toRadians, type Vec2 } from "@/lib/robocn/kinematics"
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

export type PumpjackBehavior = "pump" | "slow" | "static"
/** Where the counterbalance mass sits — the three arrangements that exist. */
export type PumpjackBalance = "crank" | "beam" | "air"

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

const ENVELOPE = boxCorners({ x: -30, y: 0, z: -236 }, { x: 30, y: 176, z: 4 })

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
  const controlled = crankAngle !== undefined

  const camera = robotCamera(view)
  const frame = fitFrame(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
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
    animate: animate && !controlled && behavior !== "static",
  })
  const turn = wrap360(motion.value)

  const apply = React.useCallback(
    (next: number) => {
      setHeld(next)
      onCrankAngleChange?.(wrap360(next))
    },
    [onCrankAngleChange],
  )

  // The pointer's bearing about the crank centre is the crank angle: grabbing
  // it turns the gearbox by hand. The hub is recomputed from the camera inside
  // the handler, so the only thing it closes over is the view.
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => {
        const hub = crankHub(view)
        const dx = unit.x * VIEW_WIDTH - hub.x
        const dy = unit.y * VIEW_HEIGHT - hub.y
        if (Math.hypot(dx, dy) < 4) return
        apply((Math.atan2(-dy, dx) * 180) / Math.PI)
      },
      [apply, view],
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

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Beam pump, crank at ${readout} degrees, carrier bar at ${px(carrierY)} units, ${viewNames[view] ?? viewNames.profile}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 360 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `crank at ${readout} degrees` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
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

      <g data-view={view} transform={frame.transform || undefined}>
        {showGround && (
          <>
            <path data-ground d={solid([{ x: -4, y: 0 }, { x: 236, y: 0 }], 30)} fill={palette.dark} opacity={0.12} />
            <path d={line([{ x: -4, y: 0 }, { x: 236, y: 0 }])} fill="none" stroke={palette.dark} strokeWidth={1} opacity={0.5} />
          </>
        )}

        {/* Skid: everything above the grade bolts to it. */}
        <path data-skid d={box(76, 0, 232, 11, 22)} {...cast} />

        {/* Prime mover and belt guard, outboard of the gearbox. */}
        <path d={box(198, 11, 228, 34, 14)} {...machined} />
        <path d={disc({ x: 210, y: 23 }, 7, 3, 16)} {...cast} />
        <path d={box(176, 15, 200, 32, 4, 12)} {...cast} fillOpacity={0.4} />

        {/* Gearbox. The crank runs on its output shaft, outboard again. */}
        <path data-gearbox d={box(140, 8, 188, 52, 18)} {...shell} />
        <path d={box(146, 52, 182, 58, 16)} {...machined} />
        <path d={line([{ x: 148, y: 18 }, { x: 180, y: 18 }])} fill="none" stroke={palette.dark} strokeWidth={1.4} />
        <path d={line([{ x: 148, y: 40 }, { x: 180, y: 40 }])} fill="none" stroke={palette.dark} strokeWidth={1.4} />

        {/* Samson post: an A-frame with two braces, carrying the saddle bearing. */}
        <g data-post>
          <path d={bar({ x: 86, y: 11 }, { x: SADDLE.x - 3, y: SADDLE.y - 4 }, 4, 16)} {...shell} />
          <path d={bar({ x: 126, y: 11 }, { x: SADDLE.x + 3, y: SADDLE.y - 4 }, 4, 16)} {...shell} />
          <path d={bar({ x: 92, y: 52 }, { x: 120, y: 52 }, 2.4, 14)} {...machined} />
          <path d={bar({ x: 96, y: 86 }, { x: 116, y: 86 }, 2.2, 14)} {...machined} />
        </g>

        {/* Walking beam and horsehead, on the saddle bearing. */}
        <g data-beam data-angle={px(beamAngle)}>
          <path d={bar(beamHead, tailBearing, 7, 9)} {...shell} />
          <path d={bar(rigidPoint(SADDLE, beamAngle, -24), rigidPoint(SADDLE, beamAngle, 36), 3, 10)} {...machined} />
          <path data-horsehead d={solid([...headFace, ...headBack], 9)} {...shell} />
          <path d={line(headFace, 9)} fill="none" stroke={palette.dark} strokeWidth={1.2} opacity={0.8} />
        </g>
        <path d={disc(SADDLE, 9, 12)} {...cast} />
        <path d={disc(SADDLE, 3.4, 13)} {...machined} />

        {/* Bridle, carrier bar, polished rod. */}
        <g data-rod data-position={px(carrierY)}>
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

        {/* Crank, pitman and counterbalance: one set each side of the gearbox. */}
        {[-CRANK_LATERAL, CRANK_LATERAL].map((offset) => (
          <g key={offset} data-crank data-side={offset < 0 ? "left" : "right"}>
            {balance === "crank" && (
              <path
                data-counterweight
                d={bar(rigidPoint(CRANK_PIVOT, turn + 180, 14), rigidPoint(CRANK_PIVOT, turn + 180, 28), 10, 6, offset)}
                {...shell}
              />
            )}
            <path d={bar(rigidPoint(CRANK_PIVOT, turn + 180, 30), crankPin, 5, 3, offset)} {...machined} />
            <path data-pitman d={bar(crankPin, tailBearing, 3.4, 3, offset)} {...machined} />
            <path d={disc(crankPin, 3.4, 4, offset)} {...cast} />
          </g>
        ))}
        <path d={disc(CRANK_PIVOT, 8, CRANK_LATERAL + 6)} {...cast} />

        {balance === "beam" && (
          <path
            data-counterweight
            d={bar(rigidPoint(SADDLE, beamAngle, BEAM_ARM - 6), rigidPoint(SADDLE, beamAngle, BEAM_ARM + 14), 12, 11)}
            {...shell}
          />
        )}
        {balance === "air" && (
          <g data-counterweight>
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
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  if (behavior === "slow") {
    const whole = Math.floor(clock)
    return whole * 720 + Math.min((clock - whole) / 0.6, 1) * 720
  }
  return clock * 360
}

/** Carrier-bar height for a crank angle: the stroke, solved through the loop. */
export function pumpjackCarrier(crankAngle: number) {
  const pose = solveFourBar(crankAngle, GEOMETRY, { branch: "down" })
  return CARRIER_REST - HEAD_RADIUS * toRadians(signed(pose.rockerAngle))
}

export { Pumpjack }
