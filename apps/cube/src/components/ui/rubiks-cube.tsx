"use client"

/**
 * rubiks-cube — the cube as a thing you play with, not a thing you watch.
 *
 * Procedural: 26 (or 8, or 125) cubies built from primitives, placed every
 * frame from the cube's own state. Orbit it, grab a face and the layer turns
 * *with your hand* and snaps when you let go, type moves at it, scramble it,
 * ask it for a hint, or watch it solve itself.
 *
 * Solved, not illustrated: the state, every turn, the scramble, the drag
 * geometry, the sticker colours and the solve all come from
 * `src/lib/robocn/cube.ts` — pure, exact integer arithmetic, tested on its
 * own. `solve()` is a real layer-by-layer method whose line is replayed and
 * checked before it is played, and it is 3×3 only; on any other order the cube
 * says so instead of pretending. Illustrated: the eased travel of a turn, the
 * rounded cubie shell and the plinth glow. Notes: `docs/rubiks-cube.md`.
 */

import * as React from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"

import { resolveCssColor, watchCssColors } from "@/lib/robocn/color"
import {
  applyTurn,
  createCube,
  cubeFaces,
  exposedFaces,
  faceNormals,
  formatMove,
  grabFromDrag,
  isSolved,
  invertMove,
  moveToTurn,
  parseAlgorithm,
  parseMove,
  scrambleMoves,
  solveCube,
  turnToMove,
  type CubeAxis,
  type CubeFace,
  type CubeMove,
  type CubeState,
  type CubeTurn,
  type Cubie,
} from "@/lib/robocn/cube"
import {
  prefersReducedMotion,
  resolveRobotPalette,
  type RobotPaletteProps,
  type RobotVariant,
} from "@/lib/robocn/style"

/**
 * What the cube does with nobody driving it. `solve` is the live one: it
 * scrambles itself, solves itself with the real method, and starts again.
 */
export type RubiksCubeBehavior = "cycle" | "scramble" | "solve" | "static"

/** Where a turn came from, so a game can time a person without timing itself. */
export type RubiksCubeSource = "user" | "solver" | "scramble" | "loop" | "undo" | "redo"

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
 * Face colours resolve prop → CSS variable → the standard scheme. The scheme
 * goes *inside* the `var()`: an undefined custom property is not a missing
 * value the browser reports, it is an invalid one that computes to the
 * inherited colour — which is how six faces quietly come out the same.
 */
const faceVariables = Object.fromEntries(
  cubeFaces.map((face) => [
    face,
    `var(--robot-cube-${face.toLowerCase()}, ${standardCubeFaceColors[face]})`,
  ]),
) as Record<CubeFace, string>

/** The algorithm the `cycle` behaviour plays. Six repeats come home. */
const cycleAlgorithm = parseAlgorithm("R U R' U'")

/**
 * Which move a clock-driven behaviour makes at step `index`. A pure function
 * of the step — and the step is a pure function of the clock — so motion is
 * tested by sampling rather than by faking frames. `solve` is not here: what
 * it plays depends on the cube, not on the time, and it is driven by the
 * solver instead.
 */
export function rubiksCubeMove(
  behavior: RubiksCubeBehavior,
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
export function rubiksCubeStep(
  behavior: RubiksCubeBehavior,
  clock: number,
  speed = 1,
): number {
  if (behavior === "static" || !Number.isFinite(clock) || clock < 0) return 0
  const rate = Number.isFinite(speed) && speed > 0 ? speed : 1
  return Math.floor(clock * rate)
}

/** 0 → 1 across a turn, eased so it reads as a wrist rather than a servo. */
export const rubiksCubeEase = (progress: number) => {
  if (!Number.isFinite(progress)) return 0
  const t = progress < 0 ? 0 : progress > 1 ? 1 : progress
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/**
 * The turn a released drag commits to: the quarter turn it is nearest, and
 * the angle it should travel to get there.
 *
 * Wound past a quarter turn, a hand has already done that turn — so the snap
 * is a round, not a threshold, and letting go half way back snaps *back*
 * rather than through. Past a full turn the cube gives up and takes the whole
 * lot rather than unwinding three quarters of it.
 */
export function rubiksCubeSnap(angle: number): { quarters: number; angle: number } {
  const wound = Number.isFinite(angle) ? angle : 0
  const quarters = Math.max(-4, Math.min(4, Math.round(wound / (Math.PI / 2))))
  return { quarters, angle: (quarters * Math.PI) / 2 }
}

export interface RubiksCubeProps extends RobotPaletteProps {
  /** Cubies to a side. 2 … 7; 3 is the cube everyone means. */
  order?: number
  /** The cube's edge in world units. */
  size?: number
  /**
   * Controlled: the cube is exactly this algorithm applied to a solved cube.
   * Supplying it stops the behaviour loop. Moves appended to it are animated;
   * anything else rebuilds the state.
   */
  algorithm?: string | CubeMove[]
  behavior?: RubiksCubeBehavior
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
  /** Grab a face and the layer follows the pointer; type moves at the canvas. */
  interactive?: boolean
  /** Paint only — never geometry. */
  variant?: RobotVariant
  /** Per-face colour overrides. `{ U: "var(--chart-1)" }` retints one face. */
  faces?: Partial<Record<CubeFace, string>>
  /** Every turn, once it has been applied, and where it came from. */
  onMove?: (move: CubeMove, state: CubeState, source: RubiksCubeSource) => void
  /** Whenever the state changes, including a reset. */
  onStateChange?: (state: CubeState) => void
  /** Called the moment the cube comes home. */
  onSolved?: () => void
  /** Both edges of solved — the one a stopwatch starts and stops on. */
  onSolvedChange?: (solved: boolean) => void
  /** The turns a person has made, as they are made and unmade. */
  onHistoryChange?: (moves: CubeMove[]) => void
  /** Handed a driver: `turn`, `scramble`, `solve`, `hint`, `undo`, `redo`. */
  controls?: (api: RubiksCubeApi) => void
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  label?: string
}

/** The driver a demo, a toolbar or a test uses to work the cube. */
export interface RubiksCubeApi {
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

const SCRATCH_QUATERNION = new THREE.Quaternion()
const SCRATCH_MATRIX = new THREE.Matrix4()
const SCRATCH_VECTOR = new THREE.Vector3()
const SCRATCH_DRAG = new THREE.Vector3()
const SCRATCH_RIGHT = new THREE.Vector3()
const SCRATCH_UP = new THREE.Vector3()
const SCRATCH_AXIS = new THREE.Vector3()
const AXIS_VECTORS = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
} as const

/** A slice part way round: what the placement pass actually needs to know. */
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
  source: RubiksCubeSource
  from: number
  to: number
  elapsed: number
  duration: number
}

/** The hand on the cube, from the press to the release. */
interface CubeHold {
  face: CubeFace
  cubie: Cubie
  screen: { x: number; y: number }
  turn: CubeTurn | null
  tangent: readonly [number, number, number] | null
  angle: number
}

function RubiksCube({
  order = 3,
  size = 2.4,
  algorithm,
  behavior = "cycle",
  speed = 0.9,
  phase = 0,
  seed = 1,
  scrambleOnMount = false,
  animate = true,
  paused = false,
  interactive = true,
  variant = "solid",
  faces,
  onMove,
  onStateChange,
  onSolved,
  onSolvedChange,
  onHistoryChange,
  controls,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  label,
  color,
  accent,
  metal,
  dark,
  glow,
  grid,
  palette: paletteOverride,
}: RubiksCubeProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const n = Number.isFinite(order) ? Math.max(2, Math.min(7, Math.round(order))) : 3
  const edge = Number.isFinite(size) && size > 0 ? size : 2.4
  const cell = edge / n

  const [cube, setCube] = React.useState<CubeState>(() => {
    const solved = createCube(n)
    if (!scrambleOnMount) return solved
    const count = typeof scrambleOnMount === "number" ? scrambleOnMount : 20
    return scrambleMoves(n, count, seed).reduce(
      (state, move) => applyTurn(state, moveToTurn(move, n)),
      solved,
    )
  })
  // The frame loop reads the state without waiting for React, and writes
  // through `setCube` only when a turn lands.
  const stateRef = React.useRef(cube)

  // Queued turns carry whether they belong in the history: an undo does not,
  // or undoing twice would walk forward again instead of back.
  const queue = React.useRef<{ move: CubeMove; record: boolean; source: RubiksCubeSource }[]>([])
  const history = React.useRef<CubeMove[]>([])
  const future = React.useRef<CubeMove[]>([])
  const active = React.useRef<CubeTravel | null>(null)
  // The solver's line, kept so `solve` costs one search rather than one a turn.
  const plan = React.useRef<CubeMove[]>([])
  const clock = React.useRef(phase)
  const stepsTaken = React.useRef(0)
  const wasSolved = React.useRef(isSolved(cube))
  const celebrate = React.useRef(0)
  const groups = React.useRef<(THREE.Group | null)[]>([])
  const shell = React.useRef<THREE.Group | null>(null)

  const controlled = algorithm !== undefined
  const colors = useCubeColors(palette, faces)
  const turnSeconds = Math.max(0.08, 0.34 / Math.max(0.1, speed))

  const push = React.useCallback(
    (move: CubeMove | string, source: RubiksCubeSource = "user", record = true) => {
      const parsed = typeof move === "string" ? parseMove(move) : move
      if (!parsed || !cubeFaces.includes(parsed.face)) return
      // A turn of the person's own invalidates any line the solver worked out.
      if (source === "user") plan.current = []
      queue.current.push({ move: parsed, record, source })
    },
    [],
  )

  const historyChanged = React.useRef(onHistoryChange)
  const rebuild = React.useCallback(
    (moves: CubeMove[]) => {
      queue.current = []
      active.current = null
      plan.current = []
      history.current = [...moves]
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

  // The order or the cube's identity changed underneath it: start again rather
  // than leaving cubies on a lattice that no longer exists.
  const orderRef = React.useRef(n)
  React.useEffect(() => {
    if (orderRef.current === n) return
    orderRef.current = n
    rebuild([])
  }, [n, rebuild])

  const api = React.useMemo<RubiksCubeApi>(
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

  /* ----------------------------------------------------------- the loop */

  const orbit = useThree((state) => state.controls)
  // The canvas is taken from the frame callback rather than from `useThree`:
  // the rig writes its `data-*` hooks and its keyboard onto that element, and
  // a value read off a hook may not be modified under the React Compiler.
  const canvas = React.useRef<HTMLCanvasElement | null>(null)
  const detach = React.useRef<(() => void) | null>(null)
  const camera = React.useRef<THREE.Camera | null>(null)
  const viewport = React.useRef({ width: 1, height: 1 })
  const interactiveRef = React.useRef(interactive)
  const apiRef = React.useRef(api)
  const labelRef = React.useRef(label)
  const orbitRef = React.useRef(orbit)
  const hold = React.useRef<CubeHold | null>(null)
  const spin = React.useRef<CubeSpin | null>(null)
  // A ref, not state: the pointer crosses a cubie boundary every few pixels of
  // a drag, and re-rendering 26 groups and their materials each time is how a
  // cube that should feel like a cube ends up feeling like a spreadsheet.
  const hovered = React.useRef(-1)

  /* --------------------------------------------------------- the pointer */

  /**
   * Drag is in world units, so the pixels have to become some. The camera's
   * own right and up carry the screen delta into the world, scaled by how much
   * world a pixel covers at the cube's distance, and then rotated into the
   * rig's own frame — a cube inside a turned group still turns the layer the
   * hand is pulling on.
   */
  const dragVector = React.useCallback((dx: number, dy: number) => {
    const view = camera.current
    if (!view) return null
    const fov = (view as THREE.PerspectiveCamera).isPerspectiveCamera
      ? (view as THREE.PerspectiveCamera).fov
      : 50
    const distance = Math.max(0.001, view.position.length())
    const perPixel =
      (2 * Math.tan((fov * Math.PI) / 360) * distance) / Math.max(1, viewport.current.height)
    SCRATCH_RIGHT.setFromMatrixColumn(view.matrixWorld, 0)
    SCRATCH_UP.setFromMatrixColumn(view.matrixWorld, 1)
    SCRATCH_DRAG.set(0, 0, 0)
      .addScaledVector(SCRATCH_RIGHT, dx * perPixel)
      .addScaledVector(SCRATCH_UP, -dy * perPixel)
    if (shell.current) {
      SCRATCH_DRAG.applyQuaternion(
        shell.current.getWorldQuaternion(SCRATCH_QUATERNION).invert(),
      )
    }
    return SCRATCH_DRAG
  }, [])

  const onDragMove = React.useCallback(
    (event: PointerEvent) => {
      const grab = hold.current
      if (!grab) return
      const travel = dragVector(event.clientX - grab.screen.x, event.clientY - grab.screen.y)
      if (!travel) return
      if (!grab.turn) {
        // Which layer is decided once, on the first few pixels, and then held:
        // a drag cannot wander into another layer half way through.
        if (travel.length() < cell * 0.14) return
        const grabbed = grabFromDrag({
          face: grab.face,
          cubie: grab.cubie,
          direction: [travel.x, travel.y, travel.z],
          order: n,
        })
        if (!grabbed) return
        grab.turn = grabbed.turn
        grab.tangent = grabbed.tangent
      }
      const [tx, ty, tz] = grab.tangent as readonly [number, number, number]
      const along = travel.x * tx + travel.y * ty + travel.z * tz
      // Half the cube's edge of travel is one quarter turn, which is about
      // what a hand expects from a cube of that size on a screen.
      const winding = grab.turn.quarterTurns === 1 ? 1 : -1
      grab.angle = winding * (along / (edge * 0.5)) * (Math.PI / 2)
      spin.current = { axis: grab.turn.axis, slice: grab.turn.slice, angle: grab.angle }
    },
    [cell, dragVector, edge, n],
  )

  const onDragEnd = React.useCallback(() => {
    const grab = hold.current
    hold.current = null
    spin.current = null
    const orbiting = orbitRef.current as { enabled?: boolean } | null
    if (orbiting) orbiting.enabled = true
    if (!grab?.turn) return
    const snap = rubiksCubeSnap(grab.angle)
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
  }, [n])

  // Everything the frame loop and the handlers read from props lands here
  // after the render rather than during it, so nothing touches a ref while
  // React is still drawing.
  const handlers = React.useRef({ move: onDragMove, up: onDragEnd })
  React.useEffect(() => {
    stateRef.current = cube
    interactiveRef.current = interactive
    apiRef.current = api
    labelRef.current = label
    orbitRef.current = orbit
    controlsRef.current = controls
    historyChanged.current = onHistoryChange
    handlers.current = { move: onDragMove, up: onDragEnd }
  })

  useFrame((state, delta) => {
    camera.current = state.camera
    viewport.current = { width: state.size.width, height: state.size.height }
    if (paused) return
    const dt = Math.min(0.05, delta)
    const reduced = prefersReducedMotion()
    clock.current += dt

    // A hand on the cube outranks everything; then the queue; then the
    // behaviour, which only runs when nothing else is driving.
    if (!active.current && !hold.current) {
      if (!queue.current.length && !controlled && animate && !reduced) {
        if (behavior === "solve") {
          const step = rubiksCubeStep("cycle", clock.current, speed * 0.55)
          if (step > stepsTaken.current) {
            stepsTaken.current = step
            if (!plan.current.length) {
              // Solved: shuffle it and start again. Scrambled: work out the
              // line once and then walk it, a turn at a time.
              plan.current = isSolved(stateRef.current)
                ? scrambleMoves(n, 14, Math.floor(clock.current) + seed)
                : (solveCube(stateRef.current) ?? [])
            }
            const next = plan.current.shift()
            if (next) push(next, "loop", false)
          }
        } else {
          const step = rubiksCubeStep(behavior, clock.current, speed * 0.55)
          if (step > stepsTaken.current) {
            stepsTaken.current = step
            const move = rubiksCubeMove(behavior, step - 1, n, seed)
            if (move) push(move, "loop", false)
          }
        }
      }
      const next = queue.current.shift()
      if (next) {
        const turn = moveToTurn(next.move, n)
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
          duration: turnSeconds,
        }
      }
    }

    let live: CubeSpin | null = spin.current
    const travel = active.current
    if (travel) {
      travel.elapsed += dt
      const progress = animate && !reduced ? travel.elapsed / travel.duration : 1
      if (progress >= 1) {
        active.current = null
        live = null
        if (travel.turn.quarterTurns) {
          const next = applyTurn(stateRef.current, travel.turn)
          stateRef.current = next
          if (travel.record) {
            history.current = [...history.current, travel.move]
            if (travel.source === "user") future.current = []
            historyChanged.current?.(history.current)
          }
          setCube(next)
          onMove?.(travel.move, next, travel.source)
          onStateChange?.(next)
          const solved = isSolved(next)
          if (solved !== wasSolved.current) {
            wasSolved.current = solved
            onSolvedChange?.(solved)
            if (solved) {
              celebrate.current = 1
              onSolved?.()
            }
          }
        }
      } else {
        live = {
          axis: travel.turn.axis,
          slice: travel.turn.slice,
          angle: travel.from + (travel.to - travel.from) * rubiksCubeEase(progress),
        }
      }
    }

    place(groups.current, stateRef.current, cell, live)

    // A short swell when it comes home, so solving it is felt and not only
    // reported. It decays to nothing and leaves the scale exactly 1.
    if (celebrate.current > 0 && shell.current) {
      celebrate.current = Math.max(0, celebrate.current - dt * 1.6)
      const swell = reduced ? 0 : Math.sin(celebrate.current * Math.PI) * 0.06
      shell.current.scale.setScalar(scale * (1 + swell))
    }

    if (!canvas.current) {
      canvas.current = state.gl.domElement
      detach.current = attach(canvas.current, interactiveRef, apiRef, handlers)
    }
    const element = canvas.current
    element.dataset.cube = "rubiks-cube"
    element.dataset.cubeOrder = String(n)
    element.dataset.cubeTurning = live ? live.axis : ""
    element.dataset.cubeDragging = hold.current ? "true" : ""
    element.dataset.cubeSolved = String(isSolved(stateRef.current))
    element.dataset.cubeMoves = String(history.current.length)
    if (interactiveRef.current) {
      element.tabIndex = 0
      // Without this a touch drag scrolls the page instead of turning a face.
      element.style.touchAction = "none"
      element.style.cursor = hold.current ? "grabbing" : hovered.current >= 0 ? "grab" : "auto"
      element.setAttribute("role", "application")
      element.setAttribute(
        "aria-label",
        labelRef.current ??
          `${n} by ${n} Rubik's cube, ${isSolved(stateRef.current) ? "solved" : "scrambled"}. Drag a face to turn that layer, or type a move: U, D, L, R, F, B, with shift for anticlockwise. S scrambles, H hints, Enter solves, backspace undoes, escape resets.`,
      )
    }
  })

  React.useEffect(() => () => detach.current?.(), [])

  /* ------------------------------------------------------------ drawing */

  const half = (n - 1) / 2
  const solvedNow = isSolved(cube)
  const body = variant === "outline" ? colors.metal : colors.dark
  const wireframe = variant === "wire" || variant === "blueprint"
  const bodySize = cell * 0.97
  const stickerSize = cell * 0.84
  const sticker = React.useMemo(
    () => roundedSquare(stickerSize, stickerSize * 0.17),
    [stickerSize],
  )
  const plastic = React.useMemo(
    () => new THREE.BoxGeometry(bodySize, bodySize, bodySize),
    [bodySize],
  )
  React.useEffect(() => () => void sticker.dispose(), [sticker])
  React.useEffect(() => () => void plastic.dispose(), [plastic])

  /**
   * The cubies worth drawing, in their *home* cells.
   *
   * A sticker is painted on the plastic: it never moves relative to its own
   * cubie, so it is laid out in the cubie's own frame — the faces that cubie
   * had when the cube was solved, each in its own colour — and the group's
   * orientation carries it round. Laying stickers out in world faces instead
   * is the bug that leaves a turned cube with blank sides.
   *
   * The array index is that home cell, because `applyTurn` moves a cubie's
   * coordinates without moving it in the array.
   */
  const home = React.useMemo(
    () =>
      createCube(n)
        .cubies.map((cubie, index) => ({ cubie, index, faces: exposedFaces(cubie, n) }))
        .filter((entry) => entry.faces.length > 0),
    [n],
  )

  return (
    <group
      ref={shell}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      {home.map(({ cubie, index, faces }) => (
        <group
          key={index}
          ref={(element) => {
            groups.current[index] = element
          }}
          position={[(cubie.i - half) * cell, (cubie.j - half) * cell, (cubie.k - half) * cell]}
          onPointerOver={
            interactive
              ? () => {
                  hovered.current = index
                }
              : undefined
          }
          onPointerOut={
            interactive
              ? () => {
                  if (hovered.current === index) hovered.current = -1
                }
              : undefined
          }
          onPointerDown={
            interactive
              ? (event) => {
                  const normal = event.face?.normal
                  if (!normal) return
                  event.stopPropagation()
                  // The picked triangle's normal is in the cubie's own frame;
                  // the group's rotation takes it back into the world.
                  SCRATCH_VECTOR.copy(normal).applyQuaternion(
                    (event.object.parent ?? event.object).getWorldQuaternion(SCRATCH_QUATERNION),
                  )
                  const face = nearestFace(SCRATCH_VECTOR)
                  if (!face) return
                  // A hand on the cube lands whatever was still travelling,
                  // rather than the release throwing that turn away: the next
                  // frame finishes it into the state before the drag begins.
                  if (active.current) active.current.elapsed = active.current.duration
                  hold.current = {
                    face,
                    cubie: stateRef.current.cubies[index],
                    screen: { x: event.clientX, y: event.clientY },
                    turn: null,
                    tangent: null,
                    angle: 0,
                  }
                  const orbiting = orbitRef.current as { enabled?: boolean } | null
                  if (orbiting) orbiting.enabled = false
                }
              : undefined
          }
        >
          <mesh castShadow receiveShadow geometry={plastic}>
            <meshStandardMaterial
              color={body}
              roughness={0.62}
              metalness={variant === "outline" ? 0.5 : 0.08}
              wireframe={wireframe}
            />
          </mesh>
          {faces.map((face) => {
            const normal = faceNormals[face]
            const lift = bodySize / 2 + cell * 0.012
            return (
              <mesh
                key={face}
                geometry={sticker}
                position={[normal[0] * lift, normal[1] * lift, normal[2] * lift]}
                rotation={stickerRotation(face)}
                renderOrder={1}
              >
                <meshStandardMaterial
                  color={variant === "blueprint" ? colors.accent : colors.faces[face]}
                  roughness={0.36}
                  metalness={0.04}
                  wireframe={variant === "wire"}
                  transparent={variant === "blueprint"}
                  opacity={variant === "blueprint" ? 0.4 : 1}
                />
              </mesh>
            )
          })}
        </group>
      ))}
      {/* A quiet plinth glow when it comes home, so solving it reads. */}
      {solvedNow ? (
        <mesh position={[0, -edge * 0.52, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[edge * 0.62, 48]} />
          <meshBasicMaterial color={colors.glow} transparent opacity={0.16} />
        </mesh>
      ) : null}
    </group>
  )
}

/**
 * The window listens for the drag and the canvas listens for the keys.
 *
 * The drag goes on the window rather than on the cubie: a hand that flings a
 * layer leaves the face it grabbed long before it lets go, and a cube that
 * stopped turning at the silhouette would be a cube that fights you.
 */
function attach(
  element: HTMLCanvasElement,
  interactive: React.RefObject<boolean>,
  api: React.RefObject<RubiksCubeApi>,
  handlers: React.RefObject<{ move: (event: PointerEvent) => void; up: () => void }>,
) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (!interactive.current) return
    const letter = event.key.toUpperCase()
    if (cubeFaces.includes(letter as CubeFace)) {
      api.current.turn({ face: letter as CubeFace, layer: 0, turns: event.shiftKey ? 3 : 1 })
    } else if (letter === "S") {
      api.current.scramble()
    } else if (letter === "H") {
      api.current.hint()
    } else if (letter === "Z" && (event.metaKey || event.ctrlKey)) {
      if (event.shiftKey) api.current.redo()
      else api.current.undo()
    } else if (event.key === "Enter") {
      api.current.solve()
    } else if (event.key === "Backspace") {
      api.current.undo()
    } else if (event.key === "Escape") {
      api.current.reset()
    } else {
      return
    }
    event.preventDefault()
  }
  const onPointerMove = (event: PointerEvent) => handlers.current.move(event)
  const onPointerUp = () => handlers.current.up()

  element.addEventListener("keydown", onKeyDown)
  window.addEventListener("pointermove", onPointerMove)
  window.addEventListener("pointerup", onPointerUp)
  window.addEventListener("pointercancel", onPointerUp)
  return () => {
    element.removeEventListener("keydown", onKeyDown)
    window.removeEventListener("pointermove", onPointerMove)
    window.removeEventListener("pointerup", onPointerUp)
    window.removeEventListener("pointercancel", onPointerUp)
  }
}

/* -------------------------------------------------------------------------- */
/* placement                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Put every cubie where the state says, and carry the slice that is part way
 * round with it. Rotating position and orientation by the same partial
 * rotation is what makes a turn one rigid body rather than nine sliding tiles.
 */
function place(
  groups: (THREE.Group | null)[],
  state: CubeState,
  cell: number,
  spin: CubeSpin | null,
) {
  const half = (state.order - 1) / 2
  let partial: THREE.Quaternion | null = null
  if (spin && spin.angle) {
    const axis = AXIS_VECTORS[spin.axis] ?? AXIS_VECTORS.y
    partial = SCRATCH_QUATERNION.setFromAxisAngle(SCRATCH_AXIS.copy(axis), spin.angle)
  }

  for (let index = 0; index < state.cubies.length; index++) {
    const group = groups[index]
    if (!group) continue
    const cubie = state.cubies[index]
    group.position.set((cubie.i - half) * cell, (cubie.j - half) * cell, (cubie.k - half) * cell)
    const m = cubie.orientation
    SCRATCH_MATRIX.set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1)
    group.quaternion.setFromRotationMatrix(SCRATCH_MATRIX)

    if (!partial || !spin || !inSpin(cubie, spin)) continue
    group.position.applyQuaternion(partial)
    group.quaternion.premultiply(partial)
  }
}

const inSpin = (cubie: Cubie, spin: CubeSpin) =>
  (spin.axis === "x" ? cubie.i : spin.axis === "y" ? cubie.j : cubie.k) === spin.slice

/** A picked normal, snapped to the face it belongs to. */
function nearestFace(normal: THREE.Vector3): CubeFace | null {
  let best: CubeFace | null = null
  let score = 0.5
  for (const face of cubeFaces) {
    const [x, y, z] = faceNormals[face]
    const dot = normal.x * x + normal.y * y + normal.z * z
    if (dot > score) {
      score = dot
      best = face
    }
  }
  return best
}

/** The rotation that lays a plane flat against a face, facing outward. */
function stickerRotation(face: CubeFace): [number, number, number] {
  switch (face) {
    case "U":
      return [-Math.PI / 2, 0, 0]
    case "D":
      return [Math.PI / 2, 0, 0]
    case "R":
      return [0, Math.PI / 2, 0]
    case "L":
      return [0, -Math.PI / 2, 0]
    case "B":
      return [0, Math.PI, 0]
    default:
      return [0, 0, 0]
  }
}

/** A sticker: a square with its corners taken off, which is what they are. */
function roundedSquare(size: number, radius: number) {
  const half = size / 2
  const r = Math.max(0, Math.min(radius, half))
  const shape = new THREE.Shape()
  shape.moveTo(-half + r, -half)
  shape.lineTo(half - r, -half)
  shape.quadraticCurveTo(half, -half, half, -half + r)
  shape.lineTo(half, half - r)
  shape.quadraticCurveTo(half, half, half - r, half)
  shape.lineTo(-half + r, half)
  shape.quadraticCurveTo(-half, half, -half, half - r)
  shape.lineTo(-half, -half + r)
  shape.quadraticCurveTo(-half, -half, -half + r, -half)
  return new THREE.ShapeGeometry(shape, 6)
}

/* -------------------------------------------------------------------------- */
/* colour                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The palette as colours three.js can use. Six face colours resolve
 * prop → `--robot-cube-<face>` → the standard scheme, the same three steps
 * every palette role takes; the body, the highlight and the glow come from
 * `resolveRobotPalette` so the cube sits inside the page's theme.
 */
function useCubeColors(
  palette: ReturnType<typeof resolveRobotPalette>,
  overrides: Partial<Record<CubeFace, string>> | undefined,
) {
  const key = cubeFaces.map((face) => overrides?.[face] ?? "").join("|")
  const [resolved, setResolved] = React.useState(() => ({
    dark: "#1f2430",
    metal: "#9aa3b2",
    accent: "#38bdf8",
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
        metal: resolveCssColor(palette.metal, "#9aa3b2"),
        accent: resolveCssColor(palette.accent, "#38bdf8"),
        glow: resolveCssColor(palette.glow, "#38bdf8"),
        faces,
      })
    }
    read()
    return watchCssColors(read)
    // `key` stands in for the override object, which a caller rebuilds inline.
  }, [key, overrides, palette.accent, palette.dark, palette.glow, palette.metal])

  return resolved
}

export { RubiksCube }
