"use client"

/**
 * blocking-sled — the training machine that pushes back.
 *
 * Each pad hangs on an arm with a return spring, and where the arm sits is a
 * static equilibrium, not a tween: the load's moment about the pivot falls off
 * as the cosine of the angle while the spring's climbs linearly, so there is
 * exactly one crossing and `sledDeflection` bisects for it. That is why the
 * first few degrees are cheap and the last few are not — the pad is running
 * out of leverage at the same moment the spring is winding up.
 *
 * The frame is the other half. Nothing moves at all until the drive beats the
 * static friction under the skids; past that, the surplus is what accelerates
 * it, and the readout says which side of that threshold the machine is on.
 *
 * Modelled once in the profile elevation and pushed through `robotCamera`, so
 * the row of pads foreshortens from a raised camera rather than being redrawn.
 * No impact, no impulse, no dynamics beyond that threshold: the deflection is
 * a static balance, and the slide is a constant acceleration.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { defaultSledArm, sledDeflection, sledSlide } from "@/lib/robocn/gridiron"
import { clamp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
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

export type SledBehavior = "drive" | "hit" | "recoil" | "idle" | "static"

const VIEW_WIDTH = 250
const VIEW_HEIGHT = 176
const NATIVE_VIEW: RobotView = "iso"
const ENVELOPE = boxCorners({ x: -62, y: 0, z: -74 }, { x: 62, y: 88, z: 46 })

/** Drawing frame: `x` toward the pads, `y` up from the turf. */
const PIVOT: Vec2 = { x: -4, y: 46 }
const ARM = defaultSledArm.arm
/** Where the arm points with no load on it, in degrees from the drawing's x. */
const REST = -40
const PAD_HALF = 12
const SKID = { back: -42, front: 30, top: 7 }
/** Full load at `load = 1`, in the same units `sledDeflection` takes. */
const FULL_LOAD = 150
/** Drawing units the sled can skid before the frame is re-cocked. */
const TRAVEL = 34

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const wrap = (value: number) => (Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0)

/**
 * The load on the pads at clock time `t`, 0 to 1, as a pure function of the
 * clock. `hit` is one strike and a release; `drive` leans on it and stays.
 */
export function sledLoad(behavior: SledBehavior, t: number): number {
  const cycle = wrap(t)
  switch (behavior) {
    case "drive":
      // Hit it and keep driving: up fast, then held with the machine working.
      return cycle < 0.2 ? cycle / 0.2 : 0.82 + Math.sin(2 * Math.PI * cycle * 2) * 0.12
    case "hit":
      // One strike: everything at once, then the spring takes it back.
      return cycle < 0.12 ? cycle / 0.12 : Math.max(0, 1 - (cycle - 0.12) / 0.5)
    case "recoil":
      // A pad already loaded, let go, ringing back through its own spring.
      return Math.max(0, Math.exp(-cycle * 3.4) * Math.cos(2 * Math.PI * cycle * 2.4))
    case "idle":
      return 0.04 + Math.sin(2 * Math.PI * cycle) * 0.03
    default:
      return 0
  }
}

export interface BlockingSledProps
  extends Omit<React.ComponentProps<"svg">, "color" | "height">,
    RobotPaletteProps {
  /** Controlled load on the pads, 0 to 1. Supplying it stops the loop. */
  load?: number
  /** What the machine does when `load` is not supplied. */
  behavior?: SledBehavior
  /** How many pads the frame carries. */
  pads?: number
  /** Return spring rate, torque per radian. Stiffer gives less ground. */
  stiffness?: number
  /** What the frame weighs, which is what has to be beaten to move it. */
  weight?: number
  /** Static friction under the skids. */
  friction?: number
  /** Where the camera stands. One machine, four projections. */
  view?: RobotView
  showGround?: boolean
  /** Cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag across to lean on it; let go and the springs take it back. */
  interactive?: boolean
  onLoadChange?: (load: number) => void
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function BlockingSled({
  load,
  behavior = "drive",
  pads = 3,
  stiffness = defaultSledArm.stiffness,
  weight = 220,
  friction = 0.62,
  view = NATIVE_VIEW,
  showGround = true,
  speed = 0.45,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onLoadChange,
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
  ...props
}: BlockingSledProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const controlled = load !== undefined
  const hold = controlled ? (Number.isFinite(load) ? clamp(load!, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => sledLoad(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    // Springs return fast; the rate is what keeps a release from teleporting.
    rate: 2.6,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const drive = clamp(motion.value, 0, 1)

  const count = Math.max(1, Math.min(5, Math.round(Number.isFinite(pads) ? pads : 3)))
  const spring = Math.max(60, Number.isFinite(stiffness) ? stiffness : defaultSledArm.stiffness)
  const mass = Math.max(1, Number.isFinite(weight) ? weight : 220)
  const mu = clamp(Number.isFinite(friction) ? friction : 0.62, 0, 2)

  // One number in: the pad angle each arm settles at, and whether the frame
  // under them has any business staying where it is.
  const perPad = (drive * FULL_LOAD * count) / count
  const deflection = sledDeflection(perPad, { arm: ARM, stiffness: spring, preload: defaultSledArm.preload })
  const skid = sledSlide(drive * FULL_LOAD * count, { weight: mass, friction: mu, mass: mass / 60 })
  // Constant acceleration over the part of the cycle the drive has been on.
  const travelled = clamp(skid.acceleration * 0.06, 0, TRAVEL)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = clamp(next, 0, 1)
      setHeld(bounded)
      onLoadChange?.(bounded)
    },
    [onLoadChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(1 - unit.x), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  /* ---------------------------------------------------------------------- */

  const camera = robotCamera(view)
  const frame = fitFrame(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT - 24, 10, 1.1)
  const { point: to, path: line, box, bar, disc } = elevationDraft(camera, "profile")

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const plate = robotSurface("shell", variant, palette, 1.4)

  const spread = count === 1 ? [0] : Array.from({ length: count }, (_, index) => (index - (count - 1) / 2) * 24)
  const armAngle = REST + deflection
  const tip = (at: number): Vec2 => ({
    x: PIVOT.x + Math.cos(toRadians(at)) * ARM,
    y: PIVOT.y + Math.sin(toRadians(at)) * ARM,
  })
  const padCentre = tip(armAngle)
  const restCentre = tip(REST)

  /** The return spring: a real zigzag between two points, its coils fixed. */
  const coil = (a: Vec2, b: Vec2, turns = 6) => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.hypot(dx, dy) || 1
    const ux = dx / length
    const uy = dy / length
    return Array.from({ length: turns * 2 + 3 }, (_, index) => {
      const t = index / (turns * 2 + 2)
      const side = index === 0 || index === turns * 2 + 2 ? 0 : index % 2 === 0 ? 3 : -3
      return {
        x: a.x + dx * t - uy * side,
        y: a.y + dy * t + ux * side,
      }
    })
  }
  // The spring pulls between a lug inside the frame and a point along the arm,
  // so it lengthens as the pad gives — which is the whole reason it resists.
  const springTop: Vec2 = { x: PIVOT.x - 8, y: PIVOT.y - 16 }
  const springFoot: Vec2 = {
    x: PIVOT.x + Math.cos(toRadians(armAngle)) * ARM * 0.62,
    y: PIVOT.y + Math.sin(toRadians(armAngle)) * ARM * 0.62,
  }
  /** Across the arm: the pad face stands square to it, and tips back with it. */
  const face = {
    x: -Math.sin(toRadians(armAngle)),
    y: Math.cos(toRadians(armAngle)),
  }

  const shift = (point: Vec2): Vec2 => ({ x: point.x - travelled, y: point.y })
  const readout = Math.round(deflection)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Blocking sled with ${count} ${count === 1 ? "pad" : "pads"}, ${readout} degrees of deflection, ${skid.sliding ? "frame sliding" : "frame held by friction"}, ${viewNames[view] ?? viewNames.iso}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? Math.round(drive * 100) : undefined}
      aria-valuetext={interactive ? `${Math.round(drive * 100)}% load, ${readout} degrees` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.06, 0.2)
        if (delta !== 0) apply(drive + delta)
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
      data-view={view}
      {...props}
    >
      <g data-machine transform={frame.transform}>
        {showGround && (
          <ellipse
            data-ground
            cx={px(to({ x: 0, y: 0 }, 0).x)}
            cy={px(to({ x: 0, y: 0 }, 0).y)}
            rx={58}
            ry={px(6 + 6 * camera.flatten)}
            fill={palette.dark}
            opacity={0.14}
          />
        )}

        {/* Where the frame started, so a skid reads as travel rather than drift. */}
        <path
          data-mark
          d={line(
            [
              { x: SKID.back, y: 0.6 },
              { x: SKID.front, y: 0.6 },
            ],
            36,
          )}
          fill="none"
          stroke={palette.grid}
          strokeWidth={0.6}
          strokeDasharray="3 3"
          opacity={0.6}
        />

        <g data-frame transform="">
          {/* Two skids, and the beam across them the arms hang off. */}
          {[-30, 30].map((depth) => (
            <path
              key={depth}
              data-skid={depth}
              d={box(
                shift({ x: SKID.back, y: 0 }).x,
                0,
                shift({ x: SKID.front, y: 0 }).x,
                SKID.top,
                5,
                depth,
              )}
              {...machined}
            />
          ))}
          <path
            d={box(
              shift({ x: -14, y: 0 }).x,
              SKID.top - 1,
              shift({ x: 6, y: 0 }).x,
              PIVOT.y + 6,
              34,
            )}
            {...shell}
          />
          {/* Ballast: the reason the frame is worth moving at all. */}
          <path
            data-ballast
            d={box(
              shift({ x: -36, y: 0 }).x,
              SKID.top,
              shift({ x: -16, y: 0 }).x,
              SKID.top + 14,
              28,
            )}
            {...cast}
          />
        </g>

        {spread.map((depth, index) => (
          <g key={index} data-pad={index}>
            <path
              data-spring={index}
              d={line(coil(shift(springTop), shift(springFoot)), depth)}
              fill="none"
              stroke={variant === "wire" ? palette.grid : palette.metal}
              strokeWidth={1.1}
              strokeLinejoin="round"
            />
            <path
              data-arm={index}
              d={bar(shift(PIVOT), shift(padCentre), 3.4, 3.4, depth)}
              {...machined}
            />
            <path
              data-face={index}
              d={bar(
                shift({
                  x: padCentre.x + face.x * PAD_HALF,
                  y: padCentre.y + face.y * PAD_HALF,
                }),
                shift({
                  x: padCentre.x - face.x * PAD_HALF,
                  y: padCentre.y - face.y * PAD_HALF,
                }),
                5,
                10,
                depth,
              )}
              {...plate}
            />
            <path
              d={disc(shift(PIVOT), 3.6, 4.2, depth, 12)}
              {...cast}
            />
            {/* How far this pad has given, marked against where it rests. */}
            {deflection > 0.5 && (
              <path
                data-give={index}
                d={line([shift(restCentre), shift(padCentre)], depth)}
                fill="none"
                stroke={palette.accent}
                strokeWidth={1}
                strokeDasharray="2 2"
                opacity={0.7}
              />
            )}
          </g>
        ))}

        {skid.sliding && (
          <path
            data-slide
            d={line(
              [
                { x: SKID.back - travelled, y: 3 },
                { x: SKID.back, y: 3 },
              ],
              0,
            )}
            fill="none"
            stroke={palette.accent}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        )}
      </g>

      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 13} fontSize={5}>
          {`${behavior.toUpperCase()} / ${Math.round(drive * 100)}% / ${readout}° GIVE / ${skid.sliding ? "SLIDING" : "HELD"}`}
        </text>
        {label && (
          <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 4} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

export { BlockingSled }
