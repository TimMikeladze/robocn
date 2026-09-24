/**
 * `puzzle-cube` is the flat sibling of `rubiks-cube`: SVG, so jsdom can mount
 * it and the drawing itself is testable, not only the clock. The state, the
 * turns and the solve are tested in `src/lib/robocn/__tests__/cube.test.ts`;
 * what is tested here is the behaviour sampling, the snap, the drawing's
 * honesty (visible stickers, no NaN) and the driver.
 */

import { act, cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import {
  PuzzleCube,
  puzzleCubeEase,
  puzzleCubeMove,
  puzzleCubeSnap,
  puzzleCubeStep,
  shadeHex,
  standardCubeFaceColors,
  type PuzzleCubeApi,
} from "@/components/ui/puzzle-cube"
import {
  applyMove,
  createCube,
  cubeFaces,
  formatMove,
  isSolved,
} from "@/lib/robocn/cube"

afterEach(cleanup)

describe("puzzle-cube", () => {
  it("steps the loop forward with the clock, and not at all when static", () => {
    expect(puzzleCubeStep("cycle", 0, 1)).toBe(0)
    expect(puzzleCubeStep("cycle", 2.4, 1)).toBe(2)
    expect(puzzleCubeStep("cycle", 2.4, 2)).toBe(4)
    expect(puzzleCubeStep("static", 9, 1)).toBe(0)
    expect(puzzleCubeStep("cycle", Number.NaN, 1)).toBe(0)
  })

  it("plays an algorithm that comes home, so the cycle is a cycle", () => {
    let cube = createCube(3)
    for (let step = 0; step < 24; step++) {
      const move = puzzleCubeMove("cycle", step)
      expect(move).not.toBeNull()
      cube = applyMove(cube, move!)
    }
    // 6 repeats of R U R' U' — 24 turns — is the identity.
    expect(isSolved(cube)).toBe(true)
  })

  it("scrambles deterministically from a seed, and differently from another", () => {
    const run = (seed: number) =>
      Array.from({ length: 12 }, (_, step) =>
        formatMove(puzzleCubeMove("scramble", step, 3, seed)!),
      ).join(" ")

    expect(run(3)).toBe(run(3))
    expect(run(3)).not.toBe(run(4))
  })

  it("makes no move when nothing should be moving", () => {
    expect(puzzleCubeMove("static", 4)).toBeNull()
    expect(puzzleCubeMove("cycle", Number.NaN)).toBeNull()
    expect(puzzleCubeMove("cycle", -2)).toBeNull()
    expect(puzzleCubeMove("solve", 3)).toBeNull()
  })

  it("eases a turn from rest to rest, and clamps rubbish", () => {
    expect(puzzleCubeEase(0)).toBe(0)
    expect(puzzleCubeEase(1)).toBe(1)
    expect(puzzleCubeEase(0.5)).toBeCloseTo(0.5, 6)
    expect(puzzleCubeEase(-4)).toBe(0)
    expect(puzzleCubeEase(9)).toBe(1)
    expect(puzzleCubeEase(Number.NaN)).toBe(0)
  })

  it("snaps a released drag to the quarter turn it is nearest, not the one it started", () => {
    const quarter = Math.PI / 2
    expect(puzzleCubeSnap(quarter * 0.2).quarters).toBe(0)
    expect(puzzleCubeSnap(quarter * 0.6).quarters).toBe(1)
    expect(puzzleCubeSnap(-quarter * 0.6).quarters).toBe(-1)
    expect(puzzleCubeSnap(quarter * 1.7).quarters).toBe(2)
    expect(puzzleCubeSnap(quarter * 0.9).angle).toBeCloseTo(quarter, 6)
    expect(puzzleCubeSnap(Number.NaN)).toEqual({ quarters: 0, angle: 0 })
    expect(puzzleCubeSnap(quarter * 12).quarters).toBe(4)
  })

  it("ships the standard scheme, one distinct colour per face", () => {
    const colors = cubeFaces.map((face) => standardCubeFaceColors[face])
    expect(colors).toHaveLength(6)
    expect(new Set(colors).size).toBe(6)
    for (const color of colors) expect(color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it("shades a hex colour and passes anything unparsable through", () => {
    expect(shadeHex("#ff0000", 0.5)).toBe("#800000")
    expect(shadeHex("#ffffff", 2)).toBe("#ffffff")
    expect(shadeHex("#102030", 0)).toBe("#000000")
    expect(shadeHex("var(--chart-1)", 0.5)).toBe("var(--chart-1)")
  })

  it("draws the visible shell cubies, and one sticker per visible face", () => {
    const { container } = render(<PuzzleCube animate={false} />)
    // A 3×3 has 26 shell cubies; the isometric view shows three whole faces,
    // and the seven cubies hidden behind them draw nothing at all.
    expect(container.querySelectorAll("[data-cubie]")).toHaveLength(19)
    expect(container.querySelectorAll("[data-sticker]")).toHaveLength(27)
    expect(container.querySelector("svg")!.getAttribute("data-cube-order")).toBe("3")
    expect(container.querySelector("svg")!.getAttribute("data-cube-solved")).toBe("true")
  })

  it("names itself, its view and its state, and never draws a NaN", () => {
    const { container, rerender } = render(<PuzzleCube animate={false} />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/3 by 3 puzzle cube/i)
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)

    // `scrambleOnMount` is initial state, so it is a fresh mount, not a rerender.
    rerender(<PuzzleCube key="scrambled" animate={false} view="front" scrambleOnMount={4} />)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("front")
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/front elevation/)
    expect(container.querySelector("svg")!.getAttribute("data-cube-solved")).toBe("false")
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("degrades to a stable drawing for a stale prop and a rubbish order", () => {
    const { container } = render(
      // @ts-expect-error — a stale prop from a consumer should degrade, not throw.
      <PuzzleCube animate={false} behavior="nonsense" order={Number.NaN} />,
    )
    expect(container.querySelector("svg")!.getAttribute("data-cube-order")).toBe("3")
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("turns a queued move into the state and the move count, without animation", async () => {
    let api: PuzzleCubeApi | undefined
    render(
      <PuzzleCube
        animate={false}
        interactive
        controls={(driver) => {
          api = driver
        }}
      />,
    )
    expect(api).toBeDefined()
    await act(async () => {
      api!.turn("R")
      await new Promise((resolve) => setTimeout(resolve, 80))
    })
    expect(api!.solved()).toBe(false)
    expect(api!.history()).toHaveLength(1)
    expect(containerMoves()).toBe("1")

    function containerMoves() {
      return document.querySelector("svg")!.getAttribute("data-cube-moves")
    }
  })

  it("types a move at the cube and solves it back home", async () => {
    let api: PuzzleCubeApi | undefined
    render(
      <PuzzleCube
        animate={false}
        interactive
        controls={(driver) => {
          api = driver
        }}
      />,
    )
    const svg = document.querySelector("svg")!
    await act(async () => {
      svg.dispatchEvent(new KeyboardEvent("keydown", { key: "u", bubbles: true }))
      await new Promise((resolve) => setTimeout(resolve, 80))
    })
    expect(api!.history()).toHaveLength(1)

    const line = api!.solve()
    expect(line).not.toBeNull()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30 * line!.length))
    })
    expect(api!.solved()).toBe(true)
    expect(document.querySelector("svg")!.getAttribute("data-cube-solved")).toBe("true")
  })
})
