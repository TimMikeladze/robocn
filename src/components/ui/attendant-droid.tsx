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

export type AttendantDroidPose = "attention" | "bow" | "present" | "alarm"
export type AttendantDroidPlating = "full" | "partial" | "bare"
export type AttendantDroidBuild = "slim" | "standard" | "heavy"
export type AttendantDroidFace = "grille" | "visor" | "lamps"
export type AttendantDroidHands = "fingers" | "clamp" | "mitt"
export type AttendantDroidSignal = "idle" | "ready" | "warning"
export type AttendantDroidBehavior = "attend" | "fret" | "idle" | "static"
/** The poses an unattended attendant works through, in order. */
const poseOrder: AttendantDroidPose[] = ["attention", "present", "bow", "alarm"]

export interface AttendantDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Etiquette posture. Omit and `behavior` works through them. */
  /** Where the camera stands. One droid, four projections. */
  view?: RobotView
  pose?: AttendantDroidPose
  /** Head rotation in degrees, clamped to −45..45. Omit and it turns to whoever it is addressing. */
  headAngle?: number
  /** What it does unattended: work the room, wring its hands, or wait politely. */
  behavior?: AttendantDroidBehavior
  /** Poses per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** The head turns to the pointer, and a click moves it on to its next pose. */
  interactive?: boolean
  onPoseChange?: (pose: AttendantDroidPose) => void
  /** How much of the body covering is fitted. `bare` strips the limb plates back to the loom. */
  plating?: AttendantDroidPlating
  /** How heavily the frame is built. Scales limb and torso width, never the height. */
  build?: AttendantDroidBuild
  /** Faceplate treatment. */
  face?: AttendantDroidFace
  /** End effector on each arm. */
  hands?: AttendantDroidHands
  /** Draw the raised collar around the neck. */
  collar?: boolean
  /** Light the vocoder grille. Omit and it lights while the droid is talking. */
  speaking?: boolean
  signal?: AttendantDroidSignal
  showGround?: boolean
  label?: string
}

/** The droid is drawn standing straight on; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"
/** Where it stands in the frame, and the depths a front elevation never had
 *  to give: how far the body, limbs and head reach through the picture. */
const CENTRE = 85
const GROUND = 200
const BODY_DEEP = 9
const LIMB_DEEP = 5

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const poses: Record<
  AttendantDroidPose,
  { lean: number; leftArm: number; rightArm: number; leftFore: number; rightFore: number; knee: number }
> = {
  attention: { lean: 0, leftArm: 5, rightArm: -5, leftFore: 0, rightFore: 0, knee: 0 },
  bow: { lean: 17, leftArm: 20, rightArm: -14, leftFore: -22, rightFore: -34, knee: 6 },
  present: { lean: -2, leftArm: 12, rightArm: -58, leftFore: -8, rightFore: -66, knee: 0 },
  alarm: { lean: -8, leftArm: -96, rightArm: 96, leftFore: -54, rightFore: 54, knee: -5 },
}

function AttendantDroid({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  pose,
  headAngle,
  behavior = "attend",
  speed = 0.3,
  animate = true,
  paused = false,
  phase = 0,
  interactive = true,
  onPoseChange,
  plating = "full",
  build = "standard",
  face = "grille",
  hands = "fingers",
  collar = true,
  speaking,
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
}: AttendantDroidProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({ speed, animate: animate && behavior !== "static", paused, phase })
  // A click takes the performance on a step and holds it there.
  const [asked, setAsked] = React.useState<number | null>(null)
  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && headAngle === undefined && !paused,
    toWorld: React.useCallback((unit: { x: number; y: number }) => ({
      x: (unit.x - 0.5) * 2,
      y: (unit.y - 0.5) * 2,
    }), []),
  })
  const scripted = attendantDroidPose(behavior, clock)
  const shown = pose ?? (asked === null ? scripted.pose : poseOrder[asked % poseOrder.length])
  const turn = finiteClamp(
    headAngle ?? (pointer.target ? clamp(pointer.target.x, -1, 1) * 40 : scripted.head),
    -45,
    45,
  )
  const talking = speaking ?? scripted.speaking
  const stance = poses[shown] ?? poses.attention
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor = signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal
  // Build widens the frame on one axis only, so every pose and joint still lines up.
  const girth = build === "heavy" ? 1.3 : build === "slim" ? 0.78 : 1
  const limbPlated = plating === "full"
  const torsoPlated = plating !== "bare"
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
  const solid = (halfWidth: number, deep: number, top: number, bottom: number, x = 0) =>
    extrudedPath(
      roundedFootprint(halfWidth, deep, Math.min(halfWidth, deep) * 0.4, 4).map(point => ({
        x: point.x - x,
        y: point.y,
      })),
      camera, -top, -bottom,
    )


  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Attendant droid, ${shown} pose, ${build} build, ${plating} plating, ${viewNames[view] ?? viewNames.front}`}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const next = (asked === null ? poseOrder.indexOf(shown) : asked) + 1
        setAsked(next)
        onPoseChange?.(poseOrder[next % poseOrder.length])
      }}
      viewBox="0 0 170 230"
      width={width}
      height={px(width * 1.35)}
      className={cn("max-w-full select-none", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d="M 85 8 V 214 M 16 208 H 154" strokeDasharray="2 3" />
          <path d="M 34 22 H 136 V 206 H 34 Z" strokeDasharray="2 3" />
        </g>
      )}
      {showGround && <ellipse cx={85} cy={202} rx={40} ry={5.5} fill={palette.dark} opacity={0.14} />}

      {offAxis && <g data-solids transform={`translate(${CENTRE} ${GROUND})`}>
        {([-1, 1] as const).map(side => {
          const [hip, knee, ankle] = chain(side * 14, -70, side * LIMB_DEEP, [
            { angle: side * stance.knee, length: 33 },
            { angle: side * stance.knee, length: 29 },
          ])
          return (
            <g key={side} data-leg={side < 0 ? "left" : "right"}>
              <path d={capsulePath(hip, knee, px(8 * girth))} {...shell} />
              <path d={capsulePath(knee, ankle, px(7 * girth))} {...machined} />
            </g>
          )
        })}
        {([-1, 1] as const).map(side => {
          const [shoulder, elbow, wrist] = chain(side * px(30 * girth), -117, side * BODY_DEEP, [
            { angle: side === -1 ? stance.leftArm : stance.rightArm, length: 37 },
            { angle: (side === -1 ? stance.leftArm + stance.leftFore : stance.rightArm + stance.rightFore), length: 32 },
          ])
          return (
            <g key={side} data-arm={side < 0 ? "left" : "right"}>
              <path d={capsulePath(shoulder, elbow, px(6.5 * girth))} {...shell} />
              <path d={capsulePath(elbow, wrist, 5.5)} {...machined} />
            </g>
          )
        })}
        <path d={solid(px(23 * girth), BODY_DEEP, 120, 70)} {...shell} />
        <path d={solid(px(18 * girth), BODY_DEEP - 1, 78, 62)} {...cast} />
        <path d={solid(7, 6, 134, 118)} {...machined} />
        <path d={solid(16, 13, 156, 128, turn * 0.14)} {...shell} />
      </g>}
      <Frame {...faceProps}>
      <g data-frame data-build={build} data-view={view} transform={`translate(85 200) rotate(${px(stance.lean)})`}>
        {[-1, 1].map((side) => (
          <g data-leg={side === -1 ? "left" : "right"} key={side} transform={`translate(${side * 14} -70) rotate(${px(side * stance.knee)})`}>
            <rect x={px(-8 * girth)} y={0} width={px(16 * girth)} height={32} rx={6} {...(limbPlated ? shell : cast)} />
            <circle data-joint cy={33} r={px(7 * girth)} {...cast} />
            <rect x={px(-7 * girth)} y={33} width={px(14 * girth)} height={29} rx={5} {...(limbPlated ? machined : cast)} />
            {!limbPlated && (
              <g data-loom="leg" fill="none" stroke={palette.metal} strokeWidth={1.2} opacity={0.8}>
                <path d="M -3 5 V 27 M 3 5 V 27 M -3 37 V 58 M 3 37 V 58" />
              </g>
            )}
            <path d="M -9 62 H 13 Q 21 62 21 70 H -10 Z" {...shell} />
          </g>
        ))}

        <g data-plating={plating}>
          <path
            d={`M ${px(-28 * girth)} -124 L ${px(-23 * girth)} -82 Q 0 -72 ${px(23 * girth)} -82 L ${px(28 * girth)} -124 Z`}
            {...shell}
          />
          <path
            d={`M ${px(-21 * girth)} -80 Q 0 -70 ${px(21 * girth)} -80 L ${px(19 * girth)} -68 Q 0 -60 ${px(-19 * girth)} -68 Z`}
            {...cast}
          />
          {torsoPlated ? (
            <g data-chest-plate>
              <path d="M -17 -116 H 17 V -90 Q 0 -82 -17 -90 Z" {...machined} />
              <g stroke={palette.dark} strokeWidth={1.2} fill="none" opacity={0.7}>
                <path d="M -11 -110 H 11 M -11 -103 H 11 M -11 -96 H 11" />
              </g>
            </g>
          ) : (
            <g data-loom="torso" fill="none" strokeLinecap="round">
              <path d="M -11 -114 C -3 -104 -9 -94 -1 -84" stroke={palette.accent} strokeWidth={2.2} />
              <path d="M 0 -116 C 8 -105 2 -95 10 -85" stroke={palette.metal} strokeWidth={2} />
              <path d="M 10 -114 C 2 -104 10 -94 4 -84" stroke={palette.dark} strokeWidth={2} />
            </g>
          )}
          <circle data-joint cy={-68} r={7.5} {...cast} />
        </g>

        {[-1, 1].map((side) => {
          const shoulder = side === -1 ? stance.leftArm : stance.rightArm
          const forearm = side === -1 ? stance.leftFore : stance.rightFore
          return (
            <g data-arm={side === -1 ? "left" : "right"} key={side} transform={`translate(${px(side * 30 * girth)} -117) rotate(${px(shoulder)})`}>
              <circle data-joint r={px(8.5 * girth)} {...cast} />
              <rect x={px(-6.5 * girth)} y={0} width={px(13 * girth)} height={36} rx={5} {...(limbPlated ? shell : cast)} />
              <g transform={`translate(0 37) rotate(${px(forearm)})`}>
                <circle data-joint r={6.5} {...cast} />
                <rect x={px(-5.5 * girth)} y={0} width={px(11 * girth)} height={35} rx={4} {...(limbPlated ? machined : cast)} />
                {!limbPlated && (
                  <path d="M -2.5 4 V 30 M 2.5 4 V 30" fill="none" stroke={palette.metal} strokeWidth={1.1} opacity={0.8} />
                )}
                <circle cy={37} r={4.6} {...cast} />
                <g data-hand={hands}>
                  {hands === "fingers" && (
                    <path d="M -5 41 Q 0 49 5 41 M 0 41 V 50" fill="none" stroke={palette.metal} strokeWidth={2} strokeLinecap="round" />
                  )}
                  {hands === "clamp" && (
                    <g {...machined}>
                      <path d="M -5 40 L -8 51 L -3 50 L -1 41 Z" />
                      <path d="M 5 40 L 8 51 L 3 50 L 1 41 Z" />
                    </g>
                  )}
                  {hands === "mitt" && <path d="M -6 40 H 6 Q 8 40 8 46 Q 0 53 -8 46 Q -8 40 -6 40 Z" {...machined} />}
                </g>
              </g>
            </g>
          )
        })}

        <g data-head transform={`translate(${px(turn * 0.14)} -134) rotate(${px(turn * 0.1)})`}>
          <rect x={-8} y={0} width={16} height={12} rx={4} {...cast} />
          {collar && <path data-collar d="M -16 4 Q 0 12 16 4 L 18 12 Q 0 20 -18 12 Z" {...machined} />}
          <path d="M -19 -20 Q -19 -30 0 -30 Q 19 -30 19 -20 V 2 Q 0 10 -19 2 Z" {...shell} />
          <path d="M -15 -20 H 15 V -2 Q 0 4 -15 -2 Z" {...cast} />
          <g data-face={face}>
            {face === "visor" ? (
              <rect x={-13} y={-17} width={26} height={8} rx={3} fill={signalColor} />
            ) : (
              [-7.5, 7.5].map((x) => (
                <g key={x}>
                  <circle cx={x} cy={-13} r={face === "lamps" ? 6 : 4.6} fill={signalColor} />
                  <circle cx={px(x + 1.2)} cy={-14.2} r={1.3} fill={palette.metal} />
                </g>
              ))
            )}
          </g>
          <rect
            data-vocoder
            x={-6}
            y={-7}
            width={12}
            height={6}
            rx={1.5}
            fill={talking ? palette.glow : palette.metal}
            stroke={palette.dark}
            strokeWidth={0.6}
            opacity={talking ? 1 : 0.75}
          />
          <path d="M -4 -6 V -2 M 0 -6 V -2 M 4 -6 V -2" stroke={palette.dark} strokeWidth={0.8} fill="none" />
          <path d="M -19 -24 H 19" stroke={palette.dark} strokeWidth={1.1} fill="none" opacity={0.6} />
        </g>
      </g>
      </Frame>
      {label && (
        <text x={85} y={224} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

const finiteClamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : 0

/** What each behavior is doing at `clock`. Pure, so tests can read it. */
export function attendantDroidPose(behavior: AttendantDroidBehavior, clock: number) {
  const t = Number.isFinite(clock) ? clock : 0
  const cycle = ((t % 1) + 1) % 1
  switch (behavior) {
    case "fret":
      return { pose: cycle < 0.5 ? "alarm" : "bow", head: Math.sin(t * Math.PI * 6) * 34, speaking: true } as const
    case "idle":
      return { pose: "attention", head: Math.sin(t * Math.PI * 0.6) * 12, speaking: false } as const
    case "static":
      return { pose: "attention", head: 0, speaking: false } as const
    default: {
      // Work the room: hold each courtesy for a beat, and talk through it.
      const step = Math.floor(cycle * poseOrder.length) % poseOrder.length
      return {
        pose: poseOrder[step],
        head: Math.sin(t * Math.PI * 1.2) * 26,
        speaking: cycle % 0.25 < 0.16,
      }
    }
  }
}

export { AttendantDroid }
