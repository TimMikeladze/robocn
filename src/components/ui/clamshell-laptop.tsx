"use client"

/**
 * clamshell-laptop — a portable workstation on one revolute joint.
 *
 * The hinge is the whole machine. `lid` is solved rather than tweened between
 * a shut picture and an open one, so the lid keeps its own length at every
 * angle and the drawing knows when it has passed vertical — past that you are
 * looking at the back of the display, and the screen is not drawn at all.
 *
 * `travel` is the hinge's own limit. Ask for more and it stops where the hinge
 * stops, and says so in the label.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { hingePose, panelPath, panelTransform } from "@/lib/robocn/device"
import { clamp, convexHull2, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import {
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

const VIEW_WIDTH = 200
const VIEW_HEIGHT = 165
/** Where the machine's own origin — the middle of its footprint, on the desk — lands. */
const ORIGIN = { x: 100, y: 112 }

/** World units: x starboard, y up, z toward the back. */
const HALF_W = 60
const FRONT = -42
const BACK = 42
const DECK = 9
const HINGE_Z = 38
const LID = 78
const LID_HALF_W = 58
const LID_T = 3.4
/** The angle the lid settles at when it is working. */
const WORK = 100
/** Degrees per second while easing back into the behaviour. */
const SLEW_RATE = 150
const NATIVE_VIEW: RobotView = "profile"

/** The hinge's own limit, as a pure function of the prop. */
const hingeTravel = (travel: number) =>
  Number.isFinite(travel) ? clamp(travel, 90, 150) : 135

/** Each camera gets the framing it needs; the machine is the same size in all of them. */
const frames: Record<RobotView, { zoom: number; dy: number }> = {
  plan: { zoom: 0.84, dy: -18 },
  front: { zoom: 0.94, dy: 6 },
  profile: { zoom: 0.94, dy: 2 },
  iso: { zoom: 0.8, dy: -4 },
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type LaptopBehavior = "open" | "adjust" | "static"
export type LaptopScreen = "desktop" | "code" | "media" | "off"

export interface ClamshellLaptopProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled lid angle in degrees, 0 shut. Omit to run `behavior`. */
  lid?: number
  /** What the lid does when `lid` is not supplied. */
  behavior?: LaptopBehavior
  /** How far the hinge opens, degrees. Clamped to 90–150. */
  travel?: number
  /** Where the camera stands. One machine, four projections. */
  view?: RobotView
  /** Open-and-shut cycles per second, or adjustments per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag the lid open, or arrow-key it. */
  interactive?: boolean
  onLidChange?: (angle: number) => void
  /** What the display is showing. Structure only — no application artwork. */
  screen?: LaptopScreen
  showDesk?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function ClamshellLaptop({
  lid,
  behavior = "open",
  travel = 135,
  view = NATIVE_VIEW,
  speed = 0.24,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onLidChange,
  screen = "desktop",
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
}: ClamshellLaptopProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const limit = hingeTravel(travel)
  const controlled = lid !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? (Number.isFinite(lid) ? clamp(lid, 0, limit) : 0) : held
  const goal = React.useCallback(
    (clock: number) => Math.min(limit, laptopGoal(behavior, clock)),
    [behavior, limit],
  )
  const motion = useRobotScalar(goal, {
    rate: SLEW_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })

  const apply = React.useCallback(
    (next: number) => {
      const bounded = clamp(next, 0, hingeTravel(travel))
      setHeld(bounded)
      onLidChange?.(bounded)
    },
    [onLidChange, travel, setHeld],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // Up the frame opens the lid, which is the way a hand actually does it.
    onDrag: React.useCallback((unit: Vec2) => apply((1 - unit.y) * 170 - 20), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), [setHeld]),
  })

  const pose = hingePose(motion.value, BACK - FRONT, LID, { maxAngle: limit })
  const angle = pose.angle
  const readout = Math.round(angle)

  const camera = robotCamera(view)
  const frame = frames[view] ?? frames.profile
  const at = (x: number, y: number, z: number) => camera.project(x, y, z)

  // The lid, as a solid. Its front face carries the screen; the thickness is
  // the same quad pushed back along the face normal, and the outline is the
  // hull of both — which is what keeps it a slab seen edge on in profile.
  const rad = toRadians(angle)
  const tip = { y: DECK + LID * Math.sin(rad), z: HINGE_Z - LID * Math.cos(rad) }
  const normal = { y: -Math.cos(rad), z: -Math.sin(rad) }
  const face = (x: number, y: number, z: number, back = false) => ({
    x,
    y: back ? y - normal.y * LID_T : y,
    z: back ? z - normal.z * LID_T : z,
  })
  const topStarboard = face(LID_HALF_W, tip.y, tip.z)
  const topPort = face(-LID_HALF_W, tip.y, tip.z)
  const hingeStarboard = face(LID_HALF_W, DECK, HINGE_Z)
  const hingePort = face(-LID_HALF_W, DECK, HINGE_Z)
  const backTopStarboard = face(LID_HALF_W, tip.y, tip.z, true)
  const backTopPort = face(-LID_HALF_W, tip.y, tip.z, true)
  const backHingeStarboard = face(LID_HALF_W, DECK, HINGE_Z, true)
  const backHingePort = face(-LID_HALF_W, DECK, HINGE_Z, true)

  const hull = convexHull2(
    [
      topStarboard, topPort, hingeStarboard, hingePort,
      backTopStarboard, backTopPort, backHingeStarboard, backHingePort,
    ].map((corner) => at(corner.x, corner.y, corner.z)),
  )
  const lidSolid = hull.length
    ? `${hull.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
    : ""

  const display = panelTransform(camera, topStarboard, topPort, hingeStarboard, LID_HALF_W * 2, LID)
  const rear = panelTransform(camera, backTopPort, backTopStarboard, backHingePort, LID_HALF_W * 2, LID)
  // Shut, the display is face down on the keyboard; seen edge on it is a line.
  // Neither is worth drawing, and a panel at a grazing angle only smears.
  const glassSide = pose.facing > 0.08 && display.facing > 0.04
  const showScreen = glassSide && display.facing > 0.18
  const showRear = rear.facing > 0.18

  const body = extrudedPath(roundedFootprint(HALF_W, (BACK - FRONT) / 2, 11, 6), camera, DECK, 0)
  const hinge = extrudedPath(
    roundedFootprint(LID_HALF_W - 4, 4, 3, 3).map((p) => ({ x: p.x, y: p.y + HINGE_Z })),
    camera,
    DECK + 3.2,
    DECK - 2,
  )
  const shadow = extrudedPath(roundedFootprint(HALF_W + 5, (BACK - FRONT) / 2 + 5, 14, 5), camera, 0, 0)

  // Whichever of the deck and the lid is nearer the camera paints last. It is
  // the lid's own middle, half a thickness behind its face, so a shut lid
  // still reads as sitting on top of the keyboard rather than under it.
  const lidNearer =
    camera.depth(
      0,
      (DECK + tip.y) / 2 - (normal.y * LID_T) / 2,
      (HINGE_Z + tip.z) / 2 - (normal.z * LID_T) / 2,
    ) > camera.depth(0, DECK, 0)

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const keyCap = robotSurface("dark", variant, palette, 0.5)
  const glass = variant === "solid" ? { fill: palette.dark } : robotSurface("dark", variant, palette, 0.8)

  const lidGroup = (
    <g data-lid data-angle={px(angle)}>
      <path d={lidSolid} {...shell} />
      {glassSide && (
        <path d={panelPath(camera, topStarboard, topPort, hingeStarboard)} {...cast} />
      )}
      {showScreen && (
        <g data-screen data-content={screen} transform={display.transform}>
          <circle cx={58} cy={3.6} r={1.1} fill={palette.metal} />
          <rect x={6} y={7} width={104} height={62} rx={1.6} {...glass} />
          {screen !== "off" && <ScreenContent screen={screen} palette={palette} />}
          <path d="M 46 73.5 H 70" stroke={palette.metal} strokeWidth={1.2} strokeLinecap="round" />
        </g>
      )}
      {showRear && (
        <g data-rear transform={rear.transform}>
          <rect x={12} y={12} width={92} height={52} rx={3} {...machined} fillOpacity={0.3} />
          <circle cx={58} cy={38} r={5} {...machined} />
        </g>
      )}
    </g>
  )

  const baseGroup = (
    <g data-base>
      <path data-body d={body} {...shell} />
      <g data-deck transform={camera.plane(DECK)}>
        <rect x={-HALF_W + 4} y={FRONT + 4} width={HALF_W * 2 - 8} height={BACK - FRONT - 8} rx={7} {...machined} fillOpacity={variant === "solid" ? 0.5 : undefined} />
        <g data-keyboard>
          <rect x={-52} y={-3} width={104} height={37} rx={3} {...cast} />
          {keys.map((key, index) => (
            <rect
              key={index}
              data-key={index}
              x={px(key.x)}
              y={px(key.y)}
              width={px(key.w)}
              height={5.1}
              rx={1.1}
              {...keyCap}
              fill={key.lit ? palette.accent : keyCap.fill}
            />
          ))}
        </g>
        <rect data-trackpad x={-15} y={-34} width={30} height={24} rx={3} {...machined} />
      </g>
      <path data-hinge d={hinge} {...cast} />
    </g>
  )

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Clamshell laptop, lid ${readout} degrees, ${screen} screen, ${viewNames[view] ?? viewNames.profile}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? Math.round(limit) : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout} degrees open` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 15 : 5, 30)
        if (delta !== 0) apply(angle + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(limit)
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
      <g transform={`translate(${ORIGIN.x} ${px(ORIGIN.y + frame.dy)}) scale(${frame.zoom})`}>
        {showDesk && <path data-desk d={shadow} fill={palette.dark} opacity={0.13} />}
        {variant === "blueprint" && (
          <g fill="none" stroke={palette.grid} strokeWidth={0.6} opacity={0.6}>
            <path d={`M ${px(at(-HALF_W - 12, DECK, HINGE_Z).x)} ${px(at(-HALF_W - 12, DECK, HINGE_Z).y)} L ${px(at(HALF_W + 12, DECK, HINGE_Z).x)} ${px(at(HALF_W + 12, DECK, HINGE_Z).y)}`} strokeDasharray="6 2 2 2" />
          </g>
        )}
        {lidNearer ? (
          <>
            {baseGroup}
            {lidGroup}
          </>
        ) : (
          <>
            {lidGroup}
            {baseGroup}
          </>
        )}
      </g>
      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 9} fontSize={5}>
          {`LID ${readout}° / ${screen.toUpperCase()}`}
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

/** The keyboard, laid out once: four rows of caps and a modifier row. */
const keys: { x: number; y: number; w: number; lit?: boolean }[] = [
  ...Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 13 }, (_, column) => ({
      x: -50 + column * 7.7,
      y: 28.4 - row * 6.4,
      w: 6.4,
      lit: row === 1 && column === 4,
    })),
  ).flat(),
  { x: -50, y: 2.8, w: 8 },
  { x: -40.4, y: 2.8, w: 8 },
  { x: -30.8, y: 2.8, w: 8 },
  { x: -21.2, y: 2.8, w: 42.4 },
  { x: 22.8, y: 2.8, w: 8 },
  { x: 32.4, y: 2.8, w: 8 },
  { x: 42, y: 2.8, w: 8 },
]

/**
 * What is on the display: structure drawn in palette roles — a bar, a window,
 * lines, a dock. Never an application's own artwork.
 */
function ScreenContent({
  screen,
  palette,
}: {
  screen: LaptopScreen
  palette: ReturnType<typeof resolveRobotPalette>
}) {
  if (screen === "media") {
    return (
      <g>
        <rect x={10} y={11} width={96} height={44} rx={1.5} fill={palette.metal} opacity={0.2} />
        <path d="M 53 29 L 66 36 L 53 43 Z" fill={palette.accent} />
        <rect x={10} y={60} width={96} height={2.4} rx={1.2} fill={palette.metal} opacity={0.45} />
        <rect x={10} y={60} width={38} height={2.4} rx={1.2} fill={palette.accent} />
      </g>
    )
  }
  if (screen === "code") {
    return (
      <g>
        <rect x={8} y={9} width={22} height={58} rx={1.2} fill={palette.metal} opacity={0.25} />
        {[38, 26, 54, 44, 20, 48, 32, 58, 24, 40].map((run, index) => (
          <rect
            key={index}
            x={34}
            y={12 + index * 5.4}
            width={run}
            height={2.2}
            rx={1.1}
            fill={index % 4 === 1 ? palette.accent : palette.metal}
            opacity={index % 4 === 1 ? 0.9 : 0.5}
          />
        ))}
      </g>
    )
  }
  return (
    <g>
      <rect x={8} y={9} width={100} height={5} rx={1.2} fill={palette.metal} opacity={0.4} />
      <rect x={22} y={19} width={72} height={34} rx={2} fill={palette.metal} opacity={0.22} />
      <rect x={22} y={19} width={72} height={5} rx={2} fill={palette.metal} opacity={0.5} />
      {[46, 58, 34].map((run, index) => (
        <rect key={run} x={27} y={29 + index * 6} width={run} height={2.4} rx={1.2} fill={index === 0 ? palette.accent : palette.metal} opacity={index === 0 ? 0.9 : 0.45} />
      ))}
      <rect x={36} y={58} width={44} height={7} rx={3.5} fill={palette.metal} opacity={0.3} />
      {[0, 1, 2, 3, 4].map((slot) => (
        <circle key={slot} cx={41 + slot * 8.5} cy={61.5} r={2.1} fill={slot === 1 ? palette.accent : palette.metal} opacity={slot === 1 ? 1 : 0.6} />
      ))}
    </g>
  )
}

/**
 * Lid angle at `clock`, in degrees. `open` runs a whole session — lift, work,
 * shut; `adjust` leaves it open and works the angle the way someone sitting
 * down at it does.
 */
export function laptopGoal(behavior: LaptopBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  const t = ((clock % 1) + 1) % 1
  if (behavior === "adjust") return WORK + Math.sin(t * Math.PI * 2) * 7
  if (t < 0.15) return (t / 0.15) * WORK
  if (t < 0.8) return WORK
  if (t < 0.95) return WORK * (1 - (t - 0.8) / 0.15)
  return 0
}

export { ClamshellLaptop }
