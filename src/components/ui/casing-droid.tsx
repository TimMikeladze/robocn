"use client"

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"

import { clamp, toRadians } from "@/lib/robocn/kinematics"
import {
  aboutPoint,
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

export type CasingDroidSkirt = "banded" | "smooth" | "ribbed"
export type CasingDroidManipulator = "none" | "suction" | "clamp" | "probe"
export type CasingDroidDome = "round" | "flat" | "faceted"
export type CasingDroidCollar = "slats" | "mesh" | "plain"
export type CasingDroidEmitter = "none" | "rod" | "dish" | "array"
export type CasingDroidLamps = "none" | "pair" | "quad"
export type CasingDroidSignal = "idle" | "ready" | "warning"
export type CasingDroidBehavior = "patrol" | "survey" | "idle" | "static"

/** The droid is drawn standing straight on; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"
/** Where it stands in the frame. */
const CENTRE = 85
const GROUND = 202

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface CasingDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Lower casing treatment. Geometry of the flare is shared; the surface is not. */
  /** Where the camera stands. One droid, four projections. */
  view?: RobotView
  skirt?: CasingDroidSkirt
  /** Rows of hemispheres on the skirt, clamped to 2–4. */
  hemisphereRows?: number
  /** Hemispheres across each row, clamped to 3–6. */
  hemisphereColumns?: number
  /** Upper sensor-shell silhouette. */
  dome?: CasingDroidDome
  /** Mid-section treatment between the skirt and the neck. */
  collar?: CasingDroidCollar
  /** Rings in the neck cage, clamped to 2–5. */
  neckRings?: number
  /** Eyestalk length as a multiple of the standard reach, clamped to 0.5–1.8. */
  stalkLength?: number
  /** Dome heading in degrees, wrapped to −180..180. Swings the eyestalk around the casing. Omit and `behavior` turns it. */
  domeAngle?: number
  /** Eyestalk pitch in degrees, clamped to −28..28. Omit and `behavior` works it. */
  eyeElevation?: number
  /** What the droid does when the dome is not being driven. */
  behavior?: CasingDroidBehavior
  /** Sweeps per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** The eyestalk follows the pointer, because of course it does. */
  interactive?: boolean
  /** Tool on the left appendage. */
  manipulator?: CasingDroidManipulator
  /** Hardware on the right appendage. */
  emitter?: CasingDroidEmitter
  /** Dome lamp arrangement. */
  lamps?: CasingDroidLamps
  signal?: CasingDroidSignal
  showGround?: boolean
  label?: string
}

function CasingDroid({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  skirt = "banded",
  hemisphereRows = 3,
  hemisphereColumns = 4,
  dome = "round",
  collar = "slats",
  neckRings = 3,
  stalkLength = 1,
  domeAngle,
  eyeElevation,
  behavior = "patrol",
  speed = 0.18,
  animate = true,
  paused = false,
  phase = 0,
  interactive = true,
  manipulator = "suction",
  emitter = "array",
  lamps = "pair",
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
  ...props
}: CasingDroidProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({ speed, animate: animate && behavior !== "static", paused, phase })
  // An eyestalk that follows you is the entire point of this machine.
  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && domeAngle === undefined && !paused,
    toWorld: React.useCallback((unit: { x: number; y: number }) => ({
      x: (unit.x - 0.5) * 2,
      y: (unit.y - 0.5) * 2,
    }), []),
  })
  const scripted = casingDroidPose(behavior, clock)
  const watched = pointer.target
  const heading = wrap180(domeAngle ?? (watched ? clamp(watched.x, -1, 1) * 115 : scripted.dome))
  const pitch = finiteClamp(
    eyeElevation ?? (watched ? clamp(-watched.y, -1, 1) * 22 : scripted.eye),
    -28,
    28,
  )
  const rows = Math.round(finiteClamp(hemisphereRows, 2, 4))
  const columns = Math.round(finiteClamp(hemisphereColumns, 3, 6))
  const rings = Math.round(finiteClamp(neckRings, 2, 5))
  const reach = finiteClamp(stalkLength, 0.5, 1.8) || 1
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor = signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

  // The dome turns about a vertical axis, so the eyestalk swings sideways and
  // foreshortens instead of orbiting the drawing plane.
  const swing = Math.sin(toRadians(heading))
  const depth = Math.cos(toRadians(heading))
  const stalk = px((17 + 11 * depth) * reach)
  // Studs are laid into the cone rather than onto a fixed grid, so a taller or
  // busier skirt still keeps every hemisphere inside the silhouette.
  const rowTop = -64
  const rowBottom = -12
  const rowGap = rows > 1 ? (rowBottom - rowTop) / (rows - 1) : 0
  // The drawing is a front elevation, so it goes through `wall` where the
  // droid stands and comes out untouched straight on. The casing is a cone of
  // revolution and the dome a hemisphere on top of it; the manipulator and the
  // emitter reach forward out of the shoulders rather than sideways across it.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const face = aboutPoint(camera.wall(), CENTRE, GROUND)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  /** A point in the frame, `deep` units toward the reader. */
  const at = (x: number, y: number, deep = 0) => camera.project(-x, -y, -deep)
  /** A drum: round in plan, standing between two heights. */
  const drum = (radius: number, top: number, bottom: number, x = 0) =>
    extrudedPath(circleFootprint(-x, 0, radius, 14), camera, -top, -bottom)


  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Casing droid, ${skirt} skirt, ${dome} dome, ${manipulator} manipulator, ${viewNames[view] ?? viewNames.front}`}
      viewBox="0 0 170 230"
      width={width}
      height={px(width * 1.35)}
      className={cn("max-w-full select-none", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d="M 85 8 V 214 M 14 206 H 156" strokeDasharray="2 3" />
          <path d="M 30 26 H 140 V 204 H 30 Z" strokeDasharray="2 3" />
        </g>
      )}
      {showGround && <ellipse cx={85} cy={205} rx={48} ry={6} fill={palette.dark} opacity={0.14} />}

      {offAxis && <g data-solids transform={`translate(${CENTRE} ${GROUND})`}>
        <path
          d={extrudedPath(
            circleFootprint(0, 0, 42, 16), camera, -76, 0,
          )}
          {...shell}
        />
        <path d={drum(27, 104, 76)} {...machined} />
        <path d={drum(21, 138, 104)} {...cast} />
        <path d={drum(24, 160, 138, swing * 3)} {...shell} />
        {([[-26, "manipulator"], [26, "emitter"]] as const).map(([x, name]) => (
          <path key={name} d={capsulePath(at(x, -104, 6), at(x * 1.1, -104, 34), 4)} {...machined} />
        ))}
      </g>}
      <Frame {...frame}>
      <g data-view={view} transform="translate(85 202)">
        <g data-skirt={skirt}>
          <path d="M -42 0 L -27 -76 H 27 L 42 0 Z" {...shell} />
          {skirt === "ribbed" && (
            <g stroke={palette.dark} strokeWidth={1} opacity={0.55}>
              <path d="M -21 -4 L -14 -74 M 0 -4 V -74 M 21 -4 L 14 -74" />
            </g>
          )}
          {skirt !== "smooth" &&
            Array.from({ length: rows }, (_, row) => {
              const y = rowTop + row * rowGap
              // The casing tapers, so every row measures the cone at its own height.
              const half = skirtHalfWidth(y)
              const radius = Math.min(6.4, (half * 1.5) / columns)
              const span = Math.max(0, half - radius - 3)
              return (
                <g key={row}>
                  {Array.from({ length: columns }, (_, column) => {
                    const slot = columns === 1 ? 0 : (column / (columns - 1)) * 2 - 1
                    return <circle key={column} cx={px(slot * span)} cy={px(y)} r={px(radius)} {...machined} />
                  })}
                </g>
              )
            })}
          <path d="M -42 -2 H 42" stroke={palette.dark} strokeWidth={1.2} fill="none" />
        </g>

        <g data-belt data-collar={collar}>
          <path d="M -28 -76 H 28 L 25 -98 H -25 Z" {...cast} />
          {collar === "slats" && (
            <g stroke={palette.metal} strokeWidth={1.2} opacity={0.7}>
              <path d="M -18 -78 V -96 M -6 -78 V -96 M 6 -78 V -96 M 18 -78 V -96" />
            </g>
          )}
          {collar === "mesh" && (
            <g stroke={palette.metal} strokeWidth={0.9} opacity={0.6}>
              <path d="M -24 -78 L -10 -96 M -12 -78 L 2 -96 M 0 -78 L 14 -96 M 12 -78 L 24 -96" />
              <path d="M -24 -96 L -10 -78 M -12 -96 L 2 -78 M 0 -96 L 14 -78 M 12 -96 L 24 -78" />
            </g>
          )}
          <path d="M -27 -98 H 27 L 24 -118 H -24 Z" {...machined} />
          <rect data-lamp-bar x={-16} y={-116} width={32} height={7} rx={3} {...cast} />
        </g>

        <g data-neck>
          {Array.from({ length: rings }, (_, ring) => (
            // The cage always spans the same gap, so more rings means a finer stack.
            <rect
              data-neck-ring
              key={ring}
              x={-16}
              y={px(-120 - (ring * 16) / (rings - 1 || 1))}
              width={32}
              height={5}
              rx={2.5}
              {...cast}
            />
          ))}
          <path d="M -12 -120 V -138 M 0 -120 V -138 M 12 -120 V -138" stroke={palette.metal} strokeWidth={1.4} fill="none" />
        </g>

        <g data-dome data-dome-shape={dome} transform={`translate(${px(swing * 3)} -138)`}>
          <path d={domeOutline(dome)} {...shell} />
          <path d="M -25 0 H 25" stroke={palette.dark} strokeWidth={1.2} fill="none" />
          {lampPositions(lamps).map(([x, y], index) => (
            <circle
              data-lamp={index}
              key={`${x}-${y}`}
              cx={px(x + swing * 4)}
              cy={y}
              r={4.2}
              fill={signalColor}
              stroke={palette.dark}
              strokeWidth={0.6}
            />
          ))}
          <g data-eyestalk transform={`translate(${px(swing * 16)} -6) rotate(${px(-pitch)})`}>
            <rect x={0} y={-2} width={stalk} height={4} rx={2} {...machined} />
            <circle cx={stalk} r={5.5} {...cast} />
            <circle cx={stalk} r={2.6} fill={signalColor} />
          </g>
        </g>

        <g data-manipulator={manipulator} transform="translate(-26 -104)">
          {manipulator !== "none" && (
            <>
              <circle r={5} {...cast} />
              <rect x={-30} y={-2.5} width={30} height={5} rx={2.5} {...machined} />
              {manipulator === "suction" && <path d="M -30 -9 L -42 -13 V 13 L -30 9 Z" {...cast} />}
              {manipulator === "clamp" && (
                <g {...machined}>
                  <path d="M -30 -3 L -43 -11 L -40 -4 L -30 -1 Z" />
                  <path d="M -30 3 L -43 11 L -40 4 L -30 1 Z" />
                </g>
              )}
              {manipulator === "probe" && (
                <>
                  <rect x={-41} y={-3.5} width={11} height={7} rx={2} {...cast} />
                  <circle cx={-44} r={3} fill={signalColor} />
                </>
              )}
            </>
          )}
        </g>

        {emitter !== "none" && (
          <g data-emitter={emitter} transform="translate(26 -104)">
            <circle r={5} {...cast} />
            <rect x={0} y={-2} width={26} height={4} rx={2} {...machined} />
            {emitter === "array" &&
              [8, 15, 22].map((x) => (
                <circle key={x} cx={x} r={4.5} fill="none" stroke={palette.metal} strokeWidth={1.4} />
              ))}
            {emitter === "dish" && <path d="M 24 -11 L 34 -14 V 14 L 24 11 Z" {...cast} />}
            <circle cx={28} r={2.8} fill={signalColor} />
          </g>
        )}
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

/** Half-width of the skirt at a given height: 42 at the base, 27 at the top. */
const skirtHalfWidth = (y: number) => 42 - (Math.min(0, Math.max(-76, y)) / -76) * 15

/** The three dome silhouettes, all filling the same 50×22 envelope. */
const domeOutline = (dome: CasingDroidDome) => {
  switch (dome) {
    case "flat":
      return "M -25 0 V -12 Q -25 -17 -18 -17 H 18 Q 25 -17 25 -12 V 0 Z"
    case "faceted":
      return "M -25 0 L -20 -14 L -9 -22 H 9 L 20 -14 L 25 0 Z"
    default:
      return "M -25 0 A 25 22 0 0 1 25 0 Z"
  }
}

/** Where the dome lamps sit, in dome-local coordinates. */
const lampPositions = (lamps: CasingDroidLamps): [number, number][] => {
  switch (lamps) {
    case "none":
      return []
    case "quad":
      return [
        [-15, -9],
        [-6, -16],
        [6, -16],
        [15, -9],
      ]
    default:
      return [
        [-13, -13],
        [13, -13],
      ]
  }
}

const finiteClamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : 0

/** Heading is cyclic, so out-of-range input wraps instead of sticking at a limit. */
const wrap180 = (value: number) => {
  if (!Number.isFinite(value)) return 0
  return px(((((value + 180) % 360) + 360) % 360) - 180)
}

/** The sweep each behavior traces, sampled at `clock`. Pure, so tests can read it. */
export function casingDroidPose(behavior: CasingDroidBehavior, clock: number) {
  const t = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    case "survey":
      return { dome: Math.sin(t * Math.PI * 2) * 165, eye: Math.sin(t * Math.PI * 4) * 16 }
    case "idle":
      return { dome: Math.sin(t * Math.PI * 0.6) * 14, eye: Math.sin(t * Math.PI * 0.9) * 5 }
    case "static":
      return { dome: 0, eye: 0 }
    default: {
      // Patrol holds a bearing, swings to the next one, and holds again.
      const cycle = ((t % 1) + 1) % 1
      const dome = cycle < 0.4 ? -70 : cycle < 0.5 ? -70 + (cycle - 0.4) * 1400 : cycle < 0.9 ? 70 : 70 - (cycle - 0.9) * 1400
      return { dome, eye: Math.sin(t * Math.PI * 1.4) * 7 }
    }
  }
}

export { CasingDroid }
