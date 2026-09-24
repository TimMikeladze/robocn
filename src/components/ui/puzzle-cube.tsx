"use client"

/**
 * puzzle-cube — the twisty cube drawn flat, the sibling of `rubiks-cube`.
 *
 * One solver, two renderers: the state, every turn, the scramble, the drag
 * geometry and the solve all come from `src/lib/robocn/cube.ts`, exactly as
 * they do in the WebGL rig. This one owns only the projection and the paint —
 * cubies modelled once in world units, pushed through `robotCamera`, back-face
 * culled by the projected normal and painter-sorted by cubie centre, which is
 * exact for convex, never-interpenetrating boxes under a linear camera,
 * including the middle of a turn.
 *
 * Solved, not illustrated: everything the solver owns. Illustrated: the flat
 * shading (one key light, no rays), the eased travel of a turn, the gap
 * between stickers and the underglow when it comes home. Notes:
 * `docs/puzzle-cube.md`.
 */

import * as React from "react"

import {
  applyTurn,
  createCube,
  cubeFaces,
  exposedFaces,
  faceNormals,
  formatMove,
  grabFromDrag,
  invertMove,
  isSolved,
  moveToTurn,
  parseAlgorithm,
  parseMove,
  scrambleMoves,
  solveCube,
  stickerFace,
  turnToMove,
  inTurn,
  type CubeAxis,
  type CubeFace,
  type CubeMove,
  type CubeState,
  type CubeTurn,
  type Cubie,
} from "@/lib/robocn/cube"
import { resolveCssColor, watchCssColors } from "@/lib/robocn/color"
import {
  boxCorners,
  fitFrame,
  px,
  prefersReducedMotion,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  type RobotCamera,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
  robotCameraAt,
  robotViews,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

/** What the cube does with nobody driving it. `solve` is the live one. */
export type PuzzleCubeBehavior = "cycle" | "scramble" | "solve" | "static"

/** Where a turn came from, so a stopwatch can time a person without timing itself. */
export type PuzzleCubeSource = "user" | "solver" | "scramble" | "loop" | "undo" | "redo"

/** How far the camera has been turned off the view it started from. */
export interface PuzzleCubeOrbit {
  /** Degrees round the cube. Any angle at all, and it wraps. */
  azimuth: number
  /**
   * Degrees above the view's own elevation. Clamped so the camera runs to
   * straight overhead and straight underneath — both poles — and no further.
   */
  elevation: number
}

/** The standard scheme, and the last word when nothing else supplies a face. */
export const standardCubeFaceColors: Record<CubeFace, string> = {
  U: "#f8fafc",
  D: "#facc15",
  F: "#22c55e",
  B: "#2563eb",
  R: "#dc2626",
  L: "#f97316",
}

/**
 * Face colours resolve prop → CSS variable → the standard scheme, the same
 * three steps every palette role takes and the same names the WebGL rig
 * reads, so one `--robot-cube-u` retints both renderers.
 */
const faceVariables = Object.fromEntries(
  cubeFaces.map((face) => [
    face,
    `var(--robot-cube-${face.toLowerCase()}, ${standardCubeFaceColors[face]})`,
  ]),
) as Record<CubeFace, string>

/** The algorithm the `cycle` behaviour plays. Six repeats come home. */
const cycleAlgorithm = parseAlgorithm("R U R' U'")

/** The cube's edge in world units; the drawing frame does the rest. */
const EDGE = 100
const VIEW_WIDTH = 200
const VIEW_HEIGHT = 200
const NATIVE_VIEW: RobotView = "iso"

/** The envelope the frame fits: the cube, its shadow and a little air. */
const ENVELOPE = boxCorners(
  { x: -EDGE * 0.72, y: -EDGE / 2 - 8, z: -EDGE * 0.72 },
  { x: EDGE * 0.72, y: EDGE / 2 + 10, z: EDGE * 0.72 },
)

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/* The camera a hand turns: drag sweeps it round, and the cube can be looked
 * at from anywhere at all — over the top, under the bottom — not only from
 * the four angles the set names. */

/** Shortest way round: a camera turned 370 degrees is turned 10. */
const wrapTurn = (degrees: number) =>
  Number.isFinite(degrees) ? (((degrees % 360) + 360) % 360) : 0

const finiteNum = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback

const clampNum = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/**
 * How far the camera stands from looking straight down or straight up. Those
 * are the poles of the projection, not cliffs short of it: the drawing is
 * exact at both (plan view *is* the pole), so the orbit runs all the way to
 * them — it just cannot go past, the same wall every orbit camera has.
 */
const POLE = 90

/** How far off its view a hand may turn the camera: to overhead, or underneath. */
const elevationBounds = (stanceElevation: number) => ({
  min: -POLE - stanceElevation,
  max: POLE - stanceElevation,
})
/** Degrees of camera per pixel of drag: a whole cube-width of sweep per half
 * the cube's screen, which is about what a wrist expects. */
const ORBIT_SWEEP = 0.9
const ORBIT_RISE = 0.5
const ORBIT_STEP = 12

/**
 * The key light, in world axes — the whole lighting model. Top brightest,
 * the front face mid, the right face darkest, which is the hierarchy a cube
 * drawn flat needs to read as a cube.
 */
const LIGHT = (() => {
  const x = 0.5
  const y = 0.82
  const z = -0.3
  const length = Math.hypot(x, y, z) || 1
  return [x / length, y / length, z / length] as const
})()

/** Floor and ceiling on the flat shading: nothing in full shadow, nothing blown out. */
const SHADE_MIN = 0.62
const SHADE_SPAN = 0.38

/**
 * The cube's own frame (`x` right, `y` up, `z` out) yawed into the world the
 * camera looks at, so the isometric view shows U, F and R — the same three
 * faces the WebGL rig's default camera shows.
 */
const toWorld = (v: readonly number[]): [number, number, number] => [v[2], v[1], -v[0]]

/** The two in-plane axes of each face: how a sticker quad is spanned. */
const faceTangents: Record<CubeFace, readonly [readonly [number, number, number], readonly [number, number, number]]> = {
  U: [[1, 0, 0], [0, 0, 1]],
  D: [[1, 0, 0], [0, 0, 1]],
  F: [[1, 0, 0], [0, 1, 0]],
  B: [[1, 0, 0], [0, 1, 0]],
  R: [[0, 1, 0], [0, 0, 1]],
  L: [[0, 1, 0], [0, 0, 1]],
}

/* ------------------------------------------------------------------ motion */

/**
 * Which move a clock-driven behaviour makes at step `index`. A pure function
 * of the step — and the step is a pure function of the clock — so motion is
 * tested by sampling rather than by faking frames. `solve` is not here: what
 * it plays depends on the cube, not on the time.
 */
export function puzzleCubeMove(
  behavior: PuzzleCubeBehavior,
  index: number,
  order = 3,
  seed = 1,
): CubeMove | null {
  if (!Number.isFinite(index) || index < 0) return null
  const step = Math.floor(index)
  if (behavior === "cycle") return cycleAlgorithm[step % cycleAlgorithm.length]
  if (behavior === "scramble") {
    // A long deterministic scramble, walked forever: the same seed always
    // shuffles the same way, so two cubes on a page can be told to agree.
    const moves = scrambleMoves(order, 60, seed)
    return moves[step % moves.length] ?? null
  }
  return null
}

/** How many turns a behaviour has started by `clock` seconds. */
export function puzzleCubeStep(behavior: PuzzleCubeBehavior, clock: number, speed = 1): number {
  if (behavior === "static" || !Number.isFinite(clock) || clock < 0) return 0
  const rate = Number.isFinite(speed) && speed > 0 ? speed : 1
  return Math.floor(clock * rate)
}

/** 0 → 1 across a turn, eased so it reads as a wrist rather than a servo. */
export const puzzleCubeEase = (progress: number) => {
  if (!Number.isFinite(progress)) return 0
  const t = progress < 0 ? 0 : progress > 1 ? 1 : progress
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/**
 * The turn a released drag commits to: the quarter turn it is nearest, and
 * the angle it should travel to get there. Wound past a quarter turn, a hand
 * has already done that turn — so the snap is a round, not a threshold, and
 * letting go half way back snaps *back* rather than through.
 */
export function puzzleCubeSnap(angle: number): { quarters: number; angle: number } {
  const wound = Number.isFinite(angle) ? angle : 0
  const quarters = Math.max(-4, Math.min(4, Math.round(wound / (Math.PI / 2))))
  return { quarters, angle: (quarters * Math.PI) / 2 }
}

/* -------------------------------------------------------------- geometry */

/** A slice part way round: what the drawing pass actually needs to know. */
interface CubeSpin {
  axis: CubeAxis
  slice: number
  angle: number
}

/** A turn in flight, whether it was queued or let go of. */
interface CubeTravel {
  turn: CubeTurn
  move: CubeMove
  record: boolean
  source: PuzzleCubeSource
  from: number
  to: number
  elapsed: number
  duration: number
}

/** The hand on the cube, from the press to the release. */
interface CubeHold {
  face: CubeFace
  cubie: Cubie
  x: number
  y: number
  turn: CubeTurn | null
  tangent: readonly [number, number, number] | null
  angle: number
}

/** One face of one cubie, projected and ready to paint. */
interface FaceDraw {
  face: CubeFace
  plastic: string
  sticker: string
  shade: number
}

/** One cubie's visible faces, at the depth it stands. */
interface CubieDraw {
  index: number
  depth: number
  turning: boolean
  faces: FaceDraw[]
}

type Matrix = readonly number[]

/** Right-handed rotation about a world axis by a float angle, matching `rotationMatrix`. */
function axisRotation(axis: CubeAxis, angle: number): Matrix {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  if (axis === "x") return [1, 0, 0, 0, c, -s, 0, s, c]
  if (axis === "y") return [c, 0, s, 0, 1, 0, -s, 0, c]
  return [c, -s, 0, s, c, 0, 0, 0, 1]
}

/** The corners of a quad, wound so every face outlines the same way. */
const QUAD_CORNERS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
]

const applyM = (m: Matrix, v: readonly number[]): [number, number, number] => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
]

/**
 * Every visible face of every shell cubie, far ones first — painter's
 * algorithm over cubie groups, which is exact for these boxes: convex,
 * never interpenetrating, and the camera is linear. A face whose normal
 * points away from the camera is dropped before it is ever drawn.
 */
function cubieDrawings(
  state: CubeState,
  camera: RobotCamera,
  spin: CubeSpin | null,
): CubieDraw[] {
  const n = state.order
  const cell = EDGE / n
  const half = (n - 1) / 2
  const stickerHalf = cell * 0.42
  const groups: CubieDraw[] = []

  for (let index = 0; index < state.cubies.length; index++) {
    const cubie = state.cubies[index]
    const exposed = exposedFaces(cubie, n)
    if (!exposed.length) continue

    const turning =
      spin !== null && spin.angle !== 0 && inTurn(cubie, { axis: spin.axis, slice: spin.slice, quarterTurns: 0 })
    const rotation = turning ? axisRotation(spin!.axis, spin!.angle) : null
    const centre: [number, number, number] = rotation
      ? applyM(rotation, [(cubie.i - half) * cell, (cubie.j - half) * cell, (cubie.k - half) * cell])
      : [(cubie.i - half) * cell, (cubie.j - half) * cell, (cubie.k - half) * cell]
    const worldCentre = toWorld(centre)
    const faces: FaceDraw[] = []

    for (const face of exposed) {
      const normal = faceNormals[face]
      const rotatedNormal = rotation ? applyM(rotation, normal) : normal
      const worldNormal = toWorld(rotatedNormal)
      // Toward the camera, or not drawn at all. The epsilon drops a face that
      // is exactly edge-on — trigonometry never lands on a clean zero, and an
      // edge-on face is a zero-width sliver nobody should see.
      if (camera.depth(worldNormal[0], worldNormal[1], worldNormal[2]) <= 1e-6) continue

      const [u, v] = faceTangents[face]
      const quad = (halfU: number, halfV: number) => {
        const points: { x: number; y: number }[] = []
        for (const [su, sv] of QUAD_CORNERS) {
          const offset: [number, number, number] = [
            normal[0] * (cell / 2) + u[0] * su * halfU + v[0] * sv * halfV,
            normal[1] * (cell / 2) + u[1] * su * halfU + v[1] * sv * halfV,
            normal[2] * (cell / 2) + u[2] * su * halfU + v[2] * sv * halfV,
          ]
          const o = rotation ? applyM(rotation, offset) : offset
          const w = toWorld([o[0] + centre[0], o[1] + centre[1], o[2] + centre[2]])
          points.push(camera.project(w[0], w[1], w[2]))
        }
        return points
      }

      // The plastic face is the whole cell; the sticker sits inside it,
      // showing the colour of the face the cubie carries there.
      const plastic = quad(cell / 2, cell / 2)
      const sticker = quad(stickerHalf, stickerHalf)
      const dot = worldNormal[0] * LIGHT[0] + worldNormal[1] * LIGHT[1] + worldNormal[2] * LIGHT[2]
      faces.push({
        face,
        plastic: quadPath(plastic),
        sticker: quadPath(sticker),
        shade: SHADE_MIN + SHADE_SPAN * Math.max(0, dot),
      })
    }

    if (faces.length) {
      groups.push({
        index,
        depth: camera.depth(worldCentre[0], worldCentre[1], worldCentre[2]),
        turning,
        faces,
      })
    }
  }

  groups.sort((a, b) => a.depth - b.depth)
  return groups
}

const quadPath = (points: { x: number; y: number }[]) =>
  points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ") + " Z"

/** A hex colour under the flat key light; anything unparsable passes through. */
export function shadeHex(hex: string, factor: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return hex
  const value = Number.parseInt(match[1], 16)
  const channel = (shift: number) =>
    Math.max(0, Math.min(255, Math.round(((value >> shift) & 0xff) * factor)))
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0))
    .toString(16)
    .padStart(6, "0")}`
}

/* --------------------------------------------------------------- the cube */

/** The driver a demo, a toolbar or a test uses to work the cube. */
export interface PuzzleCubeApi {
  /** Queue a move: `"R'"`, or the parsed shape. */
  turn: (move: CubeMove | string) => void
  scramble: (count?: number, seed?: number) => void
  reset: () => void
  /** Undo the last applied turn. */
  undo: () => void
  /** Redo the last undone turn. */
  redo: () => void
  /**
   * Play a solve. The line is a real layer-by-layer solution, replayed and
   * checked before a single turn of it moves; on a cube the method does not
   * cover — anything but a 3×3 — nothing is queued and it returns `null`.
   */
  solve: () => CubeMove[] | null
  /** The next move of that solve, queued and returned. `null` if none. */
  hint: () => CubeMove | null
  state: () => CubeState
  history: () => CubeMove[]
  solved: () => boolean
}

export interface PuzzleCubeProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Cubies to a side. 2 … 7; 3 is the cube everyone means. */
  order?: number
  /**
   * Controlled: the cube is exactly this algorithm applied to a solved cube.
   * Supplying it stops the behaviour loop. Moves appended to it are animated;
   * anything else rebuilds the state.
   */
  algorithm?: string | CubeMove[]
  behavior?: PuzzleCubeBehavior
  /** Turns per second for the behaviour loop, and turn travel with it. */
  speed?: number
  /** Seconds of offset, so a shelf of cubes breaks step. */
  phase?: number
  /** Seed for the `scramble` behaviour and for `scrambleOnMount`. */
  seed?: number
  /** Start scrambled rather than solved. */
  scrambleOnMount?: boolean | number
  animate?: boolean
  paused?: boolean
  /** Press a sticker and the layer follows the pointer; type moves at the cube. */
  interactive?: boolean
  /** Where the camera stands. Default is the isometric view it was designed in. */
  view?: RobotView
  /**
   * Degrees the camera swings round the cube, on top of `view`. Any angle at
   * all, and it wraps: the far side is 180 either way. Supplying it (or
   * `elevation`) takes the camera away from the pointer.
   */
  azimuth?: number
  /**
   * Degrees the camera rises above the view's own elevation — all the way to
   * straight underneath, or straight overhead, where it stops. The poles are
   * the far ends, not a cliff short of them.
   */
  elevation?: number
  onOrbitChange?: (orbit: PuzzleCubeOrbit) => void
  showGround?: boolean
  /** Per-face colour overrides. `{ U: "var(--chart-1)" }` retints one face. */
  faces?: Partial<Record<CubeFace, string>>
  /** Every turn, once it has been applied, and where it came from. */
  onMove?: (move: CubeMove, state: CubeState, source: PuzzleCubeSource) => void
  /** Whenever the state changes, including a reset. */
  onStateChange?: (state: CubeState) => void
  /** Called the moment the cube comes home. */
  onSolved?: () => void
  /** Both edges of solved — the one a stopwatch starts and stops on. */
  onSolvedChange?: (solved: boolean) => void
  /** The turns a person has made, as they are made and unmade. */
  onHistoryChange?: (moves: CubeMove[]) => void
  /** Handed a driver: `turn`, `scramble`, `solve`, `hint`, `undo`, `redo`. */
  controls?: (api: PuzzleCubeApi) => void
  label?: string
  size?: RobotSize | number
  /** Paint only — never geometry. */
  variant?: RobotVariant
}

function PuzzleCube({
  order = 3,
  algorithm,
  behavior = "cycle",
  speed = 0.9,
  phase = 0,
  seed = 1,
  scrambleOnMount = false,
  animate = true,
  paused = false,
  interactive = false,
  view = NATIVE_VIEW,
  azimuth,
  elevation,
  onOrbitChange,
  showGround = true,
  faces,
  onMove,
  onStateChange,
  onSolved,
  onSolvedChange,
  onHistoryChange,
  controls,
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
  "aria-label": ariaLabel,
  ...props
}: PuzzleCubeProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const n = Number.isFinite(order) ? Math.max(2, Math.min(7, Math.round(order))) : 3

  const [cube, setCube] = React.useState<CubeState>(() => {
    const solved = createCube(n)
    if (!scrambleOnMount) return solved
    const count = typeof scrambleOnMount === "number" ? scrambleOnMount : 20
    return scrambleMoves(n, count, seed).reduce(
      (state, move) => applyTurn(state, moveToTurn(move, n)),
      solved,
    )
  })
  // The loop reads the state without waiting for React, and writes through
  // `setCube` only when a turn lands.
  const stateRef = React.useRef(cube)

  // Queued turns carry whether they belong in the history: an undo does not,
  // or undoing twice would walk forward again instead of back.
  const queue = React.useRef<{ move: CubeMove; record: boolean; source: PuzzleCubeSource }[]>([])
  const history = React.useRef<CubeMove[]>([])
  const future = React.useRef<CubeMove[]>([])
  const active = React.useRef<CubeTravel | null>(null)
  const plan = React.useRef<CubeMove[]>([])
  const clock = React.useRef(Number.isFinite(phase) ? phase : 0)
  const stepsTaken = React.useRef(0)
  const wasSolved = React.useRef(isSolved(cube))
  const celebrate = React.useRef(0)
  const holdRef = React.useRef<CubeHold | null>(null)
  const runningRef = React.useRef(false)
  const wakeRef = React.useRef<() => void>(() => {})

  const controlled = algorithm !== undefined
  const colors = useCubeColors(palette, faces)
  const turnSeconds = Math.max(0.08, 0.34 / Math.max(0.1, speed))

  /** The picture this frame: the slice in flight and the solved swell. */
  const [visual, setVisual] = React.useState<{ spin: CubeSpin | null; swell: number }>({
    spin: null,
    swell: 0,
  })
  const [holding, setHolding] = React.useState(false)
  // The move count is read by the drawing, so it is state rather than a dip
  // into the history ref mid-render.
  const [moveCount, setMoveCount] = React.useState(0)

  /* The camera: the view's own angles, plus however far a hand has turned it.
   * A supplied `azimuth` or `elevation` wins and takes the camera away from
   * the pointer. */
  const [turned, setTurned] = React.useState<PuzzleCubeOrbit>({ azimuth: 0, elevation: 0 })
  // A press on the plastic, held: where it started. The trace itself lives in
  // the effect below, so the drag is one closure and nothing is left behind.
  const [orbitPress, setOrbitPress] = React.useState<{ x: number; y: number } | null>(null)
  const stanceLimits = elevationBounds((robotViews[view] ?? robotViews.iso).elevation)
  const orbit: PuzzleCubeOrbit =
    azimuth !== undefined || elevation !== undefined
      ? {
          azimuth: finiteNum(azimuth ?? 0, 0),
          elevation: clampNum(finiteNum(elevation ?? 0, 0), stanceLimits.min, stanceLimits.max),
        }
      : turned

  const push = React.useCallback(
    (move: CubeMove | string, source: PuzzleCubeSource = "user", record = true) => {
      const parsed = typeof move === "string" ? parseMove(move) : move
      if (!parsed || !cubeFaces.includes(parsed.face)) return
      // A turn of the person's own invalidates any line the solver worked out.
      if (source === "user") plan.current = []
      queue.current.push({ move: parsed, record, source })
      wakeRef.current()
    },
    [],
  )

  const historyChanged = React.useRef(onHistoryChange)
  const rebuild = React.useCallback(
    (moves: CubeMove[]) => {
      queue.current = []
      active.current = null
      plan.current = []
      holdRef.current = null
      history.current = [...moves]
      setMoveCount(moves.length)
      future.current = []
      const next = moves.reduce(
        (state, move) => applyTurn(state, moveToTurn(move, n)),
        createCube(n),
      )
      stateRef.current = next
      setCube(next)
      onStateChange?.(next)
      historyChanged.current?.(history.current)
      const solved = isSolved(next)
      if (solved !== wasSolved.current) {
        wasSolved.current = solved
        onSolvedChange?.(solved)
      }
      if (solved) onSolved?.()
    },
    [n, onSolvedChange, onStateChange, onSolved],
  )

  // Controlled: the prop is the truth. A pure append is animated; anything
  // else — a shorter list, a different move — is rebuilt from solved.
  const wanted = React.useMemo(
    () => (typeof algorithm === "string" ? parseAlgorithm(algorithm) : (algorithm ?? [])),
    [algorithm],
  )
  const wantedKey = wanted.map(formatMove).join(" ")
  const appliedKey = React.useRef("")
  React.useEffect(() => {
    if (!controlled) return
    const applied = appliedKey.current
    if (wantedKey === applied) return
    if (applied && wantedKey.startsWith(applied ? `${applied} ` : "")) {
      for (const move of wanted.slice(applied ? applied.split(" ").length : 0)) push(move, "solver")
    } else {
      rebuild(wanted)
    }
    appliedKey.current = wantedKey
  }, [controlled, push, rebuild, wanted, wantedKey])

  // The order changed underneath the cube: start again rather than leave
  // cubies on a lattice that no longer exists.
  const orderRef = React.useRef(n)
  React.useEffect(() => {
    if (orderRef.current === n) return
    orderRef.current = n
    rebuild([])
  }, [n, rebuild])

  const api = React.useMemo<PuzzleCubeApi>(
    () => ({
      turn: (move) => push(move),
      scramble: (count = 20, scrambleSeed = Math.floor(Math.random() * 1e9)) => {
        plan.current = []
        future.current = []
        for (const move of scrambleMoves(n, count, scrambleSeed)) push(move, "scramble")
      },
      reset: () => rebuild([]),
      undo: () => {
        const last = history.current.at(-1)
        if (!last) return
        history.current = history.current.slice(0, -1)
        setMoveCount(history.current.length)
        future.current = [...future.current, last]
        historyChanged.current?.(history.current)
        push(invertMove(last), "undo", false)
      },
      redo: () => {
        const next = future.current.at(-1)
        if (!next) return
        future.current = future.current.slice(0, -1)
        push(next, "redo")
      },
      solve: () => {
        const line = solveCube(stateRef.current)
        if (!line) return null
        plan.current = line
        future.current = []
        for (const move of line) push(move, "solver")
        return line
      },
      hint: () => {
        // The cached line is only a hint if it still starts where we are; any
        // turn the person made since invalidates it, so it is dropped.
        const line = plan.current.length ? plan.current : solveCube(stateRef.current)
        if (!line?.length) return null
        plan.current = line.slice(1)
        push(line[0], "solver")
        return line[0]
      },
      state: () => stateRef.current,
      history: () => [...history.current],
      solved: () => isSolved(stateRef.current),
    }),
    [n, push, rebuild],
  )
  const controlsRef = React.useRef(controls)
  React.useEffect(() => {
    controlsRef.current?.(api)
  }, [api])

  /* ------------------------------------------------------------- the loop */

  // Everything the frame loop reads from props lands here after the render
  // rather than during it, so nothing touches a ref while React is drawing.
  const frameRef = React.useRef<{
    behavior: PuzzleCubeBehavior
    speed: number
    seed: number
    animate: boolean
    paused: boolean
    controlled: boolean
    turnSeconds: number
    order: number
    onMove?: (move: CubeMove, state: CubeState, source: PuzzleCubeSource) => void
    onStateChange?: (state: CubeState) => void
    onSolved?: () => void
    onSolvedChange?: (solved: boolean) => void
  }>({
    behavior,
    speed,
    seed,
    animate,
    paused,
    controlled,
    turnSeconds,
    order: n,
    onMove,
    onStateChange,
    onSolved,
    onSolvedChange,
  })
  React.useEffect(() => {
    frameRef.current = {
      behavior,
      speed,
      seed,
      animate,
      paused,
      controlled,
      turnSeconds,
      order: n,
      onMove,
      onStateChange,
      onSolved,
      onSolvedChange,
    }
  })

  // The loop runs only while something can move: a behaviour, a turn in
  // flight, a hand on the cube, or a swell decaying. Between moves of a slow
  // behaviour the frame handler changes nothing and renders nothing.
  React.useEffect(() => {
    let raf = 0
    let last = performance.now()
    let lastKey = "\u0000"
    const idle = () => {
      runningRef.current = false
      wakeRef.current = start
    }

    const step = (now: number) => {
      const config = frameRef.current
      if (config.paused) return idle()
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const reduced = prefersReducedMotion()
      clock.current += dt
      const loopActive = config.animate && !config.controlled && config.behavior !== "static"

      // A hand on the cube outranks everything; then the queue; then the
      // behaviour, which only runs when nothing else is driving.
      if (!active.current && !holdRef.current) {
        if (!queue.current.length && loopActive && !reduced) {
          if (config.behavior === "solve") {
            const stepIndex = puzzleCubeStep("cycle", clock.current, config.speed * 0.55)
            if (stepIndex > stepsTaken.current) {
              stepsTaken.current = stepIndex
              if (!plan.current.length) {
                // Solved: shuffle it and start again. Scrambled: work out the
                // line once and then walk it, a turn at a time.
                plan.current = isSolved(stateRef.current)
                  ? scrambleMoves(config.order, 14, Math.floor(clock.current) + config.seed)
                  : (solveCube(stateRef.current) ?? [])
              }
              const next = plan.current.shift()
              if (next) push(next, "loop", false)
            }
          } else {
            const stepIndex = puzzleCubeStep(config.behavior, clock.current, config.speed * 0.55)
            if (stepIndex > stepsTaken.current) {
              stepsTaken.current = stepIndex
              const move = puzzleCubeMove(config.behavior, stepIndex - 1, config.order, config.seed)
              if (move) push(move, "loop", false)
            }
          }
        }
        const next = queue.current.shift()
        if (next) {
          const turn = moveToTurn(next.move, config.order)
          active.current = {
            turn,
            move: next.move,
            record: next.record,
            source: next.source,
            from: 0,
            // Three quarters the short way round: a cube's wrist never takes
            // 270° to do what 90° the other way does.
            to: ((turn.quarterTurns === 3 ? -1 : turn.quarterTurns) * Math.PI) / 2,
            elapsed: 0,
            duration: config.turnSeconds,
          }
        }
      }

      let live: CubeSpin | null = null
      const travel = active.current
      if (holdRef.current?.turn) {
        // The hand drives; the frame just renders it.
        live = { axis: holdRef.current.turn.axis, slice: holdRef.current.turn.slice, angle: holdRef.current.angle }
      } else if (travel) {
        travel.elapsed += dt
        const progress = config.animate && !reduced ? travel.elapsed / travel.duration : 1
        if (progress >= 1) {
          active.current = null
          live = null
          if (travel.turn.quarterTurns) {
            const next = applyTurn(stateRef.current, travel.turn)
            stateRef.current = next
            if (travel.record) {
              history.current = [...history.current, travel.move]
              setMoveCount(history.current.length)
              if (travel.source === "user") future.current = []
              historyChanged.current?.(history.current)
            }
            setCube(next)
            config.onMove?.(travel.move, next, travel.source)
            config.onStateChange?.(next)
            const solved = isSolved(next)
            if (solved !== wasSolved.current) {
              wasSolved.current = solved
              config.onSolvedChange?.(solved)
              if (solved) {
                celebrate.current = 1
                config.onSolved?.()
              }
            }
          }
        } else {
          live = {
            axis: travel.turn.axis,
            slice: travel.turn.slice,
            angle: travel.from + (travel.to - travel.from) * puzzleCubeEase(progress),
          }
        }
      }

      // A short swell when it comes home, so solving it is felt and not only
      // reported. It decays to nothing and leaves the scale exactly 1.
      let swell = 0
      if (celebrate.current > 0) {
        celebrate.current = Math.max(0, celebrate.current - dt * 1.6)
        swell = reduced ? 0 : Math.sin(celebrate.current * Math.PI) * 0.05
      }

      const key = `${live ? `${live.axis}${live.slice}:${px(live.angle)}` : "-"}:${px(swell * 1e4)}`
      if (key !== lastKey) {
        lastKey = key
        setVisual({ spin: live, swell })
      }

      if (active.current || holdRef.current || celebrate.current > 0 || (loopActive && !reduced)) {
        raf = requestAnimationFrame(step)
      } else {
        idle()
      }
    }

    const start = () => {
      if (runningRef.current) return
      runningRef.current = true
      wakeRef.current = start
      last = performance.now()
      raf = requestAnimationFrame(step)
    }
    start()
    return () => {
      cancelAnimationFrame(raf)
      runningRef.current = false
    }
  }, [animate, paused, controlled, behavior, push])

  /* ------------------------------------------------------------ the hand */

  // The camera: the view's own angles, plus however far it has been turned.
  // Unswung and unrised it is exactly `robotCamera(view)`, so the native view
  // stays byte-identical however the cube has been looked at.
  const stance = robotViews[view] ?? robotViews.iso
  const swung = wrapTurn(orbit.azimuth)
  const camera =
    swung === 0 && orbit.elevation === 0
      ? robotCamera(view)
      : robotCameraAt(
          stance.azimuth + swung,
          clampNum(stance.elevation + orbit.elevation, -POLE, POLE),
          view,
        )
  const frame = fitFrame(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const viewRef = React.useRef({ camera, frame })
  React.useEffect(() => {
    viewRef.current = { camera, frame }
  })

  /**
   * Pixels to a world direction, exactly. The camera is linear, so the two
   * in-plane axes of the grabbed face project to a 2×2 basis; solving that
   * basis for the screen drag yields the same drag in cube coordinates, which
   * is what `grabFromDrag` takes — no ray casting, no approximation.
   */
  const dragDirection = React.useCallback((dx: number, dy: number) => {
    const grab = holdRef.current
    const svg = svgRef.current
    if (!grab || !svg) return null
    const rect = svg.getBoundingClientRect()
    if (rect.width < 1) return null
    const k = VIEW_WIDTH / rect.width / viewRef.current.frame.scale
    const d = { x: dx * k, y: dy * k }
    const [u, v] = faceTangents[grab.face]
    const wu = viewRef.current.camera.project(...(toWorld(u)))
    const wv = viewRef.current.camera.project(...(toWorld(v)))
    const det = wu.x * wv.y - wv.x * wu.y
    if (Math.abs(det) < 1e-6) return null // the face is edge-on
    const a = (d.x * wv.y - d.y * wv.x) / det
    const b = (wu.x * d.y - wu.y * d.x) / det
    return [a * u[0] + b * v[0], a * u[1] + b * v[1], a * u[2] + b * v[2]] as [number, number, number]
  }, [])

  const onDragMove = React.useCallback(
    (x: number, y: number) => {
      const grab = holdRef.current
      if (!grab) return
      const direction = dragDirection(x - grab.x, y - grab.y)
      if (!direction) return
      if (!grab.turn) {
        // Which layer is decided once, on the first few pixels, and then held:
        // a drag cannot wander into another layer half way through.
        const cell = EDGE / n
        if (Math.hypot(...direction) < cell * 0.14) return
        const grabbed = grabFromDrag({
          face: grab.face,
          cubie: grab.cubie,
          direction,
          order: n,
        })
        if (!grabbed) return
        grab.turn = grabbed.turn
        grab.tangent = grabbed.tangent
      }
      const tangent = grab.tangent
      if (!tangent) return
      const along = direction[0] * tangent[0] + direction[1] * tangent[1] + direction[2] * tangent[2]
      // Half the cube's edge of travel is one quarter turn, which is about
      // what a hand expects from a cube of that size on a screen.
      const winding = grab.turn.quarterTurns === 1 ? 1 : -1
      grab.angle = winding * (along / (EDGE * 0.5)) * (Math.PI / 2)
    },
    [dragDirection, n],
  )

  const onDragEnd = React.useCallback(() => {
    const grab = holdRef.current
    holdRef.current = null
    setHolding(false)
    if (!grab?.turn) return
    const snap = puzzleCubeSnap(grab.angle)
    const quarterTurns = (((snap.quarters % 4) + 4) % 4)
    const turn: CubeTurn = { ...grab.turn, quarterTurns }
    // The settle is short and fixed: it is the cube coming to rest under a
    // hand that has already let go, not a turn being played.
    active.current = {
      turn,
      move: turnToMove(turn, n),
      record: quarterTurns !== 0,
      source: "user",
      from: grab.angle,
      to: snap.angle,
      elapsed: 0,
      duration: 0.16,
    }
    plan.current = []
    wakeRef.current()
  }, [n])

  const svgRef = React.useRef<SVGSVGElement>(null)
  React.useEffect(() => {
    if (!holding) return
    const move = (event: PointerEvent) => onDragMove(event.clientX, event.clientY)
    const up = () => onDragEnd()
    // The drag goes on the window rather than on the sticker: a hand that
    // flings a layer leaves the face it grabbed long before it lets go.
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", up)
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", up)
    }
  }, [holding, onDragMove, onDragEnd])

  const beginHold = React.useCallback(
    (event: React.PointerEvent, index: number, face: CubeFace) => {
      if (!interactive || event.button !== 0) return
      event.preventDefault()
      // One press, one hand: taking a layer takes the camera back with it.
      setOrbitPress(null)
      // The sticker keeps the press for its layer; the plastic and the
      // background give it to the camera, below.
      event.stopPropagation()
      // A hand on the cube lands whatever was still travelling, rather than
      // the release throwing that turn away: the next frame finishes it into
      // the state before the drag begins.
      if (active.current) active.current.elapsed = active.current.duration
      holdRef.current = {
        face,
        cubie: stateRef.current.cubies[index],
        x: event.clientX,
        y: event.clientY,
        turn: null,
        tangent: null,
        angle: 0,
      }
      setHolding(true)
      wakeRef.current()
    },
    [interactive],
  )

  /* A press anywhere but a sticker turns the *cube* rather than a layer: the
   * camera sweeps round it, any direction at all, over the top and under the
   * bottom. The turn works on the movement, not the spot — the trace is the
   * effect's own closure, so nothing is left behind when the hand comes off. */
  const orbitScene = React.useRef({
    orbit,
    limits: elevationBounds((robotViews[view] ?? robotViews.iso).elevation),
  })
  React.useEffect(() => {
    orbitScene.current = {
      orbit,
      limits: elevationBounds((robotViews[view] ?? robotViews.iso).elevation),
    }
  })
  const orbitChange = React.useRef(onOrbitChange)
  React.useEffect(() => {
    orbitChange.current = onOrbitChange
  })

  const turnOrbit = React.useCallback(
    (next: PuzzleCubeOrbit) => {
      const { limits } = orbitScene.current
      const bounded = {
        azimuth: wrapTurn(next.azimuth),
        elevation: clampNum(finiteNum(next.elevation, 0), limits.min, limits.max),
      }
      orbitScene.current = { ...orbitScene.current, orbit: bounded }
      setTurned(bounded)
      orbitChange.current?.(bounded)
    },
    [],
  )

  const beginOrbit = React.useCallback(
    (event: React.PointerEvent) => {
      if (!interactive || event.button !== 0 || event.defaultPrevented) return
      // One press, one hand: a layer being wound outranks the camera.
      if (holdRef.current) return
      event.preventDefault()
      setOrbitPress({ x: event.clientX, y: event.clientY })
    },
    [interactive],
  )

  React.useEffect(() => {
    if (!orbitPress) return
    let last = orbitPress
    const move = (event: PointerEvent) => {
      const from = orbitScene.current.orbit
      turnOrbit({
        azimuth: from.azimuth - (event.clientX - last.x) * ORBIT_SWEEP,
        elevation: from.elevation - (event.clientY - last.y) * ORBIT_RISE,
      })
      last = { x: event.clientX, y: event.clientY }
    }
    const up = () => setOrbitPress(null)
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", up)
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", up)
    }
  }, [orbitPress, turnOrbit])

  /* -------------------------------------------------------------- paint */

  const solvedNow = isSolved(cube)
  const spin = visual.spin
  const drawings = cubieDrawings(cube, camera, spin)
  const lineWeight = Math.max(0.5, Math.min(1.1, (EDGE / n) / 33))
  const bodyShade = (shade: number) => shadeHex(colors.dark, shade)
  const under = camera.project(...(toWorld([0, -EDGE / 2, 0])))
  const origin = camera.project(0, 0, 0)
  const swell = visual.swell

  const ariaParts = [
    `${n} by ${n} puzzle cube`,
    solvedNow ? "solved" : "scrambled",
    spin ? `turning ${spin.axis}` : null,
    viewNames[view] ?? viewNames.iso,
  ]

  // Straight down and straight up are singular for this camera, and a shadow
  // seen edge-on is a line — the ground and the underglow step out rather
  // than degenerate.
  const flat = camera.flatten

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "application" : "img")}
      aria-label={
        ariaLabel ??
        `${ariaParts.filter(Boolean).join(", ")}.` +
          (interactive
            ? " Drag a sticker to turn that layer; drag the plastic to turn the whole cube over. Or type a move: U, D, L, R, F, B, with shift for anticlockwise. Arrow keys turn the cube, S scrambles, H hints, Enter solves, Backspace undoes, Escape resets."
            : "")
      }
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onPointerDown={interactive ? beginOrbit : undefined}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const letter = event.key.toUpperCase()
        const step = event.shiftKey ? ORBIT_STEP * 3 : ORBIT_STEP
        // From the ref, not from this render: two presses in one tick would
        // otherwise both read the same angle and the second would undo the first.
        const from = orbitScene.current.orbit
        if (event.key === "ArrowLeft") turnOrbit({ ...from, azimuth: from.azimuth + step })
        else if (event.key === "ArrowRight") turnOrbit({ ...from, azimuth: from.azimuth - step })
        else if (event.key === "ArrowUp") turnOrbit({ ...from, elevation: from.elevation + step })
        else if (event.key === "ArrowDown") turnOrbit({ ...from, elevation: from.elevation - step })
        else if (event.key === "Home") turnOrbit({ azimuth: 0, elevation: 0 })
        else if (cubeFaces.includes(letter as CubeFace)) {
          push({ face: letter as CubeFace, layer: 0, turns: event.shiftKey ? 3 : 1 })
        } else if (letter === "S") {
          api.scramble()
        } else if (letter === "H") {
          api.hint()
        } else if (letter === "Z" && (event.metaKey || event.ctrlKey)) {
          if (event.shiftKey) api.redo()
          else api.undo()
        } else if (event.key === "Enter") {
          api.solve()
        } else if (event.key === "Backspace") {
          api.undo()
        } else if (event.key === "Escape") {
          api.reset()
        } else {
          return
        }
        event.preventDefault()
      }}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      width={width}
      height={px((width * VIEW_HEIGHT) / VIEW_WIDTH)}
      data-cube="puzzle-cube"
      data-cube-order={n}
      data-cube-solved={String(solvedNow)}
      data-cube-turning={spin ? spin.axis : ""}
      data-cube-dragging={holding || orbitPress ? "true" : ""}
      data-cube-moves={moveCount}
      data-azimuth={px(swung)}
      data-elevation={px(orbit.elevation)}
      className={cn(
        "max-w-full select-none",
        interactive &&
          "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]",
        (holding || orbitPress) && "cursor-grabbing",
        className,
      )}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      <g
        data-view={view}
        transform={frame.transform || undefined}
      >
        {showGround && flat > 0.03 ? (
          <ellipse
            data-ground
            cx={px(under.x)}
            cy={px(under.y + 4)}
            rx={px(EDGE * 0.78)}
            ry={px(EDGE * 0.78 * flat + 0.4)}
            fill={palette.dark}
            opacity={0.12}
          />
        ) : null}
        {solvedNow && flat > 0.03 ? (
          <ellipse
            data-glow
            cx={px(under.x)}
            cy={px(under.y + 4)}
            rx={px(EDGE * 0.66)}
            ry={px(EDGE * 0.66 * flat + 0.4)}
            fill={palette.glow}
            opacity={0.16}
          />
        ) : null}

        <g
          data-cubies
          transform={
            swell
              ? `translate(${px(origin.x)} ${px(origin.y)}) scale(${px(1 + swell)}) translate(${px(-origin.x)} ${px(-origin.y)})`
              : undefined
          }
        >
          {drawings.map(({ index, faces, turning }) => (
            <g key={index} data-cubie={index} data-turning={turning ? "true" : undefined}>
              {faces.map(({ face, plastic, sticker, shade }) => {
                const stickerColor = colors.faces[stickerFace(cube.cubies[index], face)]
                const painted = paintFace({
                  variant,
                  face,
                  stickerColor,
                  bodyShade: bodyShade(shade),
                  shade,
                  weight: lineWeight,
                  turning,
                  palette,
                })
                return (
                  <React.Fragment key={face}>
                    <path d={plastic} {...painted.plastic} />
                    <path
                      data-sticker
                      data-face={face}
                      d={sticker}
                      {...painted.sticker}
                      onPointerDown={interactive ? (event) => beginHold(event, index, face) : undefined}
                    />
                  </React.Fragment>
                )
              })}
            </g>
          ))}
        </g>

        {variant === "blueprint" && (
          <g data-annotation opacity={0.7}>
            <text
              x={px(origin.x)}
              y={px(under.y + EDGE * 0.22)}
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
              fontSize={5}
              fill={palette.foreground}
            >
              {`${n}\u00d7${n}\u00d7${n} \u00b7 ${moveCount} MOVES${solvedNow ? " \u00b7 SOLVED" : ""}`}
            </text>
          </g>
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

/* ---------------------------------------------------------------- paint */

type FacePaint = {
  plastic: React.SVGProps<SVGPathElement>
  sticker: React.SVGProps<SVGPathElement>
}

/**
 * One face's paint for the four variants — paint only, never geometry. The
 * flat key light scales every fill; `wire` picks the turning slice out in
 * accent so the mechanism is legible from its structure alone.
 */
function paintFace({
  variant,
  stickerColor,
  bodyShade,
  shade,
  weight,
  turning,
  palette,
}: {
  variant: RobotVariant
  face: CubeFace
  stickerColor: string
  bodyShade: string
  shade: number
  weight: number
  turning: boolean
  palette: ReturnType<typeof resolveRobotPalette>
}): FacePaint {
  const lit = shadeHex(stickerColor, shade)
  switch (variant) {
    case "outline":
      return {
        plastic: { fill: "none", stroke: palette.metal, strokeWidth: px(0.8 * weight) },
        sticker: { fill: "none", stroke: stickerColor, strokeWidth: px(1.1 * weight) },
      }
    case "blueprint":
      return {
        plastic: { fill: bodyShade, fillOpacity: 0.1, stroke: palette.grid, strokeWidth: px(0.6 * weight) },
        sticker: { fill: lit, fillOpacity: 0.32, stroke: palette.foreground, strokeWidth: px(0.7 * weight) },
      }
    case "wire":
      return {
        plastic: { fill: "none", stroke: palette.grid, strokeWidth: px(0.7 * weight) },
        sticker: {
          fill: "none",
          stroke: turning ? palette.accent : palette.grid,
          strokeWidth: px(0.9 * weight),
        },
      }
    default:
      return {
        plastic: { fill: bodyShade, stroke: palette.dark, strokeWidth: px(0.5 * weight) },
        sticker: { fill: lit, stroke: "none" },
      }
  }
}

/* ---------------------------------------------------------------- colour */

/**
 * The palette as colours SVG can paint. Six face colours resolve
 * prop → `--robot-cube-<face>` → the standard scheme, the same three steps
 * every palette role takes; the body and the glow come from
 * `resolveRobotPalette` so the cube sits inside the page's theme.
 */
function useCubeColors(
  palette: ReturnType<typeof resolveRobotPalette>,
  overrides: Partial<Record<CubeFace, string>> | undefined,
) {
  const key = cubeFaces.map((face) => overrides?.[face] ?? "").join("|")
  const [resolved, setResolved] = React.useState(() => ({
    dark: "#1f2430",
    glow: "#38bdf8",
    faces: { ...standardCubeFaceColors },
  }))

  React.useEffect(() => {
    const read = () => {
      const faces = {} as Record<CubeFace, string>
      for (const face of cubeFaces) {
        const wanted = overrides?.[face] ?? faceVariables[face]
        faces[face] = resolveCssColor(wanted, standardCubeFaceColors[face])
      }
      setResolved({
        dark: resolveCssColor(palette.dark, "#1f2430"),
        glow: resolveCssColor(palette.glow, "#38bdf8"),
        faces,
      })
    }
    read()
    return watchCssColors(read)
    // `key` stands in for the override object, which a caller rebuilds inline.
  }, [key, overrides, palette.dark, palette.glow])

  return resolved
}

export { PuzzleCube }
