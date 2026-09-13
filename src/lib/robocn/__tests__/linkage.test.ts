import { describe, expect, it } from "vitest"

import { distance2 } from "@/lib/robocn/kinematics"
import {
  rigidPoint,
  solveFourBar,
  solveSliderCrank,
  tacklePosition,
  tackleReeving,
  type FourBarGeometry,
} from "@/lib/robocn/linkage"

/** A crank-rocker: shortest link is the crank, and it turns all the way round. */
const crankRocker: FourBarGeometry = {
  ground: 40,
  rise: 6,
  crank: 9,
  coupler: 38,
  rocker: 22,
}

const sweep = (step = 7) =>
  Array.from({ length: Math.ceil(360 / step) }, (_, index) => index * step)

describe("solveFourBar", () => {
  it("holds every link length at every crank angle", () => {
    for (const angle of sweep()) {
      const pose = solveFourBar(angle, crankRocker)
      expect(pose.assembled).toBe(true)
      expect(distance2(pose.crankPivot, pose.crankPin)).toBeCloseTo(crankRocker.crank, 6)
      expect(distance2(pose.crankPin, pose.couplerPin)).toBeCloseTo(crankRocker.coupler, 6)
      expect(distance2(pose.rockerPivot, pose.couplerPin)).toBeCloseTo(crankRocker.rocker, 6)
    }
  })

  it("swings the rocker between the two collinear dead centres", () => {
    const angles = sweep(1).map((angle) => solveFourBar(angle, crankRocker).rockerAngle)
    const low = Math.min(...angles)
    const high = Math.max(...angles)

    // At a dead centre the crank and coupler are in line, so the rocker end is
    // exactly (coupler ± crank) from the crank pivot.
    const pivot = { x: crankRocker.ground, y: crankRocker.rise ?? 0 }
    const base = Math.hypot(pivot.x, pivot.y)
    const extreme = (reach: number) => {
      const cosine =
        (base * base + crankRocker.rocker ** 2 - reach * reach) /
        (2 * base * crankRocker.rocker)
      return (Math.acos(cosine) * 180) / Math.PI
    }
    const span = Math.abs(
      extreme(crankRocker.coupler + crankRocker.crank) -
        extreme(crankRocker.coupler - crankRocker.crank),
    )

    expect(high - low).toBeCloseTo(span, 1)
  })

  it("takes the branch it is told to, and keeps it for a whole revolution", () => {
    for (const angle of sweep()) {
      const up = solveFourBar(angle, crankRocker, { branch: "up" })
      const down = solveFourBar(angle, crankRocker, { branch: "down" })
      expect(up.couplerPin.y).toBeGreaterThan(down.couplerPin.y)
    }
  })

  it("clamps a loop that cannot close instead of producing NaN", () => {
    // The rocker is far too short to ever meet the coupler.
    const broken: FourBarGeometry = { ground: 90, crank: 8, coupler: 20, rocker: 6 }
    const pose = solveFourBar(120, broken)

    expect(pose.assembled).toBe(false)
    expect(Number.isFinite(pose.couplerPin.x)).toBe(true)
    expect(Number.isFinite(pose.couplerPin.y)).toBe(true)
    // The coupler still holds its length; the rocker is the link left short.
    expect(distance2(pose.crankPin, pose.couplerPin)).toBeCloseTo(broken.coupler, 6)
  })

  it("renders a neutral, finite pose for non-finite input", () => {
    const pose = solveFourBar(Number.NaN, {
      ground: Number.NaN,
      crank: Number.NaN,
      coupler: Number.NaN,
      rocker: Number.NaN,
    })
    for (const value of [
      pose.crankPin.x, pose.crankPin.y,
      pose.couplerPin.x, pose.couplerPin.y,
      pose.crankAngle, pose.rockerAngle, pose.transmissionAngle,
    ]) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })

  it("reports the transmission angle inside a half turn", () => {
    for (const angle of sweep()) {
      const { transmissionAngle } = solveFourBar(angle, crankRocker)
      expect(transmissionAngle).toBeGreaterThanOrEqual(0)
      expect(transmissionAngle).toBeLessThanOrEqual(180)
    }
  })
})

describe("rigidPoint", () => {
  it("places a point at a distance and a side offset from a link", () => {
    const point = rigidPoint({ x: 10, y: 4 }, 90, 6, 3)
    expect(point.x).toBeCloseTo(10 - 3, 6)
    expect(point.y).toBeCloseTo(4 + 6, 6)
  })

  it("keeps its distance from the origin whatever the link angle", () => {
    for (const angle of sweep()) {
      const point = rigidPoint({ x: 0, y: 0 }, angle, 12, 5)
      expect(Math.hypot(point.x, point.y)).toBeCloseTo(Math.hypot(12, 5), 6)
    }
  })
})

describe("solveSliderCrank", () => {
  const inline = { crank: 10, rod: 34 }

  it("holds the crank and rod lengths through a revolution", () => {
    for (const angle of sweep()) {
      const pose = solveSliderCrank(angle, inline)
      expect(pose.assembled).toBe(true)
      expect(Math.hypot(pose.pin.x, pose.pin.y)).toBeCloseTo(inline.crank, 6)
      expect(distance2(pose.pin, pose.wrist)).toBeCloseTo(inline.rod, 6)
    }
  })

  it("reports the stroke the geometry actually makes", () => {
    const sampled = sweep(0.5).map((angle) => solveSliderCrank(angle, inline).slider)
    const travelled = Math.max(...sampled) - Math.min(...sampled)

    expect(solveSliderCrank(0, inline).stroke).toBeCloseTo(2 * inline.crank, 6)
    expect(travelled).toBeCloseTo(2 * inline.crank, 2)
  })

  it("shortens the stroke when the slider line is offset", () => {
    const offset = solveSliderCrank(0, { ...inline, offset: 14 })
    const sampled = sweep(0.5).map(
      (angle) => solveSliderCrank(angle, { ...inline, offset: 14 }).slider,
    )
    expect(offset.stroke).toBeGreaterThan(2 * inline.crank)
    expect(Math.max(...sampled) - Math.min(...sampled)).toBeCloseTo(offset.stroke, 2)
  })

  it("clamps a rod too short to reach the line of travel", () => {
    const pose = solveSliderCrank(90, { crank: 10, rod: 4, offset: 30 })
    expect(pose.assembled).toBe(false)
    expect(Number.isFinite(pose.slider)).toBe(true)
    expect(Number.isFinite(pose.rodAngle)).toBe(true)
  })
})

describe("tacklePosition", () => {
  const geometry = { lines: 6, drumRadius: 5, topHeight: 180, floorHeight: 20 }

  it("shares the payout between the lines", () => {
    const one = tacklePosition(1, geometry)
    expect(one.payout).toBeCloseTo(2 * Math.PI * 5, 6)
    expect(one.travel).toBeCloseTo(one.payout / 6, 6)
    expect(one.height).toBeCloseTo(180 - one.payout / 6, 6)
    expect(one.advantage).toBe(6)
  })

  it("lifts less per turn the more lines are strung", () => {
    const six = tacklePosition(1, geometry)
    const ten = tacklePosition(1, { ...geometry, lines: 10 })
    expect(ten.travel).toBeLessThan(six.travel)
    expect(ten.travel).toBeCloseTo(six.travel * 0.6, 6)
  })

  it("stops at both ends of the mast and says so", () => {
    const low = tacklePosition(40, geometry)
    const high = tacklePosition(-40, geometry)
    expect(low.height).toBe(20)
    expect(high.height).toBe(180)
    expect(low.atLimit).toBe(true)
    expect(high.atLimit).toBe(true)
    expect(tacklePosition(1, geometry).atLimit).toBe(false)
  })

  it("stays finite for nonsense input", () => {
    const pose = tacklePosition(Number.NaN, {
      lines: Number.NaN,
      drumRadius: Number.NaN,
      topHeight: Number.NaN,
      floorHeight: Number.NaN,
    })
    expect(Number.isFinite(pose.height)).toBe(true)
    expect(pose.advantage).toBeGreaterThanOrEqual(1)
  })
})

describe("tackleReeving", () => {
  it("strings exactly as many falls as there are lines", () => {
    for (const lines of [4, 6, 8, 10]) {
      const rope = tackleReeving({ x: 0, y: 10 }, { x: 0, y: 90 }, lines, 5)
      expect(rope).toHaveLength(lines + 1)
      // Alternating: even vertices on the crown, odd on the block.
      expect(rope.filter((_, index) => index % 2 === 0).every((p) => p.y === 10)).toBe(true)
      expect(rope.filter((_, index) => index % 2 === 1).every((p) => p.y === 90)).toBe(true)
    }
  })

  it("centres the sheaves on their block", () => {
    const rope = tackleReeving({ x: 0, y: 0 }, { x: 0, y: 50 }, 4, 6)
    const crown = rope.filter((_, index) => index % 2 === 0)
    expect(crown.reduce((sum, point) => sum + point.x, 0)).toBeCloseTo(0, 6)
  })
})
