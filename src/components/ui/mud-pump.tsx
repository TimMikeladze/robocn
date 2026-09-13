"use client"

/**
 * mud-pump — three slider-cranks on one shaft, 120 degrees apart.
 *
 * The only multi-cylinder machine in the set. Each cylinder is solved by
 * `solveSliderCrank` at its own throw angle, so the crossheads really are a
 * third of a revolution apart and the pistons really do reach the dead centres
 * the rod and crank lengths put them at.
 *
 * The discharge readout is the *kinematic* sum of the piston velocities —
 * differenced from the solved slider positions and summed over the cylinders
 * that are on their discharge stroke. That is why a triplex reads steadier than
 * a duplex. It is not a hydraulic model: no pressure, flow rate, valve timing,
 * slip, compressibility or fluid of any kind is computed here.
 */

import * as React from "react"

import { clamp, type Vec2 } from "@/lib/robocn/kinematics"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { rigidPoint, solveSliderCrank } from "@/lib/robocn/linkage"
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

export type MudPumpBehavior = "stroke" | "surge" | "static"
/** Simplex, duplex, triplex: how many throws are on the shaft. */
export type MudPumpCylinders = 1 | 2 | 3

const VIEW_WIDTH = 280
const VIEW_HEIGHT = 200
const NATIVE_VIEW: RobotView = "iso"

const SHAFT: Vec2 = { x: 126, y: 58 }
const CRANK = 15
const ROD = 62
/** Crosshead to piston face. */
const PISTON_ARM = 42
const SPACING = 38

const ENVELOPE = boxCorners({ x: -62, y: 0, z: -272 }, { x: 62, y: 136, z: -2 })

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const wrap360 = (value: number) =>
  Number.isFinite(value) ? ((value % 360) + 360) % 360 : 0

/** Throw angles for a shaft with `count` cranks, evenly spaced. */
const throws = (count: number) =>
  Array.from({ length: count }, (_, index) => (index * 360) / count)

export interface MudPumpProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled crankshaft angle in degrees. Supplying it stops the loop. */
  crankAngle?: number
  onCrankAngleChange?: (angle: number) => void
  behavior?: MudPumpBehavior
  cylinders?: MudPumpCylinders
  /** Show the manifolds and the discharge the pistons add up to. */
  showFlow?: boolean
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

function MudPump({
  crankAngle,
  onCrankAngleChange,
  behavior = "stroke",
  cylinders = 3,
  showFlow = true,
  showGround = true,
  view = NATIVE_VIEW,
  speed = 0.45,
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
}: MudPumpProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = crankAngle !== undefined
  const count = ([1, 2, 3] as const).includes(cylinders) ? cylinders : 3

  const hold = controlled ? (Number.isFinite(crankAngle) ? (crankAngle as number) : 0) : held
  const goal = React.useCallback((clock: number) => mudPumpCrank(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: Math.max(240, Math.abs(speed) * 900),
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const turn = wrap360(motion.value)

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const { point: to, path: line, solid, box, bar, disc } = elevationDraft(camera, "profile")

  const apply = React.useCallback(
    (next: number) => {
      setHeld(next)
      onCrankAngleChange?.(wrap360(next))
    },
    [onCrankAngleChange],
  )
  const hub = to(SHAFT)
  const hubX = px(hub.x)
  const hubY = px(hub.y)
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => {
        const dx = unit.x * VIEW_WIDTH - hubX
        const dy = unit.y * VIEW_HEIGHT - hubY
        if (Math.hypot(dx, dy) < 4) return
        apply((Math.atan2(-dy, dx) * 180) / Math.PI)
      },
      [apply, hubX, hubY],
    ),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const offsets = throws(count).map((_, index) => (index - (count - 1) / 2) * SPACING)
  const units = throws(count).map((crank, index) => {
    const pose = solveSliderCrank(turn + crank, { crank: CRANK, rod: ROD })
    return {
      index,
      offset: offsets[index],
      pin: { x: SHAFT.x + pose.pin.x, y: SHAFT.y + pose.pin.y },
      wrist: { x: SHAFT.x + pose.wrist.x, y: SHAFT.y + pose.wrist.y },
    }
  })
  const flow = mudPumpFlow(turn, count)
  const readout = px(turn)
  // Back to front, so the near cylinder covers the ones behind it.
  const order = [...units].sort((a, b) => a.offset - b.offset)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Mud pump, ${count} ${count === 1 ? "cylinder" : "cylinders"}, crankshaft at ${readout} degrees, ${viewNames[view] ?? viewNames.iso}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 360 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `crankshaft at ${readout} degrees` : undefined}
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

      <g data-view={view} transform={frame || undefined}>
        {showGround && (
          <path data-ground d={solid([{ x: 2, y: 0 }, { x: 270, y: 0 }], 60)} fill={palette.dark} opacity={0.12} />
        )}

        <path data-skid d={box(4, 0, 268, 12, 56)} {...cast} />

        {/* Power end: the case over the shaft, and the sheave on its end. */}
        <path d={box(62, 12, 150, 104, 50)} {...shell} />
        <path d={line([{ x: 72, y: 24 }, { x: 140, y: 24 }])} fill="none" stroke={palette.dark} strokeWidth={1.4} />
        <path d={line([{ x: 72, y: 92 }, { x: 140, y: 92 }])} fill="none" stroke={palette.dark} strokeWidth={1.4} />
        <path d={disc(SHAFT, 26, 5, -54)} {...machined} />
        <path d={disc(SHAFT, 6, 6, -54)} {...cast} />

        <g data-crankshaft data-angle={readout}>
          {order.map((unit) => (
            <g key={unit.index} data-cylinder={unit.index}>
              {/* Crank web, rod and crosshead, all solved at this throw. */}
              <path d={bar(SHAFT, unit.pin, 5, 5, unit.offset)} {...machined} />
              <path data-rod d={bar(unit.pin, unit.wrist, 3.4, 4, unit.offset)} {...machined} />
              <path d={disc(unit.pin, 4, 6, unit.offset)} {...cast} />
              <path d={box(152, 42, 206, 74, 14, unit.offset)} {...shell} fillOpacity={0.35} />
              <path d={box(unit.wrist.x - 9, unit.wrist.y - 10, unit.wrist.x + 9, unit.wrist.y + 10, 10, unit.offset)} {...cast} />

              {/* Fluid end: liner, piston, and the charge behind it. */}
              <path d={box(210, 40, 262, 78, 15, unit.offset)} {...shell} />
              <path d={box(212, 48, 258, 70, 12, unit.offset)} fill={palette.dark} opacity={0.5} />
              <path
                data-charge
                d={box(unit.wrist.x + PISTON_ARM, 48, 258, 70, 11, unit.offset)}
                fill={palette.accent}
                opacity={0.55}
              />
              <path d={bar(unit.wrist, { x: unit.wrist.x + PISTON_ARM, y: unit.wrist.y }, 2.6, 2.6, unit.offset)} {...machined} />
              <path
                data-piston
                data-position={px(unit.wrist.x + PISTON_ARM)}
                d={box(unit.wrist.x + PISTON_ARM - 5, 47, unit.wrist.x + PISTON_ARM + 5, 71, 12, unit.offset)}
                {...machined}
              />
              <path d={disc({ x: 236, y: 34 }, 7, 9, unit.offset)} {...cast} />
              <path d={disc({ x: 236, y: 84 }, 7, 9, unit.offset)} {...cast} />
            </g>
          ))}
        </g>

        {showFlow && (
          <g data-manifolds>
            <path d={box(226, 14, 248, 28, (count * SPACING) / 2 + 8)} {...cast} />
            <path d={box(226, 90, 248, 104, (count * SPACING) / 2 + 8)} {...cast} />
            <path d={disc({ x: 237, y: 118 }, 14, 13)} {...shell} />
            <path
              data-discharge
              data-flow={px(flow)}
              d={line([{ x: 248, y: 97 }, { x: 250 + flow * 18, y: 97 }])}
              fill="none"
              stroke={palette.accent}
              strokeWidth={2 + flow * 4}
              strokeLinecap="round"
            />
          </g>
        )}

        {variant === "blueprint" && (
          <text
            x={px(to({ x: 200, y: 122 }).x)}
            y={px(to({ x: 200, y: 122 }).y)}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize={6}
            fill={palette.foreground}
          >
            {`Q ${px(flow)}`}
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

/**
 * Crankshaft angle at `clock`, unwrapped so the easing never crosses a seam.
 * `surge` is the same revolution taken unevenly — a pump loading and unloading
 * against what it is pushing into, drawn rather than simulated.
 */
export function mudPumpCrank(behavior: MudPumpBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  if (behavior === "surge") return clock * 360 + Math.sin(clock * Math.PI * 2) * 40
  return clock * 360
}

/**
 * The kinematic discharge at a crankshaft angle: piston velocities, differenced
 * from the solved slider positions, summed over the cylinders on their
 * discharge stroke, and scaled so one cylinder peaks at 1.
 *
 * This is geometry. Nothing here computes pressure, flow rate, valve timing,
 * slip or compressibility.
 */
export function mudPumpFlow(crankAngle: number, cylinders: number) {
  const count = Math.max(1, Math.min(3, Math.round(Number.isFinite(cylinders) ? cylinders : 3)))
  const base = Number.isFinite(crankAngle) ? crankAngle : 0
  const step = 0.5
  let total = 0
  for (const crank of throws(count)) {
    const ahead = solveSliderCrank(base + crank + step, { crank: CRANK, rod: ROD }).slider
    const behind = solveSliderCrank(base + crank - step, { crank: CRANK, rod: ROD }).slider
    const velocity = ((ahead - behind) / (2 * step)) * (180 / Math.PI)
    if (velocity > 0) total += velocity
  }
  return clamp(total / CRANK, 0, 3)
}

/** Where a crank pin stands for one throw — exported so a test can place it. */
export function mudPumpPin(crankAngle: number, index: number, cylinders: number) {
  const count = Math.max(1, Math.min(3, Math.round(cylinders)))
  return rigidPoint(SHAFT, crankAngle + throws(count)[index % count], CRANK)
}

export { MudPump }
