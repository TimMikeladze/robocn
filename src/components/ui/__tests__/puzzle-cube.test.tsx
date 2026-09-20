/**
 * `puzzle-cube` is a WebGL rig: jsdom has no renderer, so there is no mount
 * test here and there is none for `robot-arm-3d` either. What the component
 * owns beyond the solver is its motion — and every behaviour is an exported
 * pure function of the clock, which is what is sampled below. The state, the
 * turns and the drag are tested in `src/lib/robocn/__tests__/cube.test.ts`,
 * and the drawing itself is checked in a browser.
 */

import { describe, expect, it } from "vitest"

import {
  puzzleCubeEase,
  puzzleCubeMove,
  puzzleCubeStep,
  standardCubeFaceColors,
} from "@/components/ui/puzzle-cube"
import {
  applyMove,
  createCube,
  cubeFaces,
  formatMove,
  isSolved,
} from "@/lib/robocn/cube"

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
  })

  it("eases a turn from rest to rest, and clamps rubbish", () => {
    expect(puzzleCubeEase(0)).toBe(0)
    expect(puzzleCubeEase(1)).toBe(1)
    expect(puzzleCubeEase(0.5)).toBeCloseTo(0.5, 6)
    expect(puzzleCubeEase(-4)).toBe(0)
    expect(puzzleCubeEase(9)).toBe(1)
    expect(puzzleCubeEase(Number.NaN)).toBe(0)
  })

  it("ships the standard scheme, one distinct colour per face", () => {
    const colors = cubeFaces.map((face) => standardCubeFaceColors[face])
    expect(colors).toHaveLength(6)
    expect(new Set(colors).size).toBe(6)
    for (const color of colors) expect(color).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
