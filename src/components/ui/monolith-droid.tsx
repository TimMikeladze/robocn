"use client"

/**
 * monolith-droid — a slab-bodied walker with no limbs.
 *
 * A rectangular column sliced lengthwise into parallel slabs, each hung off a
 * hinge at the centre of its own top face. Every pose the machine has is those
 * slabs moving relative to one another: `splay` swings them out into a braced
 * A-frame, `stride` swings them fore and aft half a cycle apart so the column
 * walks on itself, and that is the whole mechanism.
 *
 * Each part is a cuboid in world units, drawn by projecting its corners through
 * `robotCamera(view)` — faces that point at the camera, painted back to front.
 * Face artwork rides an affine matrix built from the projected face basis, so a
 * pin hole is a real circle on a real face from every angle.
 *
 * Design note: docs/monolith-droid.md.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import {
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  type RobotPaletteProps,
  type RobotRole,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type MonolithDroidBehavior = "walk" | "unfold" | "brief" | "static"

/** The column is drawn straight on; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"

/* The frame. World units about the deck under the middle of the column:
   x starboard, y up, z toward the tail. */
const CENTRE = 100
const BASE = 188
const SLAB_H = 132
const SLAB_HW = 9.5
const SLAB_HD = 11
const SLAB_GAP = 1.6
const PITCH = SLAB_HW * 2 + SLAB_GAP
/** Base plate: shorter than a slab, proud of it on every side. */
const FOOT_H = 6
const FOOT_OUT = 3
/** Degrees the outermost slab reaches at `splay` 1. */
const MAX_SPLAY = 16
/** Degrees of fore-aft swing at each end of the footfall cycle. */
const MAX_SWING = 13
/** World units a slab clears the deck by while it is reaching. */
const STEP_RISE = 7
/** Splay units per second while easing back into the behaviour. */
const SPLAY_RATE = 0.7
const PANEL_ROWS = 4

/** Face artwork, in the face's own world units: down from the top of the slab. */
const PIN_Y = 10
const SEAMS = [24, 78, 112]
const COLLAR = { top: 30, bottom: 48 }
const PANEL = { top: 54, bottom: 76, inset: 2.4 }
/** Row widths, as a fraction of the readout — short lines of a readout. */
const ROW_WIDTHS = [0.86, 0.62, 0.94, 0.44]

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/** How far the camera pulls back so the machine still fits the frame. */
const fits: Record<RobotView, number> = { plan: 1, front: 1, profile: 1, iso: 0.9 }

interface Vec3 {
  x: number
  y: number
  z: number
}

type FacetArt = "broad" | "narrow" | "cap" | "none"

interface Facet {
  key: string
  normal: Vec3
  /** The face's top-left corner, and the two edges out of it. */
  origin: Vec3
  u: Vec3
  v: Vec3
  role: RobotRole
  art: FacetArt
}

/**
 * The six faces of a box, each as a corner and two edge vectors, so one face
 * carries both its outline and the frame its artwork is drawn in.
 */
function boxFacets(
  hw: number,
  hd: number,
  top: number,
  bottom: number,
  side: RobotRole,
  cap: RobotRole,
  art: boolean,
): Facet[] {
  const drop: Vec3 = { x: 0, y: bottom - top, z: 0 }
  return [
    { key: "front", normal: { x: 0, y: 0, z: -1 }, origin: { x: -hw, y: top, z: -hd }, u: { x: hw * 2, y: 0, z: 0 }, v: drop, role: side, art: art ? "broad" : "none" },
    { key: "back", normal: { x: 0, y: 0, z: 1 }, origin: { x: hw, y: top, z: hd }, u: { x: -hw * 2, y: 0, z: 0 }, v: drop, role: side, art: art ? "broad" : "none" },
    { key: "right", normal: { x: 1, y: 0, z: 0 }, origin: { x: hw, y: top, z: -hd }, u: { x: 0, y: 0, z: hd * 2 }, v: drop, role: side, art: art ? "narrow" : "none" },
    { key: "left", normal: { x: -1, y: 0, z: 0 }, origin: { x: -hw, y: top, z: hd }, u: { x: 0, y: 0, z: -hd * 2 }, v: drop, role: side, art: art ? "narrow" : "none" },
    { key: "top", normal: { x: 0, y: 1, z: 0 }, origin: { x: -hw, y: top, z: hd }, u: { x: hw * 2, y: 0, z: 0 }, v: { x: 0, y: 0, z: -hd * 2 }, role: cap, art: art ? "cap" : "none" },
    { key: "bottom", normal: { x: 0, y: -1, z: 0 }, origin: { x: -hw, y: bottom, z: -hd }, u: { x: hw * 2, y: 0, z: 0 }, v: { x: 0, y: 0, z: hd * 2 }, role: cap, art: "none" },
  ]
}

export interface MonolithDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. One machine, four projections. */
  view?: RobotView
  /** How far the column is open, 0 closed to 1 braced. Supplying it stops the loop. */
  splay?: number
  /** Controlled footfall phase, 0–1. Omit and the behaviour works the gait. */
  stride?: number
  /** Lit rows in the readout, 0–1. Omit and the behaviour works it. */
  panel?: number
  /** Whole-body tilt in degrees. Omit and the behaviour works it. */
  lean?: number
  /** Slabs in the column, 3–6. */
  slabs?: number
  /** What it does when `splay` is not supplied. */
  behavior?: MonolithDroidBehavior
  /** Cycles per second: one footfall pair, or one open and close. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a pair of them breaks step. */
  phase?: number
  /** Drag the column open and closed, or work it from the arrow keys. */
  interactive?: boolean
  onSplayChange?: (splay: number) => void
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

function MonolithDroid({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  splay,
  stride,
  panel,
  lean,
  slabs = 4,
  behavior = "walk",
  speed = 0.5,
  animate = true,
  paused = false,
  phase = 0,
  interactive = true,
  onSplayChange,
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
}: MonolithDroidProps) {
  const controlled = splay !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const hold = controlled ? finiteClamp(splay, 0, 1, 0.5) : held

  const goal = React.useCallback(
    (clock: number) => monolithDroidPose(behavior, clock).splay,
    [behavior],
  )
  const motion = useRobotScalar(goal, {
    rate: SPLAY_RATE,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const open = finiteClamp(motion.value, 0, 1, 0.5)
  const scripted = monolithDroidPose(behavior, motion.clock)
  const walking = stride !== undefined ? 1 : clamp(scripted.gait, 0, 1)
  const step = fract(stride !== undefined ? finite(stride) : scripted.step)
  const talk = finiteClamp(panel ?? scripted.panel, 0, 1, 0)
  const tilt = finiteClamp(lean ?? scripted.lean, -14, 14, 0)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = round3(clamp(next, 0, 1))
      setHeld(bounded)
      onSplayChange?.(bounded)
    },
    [onSplayChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // Across the box is the whole range: the gesture is pulling it apart.
    onDrag: React.useCallback((unit: Vec2) => apply(Math.abs(unit.x - 0.5) * 2), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const count = Number.isFinite(slabs) ? Math.round(clamp(slabs, 3, 6)) : 4
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const signalColor =
    signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal
  const seamColor = variant === "solid" ? palette.dark : palette.grid

  /* ----------------------------------------------------------------- pose */

  const half = (count - 1) / 2
  // The readout sits on one slab, left of centre, so the column is not symmetric.
  const readoutSlab = Math.max(0, Math.floor(half))
  const leanCos = Math.cos(toRadians(tilt))
  const leanSin = Math.sin(toRadians(tilt))

  const column = Array.from({ length: count }, (_, index) => {
    const offset = index - half
    // Outer slabs swing furthest, so the column opens as one fan.
    const hinge = half === 0 ? 0 : (offset / half) * MAX_SPLAY * open
    // Alternate slabs are half a cycle apart: one pair plants, the other reaches.
    const cycle = fract(step + (index % 2 === 0 ? 0 : 0.5))
    const swing = MAX_SWING * walking * Math.cos(cycle * Math.PI * 2)
    const rise = STEP_RISE * walking * Math.max(0, Math.sin(cycle * Math.PI * 2))
    const pivot: Vec3 = { x: offset * PITCH, y: SLAB_H + rise, z: 0 }
    const a = toRadians(hinge)
    const b = toRadians(swing)
    // A slab turns about its own hinge, then the whole column leans.
    const direct = (p: Vec3): Vec3 => {
      const x = p.x * Math.cos(a) - p.y * Math.sin(a)
      const y0 = p.x * Math.sin(a) + p.y * Math.cos(a)
      const y = y0 * Math.cos(b) - p.z * Math.sin(b)
      const z = y0 * Math.sin(b) + p.z * Math.cos(b)
      return { x: x * leanCos - y * leanSin, y: x * leanSin + y * leanCos, z }
    }
    const place = (p: Vec3): Vec3 => {
      const turned = direct(p)
      const px0 = pivot.x * leanCos - pivot.y * leanSin
      const py0 = pivot.x * leanSin + pivot.y * leanCos
      return { x: turned.x + px0, y: turned.y + py0, z: turned.z + pivot.z }
    }
    return { index, hinge, swing, rise, direct, place }
  })

  /* --------------------------------------------------------------- camera */

  const camera = robotCamera(view)
  const fit = (fits[view] ?? 1) * spreadFit(count)
  /**
   * The feet stand on the deck line in the elevations; looking straight down
   * there is no deck and no height, so the origin slides up to the middle of
   * the frame. `camera.lift` is exactly 1 in the elevations and 0 in plan, so
   * the native view is untouched.
   */
  const deckLine = px(BASE - (SLAB_H / 2) * (1 - camera.lift))
  const project = (p: Vec3): Vec2 => camera.project(p.x, p.y, p.z)
  const facing = (n: Vec3) => camera.depth(n.x, n.y, n.z) > 0.0001

  /** The affine frame a face's own artwork is drawn in, in world units. */
  const faceFrame = (origin: Vec3, u: Vec3, v: Vec3) => {
    const uu = project(u)
    const vv = project(v)
    const o = project(origin)
    const lu = Math.hypot(u.x, u.y, u.z) || 1
    const lv = Math.hypot(v.x, v.y, v.z) || 1
    return `matrix(${px(uu.x / lu)} ${px(uu.y / lu)} ${px(vv.x / lv)} ${px(vv.y / lv)} ${px(o.x)} ${px(o.y)})`
  }

  const polygon = (origin: Vec3, u: Vec3, v: Vec3) => {
    const corners = [
      origin,
      { x: origin.x + u.x, y: origin.y + u.y, z: origin.z + u.z },
      { x: origin.x + u.x + v.x, y: origin.y + u.y + v.y, z: origin.z + u.z + v.z },
      { x: origin.x + v.x, y: origin.y + v.y, z: origin.z + v.z },
    ].map(project)
    return `${corners.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
  }

  /* ---------------------------------------------------------------- parts */

  const slabPaint = robotSurface("shell", variant, palette)
  const capPaint = robotSurface("metal", variant, palette)
  const footPaint = robotSurface("dark", variant, palette, 1.2)

  const boxes = column.flatMap((slab) => {
    const body = boxFacets(SLAB_HW, SLAB_HD, 0, -SLAB_H, "shell", "metal", true)
    const foot = boxFacets(
      SLAB_HW + FOOT_OUT,
      SLAB_HD + FOOT_OUT,
      -SLAB_H,
      -SLAB_H - FOOT_H,
      "dark",
      "dark",
      false,
    )
    return [
      { slab, part: "slab" as const, facets: body },
      { slab, part: "foot" as const, facets: foot },
    ]
  })

  /** Slabs are convex and never interpenetrate, so centroid depth orders them. */
  const ordered = boxes
    .map((box) => {
      const centre = box.slab.place({
        x: 0,
        y: box.part === "foot" ? -SLAB_H - FOOT_H / 2 : -SLAB_H / 2,
        z: 0,
      })
      return { ...box, depth: camera.depth(centre.x, centre.y, centre.z) }
    })
    .sort((a, b) => a.depth - b.depth)

  const paintFor = (facetRole: RobotRole) =>
    facetRole === "dark" ? footPaint : facetRole === "metal" ? capPaint : slabPaint

  const contacts = column.map((slab) => {
    const foot = slab.place({ x: 0, y: -SLAB_H - FOOT_H, z: 0 })
    const ground = camera.project(foot.x, 0, foot.z)
    return { index: slab.index, ground, rise: slab.rise }
  })

  const state = dragging
    ? "worked by hand"
    : behavior === "static"
      ? "parked"
      : behavior === "unfold"
        ? "unfolding"
        : behavior === "brief"
          ? "briefing"
          : "walking"
  const readout = Math.round(open * 100)

  /* -------------------------------------------------------------- artwork */

  const broadArt = (slabIndex: number, faceKey: string) => {
    const w = SLAB_HW * 2
    return (
      <>
        <g data-pin>
          <circle cx={px(w * 0.29)} cy={PIN_Y} r={1.8} fill={palette.dark} opacity={0.85} />
          <circle cx={px(w * 0.71)} cy={PIN_Y} r={1.8} fill={palette.dark} opacity={0.85} />
        </g>
        {SEAMS.map((y) => (
          <rect key={y} x={0} y={y} width={px(w)} height={1.1} fill={seamColor} opacity={0.5} />
        ))}
        <rect
          data-collar
          x={0}
          y={COLLAR.top}
          width={px(w)}
          height={COLLAR.bottom - COLLAR.top}
          fill={palette.dark}
          opacity={0.9}
        />
        {slabIndex === readoutSlab && faceKey === "front" && (
          <g data-panel>
            <rect
              x={PANEL.inset}
              y={PANEL.top}
              width={px(w - PANEL.inset * 2)}
              height={PANEL.bottom - PANEL.top}
              fill={palette.dark}
              opacity={0.92}
            />
            {ROW_WIDTHS.slice(0, PANEL_ROWS).map((share, row) => {
              const lit = row < Math.round(talk * PANEL_ROWS)
              const inner = w - PANEL.inset * 2 - 3
              return (
                <rect
                  key={row}
                  data-row={row}
                  data-lit={lit ? "" : undefined}
                  x={px(PANEL.inset + 1.5)}
                  y={px(PANEL.top + 2.6 + row * 4.6)}
                  width={px(inner * share)}
                  height={2.4}
                  fill={lit ? signalColor : palette.metal}
                  opacity={lit ? 0.95 : 0.32}
                />
              )
            })}
            <circle
              data-lamp
              cx={px(w - PANEL.inset - 1.6)}
              cy={px(PANEL.top - 3)}
              r={1.5}
              fill={signalColor}
              className={signal === "ready" ? "robocn-pulse" : undefined}
            />
          </g>
        )}
      </>
    )
  }

  const narrowArt = () => {
    const w = SLAB_HD * 2
    return (
      <>
        {SEAMS.map((y) => (
          <rect key={y} x={0} y={y} width={px(w)} height={1.1} fill={seamColor} opacity={0.5} />
        ))}
        <rect
          data-collar
          x={0}
          y={COLLAR.top}
          width={px(w)}
          height={COLLAR.bottom - COLLAR.top}
          fill={palette.dark}
          opacity={0.9}
        />
        {/* Louvres: the one thing on the narrow face, so the column is not blank
            in profile. */}
        {[90, 95, 100].map((y) => (
          <rect key={y} x={px(w * 0.25)} y={y} width={px(w * 0.5)} height={1.6} fill={palette.dark} opacity={0.45} />
        ))}
      </>
    )
  }

  /** The hinge slot down the middle of the end cap: what plan view is of. */
  const capArt = () => (
    <rect
      data-hinge
      x={px(SLAB_HW - 2)}
      y={2.5}
      width={4}
      height={px(SLAB_HD * 2 - 5)}
      rx={1.6}
      fill={palette.dark}
      opacity={0.8}
    />
  )

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Monolith droid, ${state}, ${readout} percent open, ${count} slabs, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout} percent open` : undefined}
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
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d={`M 12 ${deckLine} H 188 M ${CENTRE} 16 V 218`} strokeDasharray="2 3" />
          <path d={`M 24 ${px(deckLine - SLAB_H * camera.lift)} H 176`} strokeDasharray="4 3" />
        </g>
      )}

      <g transform={`translate(${CENTRE} ${deckLine})${fit === 1 ? "" : ` scale(${px(fit)})`}`}>
        {showGround && (
          <g data-contact>
            {contacts.map((contact) => (
              <g
                key={contact.index}
                transform={`translate(${px(contact.ground.x)} ${px(contact.ground.y)}) ${camera.plane()}`.trimEnd()}
              >
                <ellipse
                  rx={px(SLAB_HW + FOOT_OUT + 2)}
                  ry={px(SLAB_HD + FOOT_OUT + 2)}
                  fill={palette.dark}
                  opacity={px(0.2 - (contact.rise / STEP_RISE) * 0.1)}
                />
              </g>
            ))}
          </g>
        )}

        <g data-monolith data-view={view}>
          {ordered.map((box) =>
            box.facets
              .map((facet) => {
                const normal = box.slab.direct(facet.normal)
                const origin = box.slab.place(facet.origin)
                const u = box.slab.direct(facet.u)
                const v = box.slab.direct(facet.v)
                const centre = box.slab.place({
                  x: facet.origin.x + (facet.u.x + facet.v.x) / 2,
                  y: facet.origin.y + (facet.u.y + facet.v.y) / 2,
                  z: facet.origin.z + (facet.u.z + facet.v.z) / 2,
                })
                return { facet, normal, origin, u, v, depth: camera.depth(centre.x, centre.y, centre.z) }
              })
              .filter((face) => facing(face.normal))
              .sort((a, b) => a.depth - b.depth)
              .map((face) => (
                <g key={`${box.slab.index}-${box.part}-${face.facet.key}`}>
                  <path
                    data-slab={box.slab.index}
                    data-part={box.part}
                    data-facet={face.facet.key}
                    d={polygon(face.origin, face.u, face.v)}
                    {...paintFor(face.facet.role)}
                  />
                  {face.facet.art !== "none" && variant !== "wire" && (
                    <g
                      data-art={box.slab.index}
                      transform={faceFrame(face.origin, face.u, face.v)}
                    >
                      {face.facet.art === "broad"
                        ? broadArt(box.slab.index, face.facet.key)
                        : face.facet.art === "narrow"
                          ? narrowArt()
                          : capArt()}
                    </g>
                  )}
                </g>
              )),
          )}
        </g>
      </g>

      {label && (
        <text
          x={CENTRE}
          y={226}
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

/* ------------------------------------------------------------------ maths */

const finite = (value: number) => (Number.isFinite(value) ? value : 0)
const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback
const round3 = (value: number) => Math.round(value * 1000) / 1000
const fract = (value: number) => {
  const time = finite(value)
  return ((time % 1) + 1) % 1
}

/**
 * How far the camera has to pull back for a column of `count` slabs at full
 * splay to stay inside the frame. Worked from the widest pose the machine has,
 * not the current one, so opening it never rescales the drawing.
 */
function spreadFit(count: number) {
  const reach =
    ((count - 1) / 2) * PITCH + SLAB_H * Math.sin(toRadians(MAX_SPLAY)) + SLAB_HW + FOOT_OUT + 4
  return Math.min(1, round3(86 / reach))
}

/**
 * What the column does with no `splay` on it. `splay` is how far open it eases
 * toward, `step` the footfall phase, `gait` how much of the stride swing is
 * used, `panel` the readout output and `lean` the whole-body tilt.
 *
 * Illustrative, not simulated: no mass, no balance, no support polygon. The
 * gait is a scripted footfall cycle rather than a solved one.
 */
export function monolithDroidPose(behavior: MonolithDroidBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Opens and closes the column with the slabs still: the mechanism on show.
    case "unfold":
      return {
        splay: 0.5 - 0.5 * Math.cos(time * Math.PI * 2),
        step: 0,
        gait: 0,
        panel: 0,
        lean: 0,
      }
    // Stands near-closed and talks.
    case "brief":
      return {
        splay: 0.12,
        step: 0,
        gait: 0,
        panel: 0.5 + 0.5 * Math.sin(time * 8),
        lean: 1.5 * Math.sin(time * Math.PI * 0.6),
      }
    case "static":
      return { splay: 0.5, step: 0, gait: 0, panel: 0, lean: 0 }
    // Strides at a working splay, rolling a little into each footfall.
    default:
      return {
        splay: 0.62,
        step: fract(time),
        gait: 1,
        panel: 0,
        lean: 2.5 * Math.sin(time * Math.PI * 2),
      }
  }
}

export { MonolithDroid }
