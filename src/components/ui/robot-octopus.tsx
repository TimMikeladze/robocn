"use client"

/**
 * robot-octopus — a mantle and eight arms, in front elevation.
 *
 * The snake is one spine. This is eight, each solved on its own phase, its own
 * length and its own curl, which is the only reason a ring of arms reads as an
 * animal rather than a rosette. The arms are mounted on a *circle* round the
 * mouth, so the ones behind the body draw first and shorter; the elevation can
 * only imply that, and the other three cameras show it. Click and it jets.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, lerp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import { solveSpine } from "@/lib/robocn/spine"
import {
  aboutPoint,
  capsulePath,
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

/** Seconds a poked jet takes to decay. */
const JET = 1.6
/** Radius of the ring the arms are mounted on. */
const CROWN = 19
/** How far the fan spreads either side of straight down, in degrees. */
const FAN = 62
/** How far an arm leans off the vertical, for the off-axis cone. */
const TILT = 58

export type OctopusBehavior = "crawl" | "jet" | "furl" | "static"

/** Drawn face on; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"
const CENTRE = 118
/** Where the arm crown sits in the frame. */
const MOUTH = 96

const fits: Record<RobotView, number> = { plan: 0.7, front: 1, profile: 1, iso: 0.9 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RobotOctopusProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Where the camera stands. One animal, four projections. */
  view?: RobotView
  /** What it does when `phase` is not supplied. */
  behavior?: OctopusBehavior
  /** Controlled cycle fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Arm cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a pair of them break step. */
  offset?: number
  /** Arms round the mouth, 4–10. */
  arms?: number
  /** Links in each arm, 3–24. */
  segments?: number
  /** Arm curl, 0 straight to 1 coiled. Omit and the behavior works them. */
  curl?: number
  /** Mantle contraction, 0 full to 1 squeezed onto the siphon. Omit and the behavior works it. */
  jet?: number
  /** How far the arms gather behind it, 0 fanned to 1 streamed. Omit and the behavior decides. */
  gather?: number
  /** The arms reach toward the pointer, and a click jets. */
  interactive?: boolean
  onJet?: () => void
  size?: RobotSize | number
  variant?: RobotVariant
  /** The seabed underneath. */
  showGround?: boolean
  label?: string
}

/** Arm contour length, in world units. */
const ARM = 104

function RobotOctopus({
  behavior = "crawl", phase, view = NATIVE_VIEW, speed = 0.55, animate = true, paused = false, offset = 0,
  arms = 8, segments = 10, curl, jet, gather,
  interactive = true, onJet,
  size = "md", variant = "solid", showGround = true, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerDown, ...props
}: RobotOctopusProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })

  const [poked, setPoked] = React.useState<number | null>(null)
  const since = poked === null ? Infinity : clock - poked
  const burst = since >= 0 && since < JET ? Math.exp(-since * 2.4) : 0

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: clamp((unit.x - 0.5) * 2.2, -1, 1),
      y: clamp((0.5 - unit.y) * 2, -1, 1),
    }), []),
  })

  const scripted = octopusBehaviorPose(behavior, clock)
  const cycle = controlled ? phase : clock * speed * scripted.rate
  const beat = Number.isFinite(cycle) ? cycle : 0
  const coil = finiteClamp(curl ?? scripted.curl, 0, 1, 0.4)
  const squeeze = finiteClamp(clamp((jet ?? scripted.jet(beat)) + burst * 0.8, 0, 1), 0, 1, 0.1)
  const stream = finiteClamp(clamp((gather ?? scripted.gather) + burst * 0.6, 0, 1), 0, 1, 0)
  const ring = Number.isFinite(arms) ? Math.round(clamp(arms, 4, 10)) : 8

  // Where the pointer is, as a screen bearing, so an arm can tell whether it
  // is the one being reached toward.
  const bearing = pointer.target
    ? (Math.atan2(-pointer.target.y, pointer.target.x) * 180) / Math.PI
    : null

  const limbs = Array.from({ length: ring }, (_, index) => {
      const around = (index / ring) * Math.PI * 2 + Math.PI / ring
      const side = Math.cos(around)
      // Fanned in the elevation, but the fan is the projection of a cone: an
      // arm out to starboard leans right, one at the front comes straight down.
      const fan = 90 - FAN * side
      const aim = lerp(fan, 96, stream)
      const reach = bearing === null ? 0 : Math.cos(toRadians(aim - bearing))
      return {
        index,
        around,
        aim,
        front: Math.sin(around) > 0,
        base: { x: CROWN * side, y: -Math.sin(around) * 4 },
        z: -CROWN * Math.sin(around),
        pose: solveSpine({
          segments,
          length: ARM * lerp(0.82, 1.06, Math.abs(Math.sin(around * 1.5))) * lerp(1, 1.1, Math.max(0, reach)),
          phase: beat - index * 0.09,
          amplitude: 0.2 + 0.34 * (1 - stream),
          waves: 1.15,
          taper: 0.55,
          // Reaching straightens an arm; the rest curl further out of the way.
          turn: clamp((coil * 0.9 - Math.max(0, reach) * 0.7) * (side >= 0 ? 1 : -1), -1, 1),
        }),
      }
    })

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const face = aboutPoint(camera.wall(), CENTRE, MOUTH, fit)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  /** A drawing offset from the mouth, `back` world units away from the camera. */
  const at = (x: number, y: number, back = 0) => camera.project(-x, -y, back)

  const mantleHeight = lerp(94, 74, squeeze)
  const mantleWidth = lerp(34, 26, squeeze)

  /** One arm: the solver's nose is the mount, its body runs out along `aim`. */
  const limb = (arm: (typeof limbs)[number]) => {
    const turn = toRadians(arm.aim)
    const cs = Math.cos(turn)
    const sn = Math.sin(turn)
    // The solver runs its body toward −x; rotate that onto the arm's bearing.
    const place = (p: Vec2) => ({
      x: arm.base.x - p.x * cs - p.y * sn,
      y: arm.base.y - p.x * sn + p.y * cs,
    })
    return (
      <g key={arm.index} data-arm={arm.index} opacity={arm.front ? 1 : 0.55}>
        {arm.pose.joints.slice(0, -1).map((joint, index) => (
          <path
            key={index}
            d={capsulePath(
              place(joint.position),
              place(arm.pose.joints[index + 1].position),
              px(Math.max(1, 6.4 * Math.pow(1 - joint.s, 1.1))),
            )}
            {...(index % 2 === 0 ? shell : machined)}
          />
        ))}
        {/* Suckers down the underside, thinning out toward the tip. */}
        <g fill={palette.dark} opacity={0.5}>
          {arm.pose.joints.slice(1, -1).map((joint, index) => {
            const p = place(joint.position)
            return <circle key={index} cx={px(p.x)} cy={px(p.y)} r={px(Math.max(0.6, 2 * (1 - joint.s)))} />
          })}
        </g>
        <circle
          cx={px(place(arm.pose.tail.position).x)}
          cy={px(place(arm.pose.tail.position).y)}
          r={1.3}
          fill={palette.accent}
          opacity={0.85}
        />
      </g>
    )
  }

  const state = burst > 0.05 ? "jetting" : behavior === "static" ? "still" : behavior === "crawl" ? "crawling" : behavior === "furl" ? "furled" : behavior

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Robot octopus, ${state}, ${ring} arms, ${viewNames[view] ?? viewNames.front}`}
      viewBox="0 0 236 244"
      width={width}
      height={px(width * 244 / 236)}
      className={cn("max-w-full select-none", interactive && "cursor-pointer", className)}
      style={{ color: palette.foreground, ...style }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setPoked(clock)
        onJet?.()
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.4}>
          <path d="M 12 96 H 224 M 118 12 V 226" strokeDasharray="2 3" />
          <ellipse cx={118} cy={96} rx={CROWN} ry={6} strokeDasharray="3 3" />
        </g>
      )}
      {showGround && (
        <g stroke={palette.grid} opacity={0.4} fill="none">
          <path d="M 14 226 H 222" strokeWidth={0.6} strokeDasharray="6 5" />
        </g>
      )}

      {offAxis && <g data-solids transform={`translate(${CENTRE} ${MOUTH}) scale(${fit})`}>
        {/* The mount ring, which the elevation flattens into a line. */}
        <path
          d={`${limbs.map((arm, index) => {
            const p = at(arm.base.x, 0, arm.z)
            return `${index ? "L" : "M"} ${px(p.x)} ${px(p.y)}`
          }).join(" ")} Z`}
          {...machined}
          fillOpacity={variant === "solid" ? 0.3 : undefined}
        />
        {limbs.map((arm) => {
          const lean = toRadians(TILT) * (1 - stream * 0.7)
          const out = Math.sin(lean) * ARM * 0.8
          const down = Math.cos(lean) * ARM * 0.8
          const side = Math.cos(arm.around)
          const back = Math.sin(arm.around)
          const tip = at(arm.base.x + out * side, down, arm.z - out * back)
          return (
            <path
              key={arm.index}
              data-arm={arm.index}
              d={capsulePath(at(arm.base.x, 0, arm.z), tip, 3)}
              {...shell}
            />
          )
        })}
        <path d={capsulePath(at(0, 0, 0), at(0, -mantleHeight, 0), px(mantleWidth * 0.8))} {...shell} />
      </g>}

      <Frame {...frame}>
        <g data-octopus data-view={view} transform={`translate(${CENTRE} ${MOUTH})`}>
          {limbs.filter((arm) => !arm.front).map(limb)}

          <g data-mantle>
            <path
              d={`M ${px(-mantleWidth)} -6 Q ${px(-mantleWidth * 1.12)} ${px(-mantleHeight * 0.72)} 0 ${px(-mantleHeight)} Q ${px(mantleWidth * 1.12)} ${px(-mantleHeight * 0.72)} ${px(mantleWidth)} -6 Q 0 ${px(6 + squeeze * 4)} ${px(-mantleWidth)} -6 Z`}
              {...shell}
            />
            <g fill="none" stroke={palette.dark} strokeWidth={0.8} opacity={0.35}>
              {[0.32, 0.52, 0.72].map((t) => (
                <path key={t} d={`M ${px(-mantleWidth * (1 - t * 0.5))} ${px(-mantleHeight * t)} Q 0 ${px(-mantleHeight * t + 6)} ${px(mantleWidth * (1 - t * 0.5))} ${px(-mantleHeight * t)}`} />
              ))}
            </g>
            <rect x={-9} y={px(-mantleHeight * 0.78)} width={18} height={14} rx={4} {...cast} />
            <circle cx={0} cy={px(-mantleHeight * 0.78 + 7)} r={2.4} fill={palette.accent} />
          </g>

          {/* Eyes: the two turrets on the mantle, the widest part of it. */}
          <g data-eyes>
            {([-1, 1] as const).map((side) => (
              <g key={side} data-eye={side === 1 ? "right" : "left"} transform={`translate(${px(side * (mantleWidth - 4))} -34)`}>
                <ellipse cx={0} cy={0} rx={9} ry={7.5} {...machined} />
                <rect x={-5.5} y={-1.6} width={11} height={3.2} rx={1.6} fill={palette.accent} />
                <path d="M -8 -5 Q 0 -9 8 -5" fill="none" stroke={palette.dark} strokeWidth={1} opacity={0.6} />
              </g>
            ))}
          </g>

          <g data-siphon transform={`translate(${px(-mantleWidth + 4)} -14) rotate(${px(-28 - squeeze * 14)})`}>
            <path d="M 0 0 L -15 -3 L -15 5 L 0 8 Z" {...cast} />
            <circle cx={-14} cy={1} r={2.4} fill={palette.glow} opacity={px(0.4 + squeeze * 0.5)} />
            {squeeze > 0.4 && (
              <g fill="none" stroke={palette.glow} strokeWidth={1} opacity={px((squeeze - 0.4) * 0.9)}>
                {[0, 1, 2].map((index) => (
                  <circle key={index} cx={px(-20 - index * 9)} cy={1} r={px(2.4 + index * 1.6)} />
                ))}
              </g>
            )}
          </g>

          <circle data-mouth cx={0} cy={0} r={px(5 - squeeze)} {...cast} />
          <circle cx={0} cy={0} r={2} fill={palette.accent} opacity={0.8} />

          {limbs.filter((arm) => arm.front).map(limb)}
        </g>
      </Frame>

      {label && (
        <text x={118} y={238} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/** A control that has to survive a consumer handing it `NaN`. */
const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback

/** What it does with no timeline on it: work the arms, pump, or ball up. */
export function octopusBehaviorPose(behavior: OctopusBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Jetting: the mantle pumps and the arms stream out behind.
    case "jet":
      return {
        rate: 0.45,
        curl: 0.12,
        gather: 0.85,
        jet: (cycle: number) => {
          const t = ((cycle % 1) + 1) % 1
          return t < 0.35 ? Math.sin((t / 0.35) * (Math.PI / 2)) : Math.pow(1 - (t - 0.35) / 0.65, 1.6)
        },
      }
    // Furled: everything coiled in tight, nothing moving much.
    case "furl":
      return { rate: 0.25, curl: 0.92, gather: 0.1, jet: () => 0.05 }
    case "static":
      return { rate: 0, curl: 0.4, gather: 0, jet: () => 0.1 }
    default:
      return {
        rate: 1,
        curl: 0.36 + 0.16 * Math.sin(time * 0.5),
        gather: 0,
        jet: () => 0.06,
      }
  }
}

export { RobotOctopus }
