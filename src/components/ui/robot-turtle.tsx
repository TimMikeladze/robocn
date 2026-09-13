"use client"

/**
 * robot-turtle — a plodder that can put itself away.
 *
 * `solveHexapod` always clamped to four legs and nothing had ever asked for
 * four; a slow wave gait at that count is a plod. What is its own is the
 * retraction: one number pulls the head, the tail and every foot in under the
 * carapace, and because the shell is drawn *after* the limbs, retracting is
 * geometry rather than a fade. The scutes are generated from the shell's own
 * outline, so a resized carapace re-plates itself. Click and it withdraws.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, lerp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import { solveHexapod, type HexapodGait, type HexapodLeg } from "@/lib/robocn/hexapod"
import {
  capsulePath,
  circleFootprint,
  extrudedPath,
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

export type TurtleBehavior = "plod" | "bask" | "retract" | "static"

/** Drawn from straight above; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "plan"
/** How much of a raised joint's height shows as a screen offset in plan view. */
const RELIEF = 0.4
/** Carapace half-width and half-length. */
const SHELL = { beam: 47, length: 57 } as const

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RobotTurtleProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Where the camera stands. One plodder, four projections. */
  view?: RobotView
  /** What it does when `phase` is not supplied. */
  behavior?: TurtleBehavior
  /** Footfall pattern. Omit and `behavior` picks one. */
  gait?: HexapodGait
  /** Controlled cycle fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Gait cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a line of them breaks step. */
  offset?: number
  /** Normalized body clearance, foot travel, and swing height, each 0–1. */
  height?: number
  stride?: number
  lift?: number
  /** Travel direction in degrees: 0 walks toward the nose. */
  heading?: number
  /** Retraction, 0 fully out to 1 everything under the shell. Omit and the behavior sets it. */
  retract?: number
  /** Head aim, −1..1. Omit and it follows the pointer. */
  gaze?: number
  /** The head tracks the pointer, and a click pulls everything in. */
  interactive?: boolean
  onRetractChange?: (withdrawn: boolean) => void
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  /** Mark the feet carrying weight. */
  showContacts?: boolean
  label?: string
}

function RobotTurtle({
  behavior = "plod", gait, phase, view = NATIVE_VIEW, speed = 0.45, animate = true, paused = false, offset = 0,
  height = 0.35, stride = 0.55, lift = 0.4, heading, retract, gaze,
  interactive = true, onRetractChange,
  size = "md", variant = "solid", showGround = true, showContacts = false, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerDown, ...props
}: RobotTurtleProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })

  const [withdrawn, setWithdrawn] = React.useState(false)

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && gaze === undefined && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: clamp((unit.x - 0.5) * 2.2, -1, 1),
      y: clamp((0.5 - unit.y) * 2, -1, 1),
    }), []),
  })

  const scripted = turtleBehaviorPose(behavior, clock)
  const inside = finiteClamp(retract ?? (withdrawn ? 1 : scripted.retract), 0, 1, scripted.retract)
  const aim = finiteClamp(gaze ?? pointer.target?.x ?? scripted.gaze, -1, 1, 0)
  const course = Number.isFinite(heading) ? (heading as number) : 0
  const cycle = controlled ? phase : clock * speed * scripted.rate * (1 - inside)

  const pose = solveHexapod({
    legs: 4,
    gait: gait ?? (inside > 0.5 ? "stand" : scripted.gait),
    phase: cycle,
    height: clamp(height + scripted.bob, 0, 1),
    stride,
    lift,
    heading: 0,
    radius: 30,
    fan: 104,
    // Withdrawing pulls the feet in under the shell rather than hiding them.
    spread: lerp(0.92, 0.2, inside),
    femur: 18,
    tibia: 22,
  })

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const ground = camera.plane()
  const headY = lerp(88, 24, inside)
  const tailY = lerp(-86, -42, inside)
  const dome = 20 + 6 * (1 - inside)

  /** A point in the plan drawing at `h` above the ground. */
  const at = (p: { x: number; y: number }, h: number) => camera.project(p.x, h, -p.y)

  function legDrawing(leg: HexapodLeg) {
    const knee = { x: leg.knee.x, y: leg.knee.y - leg.kneeHeight * RELIEF }
    const foot = { x: leg.foot.x, y: leg.foot.y - leg.clearance * RELIEF }
    return (
      <g key={leg.id} data-leg={leg.id} data-side={leg.side} opacity={leg.contact ? 1 : 0.82}>
        <path d={capsulePath(leg.hip, knee, 5.4)} {...machined} />
        <path d={capsulePath(knee, foot, 4.4)} {...shell} />
        <circle cx={px(knee.x)} cy={px(knee.y)} r={3.4} {...cast} />
        {/* Claws on the front of each foot. */}
        <g stroke={palette.dark} strokeWidth={1.4} strokeLinecap="round" fill="none">
          {[-1, 0, 1].map((t) => (
            <path key={t} d={`M ${px(foot.x + t * 3)} ${px(foot.y)} l ${px(t * 1.5)} 5`} />
          ))}
        </g>
        {showContacts && leg.contact && (
          <circle data-contact cx={px(leg.foot.x)} cy={px(leg.foot.y)} r={4.4} fill="none" stroke={palette.accent} strokeWidth={1.1} />
        )}
      </g>
    )
  }

  /** The scute plates, laid out from the carapace's own outline. */
  const scutes = (() => {
    const plates: { key: string; d: string; role: "shell" | "metal" }[] = []
    // Five vertebral plates down the midline.
    for (let index = 0; index < 5; index += 1) {
      const y = 36 - index * 18
      plates.push({
        key: `v${index}`,
        role: "metal",
        d: hexagon(0, y, 14, 10),
      })
    }
    // Four costal plates either side of them.
    for (const side of [-1, 1] as const) {
      for (let index = 0; index < 4; index += 1) {
        const y = 27 - index * 18
        plates.push({
          key: `c${side}${index}`,
          role: "shell",
          d: hexagon(side * 26, y, 12, 9),
        })
      }
    }
    // A marginal ring following the shell edge.
    for (let index = 0; index < 16; index += 1) {
      const angle = (index / 16) * Math.PI * 2
      plates.push({
        key: `m${index}`,
        role: "metal",
        d: hexagon(Math.cos(angle) * (SHELL.beam - 7), Math.sin(angle) * (SHELL.length - 7), 7, 6),
      })
    }
    return plates
  })()

  const state = behavior === "static" ? "still" : inside > 0.5 ? "withdrawn" : behavior === "bask" ? "basking" : "plodding"

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Robot turtle, ${state}, ${viewNames[view] ?? viewNames.plan}`}
      viewBox="0 0 240 230"
      width={width}
      height={px(width * 230 / 240)}
      className={cn("max-w-full select-none", interactive && "cursor-pointer", className)}
      style={{ color: palette.foreground, ...style }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const next = !withdrawn
        setWithdrawn(next)
        onRetractChange?.(next)
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.4}>
          <path d="M 12 114 H 228 M 120 14 V 214" strokeDasharray="2 3" />
          <ellipse cx={120} cy={114} rx={SHELL.beam} ry={SHELL.length} strokeDasharray="3 4" />
        </g>
      )}
      {showGround && <ellipse cx={120} cy={114} rx={96} ry={80} fill={palette.dark} opacity={0.05} />}

      {offAxis && <g data-solids transform="translate(120 114)">
        {pose.legs.map((leg) => (
          <g key={leg.id} data-leg={leg.id} data-side={leg.side}>
            <path d={capsulePath(at(leg.hip, pose.height), at(leg.knee, leg.kneeHeight), 5)} {...machined} />
            <path d={capsulePath(at(leg.knee, leg.kneeHeight), at(leg.foot, leg.clearance), 4)} {...shell} />
          </g>
        ))}
        <path d={capsulePath(at({ x: 0, y: 30 }, pose.height + 8), at({ x: 0, y: headY }, pose.height + 10), 9)} {...machined} />
        <path d={capsulePath(at({ x: 0, y: -40 }, pose.height + 4), at({ x: 0, y: tailY }, pose.height + 2), 4)} {...cast} />
        {/* The carapace is a dome, which only a second camera can show. */}
        <path
          d={extrudedPath(circleFootprint(0, 0, SHELL.beam * 0.82, 16), camera, pose.height + dome, pose.height - 3)}
          {...shell}
        />
      </g>}

      <g
        data-turtle
        data-view={view}
        transform={`translate(120 114) ${ground} scale(1 -1) rotate(${px(-course)})`.replace(/\s+/g, " ")}
      >
        {pose.legs.map(legDrawing)}

        <g data-tail>
          <path d={capsulePath({ x: 0, y: -46 }, { x: px(aim * -3), y: tailY }, px(5 - inside * 1.5))} {...cast} />
        </g>

        <g data-head transform={`translate(0 ${px(headY - 16)}) rotate(${px(-aim * 22 * (1 - inside))})`}>
          <path d={capsulePath({ x: 0, y: -18 }, { x: 0, y: 2 }, 7.5)} {...machined} />
          <path d="M -9 2 Q -10 16 0 19 Q 10 16 9 2 Q 0 -2 -9 2 Z" {...machined} />
          <path d="M -6 15 Q 0 18 6 15" fill="none" stroke={palette.dark} strokeWidth={1} />
          {([-1, 1] as const).map((side) => (
            <g key={side} data-eye={side === 1 ? "right" : "left"}>
              <circle cx={px(side * 5)} cy={9} r={2.8} {...cast} />
              <circle cx={px(side * 5 + aim * 0.9)} cy={9.4} r={1.4} fill={palette.accent} />
            </g>
          ))}
          <g stroke={palette.dark} strokeWidth={0.7} opacity={0.4} fill="none">
            <path d="M -7 -4 H 7 M -6 -10 H 6" />
          </g>
        </g>

        {/* The carapace, drawn last: whatever is retracted goes under it. */}
        <g data-carapace>
          <ellipse cx={0} cy={0} rx={SHELL.beam} ry={SHELL.length} {...cast} />
          <ellipse cx={0} cy={0} rx={px(SHELL.beam - 5)} ry={px(SHELL.length - 5)} {...shell} />
          <g opacity={0.95}>
            {scutes.map((plate, index) => (
              <path
                key={plate.key}
                data-scute={index}
                d={plate.d}
                {...(plate.role === "metal" ? machined : shell)}
                fillOpacity={variant === "solid" ? 0.55 : undefined}
              />
            ))}
          </g>
          <circle cx={0} cy={0} r={4} fill={palette.accent} opacity={0.85} />
          <circle cx={0} cy={0} r={9} fill="none" stroke={palette.glow} strokeWidth={0.9} opacity={0.4} />
        </g>
      </g>

      {label && (
        <text x={120} y={222} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/** A control that has to survive a consumer handing it `NaN`. */
const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback

/** A flat-topped hexagonal plate. */
function hexagon(cx: number, cy: number, rx: number, ry: number) {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = toRadians(index * 60 + 30)
    return `${index ? "L" : "M"} ${px(cx + Math.cos(angle) * rx)} ${px(cy + Math.sin(angle) * ry)}`
  }).join(" ") + " Z"
}

/** What it does with no timeline on it: plod, sit in the sun, or shut up shop. */
export function turtleBehaviorPose(behavior: TurtleBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Feet planted, neck right out, turning slowly to follow the light.
    case "bask":
      return { gait: "stand" as HexapodGait, rate: 0, retract: 0, bob: 0.02 * Math.sin(time * 0.5), gaze: 0.7 * Math.sin(time * 0.22) }
    case "retract":
      return { gait: "stand" as HexapodGait, rate: 0, retract: 1, bob: 0, gaze: 0 }
    case "static":
      return { gait: "stand" as HexapodGait, rate: 0, retract: 0.15, bob: 0, gaze: 0 }
    // One leg at a time, which is what makes it a plod rather than a walk.
    default:
      return {
        gait: "wave" as HexapodGait,
        rate: 1,
        retract: 0.05,
        bob: 0.02 * Math.sin(time * 2.4),
        gaze: 0.35 * Math.sin(time * 0.4),
      }
  }
}

export { RobotTurtle }
