/**
 * `rubiks-cube` is a WebGL rig: jsdom has no renderer, so there is no mount
 * test here and there is none for `robot-arm-3d` either. What the component
 * owns beyond the solver is its motion — and every behaviour is an exported
 * pure function of the clock, which is what is sampled below. The state, the
 * turns and the drag are tested in `src/lib/robocn/__tests__/cube.test.ts`,
 * and the drawing itself is checked in a browser.
 */

import { describe, expect, it } from "vitest"

import {
  rubiksCubeEase,
  rubiksCubeMove,
  rubiksCubeSnap,
  rubiksCubeStep,
  standardCubeFaceColors,
} from "@/components/ui/rubiks-cube"
import {
  applyMove,
  createCube,
  cubeFaces,
  formatMove,
  isSolved,
} from "@/lib/robocn/cube"

describe("rubiks-cube", () => {
  it("steps the loop forward with the clock, and not at all when static", () => {
    expect(rubiksCubeStep("cycle", 0, 1)).toBe(0)
    expect(rubiksCubeStep("cycle", 2.4, 1)).toBe(2)
    expect(rubiksCubeStep("cycle", 2.4, 2)).toBe(4)
    expect(rubiksCubeStep("static", 9, 1)).toBe(0)
    expect(rubiksCubeStep("cycle", Number.NaN, 1)).toBe(0)
  })

  it("plays an algorithm that comes home, so the cycle is a cycle", () => {
    let cube = createCube(3)
    for (let step = 0; step < 24; step++) {
      const move = rubiksCubeMove("cycle", step)
      expect(move).not.toBeNull()
      cube = applyMove(cube, move!)
    }
    // 6 repeats of R U R' U' — 24 turns — is the identity.
    expect(isSolved(cube)).toBe(true)
  })

  it("scrambles deterministically from a seed, and differently from another", () => {
    const run = (seed: number) =>
      Array.from({ length: 12 }, (_, step) =>
        formatMove(rubiksCubeMove("scramble", step, 3, seed)!),
      ).join(" ")

    expect(run(3)).toBe(run(3))
    expect(run(3)).not.toBe(run(4))
  })

  it("makes no move when nothing should be moving", () => {
    expect(rubiksCubeMove("static", 4)).toBeNull()
    expect(rubiksCubeMove("cycle", Number.NaN)).toBeNull()
    expect(rubiksCubeMove("cycle", -2)).toBeNull()
  })

  it("eases a turn from rest to rest, and clamps rubbish", () => {
    expect(rubiksCubeEase(0)).toBe(0)
    expect(rubiksCubeEase(1)).toBe(1)
    expect(rubiksCubeEase(0.5)).toBeCloseTo(0.5, 6)
    expect(rubiksCubeEase(-4)).toBe(0)
    expect(rubiksCubeEase(9)).toBe(1)
    expect(rubiksCubeEase(Number.NaN)).toBe(0)
  })

  it("ships the standard scheme, one distinct colour per face", () => {
    const colors = cubeFaces.map((face) => standardCubeFaceColors[face])
    expect(colors).toHaveLength(6)
    expect(new Set(colors).size).toBe(6)
    for (const color of colors) expect(color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it("snaps a released drag to the quarter turn it is nearest, not the one it started", () => {
    const quarter = Math.PI / 2
    // Barely moved: it goes back where it was and nothing is recorded.
    expect(rubiksCubeSnap(quarter * 0.2).quarters).toBe(0)
    // Past half way: the hand has done that turn.
    expect(rubiksCubeSnap(quarter * 0.6).quarters).toBe(1)
    expect(rubiksCubeSnap(-quarter * 0.6).quarters).toBe(-1)
    expect(rubiksCubeSnap(quarter * 1.7).quarters).toBe(2)
    // The travel it snaps to is the quarter turn itself, so the settle is
    // always the short way to rest.
    expect(rubiksCubeSnap(quarter * 0.9).angle).toBeCloseTo(quarter, 6)
    expect(rubiksCubeSnap(Number.NaN)).toEqual({ quarters: 0, angle: 0 })
    // Wound past a full turn it takes the lot rather than unwinding.
    expect(rubiksCubeSnap(quarter * 12).quarters).toBe(4)
  })

  it("leaves the solve to the solver rather than driving it off the clock", () => {
    // `solve` is a behaviour of the state, not of the time, so unlike `cycle`
    // and `scramble` it has no move at a step.
    expect(rubiksCubeMove("solve", 3)).toBeNull()
    expect(rubiksCubeStep("solve", 4, 1)).toBe(4)
  })
})
