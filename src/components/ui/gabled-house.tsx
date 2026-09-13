"use client"

/**
 * gabled-house — a dwelling drawn as a machine.
 *
 * Three things move, and all three are solved rather than drawn: the gable,
 * whose ridge height is the pitch you pass it; the garage door, whose rigid
 * panels ride one track from vertical to horizontal without ever stretching;
 * and the louvre fins and roof array, which turn to face the sun and report it
 * when they have run out of travel.
 *
 * `sun` is one whole day from midnight to midnight. Everything else follows
 * from it — the fins, the array, the shadow's direction and length, and whether
 * the windows are lit — so a single number is the machine's whole state.
 *
 * Brick, glazing bars and planting are drawing. Nothing here computes a heat
 * flow, a daylight factor, a wind load or a real solar position for a real
 * latitude: the sun runs a symmetric arc, and the docs say so.
 */

import * as React from "react"

import { clamp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  sectionalPanels,
  sectionalTrack,
  slatPose,
} from "@/lib/robocn/household"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import {
  boxCorners,
  elevationDraft,
  elevationPoint,
  extrudedPath,
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

export type GabledHouseBehavior = "day" | "arrive" | "static"

const VIEW_WIDTH = 260
const VIEW_HEIGHT = 200
const NATIVE_VIEW: RobotView = "front"

/** One storey of the main body. */
const STOREY = 32
const MAIN_LEFT = -62
const MAIN_RIGHT = 22
const MAIN_DEPTH = 26
const RIDGE_X = (MAIN_LEFT + MAIN_RIGHT) / 2
const MAIN_HALF = (MAIN_RIGHT - MAIN_LEFT) / 2
const EAVE_OVERHANG = 6

/** The garage wing, to the right of the house and shallower than it. */
const WING_LEFT = MAIN_RIGHT
const WING_RIGHT = 86
const WING_HEIGHT = 36
const WING_DEPTH = 20
const DOOR_LEFT = WING_LEFT + 8
const DOOR_RIGHT = WING_RIGHT - 8
const DOOR_HEAD = 28

/** The tracking array, on its own mast in the garden. */
const ARRAY_X = MAIN_LEFT - 22
const ARRAY_Y = 22

/** Half-thickness of anything that is artwork on a face rather than a solid. */
const FACE = 0.5

/** Days per second the machine will chase its clock over after a drag. */
const SLEW_RATE = 1.4

/** Fins over each window, on vertical axes, at this spacing and this width. */
const FIN_PITCH = 5
const FIN_WIDTH = 4.6

/**
 * Where an unphased clock starts: a little after sunrise, so a machine parked
 * by a reduced-motion preference stands in the morning rather than in the dark.
 */
const DAWN = 0.3

/** One day, wrapped in both directions: the drawing's own coordinate. */
const wrapDay = (value: number) =>
  Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface GabledHouseProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled time of day, 0 midnight to 1 midnight. Supplying it stops the loop. */
  sun?: number
  onSunChange?: (sun: number) => void
  behavior?: GabledHouseBehavior
  /** Storeys in the main body, rounded and clamped to 1–3. */
  storeys?: number
  /** Roof pitch in degrees, 10–55. The ridge height is a consequence of it. */
  pitch?: number
  /** Controlled garage door travel, 0 shut to 1 open. */
  garage?: number
  /** Panels in the garage door curtain, 2–6. */
  panels?: number
  /** The tracking array on the roof slope. */
  array?: boolean
  /** The sun itself, on its arc. It is the input, so it is worth drawing. */
  showSun?: boolean
  showGround?: boolean
  view?: RobotView
  speed?: number
  phase?: number
  paused?: boolean
  animate?: boolean
  interactive?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function GabledHouse({
  sun,
  onSunChange,
  behavior = "day",
  storeys = 2,
  pitch = 38,
  garage,
  panels = 4,
  array = true,
  showSun = true,
  showGround = true,
  view = NATIVE_VIEW,
  speed = 0.08,
  phase = 0,
  paused = false,
  animate = true,
  interactive = false,
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
}: GabledHouseProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = sun !== undefined

  const floors = Number.isFinite(storeys) ? clamp(Math.round(storeys), 1, 3) : 2
  const slope = Number.isFinite(pitch) ? clamp(pitch, 10, 55) : 38
  const leaves = Number.isFinite(panels) ? clamp(Math.round(panels), 2, 6) : 4

  const hold = controlled ? (Number.isFinite(sun) ? (sun as number) : 0) : held
  const goal = React.useCallback((clock: number) => houseSun(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: SLEW_RATE,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  // The clock runs on without wrapping, so the sun never rewinds across the
  // sky when a day ends; the drawing is what takes it modulo one.
  const day = wrapDay(motion.value)
  const door = clamp(
    garage !== undefined && Number.isFinite(garage) ? garage : houseGarage(behavior, day),
    0,
    1,
  )

  const apply = React.useCallback(
    (next: number) => {
      const at = Math.round(next * 1000) / 1000
      setHeld(at)
      onSunChange?.(wrapDay(at))
    },
    [onSunChange],
  )
  // Report the time as it runs, not only when someone drags it — to five
  // minutes, so a caller is not re-rendered for every frame of the day.
  const reported = React.useRef(-1)
  React.useEffect(() => {
    const at = Math.round(day * 288) / 288
    if (reported.current === at) return
    reported.current = at
    onSunChange?.(at)
  }, [day, onSunChange])
  // Drag relative to where the day already stands, so grabbing it does not
  // jump the sun to wherever the pointer happened to land.
  const live = React.useRef(0)
  React.useEffect(() => {
    live.current = motion.value
  })
  const press = React.useRef<{ from: number; at: number } | null>(null)
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => {
        if (!press.current) {
          press.current = { from: live.current, at: unit.x }
          return
        }
        // The whole width of the frame is one day.
        apply(press.current.from + (unit.x - press.current.at))
      },
      [apply],
    ),
    onDragEnd: React.useCallback(() => {
      press.current = null
      setHeld(null)
    }, []),
  })

  const camera = robotCamera(view)
  const eaves = floors * STOREY
  const rise = MAIN_HALF * Math.tan((slope * Math.PI) / 180)
  const ridge = eaves + rise
  const envelope = boxCorners(
    { x: -(WING_RIGHT + 6), y: 0, z: -(MAIN_DEPTH + 10) },
    { x: -(ARRAY_X - 18), y: ridge + 14, z: MAIN_DEPTH + 10 },
  )
  const frame = fitTransform(envelope, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const draft = elevationDraft(camera, "front")
  const { point: to, path: line, solid, box, bar } = draft

  // Line art paints nothing: glass, the garage void and the array are fills,
  // so they have to answer the variant rather than ignoring it.
  const wash = (value: number) => (variant === "outline" || variant === "wire" ? 0 : value)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  // The sun, the fins and the array are one solve: everything turns to face it.
  const sky = slatPose(day, { width: FIN_WIDTH, pitch: FIN_PITCH, minTilt: -78, maxTilt: 78 })
  const tracker = slatPose(day, { minTilt: -58, maxTilt: 58 })
  const night = sky.night
  const lit = night ? 1 : clamp(1 - sky.altitude / 18, 0, 1)

  // Shadow: away from the sun, and longer as the sun drops. Clamped, because a
  // sun on the horizon casts a shadow of no useful length at all.
  const shadowRun = night ? 0 : clamp(ridge / Math.tan(Math.max(sky.altitude, 7) * Math.PI / 180), 0, 150)
  const shadowAngle = (sky.azimuth * Math.PI) / 180
  const shadowShift = {
    x: Math.sin(shadowAngle) * shadowRun,
    z: -Math.cos(shadowAngle) * shadowRun * 0.42,
  }

  const sky3 = skyPoint(sky.azimuth, sky.altitude, 120)
  const sunAt = camera.project(sky3.x, sky3.y, sky3.z)

  const hour = `${String(Math.floor(day * 24)).padStart(2, "0")}:${String(
    Math.floor(((day * 24) % 1) * 60),
  ).padStart(2, "0")}`
  const period = night
    ? "night"
    : sky.azimuth < -25
      ? "morning"
      : sky.azimuth > 25
        ? "afternoon"
        : "midday"

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `House with ${floors} ${floors === 1 ? "storey" : "storeys"} and a ${Math.round(slope)} degree roof pitch, ${period}, ${viewNames[view] ?? viewNames.front}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(day) : undefined}
      aria-valuetext={interactive ? `${hour}, ${period}` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 1 / 48, 1 / 8)
        if (delta !== 0) apply(motion.value + delta)
        else if (event.key === "Home") apply(Math.floor(motion.value) + 0.25)
        else if (event.key === "End") apply(Math.floor(motion.value) + 0.5)
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
          <path d={`M 8 ${VIEW_HEIGHT - 16} H ${VIEW_WIDTH - 8}`} strokeDasharray="3 4" />
        </g>
      )}

      <g data-house data-view={view} transform={frame || undefined}>
        {showGround && (
          <path
            data-shadow
            d={extrudedPath(
              [
                ...footprint(MAIN_LEFT - 4, MAIN_RIGHT + 2, MAIN_DEPTH, { x: 0, z: 0 }),
                ...footprint(WING_LEFT, WING_RIGHT, WING_DEPTH, { x: 0, z: 0 }),
                ...footprint(MAIN_LEFT - 4, MAIN_RIGHT + 2, MAIN_DEPTH, shadowShift),
              ],
              camera,
              0,
              0,
            )}
            fill={palette.dark}
            opacity={night ? 0.08 : 0.16}
          />
        )}

        {/* The sun itself: a real direction in the world, so it moves right
            from every camera rather than sliding across the picture. */}
        {showSun && !night && (
          <g data-sun data-altitude={px(sky.altitude)}>
            <circle cx={px(sunAt.x)} cy={px(sunAt.y)} r={9} fill={palette.glow} opacity={0.18} />
            <circle cx={px(sunAt.x)} cy={px(sunAt.y)} r={4.4} fill={palette.accent} />
          </g>
        )}

        {/* Main body, then the wing, then the roof over both. Each is its own
            solid, with its front face drawn again over it so the corner reads
            as a corner from the angled cameras instead of one flat silhouette. */}
        <path data-body d={box(MAIN_LEFT, 0, MAIN_RIGHT, eaves, MAIN_DEPTH)} {...shell} />
        <path d={box(MAIN_LEFT, 0, MAIN_RIGHT, eaves, FACE, MAIN_DEPTH)} {...shell} />
        <path data-wing d={box(WING_LEFT, 0, WING_RIGHT, WING_HEIGHT, WING_DEPTH)} {...shell} />
        <path d={box(WING_LEFT, 0, WING_RIGHT, WING_HEIGHT, FACE, WING_DEPTH)} {...shell} />

        {/* Course lines: drawing, and they stop at the wall they are on. */}
        {variant !== "wire" &&
          Array.from({ length: floors }, (_, index) => (index + 1) * STOREY).map((y) => (
            <path
              key={y}
              d={line([{ x: MAIN_LEFT, y }, { x: MAIN_RIGHT, y }], MAIN_DEPTH + FACE)}
              fill="none"
              stroke={palette.dark}
              strokeWidth={0.7}
              opacity={0.3}
            />
          ))}

        {/* Windows, each under its own set of tracking fins. */}
        {openings(floors).map((opening) => (
          <g key={opening.key} data-window={opening.key}>
            <path
              d={box(opening.x0, opening.y0, opening.x1, opening.y1, FACE, MAIN_DEPTH)}
              fill={night || lit > 0.35 ? palette.accent : palette.dark}
              fillOpacity={wash(night ? 0.85 : 0.2 + lit * 0.5)}
              stroke={palette.dark}
              strokeWidth={0.7}
            />
            <path
              d={line(
                [
                  { x: (opening.x0 + opening.x1) / 2, y: opening.y0 },
                  { x: (opening.x0 + opening.x1) / 2, y: opening.y1 },
                ],
                MAIN_DEPTH + FACE,
              )}
              fill="none"
              stroke={palette.dark}
              strokeWidth={0.6}
              opacity={0.6}
            />
            <g data-fins={opening.key} data-tilt={px(sky.tilt)}>
              {fins(opening, sky.tilt, camera).map((fin, index) => (
                <path key={index} d={fin} {...machined} strokeWidth={0.5} />
              ))}
            </g>
          </g>
        ))}

        {/* Front door and its lamp: the lamp is the switch the day throws. */}
        <path data-door d={box(RIDGE_X - 7, 0, RIDGE_X + 7, 22, FACE, MAIN_DEPTH)} {...cast} />
        <circle
          data-lamp
          cx={px(to({ x: RIDGE_X + 12, y: 24 }, MAIN_DEPTH + FACE * 2).x)}
          cy={px(to({ x: RIDGE_X + 12, y: 24 }, MAIN_DEPTH + FACE * 2).y)}
          r={2.4}
          fill={night ? palette.accent : palette.metal}
        />

        {/* The garage: opening, track, and the curtain riding it. */}
        <path
          data-opening
          d={box(DOOR_LEFT - 3, 0, DOOR_RIGHT + 3, DOOR_HEAD + 3, FACE, WING_DEPTH)}
          {...cast}
        />
        <path
          d={box(DOOR_LEFT, 0, DOOR_RIGHT, DOOR_HEAD, FACE, WING_DEPTH - 2)}
          fill={palette.dark}
          opacity={wash(variant === "blueprint" ? 0.14 : 0.5)}
        />
        <path
          data-track
          d={trackPath(draft, sectionalTrack({ panels: leaves, opening: DOOR_HEAD }, 18))}
          fill="none"
          stroke={palette.metal}
          strokeWidth={1.2}
          opacity={0.8}
        />
        <g data-garage data-travel={px(door)}>
          {sectionalPanels(door, { panels: leaves, opening: DOOR_HEAD }).map((panel) => (
            <path
              key={panel.index}
              data-panel={`garage-${panel.index}`}
              d={panelPath(camera, panel.a, panel.b)}
              {...machined}
            />
          ))}
        </g>

        {/* Roof: one prism over the body, one lean-to over the wing. */}
        <path
          data-roof
          d={solid(
            [
              { x: MAIN_LEFT - EAVE_OVERHANG, y: eaves },
              { x: RIDGE_X, y: ridge },
              { x: MAIN_RIGHT + EAVE_OVERHANG, y: eaves },
              { x: MAIN_RIGHT + EAVE_OVERHANG, y: eaves - 3 },
              { x: MAIN_LEFT - EAVE_OVERHANG, y: eaves - 3 },
            ],
            MAIN_DEPTH + 3,
          )}
          {...cast}
        />
        <path
          d={box(WING_LEFT, WING_HEIGHT, WING_RIGHT + 4, WING_HEIGHT + 3, WING_DEPTH + 3)}
          {...cast}
        />

        {/* The ridge and the eaves, drawn along the depth so the roof reads as
            two slopes from above instead of one flat rectangle. */}
        <g data-ridge fill="none" stroke={palette.metal} strokeWidth={1.1} opacity={0.85}>
          <path d={alongDepth(to, RIDGE_X, ridge, MAIN_DEPTH + 3)} />
        </g>
        <g fill="none" stroke={palette.dark} strokeWidth={0.8} opacity={0.45}>
          <path d={alongDepth(to, MAIN_LEFT - EAVE_OVERHANG, eaves, MAIN_DEPTH + 3)} />
          <path d={alongDepth(to, MAIN_RIGHT + EAVE_OVERHANG, eaves, MAIN_DEPTH + 3)} />
        </g>

        {/* Chimney, on the slope where a flue would really come out. */}
        <path
          data-chimney
          d={box(MAIN_LEFT + 12, eaves + rise * 0.4, MAIN_LEFT + 22, ridge + 4, 5, -10)}
          {...shell}
        />
        <path
          d={box(MAIN_LEFT + 11, ridge + 4, MAIN_LEFT + 23, ridge + 6.5, 5.6, -10)}
          {...machined}
        />

        {/* The roof array: one axis, tracking, and clamped at its stops. */}
        {array && (
          <g data-array data-tilt={px(tracker.tilt)} data-clamped={tracker.clamped ? "true" : "false"}>
            <path
              d={bar({ x: ARRAY_X, y: 0 }, { x: ARRAY_X, y: ARRAY_Y }, 1.6, 2)}
              {...machined}
            />
            <path
              d={bar(
                arrayEdge(ARRAY_X, ARRAY_Y, tracker.tilt, -15),
                arrayEdge(ARRAY_X, ARRAY_Y, tracker.tilt, 15),
                1.4,
                11,
              )}
              fill={night ? palette.dark : palette.accent}
              fillOpacity={wash(night ? 0.5 : 0.8)}
              stroke={palette.dark}
              strokeWidth={0.6}
            />
          </g>
        )}

        {variant === "blueprint" && (
          <>
            <path
              d={line([
                { x: MAIN_RIGHT + EAVE_OVERHANG + 6, y: eaves },
                { x: MAIN_RIGHT + EAVE_OVERHANG + 6, y: ridge },
              ])}
              fill="none"
              stroke={palette.grid}
              strokeWidth={0.5}
              strokeDasharray="2 2"
            />
            <text
              x={px(to({ x: RIDGE_X, y: ridge + 14 }).x)}
              y={px(to({ x: RIDGE_X, y: ridge + 14 }).y)}
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
              fontSize={6}
              fill={palette.foreground}
            >
              {`${Math.round(slope)}° · ${hour}`}
            </text>
          </>
        )}
      </g>

      {label && (
        <text
          x={VIEW_WIDTH / 2}
          y={VIEW_HEIGHT - 6}
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

/* -------------------------------------------------------------------------- */
/* geometry                                                                    */
/* -------------------------------------------------------------------------- */

interface Opening {
  key: string
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Two windows beside the door on the ground floor, three on every floor above. */
function openings(floors: number): Opening[] {
  const out: Opening[] = []
  for (let floor = 0; floor < floors; floor += 1) {
    const y0 = floor * STOREY + 8
    const y1 = floor * STOREY + 25
    const centres = floor === 0 ? [MAIN_LEFT + 16, MAIN_RIGHT - 16] : [MAIN_LEFT + 16, RIDGE_X, MAIN_RIGHT - 16]
    centres.forEach((centre, index) => {
      out.push({ key: `${floor}-${index}`, x0: centre - 9, y0, x1: centre + 9, y1 })
    })
  }
  return out
}

/** A plan-view footprint for a wall run, in world axes, shifted by a shadow. */
function footprint(
  x0: number,
  x1: number,
  halfDepth: number,
  shift: { x: number; z: number },
): Vec2[] {
  return [
    { x: -x0 + shift.x, y: halfDepth + shift.z },
    { x: -x1 + shift.x, y: halfDepth + shift.z },
    { x: -x1 + shift.x, y: -halfDepth + shift.z },
    { x: -x0 + shift.x, y: -halfDepth + shift.z },
  ]
}

/** Where the sun stands, as a direction in the world rather than on the page. */
function skyPoint(azimuth: number, altitude: number, radius: number): Vec3 {
  const a = (azimuth * Math.PI) / 180
  const e = (altitude * Math.PI) / 180
  return {
    x: -Math.sin(a) * Math.cos(e) * radius,
    y: Math.sin(e) * radius,
    z: Math.cos(a) * Math.cos(e) * radius * 0.6,
  }
}

/** One louvre fin, turned about its own vertical axis inside a window. */
function fins(
  opening: Opening,
  tilt: number,
  camera: ReturnType<typeof robotCamera>,
): string[] {
  const radians = (tilt * Math.PI) / 180
  const half = FIN_WIDTH / 2
  const across = Math.cos(radians) * half
  const out = Math.sin(radians) * half
  const count = Math.max(1, Math.floor((opening.x1 - opening.x0) / FIN_PITCH))
  const first = opening.x0 + (opening.x1 - opening.x0 - (count - 1) * FIN_PITCH) / 2
  return Array.from({ length: count }, (_, index) => {
    const centre = first + index * FIN_PITCH
    const corners: Vec3[] = [
      elevationPoint({ x: centre - across, y: opening.y1 + 1 }, MAIN_DEPTH + 1 - out, "front"),
      elevationPoint({ x: centre + across, y: opening.y1 + 1 }, MAIN_DEPTH + 1 + out, "front"),
      elevationPoint({ x: centre + across, y: opening.y0 - 1 }, MAIN_DEPTH + 1 + out, "front"),
      elevationPoint({ x: centre - across, y: opening.y0 - 1 }, MAIN_DEPTH + 1 - out, "front"),
    ]
    return slabPath(corners, camera)
  })
}

/** One garage panel: rigid, spanning the opening, riding the track into the wing. */
function panelPath(camera: ReturnType<typeof robotCamera>, a: Vec2, b: Vec2): string {
  const corners: Vec3[] = [
    elevationPoint({ x: DOOR_LEFT, y: a.y }, WING_DEPTH - a.x, "front"),
    elevationPoint({ x: DOOR_RIGHT, y: a.y }, WING_DEPTH - a.x, "front"),
    elevationPoint({ x: DOOR_RIGHT, y: b.y }, WING_DEPTH - b.x, "front"),
    elevationPoint({ x: DOOR_LEFT, y: b.y }, WING_DEPTH - b.x, "front"),
  ]
  return slabPath(corners, camera)
}

/** The track itself, drawn down the near jamb of the opening. */
function trackPath(draft: ReturnType<typeof elevationDraft>, track: Vec2[]): string {
  return track
    .map((point, index) => {
      const screen = draft.point({ x: DOOR_LEFT - 1.5, y: point.y }, WING_DEPTH - point.x)
      return `${index ? "L" : "M"} ${px(screen.x)} ${px(screen.y)}`
    })
    .join(" ")
}

/** A line run along the machine's depth at one point of the elevation. */
function alongDepth(
  to: ReturnType<typeof elevationDraft>["point"],
  x: number,
  y: number,
  halfDepth: number,
): string {
  const near = to({ x, y }, halfDepth)
  const far = to({ x, y }, -halfDepth)
  return `M ${px(near.x)} ${px(near.y)} L ${px(far.x)} ${px(far.y)}`
}

/** An edge of the tracking array, turned `tilt` degrees off flat. */
function arrayEdge(x: number, y: number, tilt: number, along: number): Vec2 {
  const radians = (tilt * Math.PI) / 180
  return { x: x + Math.cos(radians) * along, y: y + Math.sin(radians) * along }
}

/* -------------------------------------------------------------------------- */
/* behaviours                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Time of day at `clock`. Both behaviours run the same day — one turn of the
 * clock is one turn of the earth — and `arrive` only differs in what the garage
 * does with it.
 */
export function houseSun(behavior: GabledHouseBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0.42
  // Unbounded on purpose: one turn of the clock is one turn of the earth, and
  // a value that never wraps is a sun that never runs backwards. It starts at
  // dawn rather than at midnight, so a machine that has just mounted is doing
  // something rather than standing in the dark.
  return clock + DAWN
}

/**
 * Garage travel for a time of day: shut all day, up for the arrival home in the
 * late afternoon, and shut again by dusk. Zero for every other behaviour,
 * because a door that opens on its own all day is not a door.
 */
export function houseGarage(behavior: GabledHouseBehavior, sun: number): number {
  if (behavior !== "arrive" || !Number.isFinite(sun)) return 0
  const day = ((sun % 1) + 1) % 1
  const from = 0.68
  const to = 0.82
  if (day <= from || day >= to) return 0
  return Math.sin(((day - from) / (to - from)) * Math.PI)
}

export { GabledHouse }
