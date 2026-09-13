"use client"

/**
 * guide-droid — a rotor-lifted visitor guide.
 *
 * One number runs the machine: `lift`. It raises the airframe, and because the
 * body hangs off a rotor rather than standing on the deck, the same number
 * stretches the coil springs the hands and feet ride on — tension in the air,
 * compression on its feet. The coils are drawn from their own extension, so
 * the spring is the readout rather than an ornament, and the body swings from
 * the hub like the pendulum it is.
 *
 * Design note: docs/guide-droid.md.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, lerp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import {
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

export type GuideDroidBehavior = "hover" | "beckon" | "settle" | "static"
/** Springs, or rigid struts with a visible knuckle. */
export type GuideDroidLimbs = "coil" | "strut"

/** The droid is drawn straight on; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"

/* The frame. Everything below is in world units about the body centre:
   x starboard, y up, z toward the viewer. */
const CENTRE = 100
const BODY_Y = 158
const DECK = 58
/** Screen units between resting on the deck and hanging at altitude. */
const RISE = 26
/** Rotor hub, above the body centre. */
const HUB = 116
const APEX = 103
const ROTOR_SPAN = 50
/** Degrees of blade per second of clock. */
const ROTOR_RATE = 900
/** Hover units per second while easing back into the behaviour. */
const LIFT_RATE = 0.9
const GRILLE_BARS = 7
/** The shell meridian, in the airframe's own coordinates. A surface of
 *  revolution: this outline is its silhouette from every horizontal angle, and
 *  a circle of the same radius from straight above. */
const SHELL_PATH =
  "M 0 -104 C 13 -102 43 -85 43 -56 C 43 -31 24 -15 0 -15 C -24 -15 -43 -31 -43 -56 C -43 -85 -13 -102 0 -104 Z"
const SHELL_CENTRE = -59
const SHELL_RADIUS = 43

/** How far the camera pulls back so the machine still fits the frame. */
const fits: Record<RobotView, number> = { plan: 1, front: 1, profile: 1, iso: 0.95 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface GuideDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. One droid, four projections. */
  view?: RobotView
  /** Hover height, 0 on the deck to 1 at altitude. Supplying it stops the loop. */
  height?: number
  /** Controlled blade angle in degrees. Omit and the rotor turns on the clock. */
  rotorAngle?: number
  /** Lit bars in the speaker grille, 0..1. Omit and the behavior works it. */
  voice?: number
  /** What it does when `height` is not supplied. */
  behavior?: GuideDroidBehavior
  /** Hover cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a pair of them breaks step. */
  phase?: number
  /** Drag it up and down, or fly it from the arrow keys. */
  interactive?: boolean
  onHeightChange?: (height: number) => void
  /** Controlled optic aim in −1..1; overrides pointer tracking. */
  look?: Vec2 | null
  /** The optics follow the page pointer while `look` is null. */
  track?: boolean
  /** Rotor blades, 2–6. */
  blades?: number
  /** How the hands and feet are carried. */
  limbs?: GuideDroidLimbs
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

function GuideDroid({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  height,
  rotorAngle,
  voice,
  behavior = "hover",
  speed = 0.4,
  animate = true,
  paused = false,
  phase = 0,
  interactive = true,
  onHeightChange,
  look = null,
  track = true,
  blades = 2,
  limbs = "coil",
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
  role,
  tabIndex,
  onKeyDown,
  onBlur,
  ...props
}: GuideDroidProps) {
  const controlled = height !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const hold = controlled ? finiteClamp(height, 0, 1, 0.5) : held

  const goal = React.useCallback(
    (clock: number) => guideDroidPose(behavior, clock).lift,
    [behavior],
  )
  const motion = useRobotScalar(goal, {
    rate: LIFT_RATE,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const lift = finiteClamp(motion.value, 0, 1, 0.5)
  const scripted = guideDroidPose(behavior, motion.clock)
  const sway = clamp(scripted.sway, -1, 1)
  const wave = held === null && !controlled ? clamp(scripted.wave, 0, 1) : 0
  const talk = finiteClamp(voice ?? scripted.voice, 0, 1, 0)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = round3(clamp(next, 0, 1))
      setHeld(bounded)
      onHeightChange?.(bounded)
    },
    [onHeightChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // A gesture worth making: the top half of the box is the whole envelope.
    onDrag: React.useCallback((unit: Vec2) => apply((0.75 - unit.y) / 0.5), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const pointer = usePointerTarget(svgRef, {
    enabled: track && !look,
    within: "window",
    persist: true,
    toWorld: React.useCallback(
      (unit: Vec2) => ({
        x: clamp((unit.x - 0.5) * 2, -1, 1),
        y: clamp((unit.y - 0.5) * 2, -1, 1),
      }),
      [],
    ),
  })
  const gaze = look ?? pointer.target ?? { x: 0, y: 0 }
  const eye = { x: clamp(finite(gaze.x), -1, 1) * 4.5, y: clamp(finite(gaze.y), -1, 1) * 3 }

  const bladeCount = Number.isFinite(blades) ? Math.round(clamp(blades, 2, 6)) : 2
  const spin =
    rotorAngle !== undefined
      ? (((finite(rotorAngle) % 360) + 360) % 360)
      : (((motion.clock * ROTOR_RATE) % 360) + 360) % 360

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shellPaint = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const wire = robotSurface("metal", variant, palette, 0.8)
  const signalColor =
    signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

  /* ---------------------------------------------------------------- pose */

  // The airframe rises; the body swings under the hub, which does not.
  const float = -lift * RISE
  const lean = sway * 4.5
  const hub: Vec2 = { x: 0, y: -HUB + float }
  /** An airframe point, carried by the float and the swing under the hub. */
  const swing = (x: number, y: number): Vec2 => rotateAbout({ x, y: y + float }, hub, lean)

  const arms = ([-1, 1] as const).map((side) => {
    const gesture = side === 1 ? wave : 0
    const anchor = swing(side * 26, -8)
    const tip: Vec2 = {
      x: side * lerp(47, 53, lift) + sway * 7 + side * gesture * 6,
      y: lerp(2, 20, lift) + float - gesture * 34,
    }
    return { side, anchor, tip, name: side === -1 ? "left" : "right" }
  })

  const legs = ([-1, 1] as const).map((side) => {
    const anchor = swing(side * 13, 20)
    const tip: Vec2 = {
      x: side * lerp(15, 17, lift) + sway * 5,
      y: lerp(48, 58, lift) + float,
    }
    return { side, anchor, tip, name: side === -1 ? "left" : "right" }
  })

  /* -------------------------------------------------------------- camera */

  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const face = camera.wall()
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  /** A world point about the body centre: x starboard, y up, z toward the viewer. */
  const at = (x: number, y: number, z = 0) => camera.project(-x, y, -z)
  /** The outline a body of revolution makes: unforeshortened across, tipped along. */
  const spheroid = (a: number, b: number) =>
    Math.sqrt((b * camera.lift) ** 2 + (a * camera.flatten) ** 2)
  const point = (p: Vec2) => at(p.x, -p.y)
  /** The same, standing `z` world units toward the viewer. */
  const deep = (p: Vec2, z: number) => at(p.x, -p.y, z)

  /* --------------------------------------------------------------- parts */

  const limb = (
    anchor: Vec2,
    tip: Vec2,
    coils: number,
    radius: number,
    thickness: number,
  ) =>
    limbs === "coil" ? (
      <path d={coilPath(anchor, tip, coils, radius)} fill="none" stroke={wire.stroke} strokeWidth={px(thickness)} strokeLinecap="round" strokeLinejoin="round" />
    ) : (
      <>
        <path d={capsulePath(anchor, midpoint(anchor, tip, radius), px(thickness * 0.9))} {...machined} />
        <path d={capsulePath(midpoint(anchor, tip, radius), tip, px(thickness * 0.8))} {...machined} />
        <circle cx={px(midpoint(anchor, tip, radius).x)} cy={px(midpoint(anchor, tip, radius).y)} r={px(thickness * 1.1)} fill={palette.dark} />
      </>
    )

  const grilleBars = Array.from({ length: GRILLE_BARS }, (_, index) => {
    const t = (index + 0.5) / GRILLE_BARS
    const p = grinPoint(t)
    // Bars light out from the middle, so quiet speech is a flicker in the centre.
    const lit = Math.abs(t - 0.5) * 2 < talk
    return { index, ...p, lit }
  })

  const rotorHub = point(hub)
  const deck = point({ x: 0, y: DECK })
  const state = dragging
    ? "flown by hand"
    : behavior === "static"
      ? "parked"
      : behavior === "settle"
        ? "settling"
        : behavior === "beckon"
          ? "beckoning"
          : "hovering"
  const readout = Math.round(lift * 100)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Guide droid, ${state}, hovering at ${readout} percent, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout} percent hover` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      viewBox="0 0 200 232"
      width={width}
      height={px((width * 232) / 200)}
      className={cn(
        "max-w-full select-none",
        interactive &&
          "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]",
        dragging && "cursor-grabbing",
        className,
      )}
      style={{ color: palette.foreground, ...style }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.25 : 0.1, 0.25)
        if (delta !== 0) apply(lift + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d={`M 14 ${BODY_Y + DECK} H 186 M ${CENTRE} 20 V 222`} strokeDasharray="2 3" />
          <path d={`M ${CENTRE - 70} ${px(BODY_Y + float - HUB)} H ${CENTRE + 70}`} strokeDasharray="4 3" />
        </g>
      )}

      <g transform={`translate(${CENTRE} ${BODY_Y})${fit === 1 ? "" : ` scale(${fit})`}`}>
        {showGround && (
          <g data-contact transform={`translate(${px(deck.x)} ${px(deck.y)}) ${camera.plane()}`.trimEnd()}>
            <circle r={px(30 + lift * 16)} fill={palette.dark} opacity={px(0.2 - lift * 0.1)} />
          </g>
        )}

        {/* Round solids: what a single elevation could not say. The shell and
            the body are surfaces of revolution, and the orbs are orbs. */}
        {offAxis && (
          <g data-solids>
            {legs.map((leg) => (
              <path key={leg.name} d={capsulePath(deep(leg.anchor, 2), deep(leg.tip, 6), 2)} {...cast} />
            ))}
            <ellipse
              cx={px(point({ x: 0, y: SHELL_CENTRE + float }).x)}
              cy={px(point({ x: 0, y: SHELL_CENTRE + float }).y)}
              rx={SHELL_RADIUS}
              ry={px(SHELL_RADIUS * camera.flatten)}
              {...shellPaint}
            />
            <g
              transform={`translate(${px(point({ x: 0, y: SHELL_CENTRE + float }).x)} ${px(point({ x: 0, y: SHELL_CENTRE + float }).y)}) scale(1 ${px(camera.lift)}) translate(0 ${-SHELL_CENTRE})`}
            >
              <path d={SHELL_PATH} {...shellPaint} />
            </g>
            {/* The shell seam is a real circle round the machine, so it is an
                ellipse from every angle and a ring in plan. */}
            <g transform={`translate(${px(point({ x: 0, y: SHELL_CENTRE + float }).x)} ${px(point({ x: 0, y: SHELL_CENTRE + float }).y)}) ${camera.plane()}`.trimEnd()}>
              <circle r={SHELL_RADIUS} fill="none" stroke={palette.dark} strokeWidth={0.9} opacity={0.45} />
            </g>
            <path
              d={capsulePath(point({ x: 0, y: -APEX + float }), point(hub), 2.4)}
              {...machined}
            />
            <ellipse
              cx={px(point({ x: 0, y: float }).x)}
              cy={px(point({ x: 0, y: float }).y)}
              rx={28}
              ry={px(spheroid(28, 25))}
              {...shellPaint}
            />
            <g transform={`translate(${px(point({ x: 0, y: float }).x)} ${px(point({ x: 0, y: float }).y)}) ${camera.plane()}`.trimEnd()}>
              <circle r={28} fill="none" stroke={palette.dark} strokeWidth={0.9} opacity={0.45} />
            </g>
            {arms.map((arm) => (
              <g key={arm.name}>
                <path d={capsulePath(deep(arm.anchor, 3), deep(arm.tip, 10), 2)} {...cast} />
                <circle cx={px(deep(arm.tip, 10).x)} cy={px(deep(arm.tip, 10).y)} r={10.5} {...machined} />
              </g>
            ))}
            {legs.map((leg) => (
              <ellipse
                key={leg.name}
                cx={px(deep(leg.tip, 6).x)}
                cy={px(deep(leg.tip, 6).y)}
                rx={12}
                ry={px(spheroid(12, 10))}
                {...machined}
              />
            ))}
          </g>
        )}

        <Frame {...frame}>
          <g data-guide data-view={view}>
            {legs.map((leg) => (
              <g key={leg.name} data-leg={leg.name} data-limb={limbs}>
                {limb(leg.anchor, leg.tip, 4, 3.6, 2.2)}
              </g>
            ))}

            <g data-shell transform={`translate(0 ${px(float)}) rotate(${px(lean)} 0 ${-HUB})`}>
              {/* The shell: a teardrop pulled up into the mast. */}
              <path d={SHELL_PATH} {...shellPaint} />
              {/* Centre seam and its rivet line — the one panel join on it. */}
              <g data-seam>
                <path d="M -6 -97 Q 0 -101 6 -97 L 6 -19 L -6 -19 Z" {...shellPaint} />
                <path d="M -6 -95 V -19 M 6 -95 V -19" fill="none" stroke={palette.dark} strokeWidth={0.9} opacity={0.6} />
                {[-88, -76, -64, -52, -40, -28].map((y) => (
                  <React.Fragment key={y}>
                    <circle cx={-5} cy={y} r={1.1} fill={palette.dark} />
                    <circle cx={5} cy={y} r={1.1} fill={palette.dark} />
                  </React.Fragment>
                ))}
              </g>

              {([-1, 1] as const).map((side) => (
                <g key={side} data-optic={side === -1 ? "left" : "right"} transform={`translate(${side * 20} -62)`}>
                  <circle r={14} {...machined} />
                  <circle r={11.5} fill={palette.dark} opacity={0.9} />
                  <g data-eye={side === -1 ? "left" : "right"} transform={`translate(${px(eye.x)} ${px(eye.y)})`}>
                    <circle r={9} fill={palette.accent} opacity={0.9} />
                    <circle r={6} fill="none" stroke={palette.dark} strokeWidth={1.4} opacity={0.75} />
                    <circle r={3} fill={palette.glow} />
                    <circle r={1.4} fill={palette.dark} />
                  </g>
                </g>
              ))}

              {/* The grille is a speaker, not a mouth: its bars light with output. */}
              <g data-grille>
                <path
                  d={grinCurve()}
                  fill="none"
                  stroke={palette.dark}
                  strokeWidth={8}
                  strokeLinecap="round"
                  opacity={variant === "solid" ? 0.85 : 0.45}
                />
                {grilleBars.map((bar) => (
                  <rect
                    key={bar.index}
                    data-bar={bar.index}
                    data-lit={bar.lit ? "" : undefined}
                    x={px(bar.x - 1.3)}
                    y={px(bar.y - 3)}
                    width={2.6}
                    height={6}
                    rx={0.8}
                    fill={bar.lit ? signalColor : palette.metal}
                    opacity={bar.lit ? 1 : 0.55}
                  />
                ))}
              </g>

              <path d={capsulePath({ x: 0, y: -APEX }, { x: 0, y: -HUB }, 2.4)} data-mast {...machined} />

              <g data-body>
                <ellipse rx={28} ry={25} {...shellPaint} />
                <path d="M -5 -24 L 5 -24 L 5 24 L -5 24 Z" {...shellPaint} />
                <path d="M -5 -23 V 23 M 5 -23 V 23" fill="none" stroke={palette.dark} strokeWidth={0.9} opacity={0.6} />
                {[-14, -2, 10].map((y) => (
                  <React.Fragment key={y}>
                    <circle cx={-4.2} cy={y} r={1} fill={palette.dark} />
                    <circle cx={4.2} cy={y} r={1} fill={palette.dark} />
                  </React.Fragment>
                ))}
                {/* Intake louvres: the rotor has to breathe from somewhere. */}
                <g stroke={palette.dark} strokeWidth={1.1} opacity={0.55} strokeLinecap="round">
                  <path d="M -21 -6 h 9 M -21 1 h 9 M -21 8 h 9 M 12 -6 h 9 M 12 1 h 9 M 12 8 h 9" />
                </g>
              </g>
            </g>

            {arms.map((arm) => (
              <g key={arm.name} data-arm={arm.name} data-limb={limbs}>
                {limb(arm.anchor, arm.tip, 5, 4.2, 2.4)}
                <g data-hand={arm.name} transform={`translate(${px(arm.tip.x)} ${px(arm.tip.y)})`}>
                  <circle r={10.5} {...machined} />
                  <path d="M -10.5 0 A 10.5 10.5 0 0 0 10.5 0 Z" fill={palette.dark} opacity={0.22} />
                </g>
              </g>
            ))}

            {legs.map((leg) => (
              <g key={leg.name} data-foot={leg.name} transform={`translate(${px(leg.tip.x)} ${px(leg.tip.y)})`}>
                <ellipse rx={12} ry={10} {...machined} />
                {/* Toe cap: the part that takes the deck. */}
                <path d="M -11 3.6 A 12 10 0 0 0 11 3.6 A 12 12 0 0 1 -11 3.6 Z" {...cast} />
              </g>
            ))}
          </g>
        </Frame>

        {/* The rotor is a disc in the horizontal plane, so it is drawn once and
            projected: a circle in plan, a sliver in elevation. */}
        <g
          data-rotor
          transform={`translate(${px(rotorHub.x)} ${px(rotorHub.y)}) ${camera.plane(0, spin)}`.trimEnd()}
        >
          <circle
            r={ROTOR_SPAN}
            fill="none"
            stroke={palette.glow}
            strokeWidth={1.2}
            opacity={px(0.05 + lift * 0.16)}
          />
          {Array.from({ length: bladeCount }, (_, index) => (
            <g key={index} data-blade={index} transform={`rotate(${px((index * 360) / bladeCount)})`}>
              <path d={`M 5 -3 L ${ROTOR_SPAN - 4} -1.6 Q ${ROTOR_SPAN} 0 ${ROTOR_SPAN - 4} 1.6 L 5 3 Z`} {...machined} />
            </g>
          ))}
          <circle r={5.5} {...cast} />
        </g>
        <circle
          cx={px(rotorHub.x)}
          cy={px(rotorHub.y - 1)}
          r={2.2}
          fill={signalColor}
          className={signal === "ready" ? "robocn-pulse" : undefined}
        />
      </g>

      {label && (
        <text x={CENTRE} y={226} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/* ------------------------------------------------------------------ maths */

const finite = (value: number) => (Number.isFinite(value) ? value : 0)
const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback
const round3 = (value: number) => Math.round(value * 1000) / 1000

const rotateAbout = (point: Vec2, pivot: Vec2, degrees: number): Vec2 => {
  const a = toRadians(degrees)
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const dx = point.x - pivot.x
  const dy = point.y - pivot.y
  return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos }
}

/** The knuckle of a strut limb: the midpoint, thrown out to one side. */
const midpoint = (a: Vec2, b: Vec2, offset: number): Vec2 => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy) || 1
  return { x: (a.x + b.x) / 2 - (dy / length) * offset, y: (a.y + b.y) / 2 + (dx / length) * offset }
}

/**
 * A coil spring between two points: a sinusoid laid along the axis. The coil
 * count is fixed, so extension shows as pitch — a stretched spring reads as a
 * long, open helix and a compressed one as a tight stack, which is the whole
 * point of hanging the limbs off springs.
 */
export function coilPath(a: Vec2, b: Vec2, coils: number, radius: number): string {
  const turns = Math.max(1, Math.round(Number.isFinite(coils) ? coils : 1))
  const width = Number.isFinite(radius) ? Math.abs(radius) : 1
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  if (!Number.isFinite(length) || length < 0.001) return `M ${px(a.x)} ${px(a.y)}`
  const ux = dx / length
  const uy = dy / length
  const steps = turns * 10
  const points: string[] = []
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps
    // The ends run straight into their collars; only the middle coils.
    const swellUp = Math.min(1, t / 0.12)
    const swellDown = Math.min(1, (1 - t) / 0.12)
    const offset =
      Math.sin(t * turns * Math.PI * 2) * width * Math.min(swellUp, swellDown)
    const x = a.x + ux * length * t - uy * offset
    const y = a.y + uy * length * t + ux * offset
    points.push(`${step ? "L" : "M"} ${px(x)} ${px(y)}`)
  }
  return points.join(" ")
}

/** The grille arc, in the shell's own coordinates. */
const GRIN = { x0: -18, y0: -38, cx: 0, cy: -27, x1: 18, y1: -38 } as const
const grinCurve = () => `M ${GRIN.x0} ${GRIN.y0} Q ${GRIN.cx} ${GRIN.cy} ${GRIN.x1} ${GRIN.y1}`
const grinPoint = (t: number): Vec2 => ({
  x: (1 - t) ** 2 * GRIN.x0 + 2 * (1 - t) * t * GRIN.cx + t ** 2 * GRIN.x1,
  y: (1 - t) ** 2 * GRIN.y0 + 2 * (1 - t) * t * GRIN.cy + t ** 2 * GRIN.y1,
})

/**
 * What it does with no height on it. `lift` is the hover height the loop eases
 * toward, `sway` the lateral drift the limbs trail behind, `wave` the beckoning
 * hand and `voice` the speaker output. All illustrative: there is no thrust,
 * no mass and no spring constant here.
 */
export function guideDroidPose(behavior: GuideDroidBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Rises, talks, and works one hand: the guide getting your attention.
    case "beckon":
      return {
        lift: 0.78 + 0.05 * Math.sin(time * Math.PI * 2),
        sway: 0.14 * Math.sin(time * Math.PI * 1.3),
        wave: 0.5 - 0.5 * Math.cos(time * Math.PI * 3),
        voice: 0.5 + 0.4 * Math.sin(time * 9),
      }
    // Weight on its feet, rotor ticking over.
    case "settle":
      return {
        lift: 0.06 + 0.05 * Math.sin(time * Math.PI),
        sway: 0.05 * Math.sin(time * Math.PI * 0.7),
        wave: 0,
        voice: 0,
      }
    case "static":
      return { lift: 0.5, sway: 0, wave: 0, voice: 0 }
    // Station-keeping: a slow bob and a drift it never quite corrects.
    default:
      return {
        lift: 0.6 + 0.16 * Math.sin(time * Math.PI * 2),
        sway: 0.3 * Math.sin(time * Math.PI * 0.74),
        wave: 0,
        voice: 0,
      }
  }
}

export { GuideDroid }
