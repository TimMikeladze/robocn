"use client"

/**
 * ion-interceptor — a twin ion-drive interceptor: a pod slung between two flat
 * panels.
 *
 * The panels are the machine. Each hangs off its own pylon and pitches about
 * that pylon's axis, so the same geometry is a pair of tall hexagons head-on, a
 * pair of *lines* from straight above when they are square, and a pair of
 * widening slabs as they come round. Nothing is redrawn per angle: the panel is
 * a flat plate in space and the camera does the rest.
 *
 * The pod turns inside them. Yaw the pod and the viewport, the emitters and the
 * nose armour all come round with it while the pylons and panels stay where the
 * airframe put them — which is the whole point of hanging a ball between two
 * spars.
 *
 * A science-fiction archetype, not a character: no markings, no livery, no
 * franchise. There is no aerodynamics here, and no ion physics either.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, toRadians, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  boxCorners,
  fitTransform,
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

const VIEW_WIDTH = 240
const VIEW_HEIGHT = 220
const NATIVE_VIEW: RobotView = "front"

/** The interceptor in world units: nose at −z, starboard at +x, up at +y. */
const POD_RADIUS = 25
const PYLON_FROM = 21
const PYLON_TO = 50
const PANEL_X = 54
const PANEL_HALF_HEIGHT = 74
const PANEL_HALF_WIDTH = 21
const PANEL_SHOULDER = 0.46
const MAX_PITCH = 80
const MAX_YAW = 55
/** Degrees of panel per second while it eases back into a behaviour. */
const PANEL_RATE = 46

const ENVELOPE = boxCorners(
  { x: -80, y: -80, z: -80 },
  { x: 80, y: 80, z: 80 },
)

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/** The panel outline in its own plane: a hexagon with flattened shoulders. */
const PANEL: Vec2[] = [
  { x: -PANEL_HALF_WIDTH, y: -PANEL_HALF_HEIGHT * PANEL_SHOULDER },
  { x: 0, y: -PANEL_HALF_HEIGHT },
  { x: PANEL_HALF_WIDTH, y: -PANEL_HALF_HEIGHT * PANEL_SHOULDER },
  { x: PANEL_HALF_WIDTH, y: PANEL_HALF_HEIGHT * PANEL_SHOULDER },
  { x: 0, y: PANEL_HALF_HEIGHT },
  { x: -PANEL_HALF_WIDTH, y: PANEL_HALF_HEIGHT * PANEL_SHOULDER },
]

export type InterceptorBehavior = "patrol" | "intercept" | "static"

export interface IonInterceptorProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Panel pitch about the pylons, in degrees. Supplying it stops the loop. */
  panelPitch?: number
  onPanelPitchChange?: (pitch: number) => void
  /** The pod's own yaw inside the pylons, in degrees. Omit and the behaviour turns it. */
  yaw?: number
  behavior?: InterceptorBehavior
  view?: RobotView
  /** The ribs across each panel's face. */
  ribs?: number
  /** Light the emitters and the viewport. Omit and they light unless it is parked. */
  active?: boolean
  interactive?: boolean
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function IonInterceptor({
  panelPitch,
  onPanelPitchChange,
  yaw,
  behavior = "patrol",
  view = NATIVE_VIEW,
  ribs = 3,
  active,
  interactive = false,
  speed = 0.3,
  animate = true,
  paused = false,
  phase = 0,
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
}: IonInterceptorProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = panelPitch !== undefined

  const hold = controlled
    ? Number.isFinite(panelPitch) ? clamp(panelPitch as number, -MAX_PITCH, MAX_PITCH) : 0
    : held
  const goal = React.useCallback(
    (clock: number) => interceptorPanels(behavior, clock),
    [behavior],
  )
  const motion = useRobotScalar(goal, {
    rate: PANEL_RATE,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const pitch = clamp(motion.value, -MAX_PITCH, MAX_PITCH)
  const turn = yaw !== undefined
    ? Number.isFinite(yaw) ? clamp(yaw, -MAX_YAW, MAX_YAW) : 0
    : clamp(
        interceptorYaw(behavior, Number.isFinite(motion.clock) ? motion.clock : 0),
        -MAX_YAW,
        MAX_YAW,
      )

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, -MAX_PITCH, MAX_PITCH) * 10) / 10
      setHeld(bounded)
      onPanelPitchChange?.(bounded)
    },
    [onPanelPitchChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => apply((unit.x - 0.5) * 2 * MAX_PITCH),
      [apply],
    ),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)

  const pitchRad = toRadians(pitch)
  const cosPitch = Math.cos(pitchRad)
  const sinPitch = Math.sin(pitchRad)
  /** A panel point: the plate lies across the machine, and pitches about its pylon. */
  const onPanel = (side: 1 | -1) => (point: Vec2, depth: number): Vec3 => ({
    x: side * PANEL_X + point.x * side,
    y: point.y * cosPitch - depth * sinPitch,
    z: point.y * sinPitch + depth * cosPitch,
  })

  const yawRad = toRadians(turn)
  const cosYaw = Math.cos(yawRad)
  const sinYaw = Math.sin(yawRad)
  /** A pod point: the ball turns about the vertical inside the pylons. */
  const inPod = (point: Vec3): Vec3 => ({
    x: point.x * cosYaw + point.z * sinYaw,
    y: point.y,
    z: -point.x * sinYaw + point.z * cosYaw,
  })

  const project = (point: Vec3) => camera.project(point.x, point.y, point.z)
  const solid = (corners: Vec3[]) => slabPath(corners, camera)
  const line = (points: Vec3[], close = false) =>
    `${points
      .map((point, index) => {
        const screen = project(point)
        return `${index ? "L" : "M"} ${px(screen.x)} ${px(screen.y)}`
      })
      .join(" ")}${close ? " Z" : ""}`

  /** A sphere, as the stack of rings it is. */
  const ball = (radius: number, steps = 5) =>
    Array.from({ length: steps }, (_, index) => {
      const t = (index + 0.5) / steps
      const y = (t * 2 - 1) * radius
      return { y, r: Math.sqrt(Math.max(0, radius * radius - y * y)) }
    }).flatMap(({ y, r }) =>
      Array.from({ length: 10 }, (_, spoke) => {
        const angle = (spoke / 10) * Math.PI * 2
        return { x: Math.cos(angle) * r, y, z: Math.sin(angle) * r }
      }),
    )

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const lit = active ?? behavior !== "static"
  const ribCount = Number.isFinite(ribs) ? clamp(Math.round(ribs), 0, 6) : 3

  const wing = (side: 1 | -1) => {
    const place = onPanel(side)
    const name = side > 0 ? "starboard" : "port"
    return (
      <g key={name} data-panel={name} data-pitch={px(pitch)}>
        <path
          d={solid(PANEL.flatMap((point) => [place(point, 2), place(point, -2)]))}
          {...shell}
        />
        {/* Ribs across the face: they foreshorten with the panel, and vanish
            with it when the plate is edge-on to the camera. */}
        {Array.from({ length: ribCount }, (_, index) => {
          const t = ribCount === 1 ? 0 : (index / (ribCount - 1)) * 2 - 1
          const y = t * PANEL_HALF_HEIGHT * 0.72
          return (
            <path
              key={index}
              d={line([
                place({ x: -PANEL_HALF_WIDTH + 3, y }, 2.4),
                place({ x: PANEL_HALF_WIDTH - 3, y }, 2.4),
              ])}
              fill="none"
              stroke={palette.dark}
              strokeWidth={1.8}
              opacity={0.55}
            />
          )
        })}
        <path
          data-spar={name}
          d={line([
            place({ x: 0, y: -PANEL_HALF_HEIGHT + 6 }, 2.4),
            place({ x: 0, y: PANEL_HALF_HEIGHT - 6 }, 2.4),
          ])}
          fill="none"
          stroke={palette.metal}
          strokeWidth={2.4}
        />
        <path
          data-pylon={name}
          d={solid([
            { x: side * PYLON_FROM, y: 5, z: 5 },
            { x: side * PYLON_FROM, y: -5, z: 5 },
            { x: side * PYLON_FROM, y: 5, z: -5 },
            { x: side * PYLON_FROM, y: -5, z: -5 },
            { x: side * PYLON_TO, y: 3.5, z: 3.5 },
            { x: side * PYLON_TO, y: -3.5, z: 3.5 },
            { x: side * PYLON_TO, y: 3.5, z: -3.5 },
            { x: side * PYLON_TO, y: -3.5, z: -3.5 },
          ])}
          {...machined}
        />
      </g>
    )
  }

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Twin ion-drive interceptor, panels pitched ${Math.round(pitch)} degrees, pod yawed ${Math.round(turn)} degrees, ${viewNames[view] ?? viewNames.front}`
      }
      aria-valuemin={interactive ? -MAX_PITCH : undefined}
      aria-valuemax={interactive ? MAX_PITCH : undefined}
      aria-valuenow={interactive ? px(pitch) : undefined}
      aria-valuetext={interactive ? `panels pitched ${Math.round(pitch)} degrees` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 15 : 5, 30)
        if (delta !== 0) apply(pitch + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "Escape") setHeld(null)
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
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path
            d={`M ${VIEW_WIDTH / 2} 8 V ${VIEW_HEIGHT - 8} M 8 ${VIEW_HEIGHT / 2} H ${VIEW_WIDTH - 8}`}
            strokeDasharray="2 3"
          />
        </g>
      )}

      <g data-view={view} data-panel-pitch={px(pitch)} data-yaw={px(turn)} transform={frame || undefined}>
        {wing(-1)}
        {wing(1)}

        <g data-pod data-angle={px(turn)}>
          <path d={solid(ball(POD_RADIUS).map(inPod))} {...shell} />
          {/* The armoured face the viewport sits in, and the viewport itself. */}
          <path
            data-visor
            d={solid(
              [
                { x: -15, y: 15, z: -POD_RADIUS + 2 },
                { x: 15, y: 15, z: -POD_RADIUS + 2 },
                { x: -18, y: -15, z: -POD_RADIUS + 2 },
                { x: 18, y: -15, z: -POD_RADIUS + 2 },
                { x: -13, y: 13, z: -POD_RADIUS - 3 },
                { x: 13, y: 13, z: -POD_RADIUS - 3 },
                { x: -15, y: -13, z: -POD_RADIUS - 3 },
                { x: 15, y: -13, z: -POD_RADIUS - 3 },
              ].map(inPod),
            )}
            {...cast}
          />
          <path
            data-viewport
            d={line(
              Array.from({ length: 14 }, (_, index) => {
                const angle = (index / 14) * Math.PI * 2
                return inPod({
                  x: Math.cos(angle) * 10,
                  y: Math.sin(angle) * 10,
                  z: -POD_RADIUS - 3.6,
                })
              }),
              true,
            )}
            fill={lit ? palette.accent : palette.metal}
            opacity={lit ? 0.65 : 0.4}
          />
          {/* Twin emitters, aft, turning with the pod. */}
          {[-9, 9].map((x) => (
            <g key={x}>
              <path
                data-emitter={x < 0 ? "port" : "starboard"}
                d={solid(
                  [
                    { x: x - 5, y: 5, z: POD_RADIUS - 4 },
                    { x: x + 5, y: 5, z: POD_RADIUS - 4 },
                    { x: x - 5, y: -5, z: POD_RADIUS - 4 },
                    { x: x + 5, y: -5, z: POD_RADIUS - 4 },
                    { x: x - 6.5, y: 6.5, z: POD_RADIUS + 8 },
                    { x: x + 6.5, y: 6.5, z: POD_RADIUS + 8 },
                    { x: x - 6.5, y: -6.5, z: POD_RADIUS + 8 },
                    { x: x + 6.5, y: -6.5, z: POD_RADIUS + 8 },
                  ].map(inPod),
                )}
                {...machined}
              />
              {lit && (
                <path
                  data-wash={x < 0 ? "port" : "starboard"}
                  d={line([
                    inPod({ x, y: 0, z: POD_RADIUS + 9 }),
                    inPod({ x, y: 0, z: POD_RADIUS + 30 }),
                  ])}
                  fill="none"
                  stroke={palette.glow}
                  strokeWidth={5}
                  strokeLinecap="round"
                  opacity={0.5}
                />
              )}
            </g>
          ))}
          {/* Hatch ring on the crown, so the ball has an up. */}
          <path
            data-hatch
            d={line(
              Array.from({ length: 12 }, (_, index) => {
                const angle = (index / 12) * Math.PI * 2
                return inPod({
                  x: Math.cos(angle) * 8,
                  y: POD_RADIUS - 2,
                  z: Math.sin(angle) * 8,
                })
              }),
              true,
            )}
            fill="none"
            stroke={palette.dark}
            strokeWidth={1.6}
            opacity={0.6}
          />
        </g>
      </g>

      {label && (
        <text
          x={VIEW_WIDTH / 2}
          y={VIEW_HEIGHT - 5}
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

/** The panel pitch the interceptor is holding at `clock`, in degrees. */
export function interceptorPanels(behavior: InterceptorBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  const t = clock * Math.PI * 2
  return behavior === "intercept"
    ? Math.sin(t * 0.9) * 62
    : Math.sin(t * 0.35) * 22
}

/** The pod's own yaw at `clock`, in degrees. */
export function interceptorYaw(behavior: InterceptorBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  const t = clock * Math.PI * 2
  return behavior === "intercept"
    ? Math.sin(t * 1.3 + 0.7) * 42
    : Math.sin(t * 0.5 + 0.4) * 14
}

export { IonInterceptor }
