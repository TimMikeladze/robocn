import { describe, expect, it } from "vitest"

import {
  applyMove,
  applyMoves,
  createCube,
  cubeFaces,
  exposedFaces,
  formatAlgorithm,
  formatMove,
  grabFromDrag,
  invertMoves,
  isSolved,
  moveFromDrag,
  moveToTurn,
  parseAlgorithm,
  parseMove,
  rotationMatrix,
  scrambleMoves,
  shellCubies,
  simplifyMoves,
  solveCube,
  solveStep,
  stickerFace,
  turnToMove,
  type CubeFace,
} from "@/lib/robocn/cube"

const R = parseMove("R")!

describe("cube", () => {
  it("starts solved, with a cubie per lattice cell and a shell around it", () => {
    const cube = createCube(3)

    expect(cube.cubies).toHaveLength(27)
    expect(shellCubies(cube)).toHaveLength(26)
    expect(isSolved(cube)).toBe(true)
  })

  it("is not solved after one turn, and is again after four", () => {
    let cube = createCube()
    cube = applyMove(cube, R)
    expect(isSolved(cube)).toBe(false)

    for (let i = 0; i < 3; i++) cube = applyMove(cube, R)
    expect(isSolved(cube)).toBe(true)
  })

  it("comes home after six repeats of the sexy move, exactly", () => {
    // (R U R' U') has order 6. Nothing but exact integer state survives this.
    const algorithm = parseAlgorithm("R U R' U'")
    let cube = createCube()
    for (let i = 0; i < 6; i++) cube = applyMoves(cube, algorithm)

    expect(isSolved(cube)).toBe(true)
  })

  it("undoes any scramble with its own inverse", () => {
    const scramble = scrambleMoves(3, 25, 7)
    const cube = applyMoves(createCube(), scramble)

    expect(isSolved(cube)).toBe(false)
    expect(isSolved(applyMoves(cube, invertMoves(scramble)))).toBe(true)
  })

  it("scrambles the same way for a seed and differently for another", () => {
    expect(formatAlgorithm(scrambleMoves(3, 10, 4))).toBe(
      formatAlgorithm(scrambleMoves(3, 10, 4)),
    )
    expect(formatAlgorithm(scrambleMoves(3, 10, 4))).not.toBe(
      formatAlgorithm(scrambleMoves(3, 10, 5)),
    )
  })

  it("never repeats a face back to back in a scramble", () => {
    const moves = scrambleMoves(3, 40, 11)
    for (let i = 1; i < moves.length; i++) {
      expect(moves[i].face).not.toBe(moves[i - 1].face)
    }
  })

  it("turns a face clockwise seen from outside, on every face", () => {
    // R takes the U sticker of the top-front-right corner onto the B face; the
    // sign convention is the one bug that makes a cube unsolvable, so all six.
    const expected: Record<CubeFace, number> = { U: -1, D: 1, L: 1, R: -1, F: -1, B: 1 }
    for (const face of cubeFaces) {
      const turn = moveToTurn({ face, layer: 0, turns: 1 }, 3)
      expect(Math.sign(turn.quarterTurns === 3 ? -1 : turn.quarterTurns)).toBe(
        expected[face],
      )
    }
  })

  it("round-trips a move through the renderer's turn and back", () => {
    for (const face of cubeFaces) {
      for (const turns of [1, 2, 3]) {
        const move = { face, layer: 0, turns }
        expect(turnToMove(moveToTurn(move, 3), 3)).toEqual(move)
      }
    }
  })

  it("moves a sticker to the face the turn points it at", () => {
    const cube = applyMove(createCube(), R)
    // The top-right-front cubie: its U sticker has gone to the back face.
    const cubie = cube.cubies.find((entry) => entry.i === 2 && entry.j === 2 && entry.k === 0)!

    expect(exposedFaces(cubie, 3)).toContain("U")
    expect(stickerFace(cubie, "U")).toBe("F")
  })

  it("reads a drag as the layer a hand expects to turn", () => {
    // Dragging the right-hand column of the front face upward is R — a face
    // turns about its own normal, so it is never the face you grabbed.
    const up = moveFromDrag({
      face: "F",
      cubie: { i: 2, j: 1, k: 2 },
      direction: [0.02, 0.6, -0.05],
      order: 3,
    })
    expect(up).toEqual({ face: "R", layer: 0, turns: 1 })

    // The same drag downward is the same layer the other way.
    const down = moveFromDrag({
      face: "F",
      cubie: { i: 2, j: 1, k: 2 },
      direction: [0, -0.6, 0],
      order: 3,
    })
    expect(down).toEqual({ face: "R", layer: 0, turns: 3 })
  })

  it("turns the middle slice when the middle is what was grabbed", () => {
    expect(
      moveFromDrag({ face: "F", cubie: { i: 1, j: 1, k: 2 }, direction: [0, 0.5, 0], order: 3 }),
    ).toEqual({ face: "L", layer: 1, turns: 3 })
  })

  it("reads a drag across the front face as a U-family turn on the grabbed row", () => {
    const move = moveFromDrag({
      face: "F",
      cubie: { i: 1, j: 2, k: 2 },
      direction: [0.5, 0.01, 0],
      order: 3,
    })
    expect(move).toEqual({ face: "U", layer: 0, turns: 3 })
  })

  it("refuses a drag with no direction in the face rather than inventing one", () => {
    expect(
      moveFromDrag({ face: "R", cubie: { i: 2, j: 1, k: 1 }, direction: [0, 0, 0], order: 3 }),
    ).toBeNull()
    // Straight out of the face: all normal, nothing in the plane.
    expect(
      moveFromDrag({ face: "R", cubie: { i: 2, j: 1, k: 1 }, direction: [0.4, 0, 0], order: 3 }),
    ).toBeNull()
    expect(
      moveFromDrag({
        face: "R",
        cubie: { i: 2, j: 1, k: 1 },
        direction: [Number.NaN, 1, 0],
        order: 3,
      }),
    ).toBeNull()
  })

  it("parses and writes the notation people actually type", () => {
    expect(parseMove("U'")).toEqual({ face: "U", layer: 0, turns: 3 })
    expect(parseMove("F2")).toEqual({ face: "F", layer: 0, turns: 2 })
    expect(parseMove("2R")).toEqual({ face: "R", layer: 1, turns: 1 })
    expect(parseMove("nonsense")).toBeNull()
    expect(formatAlgorithm(parseAlgorithm("R U2 L' 2D x"))).toBe("R U2 L' 2D")
  })

  it("survives rubbish without throwing or corrupting the lattice", () => {
    const cube = applyMoves(createCube(Number.NaN), [
      // @ts-expect-error — a stale move from a consumer should degrade, not throw.
      { face: "X", layer: Number.NaN, turns: Number.POSITIVE_INFINITY },
    ])

    expect(cube.order).toBe(3)
    for (const cubie of cube.cubies) {
      expect(Number.isInteger(cubie.i) && Number.isInteger(cubie.j) && Number.isInteger(cubie.k)).toBe(true)
    }
  })

  it("works at other orders, not only three", () => {
    for (const order of [2, 4, 5]) {
      const cube = createCube(order)
      expect(cube.cubies).toHaveLength(order ** 3)
      const scramble = scrambleMoves(order, 20, 3)
      const scrambled = applyMoves(cube, scramble)
      expect(isSolved(scrambled)).toBe(false)
      expect(isSolved(applyMoves(scrambled, invertMoves(scramble)))).toBe(true)
    }
  })

  it("winds a drag as well as answering it: same turn, plus the tangent to pull along", () => {
    const grab = grabFromDrag({
      face: "R",
      cubie: { i: 2, j: 1, k: 1 },
      direction: [0, 1, 0],
      order: 3,
    })

    expect(grab).not.toBeNull()
    expect(grab!.move).toEqual(moveFromDrag({
      face: "R",
      cubie: { i: 2, j: 1, k: 1 },
      direction: [0, 1, 0],
      order: 3,
    }))
    // Dragging up the right face pulls along +y, and turns about z.
    expect(grab!.tangent).toEqual([0, 1, 0])
    expect(grab!.turn.axis).toBe("z")
    expect(grab!.turn.slice).toBe(1)
  })

  it("cancels and fuses a line rather than playing it back move for move", () => {
    expect(formatAlgorithm(simplifyMoves(parseAlgorithm("R R'")))).toBe("")
    expect(formatAlgorithm(simplifyMoves(parseAlgorithm("R R")))).toBe("R2")
    expect(formatAlgorithm(simplifyMoves(parseAlgorithm("R R R R")))).toBe("")
    expect(formatAlgorithm(simplifyMoves(parseAlgorithm("R U U' R2")))).toBe("R'")
    // A different layer of the same face is a different move, and stays.
    expect(formatAlgorithm(simplifyMoves(parseAlgorithm("R 2R")))).toBe("R 2R")
  })

  it("solves a cube it is handed, and the line is the thing that solves it", () => {
    for (const seed of [1, 7, 31, 404, 9001]) {
      const scramble = scrambleMoves(3, 30, seed)
      const scrambled = applyMoves(createCube(3), scramble)
      const line = solveCube(scrambled)

      expect(line, `seed ${seed}`).not.toBeNull()
      expect(isSolved(applyMoves(scrambled, line!))).toBe(true)
      // Every move of it is a move a person could write down and play.
      for (const move of line!) {
        expect(parseMove(formatMove(move))).toEqual(move)
      }
    }
  })

  it("costs nothing on a solved cube, and hints the first move of the line", () => {
    expect(solveCube(createCube(3))).toEqual([])
    expect(solveStep(createCube(3))).toBeNull()

    const scrambled = applyMoves(createCube(3), scrambleMoves(3, 12, 5))
    expect(solveStep(scrambled)).toEqual(solveCube(scrambled)![0])
  })

  it("says no rather than guessing on a cube the method does not cover", () => {
    expect(solveCube(applyMoves(createCube(4), scrambleMoves(4, 10, 2)))).toBeNull()
    expect(solveCube(createCube(2))).toBeNull()
    // @ts-expect-error — a consumer holding rubbish gets null, not a throw.
    expect(solveCube(null)).toBeNull()
  })

  it("calls a cube solved when every sticker is home, spun centres and all", () => {
    // Four U turns is the identity; one is not, and neither is any of them
    // reported as solved by luck.
    let cube = createCube(3)
    for (let turn = 0; turn < 3; turn++) {
      cube = applyMove(cube, { face: "U", layer: 0, turns: 1 })
      expect(isSolved(cube)).toBe(false)
    }
    expect(isSolved(applyMove(cube, { face: "U", layer: 0, turns: 1 }))).toBe(true)

    // A centre spun about its own normal shows the same square, so a cube
    // whose stickers all match is solved even though that matrix is not the
    // identity. Spin the U centre a quarter turn in place and ask.
    const spun = createCube(3)
    const centre = spun.cubies.find((cubie) => cubie.i === 1 && cubie.j === 2 && cubie.k === 1)!
    centre.orientation = rotationMatrix("y", 1)

    expect(centre.orientation).not.toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1])
    expect(isSolved(spun)).toBe(true)
    expect(stickerFace(centre, "U")).toBe("U")
    // An edge spun in place is a different matter: its stickers stop matching.
    const edge = spun.cubies.find((cubie) => cubie.i === 1 && cubie.j === 2 && cubie.k === 2)!
    edge.orientation = rotationMatrix("y", 1)
    expect(isSolved(spun)).toBe(false)
  })

  it("solves a cube whose middle slices have been turned, centres and all", () => {
    // A middle-slice turn moves the centres, so the cube is no longer sitting
    // in the frame its face names were written in. The solver turns it round
    // in its head and writes the answer back out in the caller's frame.
    for (const seed of [2, 19, 77]) {
      const scramble = [
        ...scrambleMoves(3, 12, seed),
        ...parseAlgorithm("2R 2U' 2F 2R'"),
        ...scrambleMoves(3, 8, seed + 1),
      ]
      const scrambled = applyMoves(createCube(3), scramble)
      const line = solveCube(scrambled)

      expect(line, `seed ${seed}`).not.toBeNull()
      // No slice moves in the answer: a solve is face turns, and the cube ends
      // up wherever the slices left it — every face one colour.
      expect(line!.every((move) => move.layer === 0)).toBe(true)
      expect(isSolved(applyMoves(scrambled, line!))).toBe(true)
    }
  })

  it("calls a cube in your hands solved however it is being held", () => {
    // A whole-cube rotation is four turns of the same axis, layer by layer.
    const turned = applyMoves(createCube(3), parseAlgorithm("U 2U D' U 2U D'"))
    expect(isSolved(turned)).toBe(true)
    // But it is genuinely turned: the piece from the top-front is elsewhere.
    expect(turned.cubies[slotIndex(1, 2, 2)]).not.toMatchObject({ i: 1, j: 2, k: 2 })
    expect(isSolved(applyMove(turned, { face: "R", layer: 0, turns: 1 }))).toBe(false)
  })

  it("takes the short way back when the cube is only a few turns from home", () => {
    // Five turns of fiddling should cost five moves, not the hundred and
    // thirty a layer-by-layer method would happily spend.
    const near = applyMoves(createCube(3), parseAlgorithm("R U F L D"))
    const line = solveCube(near)

    expect(line).not.toBeNull()
    expect(line!.length).toBe(5)
    expect(isSolved(applyMoves(near, line!))).toBe(true)
  })
})

/** The array index of a home cell, which is the piece that lives there. */
const slotIndex = (i: number, j: number, k: number) => i * 9 + j * 3 + k
