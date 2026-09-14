"use client"

/**
 * radial-bloom — a hub of telescoping rams that open into a star.
 *
 * A single ram cannot show three times its own retracted length: the moving
 * part would have to leave its sleeve, and a part that has left its sleeve is
 * not guided any more. So each ram here is four concentric stages — one fixed
 * sleeve bolted to the hub rim and three that slide, each carrying the next.
 * Every stage travels a third of the tip's travel, which keeps six world units
 * of overlap between consecutive stages at full extension. The machine is
 * honest at every stroke, not just at the ends.
 *
 * The rams are deliberately not interchangeable. `REACH` gives each one its own
 * stroke, so the array closes to an even star and opens into a ragged one. That
 * is the whole mechanism: extension is what varies around the ring, not length.
 *
 * The array is modelled once in world units — x starboard, y up, z toward the
 * tail — and pushed through `robotCamera(view)`. Plan view is the identity
 * projection, so the star is the drawing it was designed as; the ranks tilt
 * `±pitch` out of the hub plane and only separate once the camera tips over.
 *
 * Design note: docs/radial-bloom.md.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, toRadians, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  circleFootprint,
  extrudedPath,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  slabPath,
  type RobotPaletteProps,
  type RobotRole,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

const VIEW = 220
/** Hub centre, and the origin every ram is measured from. */
const CENTRE = 110
const HUB_R = 19
const HUB_TOP = 5
const HUB_BOTTOM = -5
/** Where a ram's stages start, and how long each one is. */
const STAGE_R0 = 18
const STAGE_LENGTH = 22
const STAGES = 4
/** The painted nose cap is wider than its bore, so it never retracts flush. */
const NOSE = 3
/** Tip travel at full stroke. Stage k moves `TRAVEL / (STAGES - 1)`. */
const TRAVEL = 48
/** Radius of a fully closed and a fully open ram. */
const TIP_CLOSED = STAGE_R0 + STAGE_LENGTH + NOSE
const TIP_OPEN = TIP_CLOSED + TRAVEL
/** Half-widths and half-thicknesses, outward. Each stage slides inside the last. */
const STAGE_HALF_W = [4.4, 3.4, 2.4, 1.6]
const STAGE_HALF_T = [2.9, 2.2, 1.6, 1.1]
/**
 * One painted member stepping down through three diameters, off a machined
 * sleeve. Only the sleeve is a different role, and only because it is the one
 * stage that does not move — that distinction is the mechanism. Alternating all
 * four banded the spoke into blocks, which a telescope does not do, and it
 * destroyed the radial read at 150px, which is the only thing this silhouette
 * has. The collar at each mouth is what says where the joints are.
 */
const STAGE_ROLE: RobotRole[] = ["metal", "shell", "shell", "shell"]
const MAX_RAMS = 24
/** The ground the contact shadow falls on. Only reads once the camera tips. */
const GROUND = -34
/** Extension per second while a released array eases back into its behaviour. */
const BLOOM_RATE = 0.9
/** Where a parked machine sits. */
const NEUTRAL = 0.55

/**
 * Per-ram stroke ratios. Not decoration: twelve identical telescopes cannot nest
 * around one hub, so the rams are built to different strokes, and that is what
 * makes the open star ragged while the closed one stays even.
 */
const REACH = [1, 0.74, 0.93, 0.66, 0.98, 0.81, 0.7, 0.96, 0.62, 0.88, 0.77, 0.91]

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type BloomBehavior = "bloom" | "ripple" | "index" | "flutter" | "static"

export interface RadialBloomProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled extension of the whole array, 0 closed to 1 open. */
  extension?: number
  /** Controlled extension per ram. Its length sets the ram count. */
  strokes?: readonly number[]
  /**
   * What the array does when neither `extension` nor `strokes` is supplied.
   * The default holds station near full travel, which is the array working;
   * `bloom` is the one that runs the whole stroke.
   */
  behavior?: BloomBehavior
  /** How many rams on the hub, 0 to 24. */
  rams?: number
  /** Half-angle of the two ranks either side of the hub plane, in degrees. */
  pitch?: number
  /** Turn of the whole array about its own axis, in degrees. */
  spin?: number
  /** Where the camera stands. One array, four projections. */
  view?: RobotView
  /** Cycles per second: one open and close, one pass round the ring. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag out from the hub to work the array by hand, or arrow-key it. */
  interactive?: boolean
  onExtensionChange?: (extension: number) => void
  /** Hub lamp: idle is dead, ready is live, warning takes the shell colour. */
  signal?: "idle" | "ready" | "warning"
  /** Dashed circle at the array's full reach. Defaults on in blueprint. */
  showEnvelope?: boolean
  showGround?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function RadialBloom({
  extension,
  strokes,
  behavior = "flutter",
  rams = 12,
  pitch = 13,
  spin = 0,
  view = "plan",
  speed = 0.3,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onExtensionChange,
  signal = "ready",
  showEnvelope,
  showGround = true,
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
}: RadialBloomProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const vector = strokes && strokes.length > 0 ? strokes.slice(0, MAX_RAMS) : null
  const count = vector ? vector.length : clamp(Math.round(finite(rams, 12)), 0, MAX_RAMS)
  const controlled = extension !== undefined || vector !== null
  const hold = controlled
    ? vector
      ? mean(vector)
      : clamp(finite(extension, 0), 0, 1)
    : held

  const goal = React.useCallback((clock: number) => bloomGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: BLOOM_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const open = clamp(motion.value, 0, 1)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = clamp(finite(next, 0), 0, 1)
      setHeld(bounded)
      onExtensionChange?.(bounded)
    },
    [onExtensionChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // Distance out from the hub is the stroke, measured the way the array is
    // drawn: the plan-view radius, whichever camera is actually looking at it.
    onDrag: React.useCallback(
      (unit: Vec2) => {
        const dx = unit.x * VIEW - CENTRE
        const dy = unit.y * VIEW - CENTRE
        apply((Math.hypot(dx, dy) - TIP_CLOSED) / TRAVEL)
      },
      [apply],
    ),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const camera = robotCamera(view)
  const turn = finite(spin, 0)
  const rank = clamp(finite(pitch, 13), 0, 40)
  const readout = Math.round(open * 100)

  const sleeve = robotSurface("dark", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const shell = robotSurface("shell", variant, palette)
  const bolt = robotSurface("dark", variant, palette, 0.5)
  const surfaces: Record<RobotRole, ReturnType<typeof robotSurface>> = {
    shell,
    metal: machined,
    dark: sleeve,
    accent: robotSurface("accent", variant, palette),
  }
  const lamp = signal === "warning" ? palette.shell : signal === "idle" ? palette.metal : palette.accent

  // Every ram is the same geometry at its own azimuth, rank and stroke. Stages
  // are convex slabs, so one `slabPath` per stage is exact from every camera.
  const ramsDrawn = Array.from({ length: count }, (_, index) => {
    const azimuth = turn + (index * 360) / Math.max(1, count)
    const tilt = index % 2 === 0 ? rank : -rank
    const frame = ramFrame(azimuth, tilt)
    const stroke = vector
      ? clamp(finite(vector[index], 0), 0, 1)
      : ramStroke(behavior, open, motion.clock, index, count)
    const travel = TRAVEL * REACH[index % REACH.length] * stroke
    const stages = Array.from({ length: STAGES }, (_, k) => {
      const offset = (travel * k) / (STAGES - 1)
      const from = STAGE_R0 + offset
      const to = from + STAGE_LENGTH + (k === STAGES - 1 ? NOSE : 0)
      const halfWidth = STAGE_HALF_W[k]
      const halfThick = STAGE_HALF_T[k]
      return {
        role: STAGE_ROLE[k],
        body: slab(stageOutline(from, to, halfWidth, k === STAGES - 1), frame, camera, halfThick),
        // The mouth each stage presents to the one inside it.
        collar:
          k === STAGES - 1
            ? null
            : slab(stageOutline(to - 2.6, to, halfWidth + 0.7, false), frame, camera, halfThick + 0.5),
      }
    })
    return {
      index,
      // Draw the far rams before the hub and the near ones after it.
      depth: camera.depth(frame.u.x * 46, frame.u.y * 46, frame.u.z * 46),
      stages,
    }
  })

  const hubDepth = camera.depth(0, HUB_TOP, 0)
  const far = ramsDrawn.filter((ram) => ram.depth <= hubDepth)
  const near = ramsDrawn.filter((ram) => ram.depth > hubDepth)
  const shadow = camera.project(0, GROUND, 0)
  const envelope = showEnvelope ?? variant === "blueprint"

  const Ram = ({ ram }: { ram: (typeof ramsDrawn)[number] }) => (
    <g data-ram={ram.index}>
      {ram.stages.map((stage, k) => (
        <React.Fragment key={k}>
          <path
            d={stage.body}
            {...surfaces[stage.role]}
            {...(k === STAGES - 1 ? { "data-blade": "" } : null)}
          />
          {stage.collar && <path d={stage.collar} {...machined} />}
        </React.Fragment>
      ))}
    </g>
  )

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Radial bloom, ${count} rams at ${readout}% extension, ${viewNames[view] ?? viewNames.plan}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout}% extension` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.15 : 0.05, 0.25)
        if (delta !== 0) apply(open + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      width={width}
      height={width}
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
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          {camera.lift > 0.01 ? (
            <path d={`M 10 ${px(CENTRE - GROUND * camera.lift)} H 210`} strokeDasharray="2 3" />
          ) : (
            <path d={`M 10 ${CENTRE} H 210 M ${CENTRE} 10 V 210`} strokeDasharray="2 3" />
          )}
        </g>
      )}

      {showGround && (
        <ellipse
          cx={px(CENTRE + shadow.x)}
          cy={px(CENTRE + shadow.y)}
          rx={px(HUB_R * 1.5)}
          ry={px(HUB_R * 1.5 * camera.flatten)}
          fill={palette.dark}
          opacity={0.14}
        />
      )}

      <g data-bloom transform={`translate(${CENTRE} ${CENTRE})`}>
        {envelope && (
          <g data-envelope transform={camera.plane(0)} fill="none" stroke={palette.grid} strokeWidth={0.6}>
            <circle r={TIP_OPEN} strokeDasharray="2 4" />
            <circle r={TIP_CLOSED} strokeDasharray="1 5" />
          </g>
        )}

        {far.map((ram) => (
          <Ram key={ram.index} ram={ram} />
        ))}

        <g data-hub>
          <path d={extrudedPath(circleFootprint(0, 0, HUB_R, 18), camera, HUB_TOP, HUB_BOTTOM)} {...shell} />
          <g transform={camera.plane(HUB_TOP, turn)}>
            <circle r={HUB_R - 2} {...shell} />
            <circle r={7.5} {...machined} />
            {Array.from({ length: 8 }, (_, i) => {
              const angle = (i * Math.PI) / 4
              return (
                <circle
                  key={i}
                  cx={px(Math.cos(angle) * 13.5)}
                  cy={px(Math.sin(angle) * 13.5)}
                  r={1.1}
                  {...bolt}
                />
              )
            })}
            <path d={`M 0 ${px(-HUB_R + 1)} V ${px(-HUB_R + 4.5)}`} stroke={palette.grid} strokeWidth={0.7} />
            <circle r={4.2} {...bolt} />
            <circle data-lamp r={2.6} fill={lamp} opacity={variant === "wire" ? 1 : 0.92} />
            <circle r={4.4} fill="none" stroke={palette.glow} strokeWidth={0.6} opacity={0.4} />
          </g>
        </g>

        {near.map((ram) => (
          <Ram key={ram.index} ram={ram} />
        ))}
      </g>

      {variant === "blueprint" && (
        <text
          x={12}
          y={16}
          textAnchor="start"
          fontFamily="ui-monospace, monospace"
          fontSize={6}
          fill={palette.foreground}
        >
          {`${readout}% · ${count}R · ${px(TIP_OPEN)}u`}
        </text>
      )}
      {label && (
        <text
          x={CENTRE}
          y={VIEW - 6}
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

/** A ram's own axes: `u` out along it, `v` across it, `n` through its thickness. */
function ramFrame(azimuth: number, tilt: number) {
  const a = toRadians(finite(azimuth, 0))
  const p = toRadians(finite(tilt, 0))
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  const cp = Math.cos(p)
  const sp = Math.sin(p)
  return {
    u: { x: sa * cp, y: sp, z: -ca * cp },
    v: { x: ca, y: 0, z: sa },
    n: { x: sp * sa, y: -cp, z: -sp * ca },
  }
}

type RamFrame = ReturnType<typeof ramFrame>

/**
 * One stage's outline in ram coordinates: `x` out along the ram, `y` across it.
 * The last stage carries the chisel — two facets of unequal length, so the point
 * sits off the centre line the way a machined nose does.
 */
function stageOutline(from: number, to: number, halfWidth: number, nose: boolean): Vec2[] {
  if (!nose) {
    return [
      { x: from, y: halfWidth },
      { x: to, y: halfWidth },
      { x: to, y: -halfWidth },
      { x: from, y: -halfWidth },
    ]
  }
  const span = Math.max(1, to - from)
  return [
    { x: from, y: halfWidth },
    { x: to - Math.min(7, span * 0.4), y: halfWidth * 0.84 },
    { x: to, y: halfWidth * 0.18 },
    { x: to, y: -halfWidth * 0.18 },
    { x: to - Math.min(11, span * 0.62), y: -halfWidth * 0.96 },
    { x: from, y: -halfWidth },
  ]
}

/** A stage as the solid it is: its outline swept `±halfThick` through the ram. */
function slab(
  outline: readonly Vec2[],
  frame: RamFrame,
  camera: ReturnType<typeof robotCamera>,
  halfThick: number,
) {
  const corners: Vec3[] = outline.flatMap((point) => [
    ramPoint(frame, point.x, point.y, halfThick),
    ramPoint(frame, point.x, point.y, -halfThick),
  ])
  return slabPath(corners, camera)
}

const ramPoint = (frame: RamFrame, r: number, w: number, t: number): Vec3 => ({
  x: frame.u.x * r + frame.v.x * w + frame.n.x * t,
  y: frame.u.y * r + frame.v.y * w + frame.n.y * t,
  z: frame.u.z * r + frame.v.z * w + frame.n.z * t,
})

const finite = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) ? (value as number) : fallback

const mean = (values: readonly number[]) => {
  const usable = values.map((value) => clamp(finite(value, 0), 0, 1))
  return usable.length ? usable.reduce((total, value) => total + value, 0) / usable.length : 0
}

/**
 * How far open the array wants to be at `clock`. The behaviours that spread the
 * rams apart hold a steady setpoint here and do their work in
 * {@link ramStroke} — the array's extension and its distribution are two
 * different things, and only the first is what a person grabs.
 */
export function bloomGoal(behavior: BloomBehavior, clock: number): number {
  if (!Number.isFinite(clock)) return NEUTRAL
  const t = ((clock % 1) + 1) % 1
  switch (behavior) {
    case "bloom":
      return (1 - Math.cos(t * Math.PI * 2)) / 2
    case "ripple":
      return 0.72
    case "index":
      return 0.78
    case "flutter":
      return 0.9
    default:
      return NEUTRAL
  }
}

/**
 * How ram `index` of `count` shares in an array open by `extension`. Pure, so
 * the cycle is testable without faking animation frames.
 */
export function ramStroke(
  behavior: BloomBehavior,
  extension: number,
  clock: number,
  index: number,
  count: number,
): number {
  const open = Number.isFinite(extension) ? clamp(extension, 0, 1) : 0
  const n = Math.max(1, Math.round(Number.isFinite(count) ? count : 1))
  const i = Number.isFinite(index) ? ((Math.round(index) % n) + n) % n : 0
  const t = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    case "ripple": {
      const wave = (1 - Math.cos((t - i / n) * Math.PI * 2)) / 2
      return clamp(open * (0.3 + 0.7 * wave), 0, 1)
    }
    case "index": {
      const active = Math.floor((((t % 1) + 1) % 1) * n)
      return clamp(active === i ? open : open * 0.2, 0, 1)
    }
    case "flutter":
      return clamp(open * (1 + Math.sin((t * 3 + i * 0.41) * Math.PI * 2) * 0.16), 0, 1)
    default:
      return open
  }
}

export { RadialBloom }
