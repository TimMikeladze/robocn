"use client"

/**
 * folding-handset — a book fold, and the display that has to survive it.
 *
 * Two facts about a folding display do all the work. It cannot stretch, and it
 * cannot be creased to a knife edge: it bends through a radius. So the bend
 * consumes `radius × (180 − fold)` of sheet, and that length comes off the
 * panels rather than out of nowhere — the display peels away from the inner end
 * of each leaf as the machine shuts, which is the teardrop cavity you can see
 * in the gap. `2 × run + arc` is the sheet's length at every angle.
 *
 * Both leaf faces stay tangent to the bend circle, so the leaves *roll* on it
 * rather than pivoting on a pin. `foldPose` solves that in the fold's own
 * symmetric frame; this component then turns the whole result by the swing, so
 * the port leaf is held still and the other one opens — which is how a hand
 * does it, and what puts the flat inner display and the shut cover display
 * face-on to the same camera.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { foldPose, panelTransform, type FoldLeaf } from "@/lib/robocn/device"
import { clamp, toDegrees, toRadians, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
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

const VIEW_WIDTH = 210
const VIEW_HEIGHT = 190
/** Where the machine's own origin — the bend's axis, at half height — lands. */
const ORIGIN = { x: 105, y: 92 }

/** World units: x starboard, y up, z toward the back. */
const LEAF = 60
const HALF_H = 62
const LEAF_T = 3.2
/** Bezel between a panel's edge and the display bonded to it. */
const BEZEL = 2.8
/** The angle a half-open machine sits at: propped, and legible as a fold. */
const FLEX = 124
/** Degrees per second while easing back into the behaviour. */
const SLEW_RATE = 200
const NATIVE_VIEW: RobotView = "front"

/** The hinge's own limit, as a pure function of the prop. */
const foldTravel = (travel: number) =>
  Number.isFinite(travel) ? clamp(travel, 90, 180) : 180

/** The bend radius the hinge is built round, as a pure function of the prop. */
const bendRadius = (radius: number) =>
  Number.isFinite(radius) ? clamp(radius, 1.5, 40) : 3

/** Each camera gets the framing it needs; the machine is the same size in all of them. */
const frames: Record<RobotView, { zoom: number; dx: number; dy: number }> = {
  plan: { zoom: 1, dx: 0, dy: 0 },
  front: { zoom: 0.94, dx: 0, dy: 0 },
  profile: { zoom: 0.94, dx: 0, dy: 0 },
  iso: { zoom: 0.84, dx: 2, dy: 0 },
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type FoldBehavior = "unfold" | "flex" | "static"
export type FoldScreen = "canvas" | "split" | "gallery" | "off"
export type FoldCover = "clock" | "alerts" | "off"

export interface FoldingHandsetProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled fold in degrees: 0 shut, 180 flat. Omit to run `behavior`. */
  fold?: number
  /** What the fold does when `fold` is not supplied. */
  behavior?: FoldBehavior
  /** How far the hinge opens, degrees. Clamped to 90–180. */
  travel?: number
  /** The bend radius of the crease, world units. Clamped to 1.5–40. */
  radius?: number
  /** Where the camera stands. One machine, four projections. */
  view?: RobotView
  /** Open-and-shut cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag the machine open, or arrow-key it. */
  interactive?: boolean
  onFoldChange?: (fold: number) => void
  /** What the inner display is showing. Structure only — no application artwork. */
  screen?: FoldScreen
  /** What the cover display is showing, on the outside of the leaf that swings. */
  cover?: FoldCover
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function FoldingHandset({
  fold,
  behavior = "unfold",
  travel = 180,
  radius = 3,
  view = NATIVE_VIEW,
  speed = 0.2,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onFoldChange,
  screen = "canvas",
  cover = "clock",
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
}: FoldingHandsetProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const limit = foldTravel(travel)
  const controlled = fold !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? (Number.isFinite(fold) ? clamp(fold as number, 0, limit) : 0) : held
  const goal = React.useCallback(
    (clock: number) => Math.min(limit, foldGoal(behavior, clock)),
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
      const bounded = clamp(next, 0, foldTravel(travel))
      setHeld(bounded)
      onFoldChange?.(bounded)
    },
    [onFoldChange, travel, setHeld],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // Up the frame opens it, which is the way a hand actually does it.
    onDrag: React.useCallback((unit: Vec2) => apply((1 - unit.y) * 220 - 20), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), [setHeld]),
  })

  const bend = bendRadius(radius)
  const pose = foldPose(motion.value, LEAF, bend, { maxAngle: limit, steps: 15 })
  const readout = Math.round(pose.angle)
  const run = pose.run

  const camera = robotCamera(view)
  const frame = frames[view] ?? frames.front

  // The solver's frame is symmetric about the bisector; a hand holds one leaf
  // still instead, so the whole pose turns back by the swing. One rigid
  // rotation, which is why directions come through it untouched by anything
  // else — and why the leaf that moves comes toward you as it shuts.
  const sigma = toRadians(pose.swing)
  const cs = Math.cos(sigma)
  const sn = Math.sin(sigma)
  /** The fold's plane — across, toward the back — into world x and z. */
  const steady = (point: Vec2): Vec2 => ({
    x: point.x * cs + point.y * sn,
    y: -point.x * sn + point.y * cs,
  })
  const at = (point: Vec2, y: number) => camera.project(point.x, y, point.y)
  const world = (point: Vec2, y: number): Vec3 => ({ x: point.x, y, z: point.y })

  const leaves = pose.leaves.map((leaf, index) => {
    const axis = steady(leaf.axis)
    const normal = steady(leaf.normal)
    const hinge = steady(leaf.hinge)
    const root = steady(leaf.root)
    // Where the straight display run ends. The same point as the tip until the
    // bend has eaten into the panel, which is what `bare` measures.
    const far = { x: root.x + axis.x * run, y: root.y + axis.y * run }
    const tip = { x: hinge.x + axis.x * LEAF, y: hinge.y + axis.y * LEAF }
    const behind = (point: Vec2, depth: number): Vec2 => ({
      x: point.x - normal.x * depth,
      y: point.y - normal.y * depth,
    })
    return {
      leaf,
      index,
      /** Port is the leaf a hand holds; starboard is the one that swings. */
      name: leaf.side < 0 ? ("port" as const) : ("starboard" as const),
      /** Screen halves read left to right, and the front camera sees +x on the left. */
      half: leaf.side < 0 ? 1 : 0,
      axis,
      normal,
      hinge,
      root,
      far,
      tip,
      behind,
      /** How far the inner face points toward the camera. Zero is edge on. */
      faceUp: camera.depth(normal.x, 0, normal.y),
      centre: { x: (hinge.x + tip.x) / 2, y: (hinge.y + tip.y) / 2 },
    }
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const glass = variant === "solid" ? { fill: palette.dark } : robotSurface("dark", variant, palette, 0.8)

  /** A panel's own inset rectangle, so a display never runs to the panel's edge. */
  const inset = (span: number) => Math.max(0, span - BEZEL * 2)

  const parts = leaves.map((side) => {
    const other = leaves[side.index === 0 ? 1 : 0]!
    const body = extrudedPath(
      roundedFootprint(LEAF / 2, LEAF_T / 2, 1.4, 4).map((point) => {
        const along = point.x + LEAF / 2
        const through = point.y + LEAF_T / 2
        return {
          x: side.hinge.x + side.axis.x * along - side.normal.x * through,
          y: side.hinge.y + side.axis.y * along - side.normal.y * through,
        }
      }),
      camera,
      HALF_H,
      -HALF_H,
    )

    // The display's own half, on the inner face. Local x runs from +x toward
    // −x so the two halves read as one picture from the front.
    const display =
      side.half === 0
        ? panelTransform(camera, world(side.far, HALF_H), world(side.root, HALF_H), world(side.far, -HALF_H), run, HALF_H * 2)
        : panelTransform(camera, world(side.root, HALF_H), world(side.far, HALF_H), world(side.root, -HALF_H), run, HALF_H * 2)
    // A half of the display is drawn when the camera can see it *and* the other
    // leaf is not lying over it — shut, the two faces are inside the sandwich.
    // A face's own normal is the only convention-free way to ask, and the
    // second threshold is slack because a leaf near edge on covers a sliver,
    // not a display.
    // `off` still draws the glass: the display is there, it is just dark.
    const showScreen =
      display.facing > 0.14 && side.faceUp > 0.14 && other.faceUp > -0.35

    // The cover display, on the outside of the leaf that swings. Its local x
    // runs from the spine outward, which is +x toward −x once it is shut.
    const outerHinge = side.behind(side.hinge, LEAF_T)
    const outerTip = side.behind(side.tip, LEAF_T)
    const outer = panelTransform(
      camera,
      world(outerHinge, HALF_H),
      world(outerTip, HALF_H),
      world(outerHinge, -HALF_H),
      LEAF,
      HALF_H * 2,
    )
    const showCover = side.name === "starboard" && outer.facing > 0.14

    /** A key on the leaf's free edge, drawn where the camera puts it. */
    const edgeKey = (from: number, to: number) => {
      const along = { x: side.tip.x + side.axis.x * 0.7, y: side.tip.y + side.axis.y * 0.7 }
      const seat = side.behind(along, LEAF_T / 2)
      return capsulePath(at(seat, from), at(seat, to), 1.4)
    }

    return {
      key: side.name,
      depth: camera.depth(side.centre.x, 0, side.centre.y),
      node: (
        <g key={side.name} data-leaf={side.name} data-heading={px(toDegrees(Math.atan2(side.axis.y || 0, side.axis.x)))}>
          <path d={body} {...shell} />
          {side.name === "starboard" && (
            <>
              <path data-button="power" d={edgeKey(6, 24)} {...cast} />
              <path data-button="volume" d={edgeKey(30, 52)} {...cast} />
            </>
          )}
          {showScreen && (
            <g data-screen data-half={side.half} data-content={screen} transform={display.transform}>
              <rect
                x={px(Math.min(BEZEL, run / 4))}
                y={BEZEL}
                width={px(Math.max(0, run - Math.min(BEZEL, run / 4) - 1))}
                height={px(inset(HALF_H * 2))}
                {...glass}
              />
              {screen !== "off" && (
              <ScreenContent
                screen={screen}
                palette={palette}
                offset={side.half * run}
                run={run}
                width={run * 2}
                height={HALF_H * 2}
              />
              )}
              {side.half === 0 && run > 14 && (
                <circle data-lens cx={px(run - 8)} cy={9} r={1.6} fill={palette.metal} opacity={0.8} />
              )}
            </g>
          )}
          {showCover && (
            <g data-cover data-content={cover} transform={outer.transform}>
              <rect
                x={BEZEL}
                y={BEZEL}
                width={px(inset(LEAF))}
                height={px(inset(HALF_H * 2))}
                rx={3}
                {...glass}
              />
              {cover !== "off" && (
                <CoverContent cover={cover} palette={palette} width={LEAF} height={HALF_H * 2} />
              )}
              <circle data-lens cx={px(LEAF / 2)} cy={9} r={1.7} fill={palette.metal} opacity={0.8} />
            </g>
          )}
        </g>
      ),
    }
  })

  // The bend itself: a cylinder patch round the fold's axis, so its top and
  // bottom edges are the same arc at two heights. Exact under a linear camera.
  const arc = pose.bend.map(steady)
  const top = arc.map((point) => at(point, HALF_H))
  const bottom = arc.map((point) => at(point, -HALF_H))
  const sheet = arc.length
    ? `M ${top.map((p) => `${px(p.x)} ${px(p.y)}`).join(" L ")} L ${bottom
        .slice()
        .reverse()
        .map((p) => `${px(p.x)} ${px(p.y)}`)
        .join(" L ")} Z`
    : ""
  const midArc = arc[Math.floor(arc.length / 2)] ?? { x: 0, y: 0 }

  // The spine covers the cavity: the outside of the bend, plus both panels'
  // inner edges. It grows as the machine shuts, which is what the cavity does.
  const spineScale = (bend + 1.4) / (bend || 1)
  const spine = extrudedPath(
    [
      ...arc.map((point) => ({ x: point.x * spineScale, y: point.y * spineScale })),
      leaves[0]!.hinge,
      leaves[1]!.hinge,
    ],
    camera,
    HALF_H - 1.2,
    -(HALF_H - 1.2),
  )

  const ordered = [
    { key: "spine", depth: camera.depth(midArc.x * spineScale, 0, midArc.y * spineScale) - 0.01, node: (
      <path key="spine" data-hinge d={spine} {...machined} />
    ) },
    { key: "bend", depth: camera.depth(midArc.x, 0, midArc.y), node: (
      <path key="bend" data-bend data-arc={px(pose.arc)} d={sheet} {...glass} />
    ) },
    ...parts,
  ].sort((a, b) => a.depth - b.depth)

  const state = readout < 8 ? "shut" : readout > limit - 8 ? "open flat" : "half open"

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Folding handset, ${state}, fold ${readout} degrees, ${screen} display${
        pose.pinched ? ", display pinched" : ""
      }, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? Math.round(limit) : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout} degrees open` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 30 : 10, 45)
        if (delta !== 0) apply(pose.angle + delta)
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
      <g transform={`translate(${px(ORIGIN.x + frame.dx)} ${px(ORIGIN.y + frame.dy)}) scale(${frame.zoom})`}>
        {variant === "blueprint" && (
          // The circle the leaves roll on, which is the whole hinge.
          <g transform={camera.plane(0)} fill="none" stroke={palette.grid} strokeWidth={0.6} opacity={0.7}>
            <circle cx={0} cy={0} r={px(bend)} strokeDasharray="4 2" />
            <circle cx={0} cy={0} r={px(bend * spineScale)} strokeDasharray="1 2" />
          </g>
        )}
        <g data-body data-fold={px(pose.angle)} data-run={px(run)} data-pinched={pose.pinched}>
          {ordered.map((part) => part.node)}
        </g>
      </g>
      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 9} fontSize={5}>
          {`FOLD ${readout}° / ${pose.pinched ? "PINCHED" : screen.toUpperCase()}`}
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

/**
 * The inner display, drawn in the *whole* display's coordinates and clipped to
 * the half it is on. That is what makes a row or a tile cross the crease and
 * still line up: both halves lay out from the same origin, and each emits only
 * what falls inside itself. No clip paths, so no generated ids.
 */
function ScreenContent({
  screen,
  palette,
  offset,
  run,
  width,
  height,
}: {
  screen: FoldScreen
  palette: ReturnType<typeof resolveRobotPalette>
  offset: number
  run: number
  width: number
  height: number
}) {
  if (screen === "off" || run <= 0) return null
  const pad = BEZEL + 3
  /** A span of the full display, as this half's own local x and width. */
  const band = (from: number, to: number) => {
    const start = Math.max(from, offset)
    const end = Math.min(to, offset + run)
    return end > start ? { x: start - offset, width: end - start } : null
  }
  const bar = (
    from: number,
    to: number,
    y: number,
    thick: number,
    fill: string,
    opacity: number,
    key: React.Key,
  ) => {
    const cut = band(from, to)
    if (!cut) return null
    return (
      <rect
        key={key}
        x={px(cut.x)}
        y={px(y)}
        width={px(cut.width)}
        height={px(thick)}
        rx={px(Math.min(thick / 2, 1.4))}
        fill={fill}
        opacity={opacity}
      />
    )
  }

  if (screen === "split") {
    // The shape a folding display actually earns: two panes, one per leaf.
    const inner = { x: pad, width: run - pad * 2, height: height - pad * 2 }
    if (inner.width <= 0) return null
    return (
      <g data-pane={offset > 0 ? "detail" : "list"}>
        <rect x={px(inner.x)} y={px(pad)} width={px(inner.width)} height={6} rx={1.6} fill={palette.metal} opacity={0.45} />
        {offset > 0 ? (
          <g>
            <rect x={px(inner.x)} y={px(pad + 11)} width={px(inner.width)} height={px(inner.height * 0.36)} rx={2} fill={palette.metal} opacity={0.22} />
            {[0.82, 0.64, 0.9, 0.5].map((wide, index) => (
              <rect key={wide} x={px(inner.x)} y={px(pad + inner.height * 0.42 + index * 9)} width={px(inner.width * wide)} height={2.6} rx={1.3} fill={index === 0 ? palette.accent : palette.metal} opacity={index === 0 ? 0.9 : 0.45} />
            ))}
          </g>
        ) : (
          <g>
            {Array.from({ length: 7 }, (_, index) => (
              <g key={index}>
                <rect x={px(inner.x)} y={px(pad + 12 + index * 14)} width={px(inner.width)} height={11} rx={2} fill={index === 2 ? palette.accent : palette.metal} opacity={index === 2 ? 0.28 : 0.16} />
                <circle cx={px(inner.x + 6)} cy={px(pad + 17.5 + index * 14)} r={3.2} fill={palette.metal} opacity={0.4} />
                <rect x={px(inner.x + 12)} y={px(pad + 15 + index * 14)} width={px(Math.max(0, inner.width - 18))} height={2.2} rx={1.1} fill={palette.metal} opacity={0.5} />
              </g>
            ))}
          </g>
        )}
      </g>
    )
  }

  if (screen === "gallery") {
    const columns = 6
    const rows = 5
    const cell = (width - pad * 2) / columns
    const size = cell - 2.4
    const first = Math.max(0, Math.floor((offset - pad) / cell) - 1)
    return (
      <g data-tiles>
        {bar(pad, width - pad, pad, 5, palette.metal, 0.4, "status")}
        {Array.from({ length: rows }, (_, row) =>
          Array.from({ length: columns }, (_, column) => column + first).map((column) => {
            if (column >= columns) return null
            const x = pad + column * cell
            const cut = band(x, x + size)
            if (!cut) return null
            return (
              <rect
                key={`${row}-${column}`}
                x={px(cut.x)}
                y={px(pad + 9 + row * cell)}
                width={px(cut.width)}
                height={px(Math.min(size, (height - pad * 2 - 9) / rows - 2.4))}
                rx={1.6}
                fill={(row + column) % 5 === 2 ? palette.accent : palette.metal}
                opacity={(row + column) % 5 === 2 ? 0.85 : 0.3}
              />
            )
          }),
        )}
      </g>
    )
  }

  // A page: a status bar, a rail down one side, and lines that run across the
  // crease because both halves lay them out from the same origin.
  const railEnd = pad + width * 0.2
  return (
    <g data-page>
      {bar(pad, width - pad, pad, 5, palette.metal, 0.4, "status")}
      {bar(pad, railEnd, pad + 9, height - pad * 2 - 9, palette.metal, 0.18, "rail")}
      {[0.94, 0.8, 0.88, 0.62, 0.9, 0.74, 0.84, 0.56, 0.92, 0.7, 0.86].map((wide, index) => {
        const from = railEnd + 5
        return bar(
          from,
          from + (width - pad - from) * wide,
          pad + 14 + index * 9.4,
          2.8,
          index === 1 ? palette.accent : palette.metal,
          index === 1 ? 0.9 : 0.42,
          wide + index,
        )
      })}
      {bar(pad + 4, pad + width * 0.16, height - pad - 8, 5.6, palette.accent, 0.75, "action")}
    </g>
  )
}

/** The cover display: what the machine says while it is shut. Structure only. */
function CoverContent({
  cover,
  palette,
  width,
  height,
}: {
  cover: FoldCover
  palette: ReturnType<typeof resolveRobotPalette>
  width: number
  height: number
}) {
  if (cover === "off") return null
  const pad = BEZEL + 4
  const inner = width - pad * 2
  if (cover === "alerts") {
    return (
      <g data-alerts>
        {[0, 1, 2].map((slot) => (
          <g key={slot}>
            <rect x={px(pad)} y={px(pad + 16 + slot * 24)} width={px(inner)} height={19} rx={3} fill={slot === 0 ? palette.accent : palette.metal} opacity={slot === 0 ? 0.3 : 0.18} />
            <circle cx={px(pad + 9)} cy={px(pad + 25.5 + slot * 24)} r={4} fill={palette.metal} opacity={0.45} />
            <rect x={px(pad + 17)} y={px(pad + 21 + slot * 24)} width={px(inner * 0.46)} height={2.4} rx={1.2} fill={palette.metal} opacity={0.6} />
            <rect x={px(pad + 17)} y={px(pad + 27 + slot * 24)} width={px(inner * 0.66)} height={2.2} rx={1.1} fill={palette.metal} opacity={0.35} />
          </g>
        ))}
      </g>
    )
  }
  // A clock, as blocks rather than digits: no typeface, no branding.
  const block = inner / 2 - 3
  return (
    <g data-clock>
      {[0, 1].map((slot) => (
        <rect key={slot} x={px(pad + slot * (block + 6))} y={px(height * 0.3)} width={px(block)} height={px(block * 1.25)} rx={3} fill={slot === 0 ? palette.metal : palette.accent} opacity={slot === 0 ? 0.5 : 0.85} />
      ))}
      <rect x={px(pad)} y={px(height * 0.3 - 12)} width={px(inner * 0.62)} height={3} rx={1.5} fill={palette.metal} opacity={0.45} />
      {[0, 1, 2, 3].map((slot) => (
        <circle key={slot} cx={px(pad + 4 + slot * 11)} cy={px(height * 0.3 + block * 1.25 + 12)} r={3.4} fill={slot === 1 ? palette.accent : palette.metal} opacity={slot === 1 ? 0.9 : 0.35} />
      ))}
    </g>
  )
}

/**
 * Fold angle at `clock`, in degrees. `unfold` runs a whole session — open it,
 * use it, shut it; `flex` leaves it half open and works the angle the way a
 * hand holding it does. Both park shut when static.
 */
export function foldGoal(behavior: FoldBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  const t = ((clock % 1) + 1) % 1
  if (behavior === "flex") return FLEX + Math.sin(t * Math.PI * 2) * 28
  if (t < 0.16) return (t / 0.16) * 180
  if (t < 0.74) return 180
  if (t < 0.9) return 180 * (1 - (t - 0.74) / 0.16)
  return 0
}

export { FoldingHandset }
export type { FoldLeaf }
