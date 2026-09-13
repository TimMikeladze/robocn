"use client"

/**
 * slate-tablet — a slate and the stand holding it up.
 *
 * `recline` is one axis moving two things: how far the slate leans back, and
 * the stand that has to close the triangle under it. The foot is solved, not
 * drawn — given the drop from the hinge to the desk, the horizontal run is
 * whatever is left of the leg.
 *
 * Shorten the leg past what the tilt needs and the stand folds flat instead of
 * stretching, and the label says so. A drawing that let the leg grow would be
 * lying about the only mechanism it has.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { panelTransform, standPose } from "@/lib/robocn/device"
import { clamp, convexHull2, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import {
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

const VIEW_WIDTH = 190
const VIEW_HEIGHT = 172
/** Where the slate's bottom edge, on the desk, lands in the frame. */
const ORIGIN = { x: 95, y: 118 }

/** World units: x starboard, y up, z toward the back. */
const HALF_W = 52
const SLATE = 78
const SLATE_T = 4.4
/** How far up the back of the slate the stand is hinged. */
const MOUNT = 44
const STAND_HALF_W = 26
/** Recline (0–1) per second while easing back into the behaviour. */
const SLEW_RATE = 0.8
const NATIVE_VIEW: RobotView = "profile"

const frames: Record<RobotView, { zoom: number; dx: number; dy: number }> = {
  plan: { zoom: 0.88, dx: 0, dy: -44 },
  front: { zoom: 0.94, dx: 0, dy: 28 },
  profile: { zoom: 0.94, dx: 34, dy: 24 },
  iso: { zoom: 0.74, dx: 24, dy: 34 },
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type TabletBehavior = "prop" | "sketch" | "static"
export type TabletScreen = "home" | "sketch" | "off"

export interface SlateTabletProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled recline, 0 nearly upright to 1 laid right back. */
  recline?: number
  /** What the slate does when `recline` is not supplied. */
  behavior?: TabletBehavior
  /** Stand leg length in world units, clamped 20–80. Short legs fold. */
  leg?: number
  /** Where the camera stands. One slate, four projections. */
  view?: RobotView
  /** Recline cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag the slate back, or arrow-key it. */
  interactive?: boolean
  onReclineChange?: (recline: number) => void
  /** What the display is showing. Structure only — no application artwork. */
  screen?: TabletScreen
  /** Dock the stylus along the top edge. */
  stylus?: boolean
  showDesk?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function SlateTablet({
  recline,
  behavior = "prop",
  leg = 46,
  view = NATIVE_VIEW,
  speed = 0.22,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onReclineChange,
  screen = "home",
  stylus = true,
  showDesk = true,
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
}: SlateTabletProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const legLength = Number.isFinite(leg) ? clamp(leg, 20, 80) : 46
  const controlled = recline !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? (Number.isFinite(recline) ? clamp(recline, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => tabletGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: SLEW_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const at01 = clamp(Number.isFinite(motion.value) ? motion.value : 0, 0, 1)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = clamp(next, 0, 1)
      setHeld(bounded)
      onReclineChange?.(bounded)
    },
    [onReclineChange, setHeld],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // Down the frame lays it back, the way a hand pushes the top edge over.
    onDrag: React.useCallback((unit: Vec2) => apply((unit.y * VIEW_HEIGHT - 30) / 86), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), [setHeld]),
  })

  const pose = standPose(at01, SLATE, legLength, MOUNT)
  const readout = Math.round(at01 * 100)

  const camera = robotCamera(view)
  const frame = frames[view] ?? frames.profile

  // The solver works in the slate's own side elevation — x toward the back,
  // y down. Lift it into world units: that plane is the machine's z–y plane.
  const world = (planar: Vec2, x: number) => ({ x, y: -planar.y, z: planar.x })
  const tilt = toRadians(pose.tilt)
  // Out of the front face of the slate, in the same plane.
  const normal = { x: -Math.cos(tilt), y: -Math.sin(tilt) }
  const faceOffset = (planar: Vec2, side: number) => ({
    x: planar.x + normal.x * side * (SLATE_T / 2),
    y: planar.y + normal.y * side * (SLATE_T / 2),
  })
  const foot0 = { x: 0, y: 0 }

  const corners = [1, -1].flatMap((side) =>
    [foot0, pose.top].flatMap((planar) => {
      const shifted = faceOffset(planar, side)
      return [HALF_W, -HALF_W].map((x) => world(shifted, x))
    }),
  )
  const hull = convexHull2(corners.map((c) => camera.project(c.x, c.y, c.z)))
  const body = hull.length
    ? `${hull.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
    : ""

  const frontTop = world(faceOffset(pose.top, 1), HALF_W)
  const frontTopPort = world(faceOffset(pose.top, 1), -HALF_W)
  const frontFoot = world(faceOffset(foot0, 1), HALF_W)
  const display = panelTransform(camera, frontTop, frontTopPort, frontFoot, HALF_W * 2, SLATE)
  const showScreen = display.facing > 0.25

  // The stand is a plate between the hinge line and the foot line, mounted on
  // the back surface rather than on the centreline — which is what makes a
  // folded stand visible lying against the slate instead of buried inside it.
  const onBack = (planar: Vec2) => ({
    x: planar.x - normal.x * (SLATE_T / 2 + 0.7),
    y: planar.y - normal.y * (SLATE_T / 2 + 0.7),
  })
  const standHinge = onBack(pose.hinge)
  const standFoot = pose.folded ? onBack(pose.foot) : pose.foot
  const standCorners = [
    world(standHinge, STAND_HALF_W),
    world(standHinge, -STAND_HALF_W),
    world(standFoot, -STAND_HALF_W),
    world(standFoot, STAND_HALF_W),
  ].map((c) => camera.project(c.x, c.y, c.z))
  const standHull = convexHull2(standCorners)
  const stand = standHull.length
    ? `${standHull.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
    : ""

  // The stylus docks along the top edge, on the back face.
  const dock = world(faceOffset(pose.top, -1), 0)
  const penA = camera.project(-30, dock.y, dock.z)
  const penB = camera.project(30, dock.y, dock.z)
  const shadow = extrudedPath(
    roundedFootprint(HALF_W + 6, Math.max(12, (pose.foot.x + 10) / 2), 10, 5).map((p) => ({
      x: p.x,
      y: p.y + Math.max(12, (pose.foot.x + 10) / 2) - 6,
    })),
    camera,
    0,
    0,
  )

  // Whichever of the stand and the slate is nearer the camera paints last.
  const standNearer =
    camera.depth(0, -((standHinge.y + standFoot.y) / 2), (standHinge.x + standFoot.x) / 2) >
    camera.depth(0, -pose.top.y / 2, pose.top.x / 2)

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const glass = variant === "solid" ? { fill: palette.dark } : robotSurface("dark", variant, palette, 0.8)

  const standGroup = (
    <path data-stand data-folded={pose.folded ? "true" : "false"} d={stand} {...(pose.folded ? cast : machined)} />
  )
  const slateGroup = (
    <g data-slate>
      <path data-body d={body} {...shell} />
      {showScreen && (
        <g data-screen data-content={screen} transform={display.transform}>
          <rect x={4} y={4} width={96} height={70} rx={3} {...glass} />
          <circle cx={52} cy={2.4} r={0.9} fill={palette.metal} />
          {screen !== "off" && <ScreenContent screen={screen} palette={palette} />}
        </g>
      )}
      {stylus && <path data-stylus d={capsulePath(penA, penB, 2.1)} {...machined} />}
    </g>
  )

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Slate tablet, ${readout} percent reclined, ${pose.folded ? "stand folded" : "stand propped"}, ${screen} screen, ${viewNames[view] ?? viewNames.profile}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout}% reclined` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.2)
        if (delta !== 0) apply(at01 + delta)
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
      <g transform={`translate(${px(ORIGIN.x + frame.dx)} ${px(ORIGIN.y + frame.dy)}) scale(${frame.zoom})`}>
        {showDesk && <path data-desk d={shadow} fill={palette.dark} opacity={0.13} />}
        {variant === "blueprint" && (
          <g fill="none" stroke={palette.grid} strokeWidth={0.6} opacity={0.6}>
            <path
              d={`M ${px(camera.project(-HALF_W - 14, 0, 0).x)} ${px(camera.project(-HALF_W - 14, 0, 0).y)} L ${px(camera.project(HALF_W + 14, 0, pose.foot.x + 12).x)} ${px(camera.project(HALF_W + 14, 0, pose.foot.x + 12).y)}`}
              strokeDasharray="5 3"
            />
          </g>
        )}
        {standNearer ? (
          <>
            {slateGroup}
            {standGroup}
          </>
        ) : (
          <>
            {standGroup}
            {slateGroup}
          </>
        )}
      </g>
      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 9} fontSize={5}>
          {`${Math.round(pose.tilt)}° / ${pose.folded ? "FOLDED" : `${Math.round(pose.spread)}° SPREAD`}`}
        </text>
        {label && (
          <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 2.5} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

/** Structure drawn in palette roles, never an application's own artwork. */
function ScreenContent({
  screen,
  palette,
}: {
  screen: TabletScreen
  palette: ReturnType<typeof resolveRobotPalette>
}) {
  if (screen === "sketch") {
    return (
      <g>
        <rect x={8} y={8} width={10} height={62} rx={3} fill={palette.metal} opacity={0.3} />
        {[0, 1, 2, 3].map((slot) => (
          <circle key={slot} cx={13} cy={15 + slot * 11} r={2.6} fill={slot === 1 ? palette.accent : palette.metal} opacity={slot === 1 ? 1 : 0.6} />
        ))}
        <path
          d="M 26 56 C 38 20, 54 66, 66 32 S 86 22, 92 44"
          fill="none"
          stroke={palette.accent}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        <path d="M 26 66 H 92" stroke={palette.metal} strokeWidth={1} opacity={0.4} />
      </g>
    )
  }
  return (
    <g>
      {Array.from({ length: 16 }, (_, index) => (
        <rect
          key={index}
          x={16 + (index % 4) * 19}
          y={12 + Math.floor(index / 4) * 14}
          width={13}
          height={10}
          rx={2.6}
          fill={index === 5 ? palette.accent : palette.metal}
          opacity={index === 5 ? 1 : 0.42}
        />
      ))}
      <rect x={22} y={62} width={60} height={10} rx={4} fill={palette.metal} opacity={0.25} />
      {[0, 1, 2, 3].map((slot) => (
        <rect key={slot} x={27 + slot * 13} y={64} width={7} height={6} rx={1.8} fill={palette.metal} opacity={0.7} />
      ))}
    </g>
  )
}

/**
 * Recline at `clock`, 0–1. `prop` stands it up, holds it there and lays it
 * back down; `sketch` works the small range someone drawing on it uses.
 */
export function tabletGoal(behavior: TabletBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  const t = ((clock % 1) + 1) % 1
  if (behavior === "sketch") return 0.68 + Math.sin(t * Math.PI * 2) * 0.1
  if (t < 0.2) return (t / 0.2) * 0.88
  if (t < 0.75) return 0.88
  if (t < 0.92) return 0.88 * (1 - (t - 0.75) / 0.17)
  return 0
}

export { SlateTablet }
