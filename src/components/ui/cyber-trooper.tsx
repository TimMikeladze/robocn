"use client"

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"

import { clamp, toRadians } from "@/lib/robocn/kinematics"
import {
  aboutPoint,
  capsulePath,
  extrudedPath,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  roundedFootprint,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type CyberTrooperPose = "stand" | "march" | "reach" | "powerdown"
export type CyberTrooperChest = "bar" | "vent" | "core"
export type CyberTrooperHelmet = "slab" | "domed" | "crested"
export type CyberTrooperBuild = "standard" | "heavy"
export type CyberTrooperVisor = "lamps" | "slit" | "bar"
export type CyberTrooperShoulders = "pauldron" | "flush"
export type CyberTrooperSignal = "idle" | "ready" | "warning"
export type CyberTrooperBehavior = "march" | "advance" | "idle" | "static"

export interface CyberTrooperProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Whole-body posture. `powerdown` slumps the frame and dims the optics. Omit and `behavior` drives it. */
  /** Where the camera stands. One trooper, four projections. */
  view?: RobotView
  pose?: CyberTrooperPose
  /** Head rotation in degrees, clamped to −40..40. Omit and it turns to whoever it is facing. */
  headAngle?: number
  /** What the trooper does unattended. */
  behavior?: CyberTrooperBehavior
  /** Steps per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** The head turns to the pointer, and a click cuts or restores its power. */
  interactive?: boolean
  onPowerChange?: (power: number) => void
  /** Chest unit style. */
  chestUnit?: CyberTrooperChest
  /** Head shell silhouette. */
  helmet?: CyberTrooperHelmet
  /** How heavily the frame is built. Scales limb and torso width, never the height. */
  build?: CyberTrooperBuild
  /** Optic treatment on the faceplate. */
  visor?: CyberTrooperVisor
  /** Shoulder hardware: capped pauldrons, or arms flush to the torso. */
  shoulders?: CyberTrooperShoulders
  /** Draw the hinged jaw plate. */
  jaw?: boolean
  /** Normalized 0–1 power reserve shown in the chest meter. Omit and `behavior` drains it. */
  power?: number
  /** Draw the two side handles on the head shell. */
  handles?: boolean
  signal?: CyberTrooperSignal
  showGround?: boolean
  label?: string
}

/** The droid is drawn standing straight on; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"
/** Where it stands in the frame, and the depths a front elevation never had
 *  to give: how far the body, limbs and head reach through the picture. */
const CENTRE = 85
const GROUND = 204
const BODY_DEEP = 12
const LIMB_DEEP = 7

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const poses: Record<
  CyberTrooperPose,
  { lean: number; leftLeg: number; rightLeg: number; leftArm: number; rightArm: number; fore: number }
> = {
  stand: { lean: 0, leftLeg: 0, rightLeg: 0, leftArm: 4, rightArm: -4, fore: 0 },
  march: { lean: -4, leftLeg: 16, rightLeg: -15, leftArm: 22, rightArm: -20, fore: -12 },
  reach: { lean: -6, leftLeg: 4, rightLeg: -3, leftArm: 12, rightArm: -102, fore: -18 },
  powerdown: { lean: 13, leftLeg: 12, rightLeg: -10, leftArm: -6, rightArm: 6, fore: 26 },
}

function CyberTrooper({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  pose,
  headAngle,
  behavior = "march",
  speed = 0.4,
  animate = true,
  paused = false,
  phase = 0,
  interactive = true,
  onPowerChange,
  chestUnit = "bar",
  helmet = "slab",
  build = "standard",
  visor = "lamps",
  shoulders = "pauldron",
  jaw = true,
  power,
  handles = true,
  signal = "ready",
  showGround = true,
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
  onPointerDown,
  ...props
}: CyberTrooperProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({ speed, animate: animate && behavior !== "static", paused, phase })
  // A click cuts the power, and a second click restores it.
  const [cut, setCut] = React.useState(false)
  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && headAngle === undefined && !paused,
    toWorld: React.useCallback((unit: { x: number; y: number }) => ({
      x: (unit.x - 0.5) * 2,
      y: (unit.y - 0.5) * 2,
    }), []),
  })
  const scripted = cyberTrooperPose(behavior, clock)
  const shown = pose ?? (cut ? "powerdown" : scripted.pose)
  const turn = finiteClamp(
    headAngle ?? (pointer.target ? clamp(pointer.target.x, -1, 1) * 36 : scripted.head),
    -40,
    40,
  )
  const reserve = finiteClamp(power ?? (cut ? 0 : scripted.power), 0, 1)
  const stance = poses[shown] ?? poses.stand
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const down = shown === "powerdown"
  const signalColor = down
    ? palette.metal
    : signal === "warning"
      ? palette.shell
      : signal === "ready"
        ? palette.accent
        : palette.metal
  // The meter is a fixed track so the fill reads as a proportion, not a shape.
  const meterWidth = px(1 + reserve * 27)
  // Build widens the frame on one axis only, so every pose and joint still lines up.
  const girth = build === "heavy" ? 1.24 : 1
  // The drawing is a front elevation, so it goes through `wall` where the
  // droid stands and comes out untouched straight on. A humanoid drawn from
  // the front says nothing about its own depth: the torso, pelvis and head
  // become boxes, and the limbs tubes set through the body.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const facing = aboutPoint(camera.wall(), CENTRE, GROUND)
  const Frame = (facing ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const faceProps = facing ? { transform: facing } : {}
  /** A point in the frame, leaned with the body and set `deep` toward us. */
  const at = (x: number, y: number, deep = 0) => {
    const tilt = toRadians(stance.lean)
    return camera.project(
      -(x * Math.cos(tilt) - y * Math.sin(tilt)),
      -(x * Math.sin(tilt) + y * Math.cos(tilt)),
      -deep,
    )
  }
  /** The joints of a limb: each segment turned by its own angle, in order. */
  const chain = (
    ox: number,
    oy: number,
    deep: number,
    segments: readonly { angle: number; length: number }[],
  ) => {
    let x = ox
    let y = oy
    const joints = [at(x, y, deep)]
    for (const segment of segments) {
      const a = toRadians(segment.angle)
      x -= Math.sin(a) * segment.length
      y += Math.cos(a) * segment.length
      joints.push(at(x, y, deep))
    }
    return joints
  }
  /** A box between two heights above the ground, `deep` either side. */
  const solid = (halfWidth: number, deep: number, top: number, bottom: number, x = 0) =>
    extrudedPath(
      roundedFootprint(halfWidth, deep, Math.min(halfWidth, deep) * 0.4, 4).map(point => ({
        x: point.x - x,
        y: point.y,
      })),
      camera, top, bottom,
    )


  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Cyber trooper, ${shown} pose, ${build} build, ${chestUnit} chest unit, ${viewNames[view] ?? viewNames.front}`}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setCut((was) => {
          onPowerChange?.(was ? scripted.power : 0)
          return !was
        })
      }}
      viewBox="0 0 170 236"
      width={width}
      height={px(width * 1.39)}
      className={cn("max-w-full select-none", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d="M 85 8 V 220 M 14 212 H 156" strokeDasharray="2 3" />
          <path d="M 30 20 H 140 V 210 H 30 Z" strokeDasharray="2 3" />
        </g>
      )}
      {showGround && <ellipse cx={85} cy={206} rx={44} ry={6} fill={palette.dark} opacity={0.14} />}

      {offAxis && <g data-solids transform={`translate(${CENTRE} ${GROUND})`}>
        {([-1, 1] as const).map(side => {
          const [hip, knee, ankle] = chain(side * px(20 * girth), -88, side * LIMB_DEEP, [
            { angle: side === -1 ? stance.leftLeg : stance.rightLeg, length: 40 },
            { angle: side === -1 ? stance.leftLeg : stance.rightLeg, length: 44 },
          ])
          return (
            <g key={side} data-leg={side < 0 ? "left" : "right"}>
              <path d={capsulePath(hip, knee, px(11 * girth))} {...shell} />
              <path d={capsulePath(knee, ankle, px(10 * girth))} {...machined} />
            </g>
          )
        })}
        {([-1, 1] as const).map(side => {
          const [shoulder, elbow, wrist] = chain(side * px(33 * girth), -138, side * BODY_DEEP, [
            { angle: side === -1 ? stance.leftArm : stance.rightArm, length: 45 },
            { angle: (side === -1 ? stance.leftArm : stance.rightArm) + side * stance.fore, length: 38 },
          ])
          return (
            <g key={side} data-arm={side < 0 ? "left" : "right"}>
              <path d={capsulePath(shoulder, elbow, px(8 * girth))} {...shell} />
              <path d={capsulePath(elbow, wrist, 6.5)} {...machined} />
            </g>
          )
        })}
        <path d={solid(px(28 * girth), BODY_DEEP, 152, 88)} {...shell} />
        <path d={solid(px(22 * girth), BODY_DEEP - 1, 96, 80)} {...cast} />
        <path d={solid(8, 7, 172, 150)} {...machined} />
        <path d={solid(17, 14, 196, 166, turn * 0.16)} {...shell} />
      </g>}
      <Frame {...faceProps}>
      <g data-frame data-build={build} data-view={view} transform={`translate(85 204) rotate(${px(stance.lean)})`}>
        {[-1, 1].map((side) => {
          const swing = side === -1 ? stance.leftLeg : stance.rightLeg
          return (
            <g data-leg={side === -1 ? "left" : "right"} key={side} transform={`translate(${px(side * 20 * girth)} -88) rotate(${px(swing)})`}>
              <rect x={px(-11 * girth)} y={-4} width={px(22 * girth)} height={40} rx={5} {...shell} />
              <rect x={px(-9 * girth)} y={36} width={px(18 * girth)} height={8} rx={3} {...cast} />
              <rect x={px(-10 * girth)} y={44} width={px(20 * girth)} height={36} rx={4} {...machined} />
              <path d="M -12 80 H 14 Q 22 80 22 88 H -13 Z" {...cast} />
              <path d="M -11 10 H 11 M -11 22 H 11" stroke={palette.dark} strokeWidth={1} fill="none" opacity={0.6} />
            </g>
          )
        })}

        <path
          d={`M ${px(-31 * girth)} -146 H ${px(31 * girth)} L ${px(27 * girth)} -94 Q 0 -84 ${px(-27 * girth)} -94 Z`}
          {...shell}
        />
        <path
          d={`M ${px(-27 * girth)} -94 Q 0 -84 ${px(27 * girth)} -94 L ${px(24 * girth)} -82 Q 0 -74 ${px(-24 * girth)} -82 Z`}
          {...cast}
        />
        <g data-chest={chestUnit}>
          <rect x={-21} y={-136} width={42} height={30} rx={4} {...machined} />
          {chestUnit === "vent" && (
            <g stroke={palette.dark} strokeWidth={1.6} fill="none">
              <path d="M -15 -130 H 15 M -15 -123 H 15 M -15 -116 H 15" />
            </g>
          )}
          {chestUnit === "core" && (
            <>
              <circle cy={-123} r={9} {...cast} />
              <circle cy={-123} r={px(2 + reserve * 5)} fill={signalColor} />
            </>
          )}
          {chestUnit === "bar" && <rect x={-16} y={-128} width={32} height={12} rx={2} {...cast} />}
          <rect x={-15} y={-103} width={30} height={6} rx={3} {...cast} />
          <rect data-power x={-15} y={-103} width={meterWidth} height={6} rx={3} fill={signalColor} />
        </g>
        <path d="M -12 -152 H 12 V -142 H -12 Z" {...cast} />

        {[-1, 1].map((side) => {
          const shoulder = side === -1 ? stance.leftArm : stance.rightArm
          return (
            <g data-arm={side === -1 ? "left" : "right"} key={side} transform={`translate(${px(side * 33 * girth)} -138) rotate(${px(shoulder)})`}>
              {shoulders === "pauldron" && (
                <rect data-pauldron x={px(-9 * girth)} y={-10} width={px(18 * girth)} height={20} rx={7} {...cast} />
              )}
              <rect x={px(-8 * girth)} y={8} width={px(16 * girth)} height={36} rx={5} {...shell} />
              <g transform={`translate(0 45) rotate(${px(side * stance.fore)})`}>
                <rect x={-7} y={0} width={14} height={36} rx={4} {...machined} />
                <rect x={-7.5} y={36} width={15} height={12} rx={4} {...cast} />
                <path d="M -4 48 V 54 M 0 48 V 55 M 4 48 V 54" stroke={palette.metal} strokeWidth={2} strokeLinecap="round" fill="none" />
              </g>
            </g>
          )
        })}

        <g data-head transform={`translate(${px(turn * 0.16)} -172) rotate(${px(turn * 0.09)})`}>
          <path data-helmet={helmet} d={helmetOutline(helmet)} {...shell} />
          <path d="M -14 -14 H 14 V 0 H -14 Z" {...cast} />
          <g data-visor={visor}>
            {visor === "lamps" &&
              [-7, 7].map((x) => (
                <rect key={x} x={px(x - 4)} y={-11} width={8} height={7} rx={1.5} fill={signalColor} opacity={down ? 0.5 : 1} />
              ))}
            {visor === "slit" && (
              <rect x={-12} y={-9} width={24} height={3.5} rx={1.75} fill={signalColor} opacity={down ? 0.5 : 1} />
            )}
            {visor === "bar" && (
              <rect x={-13} y={-12} width={26} height={9} rx={2} fill={signalColor} opacity={down ? 0.5 : 1} />
            )}
          </g>
          {jaw && <path data-jaw d="M -10 2 H 10 V 9 Q 0 14 -10 9 Z" {...machined} />}
          <path d="M -6 3 H 6 M -8 8 H 8" stroke={palette.dark} strokeWidth={1.4} fill="none" />
          <rect x={-5} y={-30} width={10} height={9} rx={2} {...machined} />
          {handles &&
            [-1, 1].map((side) => (
              <path
                data-handle={side === -1 ? "left" : "right"}
                key={side}
                d={`M ${side * 16} -18 h ${side * 8} v 12 h ${-side * 8}`}
                fill="none"
                stroke={palette.metal}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
        </g>
      </g>
      </Frame>
      {label && (
        <text x={85} y={230} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

const finiteClamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : 0

/** The three head shells, all filling the same 36×30 envelope. */
const helmetOutline = (helmet: CyberTrooperHelmet) => {
  switch (helmet) {
    case "domed":
      return "M -18 -12 Q -18 -24 0 -24 Q 18 -24 18 -12 V 8 Q 0 16 -18 8 Z"
    case "crested":
      return "M -18 -18 L -6 -30 H 6 L 18 -18 V 8 Q 0 16 -18 8 Z"
    default:
      return "M -18 -22 H 18 V 8 Q 0 16 -18 8 Z"
  }
}

/** What each behavior is doing at `clock`. Pure, so tests can read it. */
export function cyberTrooperPose(behavior: CyberTrooperBehavior, clock: number) {
  const t = Number.isFinite(clock) ? clock : 0
  const cycle = ((t % 1) + 1) % 1
  switch (behavior) {
    case "advance":
      return { pose: cycle < 0.7 ? "march" : "reach", head: Math.sin(t * Math.PI * 2) * 22, power: 0.55 } as const
    case "idle":
      // Standing by on a slow trickle charge.
      return { pose: "stand", head: Math.sin(t * Math.PI * 0.5) * 9, power: 0.5 + Math.sin(t * Math.PI) * 0.18 } as const
    case "static":
      return { pose: "stand", head: 0, power: 0.7 } as const
    default:
      // Marching draws the reserve down, then it recharges on the spot.
      return {
        pose: cycle < 0.82 ? "march" : "stand",
        head: Math.sin(t * Math.PI * 2) * 14,
        power: cycle < 0.82 ? 0.95 - cycle * 0.8 : 0.29 + (cycle - 0.82) * 3.6,
      } as const
  }
}

export { CyberTrooper }
