"use client"

/**
 * jack-o-lantern — a carved gourd lantern that comes apart, with a candle in it.
 *
 * The shell is a lobed body of revolution, and the face is **cut out of it**
 * rather than drawn on it. Every feature is an outline authored in shell
 * coordinates and wrapped onto that surface by `carve-geometry`, so an eye
 * rides the furrows it crosses; `carve` walks a knife round each outline in
 * turn, and only when a loop closes does its plug come free and push out along
 * its own surface normal. What a lit shell emits is paid for by those holes: the
 * open area divided by the area of the skin is the share of the candle that gets
 * out at all, and each opening throws `√intensity` of full range.
 *
 * The other half is that it is an assembly. Stem, lid, candle and shell each
 * know the axis they were fitted along and the order they were fitted in, and
 * `exploded` runs that backwards. Lifting the lid is also a draught, so the
 * flame that stood straight up under a closed lid leans and guts once it is off.
 *
 * Solved: the shell, the wrapped cuts, the carve along each perimeter, the plug
 * offsets, the escaping light and its reach, the flame, and the teardown
 * schedule. Illustrated: the glow inside the shell, the bloom at each opening,
 * the wax and the stem's curl. There is no combustion model and no collision
 * model — a plug passes through whatever is in its way, as in any exploded
 * drawing.
 *
 * Modelled once in world units — `x` starboard, `y` up, `z` aft, the face at
 * `-z` — and pushed through `robotCamera`, so all four views are the same
 * geometry. Design note: docs/carved-lanterns.md.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { explodeAssembly, type AssemblyPart } from "@/lib/robocn/assembly"
import {
  carveStage,
  carveTrace,
  carveWindow,
  facePattern,
  flameAt,
  lightThrough,
  pickShell,
  scallopedRim,
  shellAspect,
  shellCut,
  strokeOutline,
  wrapOutline,
  type CutAperture,
  type FaceName,
  type ShellPoint,
} from "@/lib/robocn/carve"
import { clamp, convexHull2, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  lateralArea,
  latitudeRing,
  meridianLine,
  revolveProfile,
  type ProduceProfile,
  type ProduceSurfaceOptions,
} from "@/lib/robocn/produce"
import {
  boxCorners,
  circleFootprint,
  extrudedPath,
  fitFrame,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCameraAt,
  robotSurface,
  robotViews,
  slabPath,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

const VIEW_WIDTH = 210
const VIEW_HEIGHT = 210
/** It is read face-on, so that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"

/* World units: x starboard, y up from the ground, z aft, the face at -z. */

const BODY_HEIGHT = 76
const WAIST_RADIUS = 52
/** What the shell keeps of its waist at the floor and at the neck. */
const END_RADIUS = 0.33
const NECK_TAPER = 0.2
const WALL = 3.2

/** Where the lid is cut off, and the zig-zag it is cut with. */
const LID_STATION = 0.8
const RIM_SCALLOPS = 7
const RIM_AMPLITUDE = 0.024

const STEM_HEIGHT = 19
const STEM_LEAN = 13

const CANDLE_RADIUS = 9
const CANDLE_TOP = 40

/** Travel in the teardown, per part. */
const LID_TRAVEL = 46
const STEM_TRAVEL = 16
const CANDLE_TRAVEL = 40
/** How far a freed plug stands off the face, seated and at full teardown. */
const PLUG_POP = 5
const PLUG_TRAVEL = 18
/** And how far it has dropped by then. */
const PLUG_FALL = 14

/**
 * The share of `carve` the cutting itself takes. The tail is what the last
 * plug drops through — without it the final piece would still be hanging in
 * front of its own hole on a finished face.
 */
const CARVE_TAIL = 0.92
/** How much of `carve` a freed plug takes to drop out of the drawing. */
const PLUG_DROP = 0.08

/** The knife: how wide a cut it leaves, in stations, and its limits. */
const NIB = 0.055
const NIB_MIN = 0.015
const NIB_MAX = 0.18
/** Degrees the camera swings per whole drag across the drawing, and per arrow. */
const ORBIT_SWEEP = 300
const ORBIT_RISE = 150
const ORBIT_STEP = 6
/** How far above and below the machine the camera may get. */
const ELEVATION_LIMIT = 88

/** Flickers per cycle: the candle runs faster than the machine does. */
const FLICKER_RATE = 7

const RINGS = 14
const MERIDIANS = 48

/** The box the seated machine needs, stem and all. */
const SEATED_TOP = BODY_HEIGHT + STEM_HEIGHT + 5
const SEATED_HALF = 58

/**
 * The room the teardown wants: the seated box grown by how far the parts have
 * actually travelled. Fitted to this, the frame zooms out as the machine comes
 * apart and at no other time — a frame fitted to the fully exploded box would
 * leave a seated machine sitting in a third of its own drawing.
 */
const envelopeAt = (progress: number) =>
  boxCorners(
    { x: -SEATED_HALF - 14 * progress, y: 0, z: -SEATED_HALF - 14 * progress },
    {
      x: SEATED_HALF + 14 * progress,
      y: SEATED_TOP + (LID_TRAVEL + STEM_TRAVEL) * progress,
      z: SEATED_HALF + 14 * progress,
    },
  )

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/**
 * The shell: a flat-bottomed gourd at its widest a little below half way, drawn
 * in a fraction of its waist so the proportions survive any size.
 */
export const gourdProfile: ProduceProfile = (t) => {
  const station = clamp(t, 0, 1)
  const belly = Math.pow(Math.sin(Math.PI * Math.pow(station, 1.06)), 0.62)
  return {
    height: BODY_HEIGHT * station,
    radius:
      WAIST_RADIUS * (END_RADIUS + (1 - END_RADIUS) * belly) * (1 - NECK_TAPER * station),
  }
}

/** How far a spill throws at full intensity, and how wide it opens. */
const SPILL_LENGTH = 34
const SPILL_SPREAD = 17

/** The skin, at a rib count: one place, so the drawing and the light agree. */
const shellOptionsFor = (lobes: number): ProduceSurfaceOptions => ({
  lobes: clamp(Math.round(Number.isFinite(lobes) ? lobes : 9), 5, 13),
  lobeDepth: 0.15,
  rings: RINGS,
  meridians: MERIDIANS,
})

/** The face, wrapped onto the shell: the cuts a finished carve leaves. */
const faceCuts = (face: FaceName, teeth: number, lobes: number) =>
  facePattern(face, { teeth: clamp(Math.round(Number.isFinite(teeth) ? teeth : 4), 1, 9) })
    .map((outline) =>
      shellCut(gourdProfile, outline, { ...shellOptionsFor(lobes), wall: WALL }),
    )

/**
 * What a finished face lets out of a shell burning at `flame`: the open area,
 * the share of the candle that escapes, and each opening's own column. Pure,
 * and the same numbers the drawing is painted from.
 */
export function jackOLanternLight({
  face = "classic" as FaceName,
  teeth = 4,
  lobes = 9,
  flame = 1,
  carve = 1,
} = {}) {
  return lightThrough(
    faceCuts(face, teeth, lobes).map((cut) => ({
      id: cut.id,
      area: cut.area,
      open: clamp(Number.isFinite(carve) ? carve : 1, 0, 1),
      centroid: cut.centroid,
      normal: cut.normal,
    })),
    flame,
    {
      shellArea: lateralArea(gourdProfile, 0, LID_STATION),
      length: SPILL_LENGTH,
      spread: SPILL_SPREAD,
    },
  )
}

/** Stem, lid, candle, shell — the order they were fitted in. */
const PARTS: AssemblyPart[] = [
  { id: "shell", axis: { x: 0, y: 1, z: 0 }, travel: 0, order: 0 },
  { id: "candle", axis: { x: 0, y: 1, z: 0 }, travel: CANDLE_TRAVEL, order: 1 },
  { id: "lid", axis: { x: 0, y: 1, z: 0 }, travel: LID_TRAVEL, order: 2 },
  { id: "stem", axis: { x: 0, y: 1, z: 0 }, travel: STEM_TRAVEL, order: 3 },
]

export type JackOLanternBehavior = "carve" | "flicker" | "teardown" | "static"

/**
 * What a drag on the machine does. `cut` and `orbit` are tools — a knife and a
 * turntable — and the other two hold one of the scalar channels, the way the
 * rest of the set's interactive machines do. Holding shift swaps the two tools,
 * so a carve and a turn are one gesture apart without leaving the drawing.
 */
export type JackOLanternControl = "cut" | "orbit" | "carve" | "exploded"

/** One cut somebody made by hand: the path the knife took across the skin. */
export interface ShellStroke {
  id: string
  /** In shell coordinates: `u` degrees from the front, `v` station up the profile. */
  points: ShellPoint[]
  /** Nib width in stations. Left off, the machine's own `nib` is used. */
  width?: number
}

/** Where the camera stands, as degrees off the view it is named by. */
export interface JackOLanternOrbit {
  azimuth: number
  elevation: number
}

export interface JackOLanternPose {
  /** How much of the face is cut, 0 uncarved to 1 finished. */
  carve: number
  /** How far apart the machine is, 0 seated to 1 every part clear. */
  exploded: number
}

/**
 * What the machine is doing at `clock` with nobody driving it — a pure function
 * of the clock, exported so motion is tested by sampling rather than by faking
 * animation frames.
 */
export function jackOLanternPose(
  behavior: JackOLanternBehavior,
  clock: number,
): JackOLanternPose {
  if (!Number.isFinite(clock)) return { carve: 1, exploded: 0 }
  const t = ((clock % 1) + 1) % 1
  switch (behavior) {
    // Cut the face, then hold it lit before starting over.
    case "carve":
      return { carve: t < 0.72 ? t / 0.72 : 1, exploded: 0 }
    // Carved and shut: the only thing moving is the flame.
    case "flicker":
      return { carve: 1, exploded: 0 }
    // Apart and back together, with a pause at each end.
    case "teardown":
      return {
        carve: 1,
        exploded:
          t < 0.4 ? t / 0.4 : t < 0.55 ? 1 : t < 0.95 ? 1 - (t - 0.55) / 0.4 : 0,
      }
    default:
      return { carve: 1, exploded: 0 }
  }
}

export interface JackOLanternProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. One shell, four projections. */
  view?: RobotView
  /** Controlled carve, 0 uncarved to 1 the whole face cut. Stops the loop. */
  carve?: number
  onCarveChange?: (carve: number) => void
  /** Controlled teardown, 0 seated to 1 every part clear. Stops the loop. */
  exploded?: number
  onExplodedChange?: (exploded: number) => void
  /**
   * What it does with nobody driving it. The default is the finished machine
   * burning, so a parked one — reduced motion, `animate={false}` — is a carved
   * lantern rather than a blank gourd.
   */
  behavior?: JackOLanternBehavior
  /** Which face is cut. */
  face?: FaceName
  /** Teeth left standing in the mouth, clamped to 1..9. */
  teeth?: number
  /** Ribs round the shell, clamped to 5..13. */
  lobes?: number
  /** Controlled flame, 0 out to 1 full. Left off, the candle flickers. */
  flame?: number
  /** Blow the candle out without taking it away. */
  lit?: boolean
  /** What a drag does: cut by hand, turn the machine, or hold a channel. */
  control?: JackOLanternControl
  /**
   * Degrees the camera swings round the machine, on top of `view`. Any angle
   * at all, and it wraps: the back of the shell is 180 either way.
   */
  azimuth?: number
  /** Degrees the camera rises above the view's own elevation, clamped to ±88. */
  elevation?: number
  onOrbitChange?: (orbit: JackOLanternOrbit) => void
  /** Cuts made by hand, in the order they were cut. Supplying it takes control. */
  strokes?: ShellStroke[]
  onStrokesChange?: (strokes: ShellStroke[]) => void
  /** How wide a cut the knife leaves, in stations. Clamped to 0.015..0.18. */
  nib?: number
  interactive?: boolean
  /** Cycles per second: one carve, or one teardown. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  showGround?: boolean
  label?: string
}

const unit = (value: number | undefined, fallback = 0) =>
  clamp(Number.isFinite(value) ? (value as number) : fallback, 0, 1)

const finite = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) ? (value as number) : fallback

/** Shortest way round: a camera turned 370 degrees is turned 10. */
const wrapTurn = (degrees: number) => ((finite(degrees, 0) % 360) + 360) % 360

function JackOLantern({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  carve,
  onCarveChange,
  exploded,
  onExplodedChange,
  behavior = "flicker",
  face = "classic",
  teeth = 4,
  lobes = 9,
  flame,
  lit = true,
  control = "cut",
  azimuth,
  elevation,
  onOrbitChange,
  strokes,
  onStrokesChange,
  nib = NIB,
  interactive = false,
  speed = 0.32,
  animate = true,
  paused = false,
  phase = 0,
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
  "aria-label": ariaLabel,
  ...props
}: JackOLanternProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const clipId = `jack-${React.useId().replace(/:/g, "")}`
  const skinId = `${clipId}-skin`

  const controlledCarve = carve !== undefined
  const controlledApart = exploded !== undefined
  const holdsCarve = control === "carve"
  const holdsApart = control === "exploded"
  const grabsCarve = !holdsApart
  const pinned = grabsCarve
    ? controlledCarve
      ? unit(carve)
      : held
    : controlledApart
      ? unit(exploded)
      : held

  // One loop: it eases the channel a person can hold, and its clock drives the
  // other channel and the candle through the behaviour sampler.
  const goal = React.useCallback(
    (clock: number) =>
      grabsCarve
        ? jackOLanternPose(behavior, clock).carve
        : jackOLanternPose(behavior, clock).exploded,
    [behavior, grabsCarve],
  )
  const motion = useRobotScalar(goal, {
    rate: grabsCarve ? 0.7 : 0.9,
    hold: pinned,
    speed,
    paused,
    phase,
    animate:
      animate && behavior !== "static" && !(controlledCarve && controlledApart),
  })
  const sampled = jackOLanternPose(behavior, motion.clock)

  const cutting = controlledCarve
    ? unit(carve)
    : grabsCarve
      ? clamp(motion.value, 0, 1)
      : sampled.carve
  const apart = controlledApart
    ? unit(exploded)
    : grabsCarve
      ? sampled.exploded
      : clamp(motion.value, 0, 1)

  const shellOptions = shellOptionsFor(lobes)
  const lobeCount = shellOptions.lobes ?? 9
  const toothCount = clamp(Math.round(Number.isFinite(teeth) ? teeth : 4), 1, 9)

  // Where the camera stands: the view's own angles, plus however far a person
  // has turned it. One camera, so every cull and every depth sort follows.
  const [turned, setTurned] = React.useState<JackOLanternOrbit>({
    azimuth: 0,
    elevation: 0,
  })
  const orbit: JackOLanternOrbit = {
    azimuth: azimuth !== undefined ? finite(azimuth, 0) : turned.azimuth,
    elevation: clamp(
      elevation !== undefined ? finite(elevation, 0) : turned.elevation,
      -ELEVATION_LIMIT,
      ELEVATION_LIMIT,
    ),
  }
  const stance = robotViews[view] ?? robotViews.front
  const camera = robotCameraAt(
    stance.azimuth + orbit.azimuth,
    clamp(stance.elevation + orbit.elevation, -90, 90),
    view,
  )
  // Fitted, and allowed to fill the frame: a seated machine is half the size
  // of one taken apart, and a fixed scale would draw it in a third of its own
  // drawing to leave room for a teardown that is not happening.
  const frame = fitFrame(envelopeAt(apart), camera, VIEW_WIDTH, VIEW_HEIGHT - 12, 10, 1.7)
  const at = (point: Vec3): Vec2 => camera.project(point.x, point.y, point.z)
  const towardCamera = (point: Vec3) => camera.depth(point.x, point.y, point.z)
  const shift = (point: Vec3, by: Vec3): Vec3 => ({
    x: point.x + by.x,
    y: point.y + by.y,
    z: point.z + by.z,
  })

  /* ---------------------------------------------------------- the teardown */

  const offsets = new Map(
    explodeAssembly(PARTS, apart).map((part) => [part.id, part.offset]),
  )
  const lidOffset = offsets.get("lid") ?? { x: 0, y: 0, z: 0 }
  // The stem was fitted to the lid, so it carries the lid's travel as well.
  const stemOffset = shift(offsets.get("stem") ?? { x: 0, y: 0, z: 0 }, lidOffset)
  const candleOffset = offsets.get("candle") ?? { x: 0, y: 0, z: 0 }
  const lidFraction = LID_TRAVEL > 0 ? clamp(lidOffset.y / LID_TRAVEL, 0, 1) : 0

  /* ------------------------------------------------------------- the face */

  const faceOutlines = faceCuts(face, toothCount, lobeCount)
  const cuttingProgress = clamp(cutting / CARVE_TAIL, 0, 1)
  const faceCarved = faceOutlines.map((cut, index) => {
    const stage = carveStage(index, faceOutlines.length, cuttingProgress)
    // A plug is not free until the loop closes; then it pushes out along its
    // own normal. Left alone it drops away once the knife has moved on to the
    // next feature — the push is solved, the fall is drawn, because nothing
    // here models gravity. Taken apart, it is a part again and holds station.
    const pop = clamp((stage - 0.94) / 0.06, 0, 1)
    const fall = clamp(
      (cutting - carveWindow(index, faceOutlines.length).end * CARVE_TAIL) / PLUG_DROP,
      0,
      1,
    )
    // A dropped plug is gone from a finished face, and comes back into the
    // exploded formation once the lid above it is clear — which is what an
    // exploded drawing of a carved shell has to show.
    const rejoin = clamp((apart - 0.3) / 0.25, 0, 1)
    const reach = (PLUG_POP + PLUG_TRAVEL * apart) * pop
    const stand = {
      x: cut.normal.x * reach,
      y: cut.normal.y * reach - PLUG_FALL * fall * (1 - rejoin),
      z: cut.normal.z * reach,
    }
    const showPlug = clamp(pop * Math.max(1 - fall, rejoin), 0, 1)
    return {
      ...cut,
      index,
      stage,
      pop,
      showPlug,
      facing: towardCamera(cut.normal) > 0.1,
      hole: polygonPath(cut.rim.map(at)),
      groove: linePath(carveTrace(cut.rim, stage).map(at)),
      knife: carveTrace(cut.rim, stage).slice(-1).map(at)[0],
      plugFace: polygonPath(cut.rim.map((point) => at(shift(point, stand)))),
      plugBack: polygonPath(cut.plug.map((point) => at(shift(point, stand)))),
    }
  })

  /* --------------------------------------------------- the cuts by hand */

  // Strokes somebody drew on the skin. Each is a path in shell coordinates; the
  // opening is the ribbon the nib swept along it, and it is open the moment it
  // is cut — the material is coming away under the knife, not after it.
  const [drawn, setDrawn] = React.useState<ShellStroke[]>([])
  const [stroke, setStroke] = React.useState<ShellStroke | null>(null)
  // The stroke under the knife is held in a ref as well as in state: React may
  // call a state updater twice, and committing a finished cut from inside one
  // would cut it twice.
  const strokeRef = React.useRef<ShellStroke | null>(null)
  const handStrokes = strokes ?? drawn
  const nibWidth = clamp(finite(nib, NIB), NIB_MIN, NIB_MAX)
  const rejoined = clamp((apart - 0.3) / 0.25, 0, 1)
  const handCuts = [...handStrokes, ...(stroke ? [stroke] : [])]
    .filter((entry) => entry && entry.points?.length)
    .map((entry) => {
      const station = clamp(
        entry.points.reduce((sum, point) => sum + finite(point?.v, 0.5), 0) /
          entry.points.length,
        0,
        1,
      )
      const cut = shellCut(
        gourdProfile,
        {
          id: entry.id,
          points: strokeOutline(entry.points, {
            aspect: shellAspect(gourdProfile, station),
            width: clamp(finite(entry.width, nibWidth), NIB_MIN, NIB_MAX),
          }),
        },
        { ...shellOptions, wall: WALL },
      )
      const stand = {
        x: cut.normal.x * (PLUG_POP + PLUG_TRAVEL * apart),
        y: cut.normal.y * (PLUG_POP + PLUG_TRAVEL * apart) - PLUG_FALL * (1 - rejoined),
        z: cut.normal.z * (PLUG_POP + PLUG_TRAVEL * apart),
      }
      return {
        ...cut,
        index: -1,
        stage: 1,
        pop: 1,
        // The chip a stroke frees is already away; it only comes back for the
        // exploded drawing, like every other plug.
        showPlug: rejoined,
        facing: towardCamera(cut.normal) > 0.1,
        hole: polygonPath(cut.rim.map(at)),
        groove: "",
        knife: undefined as Vec2 | undefined,
        plugFace: polygonPath(cut.rim.map((point) => at(shift(point, stand)))),
        plugBack: polygonPath(cut.plug.map((point) => at(shift(point, stand)))),
      }
    })
  const cuts = [...faceCarved, ...handCuts]

  /* ------------------------------------------------------------ the light */

  const candle = flameAt(motion.clock * FLICKER_RATE, { draught: lidFraction })
  const burn = lit ? (flame !== undefined ? unit(flame) : candle.intensity) : 0
  const neck = gourdProfile(LID_STATION)
  const apertures: CutAperture[] = [
    ...cuts.map((cut) => ({
      id: cut.id,
      area: cut.area,
      open: cut.pop,
      centroid: cut.centroid,
      normal: cut.normal,
    })),
    {
      id: "neck",
      area: Math.PI * neck.radius * neck.radius,
      open: lidFraction,
      centroid: { x: 0, y: neck.height, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
    },
  ]
  const light = lightThrough(apertures, burn, {
    shellArea: lateralArea(gourdProfile, 0, LID_STATION),
    length: SPILL_LENGTH,
    spread: SPILL_SPREAD,
  })

  /* ----------------------------------------------------------- the drawing */

  const shellPath = hullPath(
    revolveProfile(gourdProfile, { ...shellOptions, to: LID_STATION + RIM_AMPLITUDE })
      .map(at),
  )
  const lidPath = hullPath(
    revolveProfile(gourdProfile, { ...shellOptions, from: LID_STATION - RIM_AMPLITUDE })
      .map((point) => at(shift(point, lidOffset))),
  )
  const seam = scallopedRim({
    id: "lid-rim",
    v: LID_STATION,
    scallops: RIM_SCALLOPS,
    amplitude: RIM_AMPLITUDE,
    steps: 5,
  })
  const seamWorld = wrapOutline(gourdProfile, seam.points, shellOptions)
  const seamOnBody = linePath(
    seamWorld.filter((point) => towardCamera(point) > 0).map(at),
  )
  const seamOnLid = linePath(
    seamWorld
      .filter((point) => towardCamera(point) > 0)
      .map((point) => at(shift(point, lidOffset))),
  )

  const furrows = Array.from({ length: lobeCount }, (_, index) => {
    const azimuth = (180 + index * 360) / lobeCount
    const radians = (azimuth * Math.PI) / 180
    const radial = { x: Math.sin(radians), y: 0, z: Math.cos(radians) }
    return {
      index,
      facing: towardCamera(radial) > 0.12,
      body: linePath(
        meridianLine(
          gourdProfile,
          azimuth,
          { ...shellOptions, from: 0.04, to: LID_STATION - RIM_AMPLITUDE },
          12,
        ).map(at),
      ),
      lid: linePath(
        meridianLine(
          gourdProfile,
          azimuth,
          { ...shellOptions, from: LID_STATION + RIM_AMPLITUDE, to: 0.99 },
          4,
        ).map((point) => at(shift(point, lidOffset))),
      ),
    }
  })

  const neckRing = latitudeRing(gourdProfile, LID_STATION, shellOptions, 36).map(at)
  const neckPath = polygonPath(neckRing)
  const neckTop = neckRing.length ? Math.min(...neckRing.map((point) => point.y)) : 0

  const stemFoot = shift({ x: 0, y: BODY_HEIGHT - 3, z: 0 }, stemOffset)
  const stemHead = shift(
    {
      x: Math.sin((STEM_LEAN * Math.PI) / 180) * STEM_HEIGHT,
      y: BODY_HEIGHT - 3 + Math.cos((STEM_LEAN * Math.PI) / 180) * STEM_HEIGHT,
      z: -1.5,
    },
    stemOffset,
  )
  const stemCurl = {
    x: stemHead.x - 7.5,
    y: stemHead.y + 3.5,
    z: stemHead.z - 3,
  }
  const stemPath = slabPath(
    [...ringAt(stemFoot, 7.5), ...ringAt(stemHead, 3.6)],
    camera,
  )
  const curlPath = slabPath(
    [...ringAt(stemHead, 3.4), ...ringAt(stemCurl, 1.9)],
    camera,
  )

  const candleBase = shift({ x: 0, y: 1, z: 0 }, candleOffset)
  const candleHead = shift({ x: 0, y: CANDLE_TOP, z: 0 }, candleOffset)
  const wick = shift({ x: 0, y: CANDLE_TOP + 2.5, z: 0 }, candleOffset)
  const candlePath = extrudedPath(
    circleFootprint(0, 0, CANDLE_RADIUS, 16),
    camera,
    candleHead.y,
    candleBase.y,
  )
  const flamePath = flameOutline(wick, candle, burn, at)
  const corePath = flameOutline(wick, candle, burn, at, 0.5)

  const shellSurface = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  /* ------------------------------------------------------- the person's end */

  const carvedPercent = Math.round(cutting * 100)
  const apartPercent = Math.round(apart * 100)
  const readout = grabsCarve ? carvedPercent : apartPercent
  const readoutText = grabsCarve
    ? `${carvedPercent} percent carved`
    : `${apartPercent} percent apart`

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(Number.isFinite(next) ? next : 0, 0, 1) * 100) / 100
      setHeld(bounded)
      if (control === "exploded") onExplodedChange?.(bounded)
      else onCarveChange?.(bounded)
    },
    [control, onCarveChange, onExplodedChange],
  )

  /* ------------------------------------------------- pointer and keyboard */

  // The drag callbacks have to keep the same identity across renders or the
  // listeners rebind every frame, so what they need from this render is handed
  // over through a ref after it commits rather than through their own closure.
  const sceneRef = React.useRef({
    camera,
    frame,
    shellOptions,
    orbit,
    nibWidth,
    control,
    controlledStrokes: strokes !== undefined,
  })
  React.useEffect(() => {
    sceneRef.current = {
      camera,
      frame,
      shellOptions,
      orbit,
      nibWidth,
      control,
      controlledStrokes: strokes !== undefined,
    }
  })
  const strokesRef = React.useRef(handStrokes)
  React.useEffect(() => {
    strokesRef.current = handStrokes
  })
  /** Where the pointer was last, so an orbit works on the movement, not the spot. */
  const traceRef = React.useRef<{ pointer: Vec2; pick: ShellPoint | null } | null>(null)
  const modifierRef = React.useRef(false)

  const turnTo = React.useCallback(
    (next: JackOLanternOrbit) => {
      const bounded = {
        azimuth: wrapTurn(next.azimuth),
        elevation: clamp(finite(next.elevation, 0), -ELEVATION_LIMIT, ELEVATION_LIMIT),
      }
      sceneRef.current = { ...sceneRef.current, orbit: bounded }
      setTurned(bounded)
      onOrbitChange?.(bounded)
    },
    [onOrbitChange],
  )

  const commitStrokes = React.useCallback(
    (next: ShellStroke[]) => {
      strokesRef.current = next
      if (!sceneRef.current.controlledStrokes) setDrawn(next)
      onStrokesChange?.(next)
    },
    [onStrokesChange],
  )

  const onDrag = React.useCallback(
    (point: Vec2) => {
      const scene = sceneRef.current
      // Shift swaps the knife for the turntable and back, so a person can turn
      // the shell round to reach the far side without leaving the drawing.
      const tool =
        modifierRef.current && (scene.control === "cut" || scene.control === "orbit")
          ? scene.control === "cut"
            ? "orbit"
            : "cut"
          : modifierRef.current
            ? "orbit"
            : scene.control

      if (tool === "carve" || tool === "exploded") {
        apply(tool === "exploded" ? 1 - point.y : point.x)
        return
      }

      const last = traceRef.current
      if (tool === "orbit") {
        traceRef.current = { pointer: point, pick: null }
        if (!last) return
        turnTo({
          azimuth: scene.orbit.azimuth - (point.x - last.pointer.x) * ORBIT_SWEEP,
          elevation: scene.orbit.elevation - (point.y - last.pointer.y) * ORBIT_RISE,
        })
        return
      }

      // Cutting: the pointer has to land back on the skin it is over, which is
      // the projection run backwards. Seeded with the last landing, so a drag
      // across the limb follows the shell instead of jumping round it.
      const box = {
        x: (point.x * VIEW_WIDTH - scene.frame.dx) / scene.frame.scale,
        y: (point.y * VIEW_HEIGHT - scene.frame.dy) / scene.frame.scale,
      }
      const pick = pickShell(
        gourdProfile,
        (p) => scene.camera.project(p.x, p.y, p.z),
        box,
        {
          ...scene.shellOptions,
          from: 0.06,
          to: LID_STATION - 0.02,
          depth: (vector) => scene.camera.depth(vector.x, vector.y, vector.z),
          tolerance: 7,
          seed: last?.pick ?? undefined,
        },
      )
      if (!pick.hit) return
      const landed = { u: pick.u, v: pick.v }
      traceRef.current = { pointer: point, pick: landed }
      const current = strokeRef.current
      const next: ShellStroke = current
        ? { ...current, points: [...current.points, landed] }
        : {
            id: `hand-${Math.round(Date.now())}-${strokesRef.current.length}`,
            points: [landed],
            width: scene.nibWidth,
          }
      strokeRef.current = next
      setStroke(next)
    },
    [apply, turnTo],
  )

  const onDragEnd = React.useCallback(() => {
    traceRef.current = null
    setHeld(null)
    const finished = strokeRef.current
    strokeRef.current = null
    setStroke(null)
    if (finished) commitStrokes([...strokesRef.current, finished])
  }, [commitStrokes])

  const dragging = useRobotDrag(svgRef, { enabled: interactive, onDrag, onDragEnd })

  const current = grabsCarve ? cutting : apart
  const holdsScalar = holdsCarve || holdsApart

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? (holdsScalar ? "slider" : "application") : "img")}
      aria-label={
        ariaLabel ??
        `Jack-o'-lantern, ${carvedPercent} percent carved${
          handStrokes.length > 0
            ? `, ${handStrokes.length} cut${handStrokes.length === 1 ? "" : "s"} by hand`
            : ""
        }, ${apartPercent === 0 ? "assembled" : `${apartPercent} percent apart`}, ${
          burn > 0 ? "lit" : "unlit"
        }, ${viewNames[view] ?? viewNames.front}${
          orbit.azimuth === 0 && orbit.elevation === 0
            ? ""
            : ` turned ${Math.round(orbit.azimuth)} degrees, ${Math.round(
                orbit.elevation,
              )} degrees above`
        }`
      }
      aria-valuemin={interactive && holdsScalar ? 0 : undefined}
      aria-valuemax={interactive && holdsScalar ? 100 : undefined}
      aria-valuenow={interactive && holdsScalar ? readout : undefined}
      aria-valuetext={interactive && holdsScalar ? readoutText : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onPointerDownCapture={(event) => {
        // Read the modifier before the drag listener on the element sees the
        // press, which is what the capture phase is for.
        modifierRef.current = event.shiftKey
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        if (holdsScalar) {
          const delta = arrowStep(event.key, event.shiftKey ? 0.15 : 0.05, 0.25)
          if (delta !== 0) apply(current + delta)
          else if (event.key === "Home") apply(0)
          else if (event.key === "End") apply(1)
          else return
          event.preventDefault()
          return
        }
        // The tools turn the machine on the arrow keys, and the knife's own
        // keys undo what it cut.
        const step = event.shiftKey ? ORBIT_STEP * 3 : ORBIT_STEP
        if (event.key === "ArrowLeft") turnTo({ ...orbit, azimuth: orbit.azimuth + step })
        else if (event.key === "ArrowRight") turnTo({ ...orbit, azimuth: orbit.azimuth - step })
        else if (event.key === "ArrowUp") turnTo({ ...orbit, elevation: orbit.elevation + step })
        else if (event.key === "ArrowDown") turnTo({ ...orbit, elevation: orbit.elevation - step })
        else if (event.key === "Home") turnTo({ azimuth: 0, elevation: 0 })
        else if (event.key === "Backspace" || event.key === "Delete") {
          commitStrokes(handStrokes.slice(0, -1))
        } else if (event.key === "Escape") commitStrokes([])
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
      <defs>
        {/* What can be seen of the candle past the shell: the neck opening
            itself, and everything the candle has risen above it. */}
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <path d={neckPath} />
          <rect x={-400} y={-600} width={800} height={px(neckTop + 600)} />
        </clipPath>
        {/* A cut is a hole in the shell, so it cannot be drawn outside one:
            near the limb the wrapped outline reaches past the silhouette the
            sampled hull can draw, and this is where it stops. */}
        <clipPath id={skinId} clipPathUnits="userSpaceOnUse">
          <path d={shellPath} />
        </clipPath>
      </defs>

      {variant === "blueprint" && (
        <path
          d={`M ${VIEW_WIDTH / 2} 8 V ${VIEW_HEIGHT - 16}`}
          fill="none"
          stroke={palette.grid}
          strokeWidth={0.5}
          strokeDasharray="3 4"
          opacity={0.4}
        />
      )}

      <g data-frame data-view={view} data-tool={control} transform={frame.transform || undefined}>
        {showGround && (
          <>
            <ellipse
              data-ground
              cx={0}
              cy={0}
              rx={px(WAIST_RADIUS * 0.82)}
              ry={px(Math.max(2.6, WAIST_RADIUS * 0.82 * camera.flatten))}
              fill={palette.dark}
              opacity={0.16}
            />
            {light.escape > 0 && burn > 0 && (
              <ellipse
                data-pool
                cx={0}
                cy={0}
                rx={px(WAIST_RADIUS * 1.05)}
                ry={px(Math.max(3, WAIST_RADIUS * 1.05 * camera.flatten))}
                fill={palette.glow}
                opacity={px(clamp(light.escape * burn * 3, 0, 0.22))}
              />
            )}
          </>
        )}

        {/* Inside the shell, so it only shows through what has been cut. */}
        <g data-candle-inner opacity={variant === "solid" ? 0.9 : 0.5}>
          <path d={candlePath} {...machined} />
          {burn > 0 && <path d={flamePath} fill={palette.glow} opacity={0.9} />}
        </g>

        <g data-shell>
          <path d={shellPath} {...shellSurface} />
          {furrows
            .filter((furrow) => furrow.facing)
            .map((furrow) => (
              <path
                key={`rib-${furrow.index}`}
                data-rib={furrow.index}
                d={furrow.body}
                fill="none"
                stroke={palette.dark}
                strokeWidth={0.9}
                opacity={0.22}
              />
            ))}
          <path
            data-seam
            d={seamOnBody}
            fill="none"
            stroke={palette.dark}
            strokeWidth={0.9}
            opacity={lidFraction > 0.02 ? 0.55 : 0.25}
          />
        </g>

        {/* The face: a scored groove while the knife is still going round, an
            opening with the candle behind it once the loop has closed. */}
        <g clipPath={`url(#${skinId})`}>
          {cuts
            .filter((cut) => cut.facing)
            .map((cut) => (
              <g key={cut.id}>
                {cut.pop > 0 && (
                  <>
                    <path data-cut={cut.id} d={cut.hole} fill={palette.dark} opacity={0.95} />
                    {burn > 0 && (
                      <>
                        {/* Every opening reads at the same brightness: what an
                            eye passes less of is flux, not radiance. The share
                            of the flame it carries is in how far it throws. */}
                        <path
                          data-glow={cut.id}
                          d={cut.hole}
                          fill={palette.glow}
                          opacity={px(clamp(0.4 + burn * 0.55, 0, 0.95))}
                        />
                        {/* The bloom: the rim of a cut is the brightest part of
                            it, because the light is coming past the edge. */}
                        <path
                          d={cut.hole}
                          fill="none"
                          stroke={palette.accent}
                          strokeWidth={1.4}
                          strokeLinejoin="round"
                          opacity={px(clamp(0.2 + burn * 0.4, 0, 0.7))}
                        />
                      </>
                    )}
                  </>
                )}
                {cut.groove !== "" && cut.stage < 1 && (
                  <>
                    <path
                      data-groove={cut.id}
                      d={cut.groove}
                      fill="none"
                      stroke={palette.dark}
                      strokeWidth={1.6}
                      strokeLinecap="round"
                      opacity={0.7}
                    />
                    {cut.knife && (
                      <circle
                        data-knife={cut.id}
                        cx={px(cut.knife.x)}
                        cy={px(cut.knife.y)}
                        r={1.6}
                        fill={palette.accent}
                      />
                    )}
                  </>
                )}
              </g>
            ))}
        </g>

        {/* The pieces the cuts freed stand off the skin, so they are not. */}
        {cuts
          .filter((cut) => cut.facing && cut.showPlug > 0.01)
          .map((cut) => (
            <g key={`plug-${cut.id}`} data-plug={cut.id} opacity={px(cut.showPlug)}>
              <path d={cut.plugBack} {...cast} opacity={0.7} />
              <path d={cut.plugFace} {...shellSurface} />
            </g>
          ))}

        {/* The neck, and what has climbed out of it. */}
        {lidFraction > 0.02 && (
          <path data-neck d={neckPath} fill={palette.dark} opacity={0.9} />
        )}
        <g data-candle clipPath={`url(#${clipId})`}>
          <path d={candlePath} {...machined} />
          {/* The wax pool the wick stands in: a horizontal disc, so it opens
              into a circle looking down and closes to a line looking level. */}
          <ellipse
            cx={px(at(candleHead).x)}
            cy={px(at(candleHead).y)}
            rx={px(CANDLE_RADIUS)}
            ry={px(Math.max(0.6, CANDLE_RADIUS * camera.flatten))}
            fill={palette.dark}
            opacity={0.35}
          />
          <path
            d={linePath([at(candleHead), at(wick)])}
            fill="none"
            stroke={palette.dark}
            strokeWidth={1.2}
          />
          {burn > 0 && (
            <>
              <path data-flame d={flamePath} fill={palette.glow} opacity={0.85} />
              <path d={corePath} fill={palette.accent} opacity={0.9} />
            </>
          )}
        </g>

        <g data-lid transform={undefined}>
          <path d={lidPath} {...shellSurface} />
          {furrows
            .filter((furrow) => furrow.facing)
            .map((furrow) => (
              <path
                key={`lid-rib-${furrow.index}`}
                d={furrow.lid}
                fill="none"
                stroke={palette.dark}
                strokeWidth={0.9}
                opacity={0.22}
              />
            ))}
          <path
            d={seamOnLid}
            fill="none"
            stroke={palette.dark}
            strokeWidth={0.9}
            opacity={0.35}
          />
        </g>

        <g data-stem>
          <path d={stemPath} {...cast} />
          <path d={curlPath} {...cast} opacity={0.92} />
        </g>

        {/* What gets out, and how far: each opening throws √intensity of range. */}
        {burn > 0 &&
          light.spills
            .filter((spill) => spill.reach > 0.5)
            .map((spill) => {
              const cut = cuts.find((entry) => entry.id === spill.id)
              if (spill.id !== "neck" && !cut?.facing) return null
              return (
                <path
                  key={`spill-${spill.id}`}
                  data-spill={spill.id}
                  d={spillPath(spill.origin, spill.direction, spill.reach, spill.halfWidth, at)}
                  fill={palette.glow}
                  opacity={px(clamp(0.03 + spill.intensity * 0.25, 0, 0.12))}
                />
              )
            })}
      </g>

      {variant === "blueprint" && (
        <text
          x={VIEW_WIDTH - 10}
          y={20}
          textAnchor="end"
          fontFamily="ui-monospace, monospace"
          fontSize={5}
          fill={palette.grid}
        >
          {`CARVE ${carvedPercent}% · APART ${apartPercent}% · ESC ${Math.round(light.escape * 100)}%`}
        </text>
      )}
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

/**
 * The flame as a teardrop in the plane the lean happens in, built from world
 * points and projected — so it foreshortens into a bloom seen from above rather
 * than standing up out of the drawing.
 */
function flameOutline(
  wick: Vec3,
  flame: { height: number; lean: number },
  burn: number,
  at: (point: Vec3) => Vec2,
  scale = 1,
): string {
  if (!(burn > 0)) return ""
  const tall = 16 * Math.max(0.2, flame.height) * scale
  const wide = 5.4 * (0.72 + 0.28 * burn) * scale
  const radians = (flame.lean * Math.PI) / 180
  const tip: Vec3 = {
    x: wick.x + Math.sin(radians) * tall,
    y: wick.y + Math.cos(radians) * tall,
    z: wick.z,
  }
  const left = at({ x: wick.x - wide, y: wick.y, z: wick.z })
  const right = at({ x: wick.x + wide, y: wick.y, z: wick.z })
  const shoulder = (side: number) =>
    at({
      x: wick.x + side * wide * 1.35 + Math.sin(radians) * tall * 0.45,
      y: wick.y + Math.cos(radians) * tall * 0.5,
      z: wick.z,
    })
  const head = at(tip)
  const a = shoulder(-1)
  const b = shoulder(1)
  return `M ${px(left.x)} ${px(left.y)} Q ${px(a.x)} ${px(a.y)} ${px(head.x)} ${px(head.y)} Q ${px(b.x)} ${px(b.y)} ${px(right.x)} ${px(right.y)} Z`
}

/** The column out of one opening: its reach, spreading to its own half-width. */
function spillPath(
  origin: Vec3,
  direction: Vec3,
  reach: number,
  halfWidth: number,
  at: (point: Vec3) => Vec2,
): string {
  const length = Math.hypot(direction.x, direction.y, direction.z)
  if (!(length > 1e-9) || !(reach > 0)) return ""
  const unitDirection = {
    x: direction.x / length,
    y: direction.y / length,
    z: direction.z / length,
  }
  // Across the column: the horizontal perpendicular, or starboard if it is
  // pointing straight up.
  const flat = Math.hypot(unitDirection.x, unitDirection.z)
  const across =
    flat > 1e-6
      ? { x: -unitDirection.z / flat, y: 0, z: unitDirection.x / flat }
      : { x: 1, y: 0, z: 0 }
  const tip = {
    x: origin.x + unitDirection.x * reach,
    y: origin.y + unitDirection.y * reach,
    z: origin.z + unitDirection.z * reach,
  }
  const root = Math.max(1.5, halfWidth * 0.3)
  const corners = [
    { x: origin.x + across.x * root, y: origin.y + across.y * root, z: origin.z + across.z * root },
    { x: tip.x + across.x * halfWidth, y: tip.y + across.y * halfWidth, z: tip.z + across.z * halfWidth },
    { x: tip.x - across.x * halfWidth, y: tip.y - across.y * halfWidth, z: tip.z - across.z * halfWidth },
    { x: origin.x - across.x * root, y: origin.y - across.y * root, z: origin.z - across.z * root },
  ]
  return polygonPath(corners.map(at))
}

/** A horizontal ring of world points about a centre: one end of a taper. */
function ringAt(centre: Vec3, radius: number, steps = 10): Vec3[] {
  return Array.from({ length: steps }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2
    return {
      x: centre.x + Math.cos(angle) * radius,
      y: centre.y,
      z: centre.z + Math.sin(angle) * radius,
    }
  })
}

/** The outline round a set of projected points: any solid, from any angle. */
function hullPath(points: readonly Vec2[]): string {
  const hull = convexHull2(points)
  if (hull.length < 3) return ""
  return `${hull.map((point, index) => `${index ? "L" : "M"} ${px(point.x)} ${px(point.y)}`).join(" ")} Z`
}

/** A polygon in the order it was built — a cut, a plug, a column. */
function polygonPath(points: readonly Vec2[]): string {
  if (points.length < 3) return ""
  return `${points.map((point, index) => `${index ? "L" : "M"} ${px(point.x)} ${px(point.y)}`).join(" ")} Z`
}

/** An open polyline: a furrow, a seam, a groove the knife has cut so far. */
function linePath(points: readonly Vec2[]): string {
  if (points.length < 2) return ""
  return points
    .map((point, index) => `${index ? "L" : "M"} ${px(point.x)} ${px(point.y)}`)
    .join(" ")
}

export { JackOLantern }
