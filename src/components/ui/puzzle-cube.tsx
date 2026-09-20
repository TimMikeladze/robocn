"use client"

/**
 * puzzle-cube — the classic twisty cube as a real rig, not a picture of one.
 *
 * Procedural: 27 (or 8, or 125) cubies built from primitives, placed every
 * frame from the cube's own state. Orbit it, drag a face to turn that layer,
 * type moves at it, scramble it, reset it. Drop it inside `robot-stage`.
 *
 * Solved, not illustrated: the state, every turn, the scramble, the
 * drag-to-move and the sticker colours all come from `src/lib/robocn/cube.ts`
 * — pure, exact integer arithmetic, tested on its own. Illustrated: the eased
 * travel of a turn, and the bevel on a cubie. Nothing here solves a scrambled
 * cube; `reset` restores it, which is a different thing and is said so in the
 * docs. Notes: `docs/puzzle-cube.md`.
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
  isSolved,
  invertMove,
  moveFromDrag,
  moveToTurn,
  parseAlgorithm,
  parseMove,
  scrambleMoves,
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

/** What the cube does with nobody driving it. Always includes `static`. */
export type PuzzleCubeBehavior = "cycle" | "scramble" | "static"

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

/** The algorithm each looping behaviour plays, and how long a turn takes. */
const cycleAlgorithm = parseAlgorithm("R U R' U'")

/**
 * Which move a behaviour makes at step `index`. A pure function of the step —
 * and the step is a pure function of the clock — so motion is tested by
 * sampling rather than by faking frames.
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
export function puzzleCubeStep(
  behavior: PuzzleCubeBehavior,
  clock: number,
  speed = 1,
): number {
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

export interface PuzzleCubeProps extends RobotPaletteProps {
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
  /** Drag a face to turn that layer; click the canvas and type moves at it. */
  interactive?: boolean
  /** Paint only — never geometry. */
  variant?: RobotVariant
  /** Per-face colour overrides. `{ U: "var(--chart-1)" }` retints one face. */
  faces?: Partial<Record<CubeFace, string>>
  /** Every turn, once it has been applied. */
  onMove?: (move: CubeMove, state: CubeState) => void
  /** Whenever the state changes, including a reset. */
  onStateChange?: (state: CubeState) => void
  /** Called the moment the cube comes home. */
  onSolved?: () => void
  /** Handed a driver: `turn`, `scramble`, `reset`, `undo`. */
  controls?: (api: PuzzleCubeApi) => void
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  label?: string
}

/** The driver a demo, a toolbar or a test uses to work the cube. */
export interface PuzzleCubeApi {
  /** Queue a move: `"R'"`, or the parsed shape. */
  turn: (move: CubeMove | string) => void
  scramble: (count?: number, seed?: number) => void
  reset: () => void
  /** Undo the last applied turn. */
  undo: () => void
  state: () => CubeState
}

const SCRATCH_QUATERNION = new THREE.Quaternion()
const SCRATCH_MATRIX = new THREE.Matrix4()
const SCRATCH_VECTOR = new THREE.Vector3()
const SCRATCH_AXIS = new THREE.Vector3()
const AXIS_VECTORS = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
} as const

function PuzzleCube({
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
}: PuzzleCubeProps) {
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
  const queue = React.useRef<{ move: CubeMove; record: boolean }[]>([])
  const history = React.useRef<CubeMove[]>([])
  const active = React.useRef<{
    turn: CubeTurn
    move: CubeMove
    record: boolean
    elapsed: number
  } | null>(null)
  const clock = React.useRef(phase)
  const stepsTaken = React.useRef(0)
  const groups = React.useRef<(THREE.Group | null)[]>([])

  const controlled = algorithm !== undefined
  const colors = useCubeColors(palette, faces)
  const turnSeconds = Math.max(0.08, 0.34 / Math.max(0.1, speed))

  const push = React.useCallback((move: CubeMove | string, record = true) => {
    const parsed = typeof move === "string" ? parseMove(move) : move
    if (parsed && cubeFaces.includes(parsed.face)) queue.current.push({ move: parsed, record })
  }, [])

  const rebuild = React.useCallback(
    (moves: CubeMove[]) => {
      queue.current = []
      active.current = null
      history.current = [...moves]
      const next = moves.reduce(
        (state, move) => applyTurn(state, moveToTurn(move, n)),
        createCube(n),
      )
      setCube(next)
      onStateChange?.(next)
      if (isSolved(next)) onSolved?.()
    },
    [n, onStateChange, onSolved],
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
      for (const move of wanted.slice(applied ? applied.split(" ").length : 0)) push(move)
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

  const api = React.useMemo<PuzzleCubeApi>(
    () => ({
      turn: (move) => push(move),
      scramble: (count = 20, scrambleSeed = Math.floor(Math.random() * 1e9)) => {
        for (const move of scrambleMoves(n, count, scrambleSeed)) push(move)
      },
      reset: () => rebuild([]),
      undo: () => {
        const last = history.current.at(-1)
        if (!last) return
        history.current = history.current.slice(0, -1)
        push(invertMove(last), false)
      },
      state: () => stateRef.current,
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
  const interactiveRef = React.useRef(interactive)
  const apiRef = React.useRef(api)
  const labelRef = React.useRef(label)
  const pushRef = React.useRef(push)

  // Everything the frame loop and the key handler read from props lands here
  // after the render rather than during it, so nothing touches a ref while
  // React is still drawing.
  React.useEffect(() => {
    stateRef.current = cube
    interactiveRef.current = interactive
    apiRef.current = api
    labelRef.current = label
    pushRef.current = push
    controlsRef.current = controls
  })
  const grabbed = React.useRef<{
    face: CubeFace
    cubie: Cubie
    origin: THREE.Vector3
  } | null>(null)

  useFrame((state, delta) => {
    if (paused) return
    const dt = Math.min(0.05, delta)
    const reduced = prefersReducedMotion()
    clock.current += dt

    // A queued move outranks the behaviour, and the behaviour only runs when
    // nothing is driving: no controlled algorithm, no hand on the cube.
    if (!active.current) {
      if (!queue.current.length && !controlled && !grabbed.current && animate && !reduced) {
        const step = puzzleCubeStep(behavior, clock.current, speed * 0.55)
        if (step > stepsTaken.current) {
          stepsTaken.current = step
          const move = puzzleCubeMove(behavior, step - 1, n, seed)
          if (move) push(move)
        }
      }
      const next = queue.current.shift()
      if (next) {
        active.current = {
          turn: moveToTurn(next.move, n),
          move: next.move,
          record: next.record,
          elapsed: 0,
        }
      }
    }

    let progress = 0
    if (active.current) {
      active.current.elapsed += dt
      progress = animate && !reduced ? active.current.elapsed / turnSeconds : 1
      if (progress >= 1) {
        const { turn, move, record } = active.current
        active.current = null
        progress = 0
        const next = applyTurn(stateRef.current, turn)
        stateRef.current = next
        if (record) history.current = [...history.current, move]
        setCube(next)
        onMove?.(move, next)
        onStateChange?.(next)
        if (isSolved(next)) onSolved?.()
      }
    }

    place(groups.current, stateRef.current, cell, active.current, progress)

    if (!canvas.current) {
      canvas.current = state.gl.domElement
      detach.current = attach(canvas.current, interactiveRef, apiRef, pushRef)
    }
    const element = canvas.current
    const turning = active.current
    element.dataset.cube = "puzzle-cube"
    element.dataset.cubeOrder = String(n)
    element.dataset.cubeTurning = turning ? turning.turn.axis : ""
    element.dataset.cubeSolved = String(isSolved(stateRef.current))
    element.dataset.cubeMoves = String(history.current.length)
    if (interactiveRef.current) {
      element.tabIndex = 0
      // Without this a touch drag scrolls the page instead of turning a face.
      element.style.touchAction = "none"
      element.setAttribute("role", "application")
      element.setAttribute(
        "aria-label",
        labelRef.current ??
          `${n} by ${n} puzzle cube. Drag a face to turn that layer, or type a move: U, D, L, R, F, B, with shift for anticlockwise.`,
      )
    }
  })

  /* -------------------------------------------------------- the keyboard */

  React.useEffect(() => () => detach.current?.(), [])

  /* ------------------------------------------------------------ drawing */

  const half = (n - 1) / 2
  const solvedNow = isSolved(cube)
  const body = variant === "outline" ? colors.metal : colors.dark
  const wireframe = variant === "wire" || variant === "blueprint"
  const stickerInset = cell * 0.08
  const stickerSize = cell * 0.84
  const bodySize = cell * 0.97

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
    <group position={position} rotation={rotation} scale={scale}>
      {home.map(({ cubie, index, faces }) => (
        <group
          key={index}
          ref={(element) => {
            groups.current[index] = element
          }}
          position={[(cubie.i - half) * cell, (cubie.j - half) * cell, (cubie.k - half) * cell]}
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
                  grabbed.current = {
                    face,
                    cubie: stateRef.current.cubies[index],
                    origin: event.point.clone(),
                  }
                  if (orbit) (orbit as { enabled?: boolean }).enabled = false
                  const target = event.target as Element & {
                    setPointerCapture?: (id: number) => void
                  }
                  target.setPointerCapture?.(event.pointerId)
                }
              : undefined
          }
          onPointerMove={
            interactive
              ? (event) => {
                  const grab = grabbed.current
                  if (!grab) return
                  event.stopPropagation()
                  const travel = SCRATCH_VECTOR.copy(event.point).sub(grab.origin)
                  // A turn per drag: below a third of a cubie it is still a
                  // press, above it the layer commits and the hand lets go.
                  if (travel.length() < cell * 0.35) return
                  const move = moveFromDrag({
                    face: grab.face,
                    cubie: grab.cubie,
                    direction: [travel.x, travel.y, travel.z],
                    order: n,
                  })
                  grabbed.current = null
                  if (orbit) (orbit as { enabled?: boolean }).enabled = true
                  if (move) push(move)
                }
              : undefined
          }
          onPointerUp={
            interactive
              ? () => {
                  grabbed.current = null
                  if (orbit) (orbit as { enabled?: boolean }).enabled = true
                }
              : undefined
          }
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={[bodySize, bodySize, bodySize]} />
            <meshStandardMaterial
              color={body}
              roughness={0.62}
              metalness={variant === "outline" ? 0.5 : 0.08}
              wireframe={wireframe}
            />
          </mesh>
          {faces.map((face) => {
            const normal = faceNormals[face]
            return (
              <mesh
                key={face}
                position={[
                  normal[0] * (bodySize / 2 + stickerInset * 0.2),
                  normal[1] * (bodySize / 2 + stickerInset * 0.2),
                  normal[2] * (bodySize / 2 + stickerInset * 0.2),
                ]}
                rotation={stickerRotation(face)}
                renderOrder={1}
              >
                <planeGeometry args={[stickerSize, stickerSize]} />
                <meshStandardMaterial
                  color={variant === "blueprint" ? colors.accent : colors.faces[face]}
                  roughness={0.42}
                  metalness={0.05}
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
 * Type moves at the cube. The canvas is what has the focus, so it is what
 * listens; every handler reads its refs so the binding never has to be redone.
 */
function attach(
  element: HTMLCanvasElement,
  interactive: React.RefObject<boolean>,
  api: React.RefObject<PuzzleCubeApi>,
  push: React.RefObject<(move: CubeMove | string) => void>,
) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (!interactive.current) return
    const letter = event.key.toUpperCase()
    if (cubeFaces.includes(letter as CubeFace)) {
      push.current({ face: letter as CubeFace, layer: 0, turns: event.shiftKey ? 3 : 1 })
    } else if (letter === "S") {
      api.current.scramble()
    } else if (event.key === "Backspace") {
      api.current.undo()
    } else if (event.key === "Escape") {
      api.current.reset()
    } else {
      return
    }
    event.preventDefault()
  }
  element.addEventListener("keydown", onKeyDown)
  return () => element.removeEventListener("keydown", onKeyDown)
}

/* -------------------------------------------------------------------------- */
/* placement                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Put every cubie where the state says, and carry the slice that is mid-turn
 * round with it. Rotating position and orientation by the same partial
 * rotation is what makes a turn one rigid body rather than 9 sliding tiles.
 */
function place(
  groups: (THREE.Group | null)[],
  state: CubeState,
  cell: number,
  active: { turn: CubeTurn } | null,
  progress: number,
) {
  const half = (state.order - 1) / 2
  const eased = puzzleCubeEase(progress)
  let partial: THREE.Quaternion | null = null
  if (active) {
    const axis = AXIS_VECTORS[active.turn.axis] ?? AXIS_VECTORS.y
    partial = SCRATCH_QUATERNION.setFromAxisAngle(
      SCRATCH_AXIS.copy(axis),
      (active.turn.quarterTurns * Math.PI) / 2 * eased,
    )
  }

  for (let index = 0; index < state.cubies.length; index++) {
    const group = groups[index]
    if (!group) continue
    const cubie = state.cubies[index]
    group.position.set((cubie.i - half) * cell, (cubie.j - half) * cell, (cubie.k - half) * cell)
    const m = cubie.orientation
    SCRATCH_MATRIX.set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1)
    group.quaternion.setFromRotationMatrix(SCRATCH_MATRIX)

    if (!partial || !inActiveSlice(cubie, active!.turn)) continue
    group.position.applyQuaternion(partial)
    group.quaternion.premultiply(partial)
  }
}

const inActiveSlice = (cubie: Cubie, turn: CubeTurn) =>
  (turn.axis === "x" ? cubie.i : turn.axis === "y" ? cubie.j : cubie.k) === turn.slice

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

export { PuzzleCube }
