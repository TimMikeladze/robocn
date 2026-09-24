/**
 * cube — an N×N×N twisty puzzle as state, not as a pose.
 *
 * Every other solver in the set answers "where do the joints go for this
 * target". A twisty cube has no target: its whole configuration is a
 * permutation, and the only continuous quantity is how far through a turn it
 * currently is. So the state here is a lattice of cubies, each carrying an
 * integer orientation matrix, and a move is one exact matrix multiply — no
 * floating point ever enters the state, and `isSolved` is "every orientation
 * is the identity" rather than a string compare. Notes: `docs/rubiks-cube.md`.
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

/**
 * Solved is what a person holding one means by solved: **every face one
 * colour**. Not "every orientation is the identity", and not even "every
 * sticker shows its own face" — both of those call a cube unsolved that
 * nobody would, because both count things you cannot see. A centre spun about
 * its own normal shows the same square; a cube turned round in your hands, or
 * one whose middle slices have been turned, has its whites somewhere else and
 * is still solved.
 *
 * It is no weaker for it: nine stickers of each colour means two faces cannot
 * show the same one, so six uniform faces is a solved cube. And it is exact —
 * integer comparisons through `stickerFace`, never a tolerance.
 */
export function isSolved(state: CubeState): boolean {
  const cubies = state?.cubies
  if (!cubies?.length) return false
  const shown: Partial<Record<CubeFace, CubeFace>> = {}
  for (const cubie of cubies) {
    for (const face of exposedFaces(cubie, state.order)) {
      const shows = stickerFace(cubie, face)
      const seen = shown[face]
      if (seen === undefined) shown[face] = shows
      else if (seen !== shows) return false
    }
  }
  return true
}

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

export interface CubeGrab {
  /** The turn the drag is winding on. */
  turn: CubeTurn
  /** The same thing as a person would write it. */
  move: CubeMove
  /** The unit direction along which travel winds `turn` forwards. */
  tangent: readonly [number, number, number]
}

/**
 * The whole drag, not just its answer: the turn it is winding, and the
 * direction the hand has to keep pulling to keep winding it.
 *
 * The drag is projected onto the two axes in the plane of the grabbed face,
 * the dominant one is taken, and the rotation axis is its cross product with
 * the face normal — so dragging up the right-hand face lifts that column,
 * whichever way the camera happens to be pointing. A rig that follows the
 * pointer rather than snapping at a threshold needs the tangent as well, and
 * it is the same geometry, so it comes from here rather than being re-derived
 * against a camera. Null when the drag has no direction in the face's plane.
 */
export function grabFromDrag(drag: CubeDrag): CubeGrab | null {
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
  const turn: CubeTurn = { axis: turnAxis, slice, quarterTurns }
  return { turn, move: turnToMove(turn, n), tangent: along }
}

/** The turn a drag across a face asks for, and nothing else. */
export const moveFromDrag = (drag: CubeDrag): CubeMove | null =>
  grabFromDrag(drag)?.move ?? null

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

/* --------------------------------------------------------------- solving */

/**
 * A layer-by-layer solve, and the only part of this file that searches.
 *
 * The method is the beginner's one — cross, first-layer corners, middle
 * edges, last-layer cross, twist, place — but it is not written as a hundred
 * hand-cased positions. Each stage is an iterative-deepening search a few
 * symbols deep over an alphabet of *macros*: the U turns, plus one standard
 * algorithm rotated into each of the four side slots. A small search over big
 * steps, rather than a big search over small ones.
 *
 * The search runs on a packed encoding — where each piece sits (0 … 26) and
 * which of the 24 rotations it carries — so a turn is 27 table lookups and no
 * allocation. `solveCube` decodes nothing back until the end, replays the
 * answer through `applyMoves`, and returns `null` unless that replay comes
 * home. It never returns a line it has not checked.
 */

/** The eighteen face turns of a 3×3, in a fixed order the tables index by. */
const basicMoves: CubeMove[] = cubeFaces.flatMap((face) =>
  [1, 2, 3].map((turns) => ({ face, layer: 0, turns })),
)

/** The 24 orientations a cubie can carry, identity first. */
const orientations: CubeMatrix[] = (() => {
  const key = (m: CubeMatrix) => m.join(",")
  const list: CubeMatrix[] = [identityMatrix]
  const seen = new Set([key(identityMatrix)])
  const generators = [
    rotationMatrix("x", 1),
    rotationMatrix("y", 1),
    rotationMatrix("z", 1),
  ]
  for (let index = 0; index < list.length; index++) {
    for (const generator of generators) {
      const next = multiplyMatrix(generator, list[index])
      if (seen.has(key(next))) continue
      seen.add(key(next))
      list.push(next)
    }
  }
  return list
})()

const orientationIndex = new Map(orientations.map((m, index) => [m.join(","), index]))

/** Is this orientation's own +y still pointing at the world's +y? */
const upright: boolean[] = orientations.map((m) => m[1] === 0 && m[4] === 1 && m[7] === 0)

/** Lattice cell ↔ slot number, for a 3×3. A piece's home slot is its index. */
const slotOf = (i: number, j: number, k: number) => i * 9 + j * 3 + k

/** Per move: where each slot goes, how an orientation turns, which slots move. */
const moveTables = basicMoves.map((move) => {
  const turn = moveToTurn(move, 3)
  const rotation = rotationMatrix(turn.axis, turn.quarterTurns)
  const slots = new Uint8Array(27)
  const moved = new Uint8Array(27)
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        const slot = slotOf(i, j, k)
        const here = { i, j, k, orientation: identityMatrix }
        if (!inTurn(here, turn)) {
          slots[slot] = slot
          continue
        }
        const [x, y, z] = applyMatrix(rotation, [
          centred(i, 3),
          centred(j, 3),
          centred(k, 3),
        ])
        slots[slot] = slotOf(uncentred(x, 3), uncentred(y, 3), uncentred(z, 3))
        moved[slot] = 1
      }
    }
  }
  const turns = new Uint8Array(24)
  for (let index = 0; index < 24; index++) {
    turns[index] =
      orientationIndex.get(multiplyMatrix(rotation, orientations[index]).join(",")) ?? index
  }
  return { slots, moved, turns }
})

/** The face a unit normal points at, or null. */
const faceFromNormal = (normal: readonly [number, number, number]): CubeFace | null => {
  for (const face of cubeFaces) {
    const [x, y, z] = faceNormals[face]
    if (normal[0] === x && normal[1] === y && normal[2] === z) return face
  }
  return null
}

/**
 * The 24 ways a whole cube can sit in your hands, as remaps of the packed
 * form. Turning a middle slice moves the centres, and a cube whose centres
 * have moved cannot be solved by face turns in the frame it is sitting in —
 * so the solver turns the *cube* first, in its head, and writes the answer
 * back out in the frame you are holding.
 */
const wholeRotations = orientations.map((matrix) => {
  const slots = new Uint8Array(27)
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        const [x, y, z] = applyMatrix(matrix, [centred(i, 3), centred(j, 3), centred(k, 3)])
        slots[slotOf(i, j, k)] = slotOf(uncentred(x, 3), uncentred(y, 3), uncentred(z, 3))
      }
    }
  }
  const turns = new Uint8Array(24)
  for (let index = 0; index < 24; index++) {
    turns[index] =
      orientationIndex.get(multiplyMatrix(matrix, orientations[index]).join(",")) ?? index
  }
  // Where each face ends up, and the way back — which is what writes a move
  // found in the turned frame back into the one the caller is holding.
  const faceTo = {} as Record<CubeFace, CubeFace>
  const faceBack = {} as Record<CubeFace, CubeFace>
  for (const face of cubeFaces) {
    const moved = faceFromNormal(applyMatrix(matrix, faceNormals[face])) ?? face
    faceTo[face] = moved
    faceBack[moved] = face
  }
  return { slots, turns, faceBack }
})

/** Where every piece is and which way it points, as two flat arrays. */
interface PackedCube {
  /** `slot[p]` — the slot piece `p` currently occupies. `p` is its home slot. */
  slot: Uint8Array
  /** `spin[p]` — its orientation, as an index into the 24. 0 is home. */
  spin: Uint8Array
}

const packCube = (state: CubeState): PackedCube => {
  const slot = new Uint8Array(27)
  const spin = new Uint8Array(27)
  state.cubies.forEach((cubie, piece) => {
    slot[piece] = slotOf(cubie.i, cubie.j, cubie.k)
    spin[piece] = orientationIndex.get(cubie.orientation.join(",")) ?? 0
  })
  return { slot, spin }
}

/** One face turn, in place. Each piece is read and written on its own, so it is safe. */
function turnPacked(cube: PackedCube, move: number) {
  const table = moveTables[move]
  for (let piece = 0; piece < 27; piece++) {
    const at = cube.slot[piece]
    if (!table.moved[at]) continue
    cube.slot[piece] = table.slots[at]
    cube.spin[piece] = table.turns[cube.spin[piece]]
  }
}

/* ----------------------------------------------------------- the alphabet */

/** The four side faces in the order a turn about the U axis cycles them. */
const sideFaces: CubeFace[] = ["F", "R", "B", "L"]

/** The same algorithm, rotated `k` quarter turns about the U–D axis. */
const yaw = (moves: CubeMove[], k: number): CubeMove[] =>
  moves.map((move) => {
    const side = sideFaces.indexOf(move.face)
    return side < 0 ? move : { ...move, face: sideFaces[(side + k) % 4] }
  })

const moveNumber = new Map(
  basicMoves.map((move, index) => [`${move.face}${move.turns}`, index]),
)

const asMacro = (moves: CubeMove[]): number[] =>
  moves.map((move) => moveNumber.get(`${move.face}${move.turns}`) as number)

/** A symbol the stage search may play: a macro, and what it must not repeat. */
interface CubeSymbol {
  moves: number[]
  /** Two symbols of the same group never run back to back — they'd merge. */
  group: string | null
}

const uTurns: CubeSymbol[] = [1, 2, 3].map((turns) => ({
  moves: asMacro([{ face: "U", layer: 0, turns }]),
  group: "U",
}))

const everyFaceTurn: CubeSymbol[] = basicMoves.map((move, index) => ({
  moves: [index],
  group: move.face,
}))

/** One algorithm at all four side slots. */
const atEverySlot = (text: string): CubeSymbol[] => {
  const moves = parseAlgorithm(text)
  return [0, 1, 2, 3].map((k) => ({ moves: asMacro(yaw(moves, k)), group: null }))
}

const sexyMove = atEverySlot("R U R' U'")
/** The short corner inserts, which is what a first layer is actually built from. */
const cornerInserts = [
  "R U R'", "R U' R'", "R U2 R'",
  "F' U F", "F' U' F", "F' U2 F",
].flatMap(atEverySlot)
const rightInsert = atEverySlot("U R U' R' U' F' U F")
const leftInsert = atEverySlot("U' L' U L U F U' F'")
const crossAlgorithm = atEverySlot("F R U R' U' F'")
const sune = [
  ...atEverySlot("R U R' U R U2 R'"),
  ...atEverySlot("R U2 R' U' R U' R'"),
]
const cornerCycle = atEverySlot("U R U' L' U R' U' L")
const edgeCycle = [
  ...atEverySlot("R U' R U R U R U' R' U' R2"),
  ...atEverySlot("R2 U R U R' U' R' U' R' U R'"),
]

/* ------------------------------------------------------------- the stages */

const edgeAt = (i: number, j: number, k: number) => slotOf(i, j, k)

const downEdges = [edgeAt(1, 0, 2), edgeAt(2, 0, 1), edgeAt(1, 0, 0), edgeAt(0, 0, 1)]
const downCorners = [slotOf(2, 0, 2), slotOf(2, 0, 0), slotOf(0, 0, 0), slotOf(0, 0, 2)]
const middleEdges = [slotOf(2, 1, 2), slotOf(2, 1, 0), slotOf(0, 1, 0), slotOf(0, 1, 2)]
const upEdges = [edgeAt(1, 2, 2), edgeAt(2, 2, 1), edgeAt(1, 2, 0), edgeAt(0, 2, 1)]
const upCorners = [slotOf(2, 2, 2), slotOf(2, 2, 0), slotOf(0, 2, 0), slotOf(0, 2, 2)]
/** The six face centres, which is what says which way round the cube is. */
const cubeCentres = [
  slotOf(0, 1, 1), slotOf(2, 1, 1),
  slotOf(1, 0, 1), slotOf(1, 2, 1),
  slotOf(1, 1, 0), slotOf(1, 1, 2),
]

const homeYet = (cube: PackedCube, pieces: number[]) =>
  pieces.every((piece) => cube.slot[piece] === piece && cube.spin[piece] === 0)

const placedYet = (cube: PackedCube, pieces: number[]) =>
  pieces.every((piece) => cube.slot[piece] === piece)

const uprightYet = (cube: PackedCube, pieces: number[]) =>
  pieces.every((piece) => upright[cube.spin[piece]])

interface CubeStage {
  /**
   * Tried in order. A first pass over many short algorithms finds the tidy
   * answer nearly every time; the fallback is a small alphabet searched deep,
   * which always has one but spends moves to get it.
   */
  tiers: { alphabet: CubeSymbol[]; depth: number }[]
  done: (cube: PackedCube) => boolean
}

/**
 * The method, in order. Each stage's goal carries every earlier stage's, so a
 * search cannot buy one piece by spending another.
 */
function stages(): CubeStage[] {
  const list: CubeStage[] = []
  const firstLayer = [...downEdges, ...downCorners]
  const twoLayers = [...firstLayer, ...middleEdges]

  downEdges.forEach((_, count) => {
    const wanted = downEdges.slice(0, count + 1)
    list.push({
      tiers: [{ alphabet: everyFaceTurn, depth: 6 }],
      done: (cube) => homeYet(cube, wanted),
    })
  })
  downCorners.forEach((_, count) => {
    const wanted = [...downEdges, ...downCorners.slice(0, count + 1)]
    list.push({
      tiers: [
        { alphabet: [...uTurns, ...cornerInserts], depth: 3 },
        { alphabet: [...uTurns, ...sexyMove], depth: 8 },
      ],
      done: (cube) => homeYet(cube, wanted),
    })
  })
  middleEdges.forEach((_, count) => {
    const wanted = [...firstLayer, ...middleEdges.slice(0, count + 1)]
    list.push({
      tiers: [{ alphabet: [...uTurns, ...rightInsert, ...leftInsert], depth: 6 }],
      done: (cube) => homeYet(cube, wanted),
    })
  })
  list.push({
    tiers: [{ alphabet: [...uTurns, ...crossAlgorithm], depth: 5 }],
    done: (cube) => homeYet(cube, twoLayers) && uprightYet(cube, upEdges),
  })
  list.push({
    tiers: [{ alphabet: [...uTurns, ...sune], depth: 6 }],
    done: (cube) =>
      homeYet(cube, twoLayers) && uprightYet(cube, upEdges) && uprightYet(cube, upCorners),
  })
  list.push({
    tiers: [{ alphabet: [...uTurns, ...cornerCycle], depth: 5 }],
    done: (cube) =>
      homeYet(cube, twoLayers) &&
      uprightYet(cube, upEdges) &&
      uprightYet(cube, upCorners) &&
      placedYet(cube, upCorners),
  })
  list.push({
    tiers: [{ alphabet: [...uTurns, ...edgeCycle], depth: 5 }],
    done: (cube) => homeYet(cube, [...twoLayers, ...upEdges, ...upCorners]),
  })
  return list
}

/* ------------------------------------------------------------- the search */

/** Iterative deepening over one alphabet. Move numbers, or null. */
function searchTier(
  cube: PackedCube,
  done: (cube: PackedCube) => boolean,
  alphabet: CubeSymbol[],
  depth: number,
): number[] | null {
  if (done(cube)) return []
  // One scratch cube per level, reused: the search allocates nothing per node.
  const levels = Array.from({ length: depth + 1 }, () => ({
    slot: new Uint8Array(27),
    spin: new Uint8Array(27),
  }))
  levels[0].slot.set(cube.slot)
  levels[0].spin.set(cube.spin)
  const played: CubeSymbol[] = []

  const walk = (level: number, left: number): boolean => {
    if (!left) return false
    const here = levels[level]
    const next = levels[level + 1]
    for (const symbol of alphabet) {
      if (symbol.group && symbol.group === played[level - 1]?.group) continue
      next.slot.set(here.slot)
      next.spin.set(here.spin)
      for (const move of symbol.moves) turnPacked(next, move)
      played[level] = symbol
      if (done(next)) {
        played.length = level + 1
        return true
      }
      if (walk(level + 1, left - 1)) return true
    }
    return false
  }

  for (let limit = 1; limit <= depth; limit++) {
    played.length = 0
    if (walk(0, limit)) return played.flatMap((symbol) => symbol.moves)
  }
  return null
}

/** The stage's tiers in order: the tidy answer first, the sure one second. */
function searchStage(cube: PackedCube, stage: CubeStage): number[] | null {
  for (const tier of stage.tiers) {
    const line = searchTier(cube, stage.done, tier.alphabet, tier.depth)
    if (line) return line
  }
  return null
}

/* ------------------------------------------------------------- the answer */

/** `R R` → `R2`, `R R'` → nothing, `R2 R2` → nothing. Same face, same layer. */
export function simplifyMoves(moves: CubeMove[]): CubeMove[] {
  const out: CubeMove[] = []
  for (const move of moves ?? []) {
    const turns = (((Math.round(move?.turns ?? 0) % 4) + 4) % 4)
    if (!turns || !cubeFaces.includes(move.face)) continue
    const last = out.at(-1)
    if (last && last.face === move.face && last.layer === move.layer) {
      out.pop()
      const merged = (last.turns + turns) % 4
      if (merged) out.push({ ...last, turns: merged })
      continue
    }
    out.push({ ...move, turns })
  }
  return out
}

/**
 * A line that takes this cube home, or `null`.
 *
 * 3×3 only — the method is the 3×3 one, and a 4×4 has parities it does not
 * know about, so every other order is honestly `null` rather than a guess.
 * The answer is replayed and checked before it is handed back.
 */
export function solveCube(state: CubeState): CubeMove[] | null {
  if (!state || state.order !== 3 || state.cubies?.length !== 27) return null
  if (isSolved(state)) return []
  const cube = packCube(state)

  // Sit the cube the right way up first: the method turns faces, and faces
  // are named by the centres they carry, so the centres have to be home
  // before any of it means anything. A legal cube always has exactly such a
  // rotation; anything else is not a cube this can solve.
  const aligned = wholeRotations.find((rotation) => {
    for (const centre of cubeCentres) {
      if (rotation.slots[cube.slot[centre]] !== centre) return false
    }
    return true
  })
  if (!aligned) return null
  for (let piece = 0; piece < 27; piece++) {
    cube.slot[piece] = aligned.slots[cube.slot[piece]]
    cube.spin[piece] = aligned.turns[cube.spin[piece]]
  }

  // A cube a few turns from home is solved *properly* rather than by the
  // method: a short exhaustive search first, so undoing five turns of
  // fiddling is five moves back and not a hundred and thirty.
  const everything = [...downEdges, ...downCorners, ...middleEdges, ...upEdges, ...upCorners]
  const short = searchTier(
    cube,
    (near) => homeYet(near, everything) && placedYet(near, cubeCentres),
    everyFaceTurn,
    5,
  )

  const found: number[] = short ?? []
  for (const stage of short ? [] : stages()) {
    const line = searchStage(cube, stage)
    if (!line) return null
    for (const move of line) turnPacked(cube, move)
    found.push(...line)
  }
  const solution = simplifyMoves(
    // Back into the frame the caller is holding: the same turn, on the face
    // that was standing where this one is now.
    found.map((move) => ({ ...basicMoves[move], face: aligned.faceBack[basicMoves[move].face] })),
  )
  return isSolved(applyMoves(state, solution)) ? solution : null
}

/** The next move of a solve — which is what a hint is. */
export const solveStep = (state: CubeState): CubeMove | null =>
  solveCube(state)?.[0] ?? null
