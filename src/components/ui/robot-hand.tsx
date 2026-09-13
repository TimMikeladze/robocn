"use client"

/**
 * robot-hand — five digits, a saddle-jointed thumb, and a wrist.
 *
 * The whole pose comes out of `hand-kinematics`: four fingers as three-link
 * chains posed forward in planes abducted about the palm normal, and a thumb
 * whose carpometacarpal joint really is a saddle — swung across the palm,
 * lifted out of it, and rolled about its own metacarpal, which is what turns
 * the pad to face the fingers instead of facing forward.
 *
 * That is why `pinch` closes on something here: the gap between the thumb pad
 * and the index pad is a distance the solver produces, drawn as a caliper and
 * reported in the readout. It is a shape, not a grip — the hand is not holding
 * anything and does not claim to be.
 *
 * One model, four cameras. Hand-local axes are `x` toward the thumb, `y` up
 * the hand, `z` out of the palm; the palm faces the `front` camera.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import {
  handGoal,
  handGrasps,
  handWave,
  solveHand,
  type HandBehavior,
  type HandDigit,
  type HandGrasp,
  type HandSide,
} from "@/lib/robocn/hand"
import { clamp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  capsulePath,
  circleFootprint,
  extrudedPath,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  slabPath,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type { HandBehavior, HandGrasp, HandSide }

const VIEW_WIDTH = 170
const VIEW_HEIGHT = 190
/** World origin on screen: the wrist, where the hand starts. */
const CENTRE = { x: 85, y: 126 }
/** Curl (0–1) per second while easing back into the behaviour. */
const SLEW_RATE = 1.4
const CLICK_SLOP = 0.04
/** Palm on, which is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"
/** A pinch reads as closed once the pads are this near, in world units. */
const PINCH_CLOSE = 14

const fits: Record<RobotView, number> = {
  plan: 0.9,
  front: 0.86,
  profile: 0.86,
  iso: 0.8,
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RobotHandProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled closure, 0 open to 1 shut, scaling the grasp. Omit to run `behavior`. */
  curl?: number
  /** Which grip the digits close into. */
  grasp?: HandGrasp
  /** Per-digit closure, thumb first, overriding the grasp digit by digit. */
  digits?: readonly (number | null | undefined)[]
  /** Finger fan, -1 pressed together to 1 splayed. Defaults to the grasp's. */
  spread?: number
  /** Thumb across the palm, 0 alongside to 1 opposed. Defaults to the grasp's. */
  opposition?: number
  /** A hand is handed. `left` is `right` mirrored, not a second drawing. */
  side?: HandSide
  /** Wrist flexion in degrees, positive toward the palm. */
  wristPitch?: number
  /** Wrist deviation in degrees, positive toward the thumb. */
  wristYaw?: number
  /** What the hand does when `curl` is not supplied. */
  behavior?: HandBehavior
  /** Where the camera stands. One hand, four projections. */
  view?: RobotView
  /** Grips per second, or waves per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag to close the hand; click steps to the next grasp. */
  interactive?: boolean
  onCurlChange?: (curl: number) => void
  onGraspChange?: (grasp: HandGrasp) => void
  showWrist?: boolean
  /** Draw the caliper between the thumb pad and the index pad. */
  showPinch?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function RobotHand({
  curl,
  grasp = "power",
  digits,
  spread,
  opposition,
  side = "right",
  wristPitch = 0,
  wristYaw = 0,
  behavior = "grip",
  view = NATIVE_VIEW,
  speed = 0.3,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onCurlChange,
  onGraspChange,
  showWrist = true,
  showPinch = true,
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
}: RobotHandProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = curl !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const [picked, setPicked] = React.useState<HandGrasp | null>(null)
  const shown = picked ?? (handGrasps.includes(grasp) ? grasp : "power")

  const hold = controlled ? (Number.isFinite(curl) ? clamp(curl, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => handGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: Math.max(SLEW_RATE, Math.abs(speed) * 5),
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const master = clamp(Number.isFinite(motion.value) ? motion.value : 0, 0, 1)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = clamp(next, 0, 1)
      setHeld(bounded)
      onCurlChange?.(bounded)
    },
    [onCurlChange, setHeld],
  )
  const step = React.useCallback(() => {
    const next = handGrasps[(handGrasps.indexOf(shown) + 1) % handGrasps.length]
    setPicked(next)
    onGraspChange?.(next)
  }, [shown, onGraspChange, setPicked])

  const press = React.useRef<{ from: number; at: number; moved: boolean } | null>(null)
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => {
        if (!press.current) {
          press.current = { from: master, at: unit.y, moved: false }
          return
        }
        const moved = unit.y - press.current.at
        if (Math.abs(moved) > CLICK_SLOP) press.current.moved = true
        if (press.current.moved) apply(press.current.from + moved * 2.2)
      },
      [apply, master],
    ),
    onDragEnd: React.useCallback(() => {
      const started = press.current
      press.current = null
      if (started && !started.moved) step()
    }, [step]),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  // The ripple is the one behaviour a single scalar cannot carry: each digit
  // needs its own phase, so it reads the clock directly.
  const rippling = !controlled && held === null && behavior === "wave"
  const rippled = rippling
    ? Array.from({ length: 5 }, (_, i) => handWave(motion.clock, i))
    : undefined

  const pose = solveHand({
    grasp: shown,
    curl: master,
    digits: rippled ?? digits,
    spread,
    opposition,
    side,
    wristPitch,
    wristYaw,
  })

  const camera = robotCamera(view)
  const fit = fits[view] ?? 1
  /** Hand-local to world: the palm normal points at the `front` camera. */
  const world = (point: Vec3): Vec3 => ({ x: point.x, y: point.y, z: -point.z })
  const to = (point: Vec3): Vec2 => {
    const w = world(point)
    return camera.project(w.x, w.y, w.z)
  }
  const depthOf = (point: Vec3) => {
    const w = world(point)
    return camera.depth(w.x, w.y, w.z)
  }

  /** An outline in the hand plane given a thickness out of the palm. */
  const slab = (outline: Vec2[], front: number, back: number) =>
    slabPath(
      outline.flatMap((point) => [
        world({ x: point.x, y: point.y, z: front }),
        world({ x: point.x, y: point.y, z: back }),
      ]),
      camera,
    )

  const line = (a: Vec3, b: Vec3) => {
    const from = to(a)
    const at = to(b)
    return `M ${px(from.x)} ${px(from.y)} L ${px(at.x)} ${px(at.y)}`
  }

  const readout = Math.round(master * 100)
  const gap = pose.pinch.gap
  const closed = clamp(1 - gap / PINCH_CLOSE, 0, 1)

  const digitPart = (item: HandDigit) => {
    const points = item.joints.map(to)
    return (
      <g key={item.name} data-digit={item.name}>
        {points.slice(0, -1).map((joint, i) => (
          <g key={i} data-phalanx={`${item.name}-${i}`}>
            <path
              d={capsulePath(joint, points[i + 1], item.radii[i] ?? 3.4)}
              {...(i % 2 ? machined : shell)}
            />
            <circle
              cx={px(joint.x)}
              cy={px(joint.y)}
              r={px((item.radii[i] ?? 3.4) * 0.52)}
              {...cast}
            />
          </g>
        ))}
        <circle
          data-pad={item.name}
          cx={px(to(item.pad).x)}
          cy={px(to(item.pad).y)}
          r={px((item.radii[item.radii.length - 1] ?? 3) * 0.7)}
          fill={palette.accent}
          fillOpacity={0.35 + item.closure * 0.65}
        />
      </g>
    )
  }

  // Draw back to front, so a curled digit passes in front of the palm the way
  // the camera says it should rather than the way the array happens to be.
  const ordered = [...pose.digits].sort(
    (a, b) => depthOf(a.joints[1]) - depthOf(b.joints[1]),
  )
  const behind = ordered.filter((item) => depthOf(item.joints[1]) < 0)
  const infront = ordered.filter((item) => depthOf(item.joints[1]) >= 0)

  const palmFace = (
    <g data-palm>
      <path d={slab(pose.palm, pose.palmFront, pose.palmBack)} {...shell} />
      {/* Thenar plate: the muscle pad the thumb's saddle joint sits under. */}
      <path
        d={slab(
          pose.palm.map((point) => ({
            x: point.x * 0.5 + (side === "left" ? -9 : 9),
            y: point.y * 0.48 + 12,
          })),
          pose.palmFront + 1.8,
          pose.palmFront,
        )}
        {...machined}
      />
      {/* Tendon runs from the wrist collar up to each knuckle. */}
      <g fill="none" stroke={palette.dark} strokeWidth={0.9} opacity={0.55}>
        {pose.digits.slice(1).map((item) => (
          <path
            key={item.name}
            d={line(
              { x: item.joints[0].x * 0.35, y: 6, z: pose.palmFront },
              { x: item.joints[0].x, y: item.joints[0].y - 6, z: pose.palmFront },
            )}
          />
        ))}
      </g>
      {pose.digits.slice(1).map((item) => {
        const knuckle = to(item.joints[0])
        return (
          <circle
            key={item.name}
            data-knuckle={item.name}
            cx={px(knuckle.x)}
            cy={px(knuckle.y)}
            r={px((item.radii[0] ?? 4) * 0.78)}
            {...machined}
          />
        )
      })}
      <circle
        data-port
        cx={px(to({ x: 0, y: 26, z: pose.palmFront }).x)}
        cy={px(to({ x: 0, y: 26, z: pose.palmFront }).y)}
        r={4.2}
        fill={palette.accent}
      />
    </g>
  )

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Robot ${side} hand, ${shown} grasp, ${readout} percent closed, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout}% closed, ${shown} grasp` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.2)
        if (delta !== 0) apply(master + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else if (event.key === "Enter" || event.key === " ") step()
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
      data-side={side}
      {...props}
    >
      <g
        data-hand
        transform={`translate(${CENTRE.x} ${CENTRE.y})${fit === 1 ? "" : ` scale(${fit})`}`}
      >
        {showWrist && (
          <g data-wrist>
            <path d={extrudedPath(circleFootprint(0, 0, 13, 12), camera, 2, -16)} {...machined} />
            <path d={extrudedPath(circleFootprint(0, 0, 15.5, 12), camera, -16, -22)} {...cast} />
            <path d={extrudedPath(circleFootprint(0, 0, 13.5, 12), camera, -22, -38)} {...shell} />
            <path
              d={line({ x: -12, y: -30, z: 13 }, { x: 12, y: -30, z: 13 })}
              stroke={palette.dark}
              strokeWidth={1.1}
              fill="none"
            />
          </g>
        )}

        {behind.map(digitPart)}
        {palmFace}
        {infront.map(digitPart)}

        {showPinch && closed > 0 && (
          <g data-pinch opacity={px(0.25 + closed * 0.75)}>
            <path
              d={line(pose.pinch.thumb, pose.pinch.finger)}
              stroke={palette.glow}
              strokeWidth={1.2}
              strokeDasharray="2 2"
              fill="none"
            />
          </g>
        )}

        {variant === "blueprint" && (
          <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.7}>
            <path d={line({ x: -40, y: 52, z: 0 }, { x: 40, y: 52, z: 0 })} strokeDasharray="2 3" />
            <path d={line({ x: 0, y: -6, z: 0 }, { x: 0, y: 108, z: 0 })} strokeDasharray="2 3" />
          </g>
        )}
      </g>
      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={172} fontSize={5}>
          {`${shown.toUpperCase()} / ${readout}% / GAP ${px(gap).toFixed(1)}`}
        </text>
        {label && (
          <text x={VIEW_WIDTH / 2} y={181} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

export { RobotHand, handGoal, handWave }
