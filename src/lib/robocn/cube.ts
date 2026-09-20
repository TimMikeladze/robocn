/**
 * cube — an N×N×N twisty puzzle as state, not as a pose.
 *
 * Every other solver in the set answers "where do the joints go for this
 * target". A twisty cube has no target: its whole configuration is a
 * permutation, and the only continuous quantity is how far through a turn it
 * currently is. So the state here is a lattice of cubies, each carrying an
 * integer orientation matrix, and a move is one exact matrix multiply — no
 * floating point ever enters the state, and `isSolved` is "every orientation
 * is the identity" rather than a string compare. Notes: `docs/puzzle-cube.md`.
 *
 * Pure functions over plain objects. No React, no three.js, no dependencies —
 * the drag maths the r3f rig runs on is the same code the tests sample.
 */

/** The six faces, in the order the standard colour scheme lists them. */
export type CubeFace = "U" | "D" | "L" | "R" | "F" | "B"

export type CubeAxis = "x" | "y" | "z"

export const cubeFaces: CubeFace[] = ["U", "D", "L", "R", "F", "B"]

/** Outward unit normal of each face, in the rig's world axes: x right, y up, z out. */
export const faceNormals: Record<CubeFace, readonly [number, number, number]> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
}

const axisIndex: Record<CubeAxis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 }
const axisOrder: CubeAxis[] = ["x", "y", "z"]

/** The axis a face turns about, and whether its normal points up that axis. */
export const faceAxis = (face: CubeFace): CubeAxis =>
  face === "U" || face === "D" ? "y" : face === "L" || face === "R" ? "x" : "z"

const facePositive = (face: CubeFace) => face === "U" || face === "R" || face === "F"

/**
 * A 3×3 integer matrix, row-major, mapping the cubie's own axes onto the
 * world's. Integer because every entry is only ever -1, 0 or 1.
 */
export type CubeMatrix = readonly [
  number, number, number,
  number, number, number,
  number, number, number,
]

export const identityMatrix: CubeMatrix = [1, 0, 0, 0, 1, 0, 0, 0, 1]

/** One piece: where it sits on the lattice, and which way it points. */
export interface Cubie {
  /** Lattice indices, 0 … order-1 along x, y and z. */
  i: number
  j: number
  k: number
  orientation: CubeMatrix
}

export interface CubeState {
  order: number
  cubies: Cubie[]
}

/**
 * A move the way a person says it: quarter turns **clockwise looking at that
 * face from outside**, on a layer counted inward from that face.
 */
export interface CubeMove {
  face: CubeFace
  /** 0 is the face itself; 1 the layer behind it. */
  layer: number
  /** Quarter turns, 1 … 3. 3 is the same as one anticlockwise. */
  turns: number
}

/**
 * The same move the way the renderer wants it: quarter turns **right-handed
 * about the positive axis**, on a slice indexed along that axis.
 */
export interface CubeTurn {
  axis: CubeAxis
  slice: number
  quarterTurns: number
}

const clampOrder = (order: number) =>
  Number.isFinite(order) ? Math.max(2, Math.min(7, Math.round(order))) : 3

/* ----------------------------------------------------------------- matrices */

/** Right-handed rotation about `axis` by `quarterTurns` × 90°, exactly. */
export function rotationMatrix(axis: CubeAxis, quarterTurns: number): CubeMatrix {
  const q = ((Math.round(Number.isFinite(quarterTurns) ? quarterTurns : 0) % 4) + 4) % 4
  const c = [1, 0, -1, 0][q]
  const s = [0, 1, 0, -1][q]
  if (axis === "x") return [1, 0, 0, 0, c, -s, 0, s, c]
  if (axis === "y") return [c, 0, s, 0, 1, 0, -s, 0, c]
  return [c, -s, 0, s, c, 0, 0, 0, 1]
}

export function multiplyMatrix(a: CubeMatrix, b: CubeMatrix): CubeMatrix {
  const out = new Array(9).fill(0)
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 3; column++) {
      out[row * 3 + column] =
        a[row * 3] * b[column] +
        a[row * 3 + 1] * b[3 + column] +
        a[row * 3 + 2] * b[6 + column]
    }
  }
  return out as unknown as CubeMatrix
}

export function applyMatrix(
  matrix: CubeMatrix,
  vector: readonly [number, number, number],
): [number, number, number] {
  return [
    matrix[0] * vector[0] + matrix[1] * vector[1] + matrix[2] * vector[2],
    matrix[3] * vector[0] + matrix[4] * vector[1] + matrix[5] * vector[2],
    matrix[6] * vector[0] + matrix[7] * vector[1] + matrix[8] * vector[2],
  ]
}

const transpose = (m: CubeMatrix): CubeMatrix =>
  [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]] as unknown as CubeMatrix

/* -------------------------------------------------------------------- state */

/** A solved cube of `order` cubies to a side. */
export function createCube(order = 3): CubeState {
  const n = clampOrder(order)
  const cubies: Cubie[] = []
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        cubies.push({ i, j, k, orientation: identityMatrix })
      }
    }
  }
  return { order: n, cubies }
}

export const isSolved = (state: CubeState): boolean =>
  state.cubies.every(
    (cubie, index) =>
      cubie.orientation.every((value, slot) => value === identityMatrix[slot]) &&
      // A turned-but-symmetric piece still has to be *where* it started.
      index ===
        cubie.i * state.order * state.order + cubie.j * state.order + cubie.k,
  )

/** Lattice index → centred coordinate, doubled so it stays an integer. */
const centred = (index: number, order: number) => 2 * index - (order - 1)
const uncentred = (value: number, order: number) => (value + order - 1) / 2

/* -------------------------------------------------------------------- moves */

/** A person's move as the renderer's turn. */
export function moveToTurn(move: CubeMove, order: number): CubeTurn {
  const n = clampOrder(order)
  const face = cubeFaces.includes(move?.face) ? move.face : "U"
  const layer = Number.isFinite(move?.layer)
    ? Math.max(0, Math.min(n - 1, Math.round(move.layer)))
    : 0
  const turns = Number.isFinite(move?.turns) ? Math.round(move.turns) : 1
  const positive = facePositive(face)
  return {
    axis: faceAxis(face),
    slice: positive ? n - 1 - layer : layer,
    // Clockwise from outside is a negative right-handed turn about a positive
    // normal, and a positive one about a negative normal. The whole sign
    // convention of the library lives in this line.
    quarterTurns: (((positive ? -turns : turns) % 4) + 4) % 4,
  }
}

/** The renderer's turn as the move a person would write. */
export function turnToMove(turn: CubeTurn, order: number): CubeMove {
  const n = clampOrder(order)
  const axis = axisOrder.includes(turn?.axis) ? turn.axis : "y"
  const slice = Number.isFinite(turn?.slice)
    ? Math.max(0, Math.min(n - 1, Math.round(turn.slice)))
    : 0
  const quarters = (((Math.round(turn?.quarterTurns ?? 0) % 4) + 4) % 4)
  const [positiveFace, negativeFace]: [CubeFace, CubeFace] =
    axis === "x" ? ["R", "L"] : axis === "y" ? ["U", "D"] : ["F", "B"]
  // Name it after the nearer face, which is what a person would have called it.
  const fromPositive = slice >= n / 2
  return {
    face: fromPositive ? positiveFace : negativeFace,
    layer: fromPositive ? n - 1 - slice : slice,
    turns: quarters === 0 ? 0 : fromPositive ? 4 - quarters : quarters,
  }
}

/** Is this cubie in the slice the turn moves? */
export const inTurn = (cubie: Cubie, turn: CubeTurn): boolean =>
  (turn.axis === "x" ? cubie.i : turn.axis === "y" ? cubie.j : cubie.k) ===
  turn.slice

/** The state after one turn. Immutable: the previous state is untouched. */
export function applyTurn(state: CubeState, turn: CubeTurn): CubeState {
  const n = state.order
  const quarters = (((Math.round(turn?.quarterTurns ?? 0) % 4) + 4) % 4)
  if (!quarters || !axisOrder.includes(turn?.axis)) return state
  const slice = Math.max(0, Math.min(n - 1, Math.round(turn.slice)))
  const rotation = rotationMatrix(turn.axis, quarters)

  return {
    order: n,
    cubies: state.cubies.map((cubie) => {
      if (!inTurn(cubie, { ...turn, slice })) return cubie
      const position: [number, number, number] = [
        centred(cubie.i, n),
        centred(cubie.j, n),
        centred(cubie.k, n),
      ]
      const moved = applyMatrix(rotation, position)
      return {
        i: uncentred(moved[0], n),
        j: uncentred(moved[1], n),
        k: uncentred(moved[2], n),
        orientation: multiplyMatrix(rotation, cubie.orientation),
      }
    }),
  }
}

export const applyMove = (state: CubeState, move: CubeMove): CubeState =>
  applyTurn(state, moveToTurn(move, state.order))

export const applyMoves = (state: CubeState, moves: CubeMove[]): CubeState =>
  (moves ?? []).reduce(applyMove, state)

export const invertMove = (move: CubeMove): CubeMove => ({
  ...move,
  turns: (4 - ((((move?.turns ?? 1) % 4) + 4) % 4)) % 4 || 4,
})

export const invertMoves = (moves: CubeMove[]): CubeMove[] =>
  [...(moves ?? [])].reverse().map(invertMove)

/* ------------------------------------------------------------------ writing */

/** `R`, `U'`, `F2`, `2R'` — face, optional depth prefix, optional modifier. */
export function parseMove(token: string): CubeMove | null {
  const match = /^([2-7])?([UDLRFB])(['2₂]?)$/.exec((token ?? "").trim())
  if (!match) return null
  const layer = match[1] ? Number(match[1]) - 1 : 0
  const turns = match[3] === "'" ? 3 : match[3] === "" ? 1 : 2
  return { face: match[2] as CubeFace, layer, turns }
}

export function parseAlgorithm(text: string): CubeMove[] {
  return (text ?? "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(parseMove)
    .filter((move): move is CubeMove => move !== null)
}

export function formatMove(move: CubeMove): string {
  const turns = (((move?.turns ?? 1) % 4) + 4) % 4 || 4
  const suffix = turns === 1 ? "" : turns === 2 ? "2" : turns === 3 ? "'" : ""
  const depth = move.layer > 0 ? String(move.layer + 1) : ""
  return `${depth}${move.face}${suffix}`
}

export const formatAlgorithm = (moves: CubeMove[]): string =>
  (moves ?? []).map(formatMove).join(" ")

/* ---------------------------------------------------------------- scramble */

/** A deterministic 32-bit generator, so a seed always scrambles the same way. */
function generator(seed: number) {
  let value = (Number.isFinite(seed) ? Math.floor(seed) : 1) >>> 0 || 0x9e3779b9
  return () => {
    value ^= value << 13
    value >>>= 0
    value ^= value >>> 17
    value ^= value << 5
    value >>>= 0
    return value / 0x100000000
  }
}

/**
 * A scramble that reads like a scramble: never the same face twice running,
 * and never a move that only undoes the one before it.
 */
export function scrambleMoves(order = 3, count = 20, seed = 1): CubeMove[] {
  const n = clampOrder(order)
  const random = generator(seed)
  const length = Number.isFinite(count) ? Math.max(0, Math.round(count)) : 20
  const moves: CubeMove[] = []
  let previous: CubeFace | null = null
  while (moves.length < length) {
    const face = cubeFaces[Math.floor(random() * cubeFaces.length) % 6]
    if (face === previous) continue
    previous = face
    moves.push({
      face,
      layer: Math.floor(random() * Math.floor(n / 2)),
      turns: 1 + Math.floor(random() * 3),
    })
  }
  return moves
}

/* --------------------------------------------------------------- stickers */

/**
 * Which face's colour the sticker on `face` of this cubie shows. The
 * orientation maps the cubie's own axes onto the world's, and this question
 * runs the other way, so it is the transpose that is applied.
 */
export function stickerFace(cubie: Cubie, face: CubeFace): CubeFace {
  const local = applyMatrix(transpose(cubie.orientation), faceNormals[face])
  for (const candidate of cubeFaces) {
    const normal = faceNormals[candidate]
    if (
      local[0] === normal[0] &&
      local[1] === normal[1] &&
      local[2] === normal[2]
    ) {
      return candidate
    }
  }
  return face
}

/** The faces of this cubie that are on the outside of the cube. */
export function exposedFaces(cubie: Cubie, order: number): CubeFace[] {
  const n = clampOrder(order)
  const faces: CubeFace[] = []
  if (cubie.i === n - 1) faces.push("R")
  if (cubie.i === 0) faces.push("L")
  if (cubie.j === n - 1) faces.push("U")
  if (cubie.j === 0) faces.push("D")
  if (cubie.k === n - 1) faces.push("F")
  if (cubie.k === 0) faces.push("B")
  return faces
}

/** Cubies with at least one sticker showing — the only ones worth drawing. */
export const shellCubies = (state: CubeState): Cubie[] =>
  state.cubies.filter((cubie) => exposedFaces(cubie, state.order).length > 0)

/* -------------------------------------------------------------------- drag */

export interface CubeDrag {
  /** The face the pointer went down on. */
  face: CubeFace
  /** The cubie it went down on. */
  cubie: Pick<Cubie, "i" | "j" | "k">
  /** Pointer travel in world units, in the same axes as the cube. */
  direction: readonly [number, number, number]
  order: number
}

/**
 * The turn a drag across a face asks for.
 *
 * The drag is projected onto the two axes in the plane of the grabbed face,
 * the dominant one is taken, and the rotation axis is its cross product with
 * the face normal — so dragging up the right-hand face lifts that column,
 * whichever way the camera happens to be pointing. Null when the drag is too
 * small to have a direction, or rubbish.
 */
export function moveFromDrag(drag: CubeDrag): CubeMove | null {
  if (!drag || !cubeFaces.includes(drag.face)) return null
  const n = clampOrder(drag.order)
  const normal = faceNormals[drag.face]
  const direction = drag.direction ?? [0, 0, 0]
  if (!direction.every?.((value) => Number.isFinite(value))) return null

  // Everything in the face's plane; the component out of it is the camera's
  // problem, not the cube's.
  const planar = direction.map(
    (value, index) => value - normal[index] * dot(normal, direction),
  ) as [number, number, number]

  let best = -1
  let axis: CubeAxis = "x"
  for (const candidate of axisOrder) {
    const magnitude = Math.abs(planar[axisIndex[candidate]])
    if (magnitude > best) {
      best = magnitude
      axis = candidate
    }
  }
  if (best < 1e-6) return null

  const sign = Math.sign(planar[axisIndex[axis]]) || 1
  const along: [number, number, number] = [0, 0, 0]
  along[axisIndex[axis]] = sign

  // n × d: turning right-handed about this takes the sticker along the drag.
  const rotation = cross(normal, along)
  let turnAxis: CubeAxis = "x"
  for (const candidate of axisOrder) {
    if (rotation[axisIndex[candidate]] !== 0) turnAxis = candidate
  }
  const quarterTurns = rotation[axisIndex[turnAxis]] > 0 ? 1 : 3
  const cubie = drag.cubie ?? { i: 0, j: 0, k: 0 }
  const slice = Math.max(
    0,
    Math.min(
      n - 1,
      Math.round(
        turnAxis === "x" ? cubie.i : turnAxis === "y" ? cubie.j : cubie.k,
      ),
    ),
  )
  return turnToMove({ axis: turnAxis, slice, quarterTurns }, n)
}

const dot = (
  a: readonly [number, number, number],
  b: readonly [number, number, number],
) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

const cross = (
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): [number, number, number] => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
