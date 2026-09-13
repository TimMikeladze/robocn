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

export type AstromechLegMode = "tripod" | "bipod"
export type AstromechTool = "none" | "probe" | "welder" | "periscope"
export type AstromechDome = "round" | "flat" | "faceted"
export type AstromechLivery = "plain" | "banded" | "paneled"
export type AstromechFeet = "skid" | "wheel" | "tread"
export type AstromechAntenna = "none" | "whip" | "dish"
export type AstromechSignal = "idle" | "ready" | "warning"
export type AstromechBehavior = "work" | "roam" | "idle" | "static"

/** The droid is drawn standing straight on; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"
/** Where it stands in the frame. */
const CENTRE = 90
const GROUND = 192

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface AstromechDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Tripod drops the centre foot and squats; bipod retracts it and stands tall. */
  /** Where the camera stands. One droid, four projections. */
  view?: RobotView
  legMode?: AstromechLegMode
  /** Upper sensor-shell silhouette. */
  dome?: AstromechDome
  /** How much detailing the body carries. */
  livery?: AstromechLivery
  /** What the legs run on. */
  feet?: AstromechFeet
  /** Communications hardware on the dome. */
  antenna?: AstromechAntenna
  /** Service hatches down the body front, clamped to 1–3. */
  ports?: number
  /** Dome heading in degrees, wrapped to −180..180. Omit and `behavior` turns it. */
  domeAngle?: number
  /** Whole-body lean in degrees, clamped to −14..14. Omit and `behavior` rocks it. */
  lean?: number
  /** Open the front service panel. Omit and `behavior` works it. */
  panel?: boolean
  /** Instrument extended from the open panel, or raised from the dome for `periscope`. */
  tool?: AstromechTool
  /** Holographic projection strength, 0–1. Zero hides the cone entirely. Omit and `behavior` fades it. */
  holo?: number
  /** What the unit gets on with when nothing is driving it. */
  behavior?: AstromechBehavior
  /** Work cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** The dome turns to whoever is pointing at it. */
  interactive?: boolean
  signal?: AstromechSignal
  showGround?: boolean
  label?: string
}

function AstromechDroid({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  legMode = "tripod",
  dome = "round",
  livery = "banded",
  feet = "skid",
  antenna = "none",
  ports = 2,
  domeAngle,
  lean,
  panel,
  tool = "none",
  holo,
  behavior = "work",
  speed = 0.25,
  animate = true,
  paused = false,
  phase = 0,
  interactive = true,
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
}: AstromechDroidProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({ speed, animate: animate && behavior !== "static", paused, phase })
  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && domeAngle === undefined && !paused,
    toWorld: React.useCallback((unit: { x: number; y: number }) => ({
      x: (unit.x - 0.5) * 2,
      y: (unit.y - 0.5) * 2,
    }), []),
  })
  const scripted = astromechDroidPose(behavior, clock)
  const aimed = pointer.target ? clamp(pointer.target.x, -1, 1) * 120 : null
  const heading = wrap180(domeAngle ?? aimed ?? scripted.dome)
  const tilt = finiteClamp(lean ?? scripted.lean, -14, 14)
  const projection = finiteClamp(holo ?? scripted.holo, 0, 1)
  const open = panel ?? scripted.panel
  const hatches = Math.round(finiteClamp(ports, 1, 3))
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor = signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

  const swing = Math.sin(toRadians(heading))
  const depth = Math.cos(toRadians(heading))
  // The centre foot carries the body when it is down, so ride height is a
  // function of the chassis mode rather than a separate prop.
  const ride = legMode === "tripod" ? -6 : 0
  const deployed = open && tool !== "none" && tool !== "periscope"
  // The drawing is a front elevation, so it goes through `wall` where the
  // droid stands and comes out untouched straight on. The barrel is a drum
  // rather than a panel, the centre foot is behind the other two rather than
  // between them, and the dome sits on top of both: none of that is in one view.
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
      aria-label={`Astromech droid, ${legMode} chassis, ${dome} dome, ${tool} instrument, ${viewNames[view] ?? viewNames.front}`}
      viewBox="0 0 180 220"
      width={width}
      height={px(width * 1.22)}
      className={cn("max-w-full select-none", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d="M 90 10 V 204 M 18 196 H 162" strokeDasharray="2 3" />
          <path d="M 38 26 H 142 V 194 H 38 Z" strokeDasharray="2 3" />
        </g>
      )}
      {showGround && <ellipse cx={90} cy={195} rx={46} ry={5.5} fill={palette.dark} opacity={0.14} />}

      {projection > 0 && (
        <g data-holo opacity={px(0.2 + projection * 0.55)}>
          <path
            d={`M 118 ${px(120)} L ${px(150 + projection * 8)} ${px(70 - projection * 26)} L ${px(120 - projection * 6)} ${px(58 - projection * 30)} Z`}
            fill={palette.glow}
            opacity={0.35}
          />
          <path
            d={`M 124 ${px(104)} H ${px(146 + projection * 6)}`}
            stroke={palette.accent}
            strokeWidth={1.2}
            strokeDasharray="3 3"
            fill="none"
          />
        </g>
      )}

      {offAxis && <g data-solids transform={`translate(${CENTRE} ${GROUND})`}>
        {legMode === "tripod" && (
          <path d={capsulePath(at(0, -58, -22), at(0, -8, -30), 7)} {...machined} />
        )}
        {([-1, 1] as const).map(side => (
          <g key={side} data-leg={side < 0 ? "left" : "right"}>
            <path d={capsulePath(at(side * 30, ride - 58, 12), at(side * 30, ride - 6, 12), 8)} {...machined} />
            <path d={capsulePath(at(side * 30, ride - 5, -6), at(side * 30, ride - 5, 20), 6)} {...cast} />
          </g>
        ))}
        <path d={drum(24, 128 - ride, 40 - ride)} {...shell} />
        <path d={drum(23, 150 - ride, 128 - ride)} {...machined} />
      </g>}
      <Frame {...frame}>
      <g data-view={view} transform={`translate(90 192) rotate(${px(tilt)})`}>
        {legMode === "tripod" && (
          <g data-leg="centre">
            <rect x={-7} y={-58} width={14} height={48} rx={5} {...machined} />
            <path d="M -12 -12 H 12 Q 18 -12 18 -4 H -16 Z" {...cast} />
            {footDetail(feet, 0.8).map((node, index) => (
              <circle data-foot key={index} cx={node[0]} cy={-8} r={node[1]} {...machined} />
            ))}
          </g>
        )}
        {[-1, 1].map((side) => (
          <g data-leg={side === -1 ? "left" : "right"} key={side} transform={`translate(${side * 30} ${ride})`}>
            <path d="M -9 -74 H 9 V -18 H -9 Z" {...shell} />
            <rect x={-11} y={-80} width={22} height={12} rx={4} {...machined} />
            <path d="M -13 -18 H 13 L 16 -4 H -16 Z" {...cast} />
            {footDetail(feet, 1).map((node, index) => (
              <circle data-foot key={index} cx={node[0]} cy={-8} r={node[1]} {...machined} />
            ))}
          </g>
        ))}

        <g data-body transform={`translate(0 ${ride})`}>
          <path d="M -24 -128 H 24 V -26 Q 0 -18 -24 -26 Z" {...shell} />
          {livery !== "plain" && (
            <g data-livery={livery} stroke={palette.dark} strokeWidth={1} opacity={0.5} fill="none">
              <path d="M -24 -112 H 24 M -24 -44 H 24" />
              {livery === "paneled" && <path d="M -24 -86 H 24 M -24 -66 H 24 M -8 -112 V -44 M 8 -112 V -44" />}
            </g>
          )}
          {Array.from({ length: hatches }, (_, hatch) => (
            <rect
              data-port
              key={hatch}
              x={6}
              y={px(-100 + hatch * 18)}
              width={14}
              height={14}
              rx={3}
              {...machined}
            />
          ))}
          <g data-panel={open ? "open" : "closed"}>
            {open ? (
              <>
                <path d="M -14 -104 H 2 V -66 H -14 Z" {...cast} transform="translate(-16 0) rotate(-14 -14 -104)" />
                <rect x={-14} y={-104} width={16} height={38} rx={2} {...machined} />
                <g stroke={palette.accent} strokeWidth={1.2} fill="none" opacity={0.8}>
                  <path d="M -11 -98 H -1 M -11 -90 H -1 M -11 -82 H -1" />
                </g>
              </>
            ) : (
              <rect x={-14} y={-104} width={16} height={38} rx={3} {...cast} />
            )}
          </g>
          <circle cx={-20} cy={-34} r={6} fill={signalColor} stroke={palette.dark} strokeWidth={0.6} />

          {deployed && (
            <g data-tool={tool} transform="translate(-30 -86)">
              <rect x={0} y={-2.5} width={16} height={5} rx={2.5} {...machined} />
              {tool === "probe" && (
                <>
                  <rect x={-10} y={-2} width={10} height={4} rx={2} {...cast} />
                  <circle cx={-13} r={2.6} fill={signalColor} />
                </>
              )}
              {tool === "welder" && (
                <>
                  <path d="M 0 -4 L -12 0 L 0 4 Z" {...cast} />
                  <circle cx={-15} r={3.4} fill={palette.glow} opacity={0.85} />
                </>
              )}
            </g>
          )}
        </g>

        <g data-dome data-dome-shape={dome} transform={`translate(${px(swing * 4)} ${ride - 128})`}>
          <path d={domeOutline(dome)} {...shell} />
          <path d="M -25 0 H 25" stroke={palette.dark} strokeWidth={1.2} fill="none" />
          {dome === "round" && (
            <path d={`M ${px(-18 + swing * 6)} -6 A 20 17 0 0 1 ${px(18 + swing * 6)} -6`} fill="none" stroke={palette.dark} strokeWidth={1} opacity={0.5} />
          )}
          <circle
            data-eye
            cx={px(swing * 15)}
            cy={-10}
            r={px(5 + 2 * Math.abs(depth))}
            fill={palette.dark}
            stroke={palette.metal}
            strokeWidth={1}
          />
          <circle cx={px(swing * 15)} cy={-10} r={2.4} fill={signalColor} />
          {antenna === "whip" && (
            <path data-antenna="whip" d={`M ${px(-12 + swing * 5)} -14 V -44`} stroke={palette.metal} strokeWidth={1.6} fill="none" strokeLinecap="round" />
          )}
          {antenna === "dish" && (
            <g data-antenna="dish" transform={`translate(${px(-13 + swing * 5)} -16)`}>
              <path d="M -6 0 L 6 -6 V -18 L -6 -12 Z" {...cast} />
              <path d="M 0 -3 V -12" stroke={palette.metal} strokeWidth={1.4} fill="none" />
            </g>
          )}
          {tool === "periscope" && (
            <g data-tool="periscope" transform={`translate(${px(swing * 6)} 0)`}>
              <rect x={-2.5} y={-40} width={5} height={24} rx={2} {...machined} />
              <path d="M -7 -46 H 7 V -38 H -7 Z" {...cast} />
              <circle cx={4} cy={-42} r={2} fill={signalColor} />
            </g>
          )}
        </g>
      </g>
      </Frame>
      {label && (
        <text x={90} y={214} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

const finiteClamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : 0

const wrap180 = (value: number) => {
  if (!Number.isFinite(value)) return 0
  return px(((((value + 180) % 360) + 360) % 360) - 180)
}

/** The three dome silhouettes, all filling the same 50×23 envelope. */
const domeOutline = (dome: AstromechDome) => {
  switch (dome) {
    case "flat":
      return "M -25 0 V -13 Q -25 -18 -18 -18 H 18 Q 25 -18 25 -13 V 0 Z"
    case "faceted":
      return "M -25 0 L -19 -15 L -8 -23 H 8 L 19 -15 L 25 0 Z"
    default:
      return "M -25 0 A 25 23 0 0 1 25 0 Z"
  }
}

/** Contact hardware under one foot: [x, radius] per node. */
const footDetail = (feet: AstromechFeet, scale: number): [number, number][] => {
  switch (feet) {
    case "wheel":
      return [[0, px(6 * scale)]]
    case "tread":
      return [
        [px(-7 * scale), px(3 * scale)],
        [0, px(3 * scale)],
        [px(7 * scale), px(3 * scale)],
      ]
    default:
      return [[0, px(4.5 * scale)]]
  }
}

/** What each behavior is doing at `clock`. Pure, so tests can read it. */
export function astromechDroidPose(behavior: AstromechBehavior, clock: number) {
  const t = Number.isFinite(clock) ? clock : 0
  const cycle = ((t % 1) + 1) % 1
  switch (behavior) {
    case "roam":
      return { dome: Math.sin(t * Math.PI * 2) * 150, lean: Math.sin(t * Math.PI * 4) * 6, panel: false, holo: 0 }
    case "idle":
      return { dome: Math.sin(t * Math.PI * 0.6) * 22, lean: Math.sin(t * Math.PI * 0.5) * 2, panel: false, holo: 0 }
    case "static":
      return { dome: 0, lean: 0, panel: false, holo: 0 }
    default: {
      // Turn to the socket, open up, project, then close and look away.
      const panel = cycle > 0.24 && cycle < 0.86
      const holo =
        cycle < 0.34 ? 0
        : cycle < 0.46 ? (cycle - 0.34) / 0.12
        : cycle < 0.72 ? 1
        : cycle < 0.84 ? 1 - (cycle - 0.72) / 0.12
        : 0
      return { dome: cycle < 0.2 ? 60 : -18, lean: Math.sin(t * Math.PI * 2) * 3, panel, holo }
    }
  }
}

export { AstromechDroid }
