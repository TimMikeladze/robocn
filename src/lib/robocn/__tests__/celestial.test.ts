import { describe, expect, it } from "vitest"

import {
  MAX_ECCENTRICITY,
  bodyFrame,
  discMu,
  illumination,
  latitudeBand,
  limbDarkening,
  lumpyPoint,
  lumpyRadius,
  meridian,
  orbitPath,
  orbitalState,
  phaseFraction,
  solveKepler,
  sphereLattice,
  spinAxis,
  surfacePoint,
  terminator,
} from "@/lib/robocn/celestial"
import type { Vec3 } from "@/lib/robocn/kinematics"

const norm = (v: Vec3) => Math.hypot(v.x, v.y, v.z)
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

describe("Kepler's equation", () => {
  it.each([0, 0.1, 0.4, 0.7, 0.9, MAX_ECCENTRICITY])(
    "inverts itself at eccentricity %f",
    (eccentricity) => {
      for (let step = 0; step <= 64; step++) {
        const mean = -Math.PI + (step / 64) * 2 * Math.PI
        const eccentric = solveKepler(mean, eccentricity)
        expect(eccentric - eccentricity * Math.sin(eccentric)).toBeCloseTo(mean, 9)
      }
    },
  )

  it("keeps the revolution count rather than folding it away", () => {
    expect(solveKepler(0, 0.5)).toBeCloseTo(0, 12)
    expect(solveKepler(Math.PI * 2, 0.5)).toBeCloseTo(Math.PI * 2, 9)
    expect(solveKepler(-Math.PI * 4, 0.5)).toBeCloseTo(-Math.PI * 4, 9)
  })

  it("degenerates to the mean anomaly on a circle, and never returns NaN", () => {
    expect(solveKepler(1.234, 0)).toBe(1.234)
    expect(Number.isFinite(solveKepler(Number.NaN, Number.NaN))).toBe(true)
    // Past the clamp is still an orbit, not a parabola.
    expect(Number.isFinite(solveKepler(2, 3))).toBe(true)
  })
})

describe("an orbit", () => {
  const elements = { semiMajor: 100, eccentricity: 0.5, period: 4 }

  it("puts the hub at a focus, not at the centre", () => {
    const periapsis = orbitalState(elements, 0)
    const apoapsis = orbitalState(elements, 2)
    expect(periapsis.radius).toBeCloseTo(50, 9)
    expect(apoapsis.radius).toBeCloseTo(150, 9)
    // Centre of the drawn ellipse sits a·e from the focus at the origin.
    const path = orbitPath(elements, 720)
    const centre = path.reduce(
      (sum, point) => ({ x: sum.x + point.x / 720, y: sum.y + point.y / 720, z: sum.z + point.z / 720 }),
      { x: 0, y: 0, z: 0 },
    )
    expect(norm(centre)).toBeGreaterThan(20)
  })

  it("returns to where it started after one period", () => {
    const start = orbitalState(elements, 0.37)
    const later = orbitalState(elements, 0.37 + 4)
    expect(later.position.x).toBeCloseTo(start.position.x, 6)
    expect(later.position.y).toBeCloseTo(start.position.y, 6)
    expect(later.position.z).toBeCloseTo(start.position.z, 6)
  })

  it("sweeps equal areas in equal times", () => {
    const slice = (from: number) => {
      let area = 0
      for (let step = 0; step < 200; step++) {
        const a = orbitalState(elements, from + (step / 200) * 0.5).position
        const b = orbitalState(elements, from + ((step + 1) / 200) * 0.5).position
        area += norm(cross(a, b)) / 2
      }
      return area
    }
    // Half a period apart: the fast half by periapsis and the slow half out at
    // apoapsis sweep the same area, which is the whole of Kepler's second law.
    // Compared relatively, because the sum of chords is a hair under the arc.
    const relative = (a: number, b: number) => Math.abs(a - b) / Math.max(a, b)
    expect(relative(slice(0), slice(2))).toBeLessThan(1e-4)
    expect(relative(slice(0.7), slice(2.7))).toBeLessThan(1e-4)
  })

  it("tilts the plane without changing the shape", () => {
    const flat = orbitPath({ ...elements, inclination: 0 }, 180)
    const tipped = orbitPath({ ...elements, inclination: 40, node: 25 }, 180)
    expect(flat.every((point) => Math.abs(point.y) < 1e-9)).toBe(true)
    expect(tipped.some((point) => Math.abs(point.y) > 10)).toBe(true)
    for (let index = 0; index < flat.length; index++) {
      expect(norm(tipped[index])).toBeCloseTo(norm(flat[index]), 9)
    }
  })

  it("runs fast at periapsis and slowly at apoapsis", () => {
    const step = 0.01
    const near = norm({
      x: orbitalState(elements, step).position.x - orbitalState(elements, 0).position.x,
      y: orbitalState(elements, step).position.y - orbitalState(elements, 0).position.y,
      z: orbitalState(elements, step).position.z - orbitalState(elements, 0).position.z,
    })
    const far = norm({
      x: orbitalState(elements, 2 + step).position.x - orbitalState(elements, 2).position.x,
      y: orbitalState(elements, 2 + step).position.y - orbitalState(elements, 2).position.y,
      z: orbitalState(elements, 2 + step).position.z - orbitalState(elements, 2).position.z,
    })
    expect(near).toBeGreaterThan(far * 2)
  })

  it("renders a broken element set as a stable circle rather than NaN", () => {
    const broken = orbitalState({ semiMajor: Number.NaN, eccentricity: Number.NaN, period: 0 }, 1)
    expect(Number.isFinite(broken.position.x)).toBe(true)
    expect(Number.isFinite(broken.radius)).toBe(true)
  })
})

describe("the body frame", () => {
  it.each([
    { tilt: 0, precession: 0, spin: 0 },
    { tilt: 23, precession: 40, spin: 130 },
    { tilt: -60, precession: -200, spin: -47 },
    { tilt: 90, precession: 0, spin: 90 },
  ])("stays orthonormal at %o", (options) => {
    const frame = bodyFrame(options)
    for (const axis of [frame.right, frame.up, frame.forward]) {
      expect(norm(axis)).toBeCloseTo(1, 12)
    }
    expect(dot(frame.right, frame.up)).toBeCloseTo(0, 12)
    expect(dot(frame.right, frame.forward)).toBeCloseTo(0, 12)
    expect(dot(frame.up, frame.forward)).toBeCloseTo(0, 12)
  })

  it("is the identity when nothing is tilted or turned", () => {
    const frame = bodyFrame()
    expect(frame.up.x).toBeCloseTo(0, 12)
    expect(frame.up.y).toBeCloseTo(1, 12)
    expect(frame.up.z).toBeCloseTo(0, 12)
    expect(frame.right.x).toBeCloseTo(1, 12)
    expect(frame.forward.z).toBeCloseTo(-1, 12)
  })

  it("leans the pole where the tilt says", () => {
    expect(spinAxis(0, 0).y).toBeCloseTo(1, 12)
    expect(Math.abs(spinAxis(0, 0).x)).toBeCloseTo(0, 12)
    const leaning = spinAxis(30, 0)
    expect(leaning.y).toBeCloseTo(Math.cos(Math.PI / 6), 12)
    expect(leaning.z).toBeCloseTo(-Math.sin(Math.PI / 6), 12)
    expect(norm(leaning)).toBeCloseTo(1, 12)
  })

  it("holds every surface point on the sphere, and the pole still", () => {
    const frame = bodyFrame({ tilt: 27, precession: 33, spin: 214 })
    for (const latitude of [-90, -40, 0, 15, 90]) {
      for (const longitude of [0, 90, 217, 359]) {
        expect(norm(surfacePoint(frame, 40, latitude, longitude))).toBeCloseTo(40, 9)
      }
    }
    // The pole is the pole whatever the longitude is.
    const a = surfacePoint(frame, 40, 90, 0)
    const b = surfacePoint(frame, 40, 90, 137)
    expect(a.x).toBeCloseTo(b.x, 9)
    expect(a.y).toBeCloseTo(b.y, 9)
  })

  it("turns a full revolution back onto itself", () => {
    const rest = surfacePoint(bodyFrame({ tilt: 18, spin: 0 }), 30, 20, 50)
    const round = surfacePoint(bodyFrame({ tilt: 18, spin: 360 }), 30, 20, 50)
    expect(round.x).toBeCloseTo(rest.x, 9)
    expect(round.y).toBeCloseTo(rest.y, 9)
    expect(round.z).toBeCloseTo(rest.z, 9)
  })

  it("draws bands and meridians on that same sphere", () => {
    const frame = bodyFrame({ tilt: 20 })
    const band = latitudeBand(frame, 25, 35, 24)
    expect(band).toHaveLength(24)
    expect(band.every((point) => Math.abs(norm(point) - 25) < 1e-9)).toBe(true)
    const line = meridian(frame, 25, 70, 12)
    expect(line).toHaveLength(13)
    expect(norm(line[0])).toBeCloseTo(25, 9)
  })

  it("spreads a sphere lattice evenly over the whole sphere", () => {
    const sites = sphereLattice(400)
    expect(sites).toHaveLength(400)
    expect(sites.every((site) => Math.abs(norm(site) - 1) < 1e-9)).toBe(true)
    // The cap above y = 0.5 is a quarter of the sphere's area.
    const cap = sites.filter((site) => site.y >= 0.5).length
    expect(Math.abs(cap - 100)).toBeLessThanOrEqual(2)
    expect(sphereLattice(0)).toEqual([])
  })
})

describe("light", () => {
  it("puts the terminator on the sphere, square to the light", () => {
    const sun = { x: 0.4, y: 0.7, z: -0.6 }
    const ring = terminator(30, sun, 40)
    expect(ring).toHaveLength(40)
    for (const point of ring) {
      expect(norm(point)).toBeCloseTo(30, 9)
      expect(illumination(point, sun)).toBeCloseTo(0, 9)
    }
  })

  it("reports the phase from the geometry", () => {
    const eye = { x: 0, y: 0, z: -1 }
    expect(phaseFraction(eye, eye)).toBeCloseTo(1, 12)
    expect(phaseFraction({ x: 0, y: 0, z: 1 }, eye)).toBeCloseTo(0, 12)
    expect(phaseFraction({ x: 1, y: 0, z: 0 }, eye)).toBeCloseTo(0.5, 12)
  })

  it("lights a surface point by its own normal", () => {
    const sun = { x: 0, y: 0, z: -1 }
    expect(illumination({ x: 0, y: 0, z: -10 }, sun)).toBeCloseTo(1, 12)
    expect(illumination({ x: 0, y: 0, z: 10 }, sun)).toBeCloseTo(-1, 12)
    expect(illumination({ x: 10, y: 0, z: 0 }, sun)).toBeCloseTo(0, 12)
  })

  it("darkens toward the limb by the law and not by eye", () => {
    expect(limbDarkening(1, 0.6)).toBeCloseTo(1, 12)
    expect(limbDarkening(0, 0.6)).toBeCloseTo(0.4, 12)
    expect(limbDarkening(0.5, 0.6)).toBeCloseTo(0.7, 12)
    expect(limbDarkening(0.5, 0)).toBe(1)
    // Monotone from the centre of the disc out to the edge.
    let previous = Number.POSITIVE_INFINITY
    for (let step = 0; step <= 10; step++) {
      const value = limbDarkening(discMu(step / 10))
      expect(value).toBeLessThanOrEqual(previous)
      previous = value
    }
    expect(discMu(0)).toBe(1)
    expect(discMu(1)).toBe(0)
  })
})

describe("an irregular body", () => {
  const options = { lobes: 9, depth: 0.3, seed: 12 }

  it("stays inside the depth it was given", () => {
    for (const site of sphereLattice(500)) {
      const radius = lumpyRadius(site, options)
      expect(radius).toBeGreaterThanOrEqual(1 - options.depth - 1e-12)
      expect(radius).toBeLessThanOrEqual(1 + options.depth + 1e-12)
    }
  })

  it("is the same rock for the same seed and a different one for another", () => {
    const direction = { x: 0.3, y: -0.5, z: 0.8 }
    expect(lumpyRadius(direction, options)).toBe(lumpyRadius(direction, { ...options }))
    expect(lumpyRadius(direction, options)).not.toBe(
      lumpyRadius(direction, { ...options, seed: 13 }),
    )
  })

  it("has no seam: a closed walk over the sphere never steps", () => {
    const steps = 720
    let previous = lumpyRadius({ x: 0, y: 1, z: 0 }, options)
    let worst = 0
    for (let step = 1; step <= steps; step++) {
      const angle = (step / steps) * Math.PI * 2
      // A great circle through both poles, so every lobe axis is crossed.
      const value = lumpyRadius({ x: Math.sin(angle) * 0.6, y: Math.cos(angle), z: Math.sin(angle) * 0.8 }, options)
      worst = Math.max(worst, Math.abs(value - previous))
      previous = value
    }
    expect(worst).toBeLessThan(0.02)
    expect(previous).toBeCloseTo(lumpyRadius({ x: 0, y: 1, z: 0 }, options), 9)
  })

  it("is a sphere again when the depth is zero", () => {
    for (const site of sphereLattice(40)) {
      expect(lumpyRadius(site, { ...options, depth: 0 })).toBe(1)
      expect(norm(lumpyPoint(site, 20, { ...options, depth: 0 }))).toBeCloseTo(20, 9)
    }
  })

  it("survives broken input", () => {
    expect(Number.isFinite(lumpyRadius({ x: 0, y: 0, z: 0 }, options))).toBe(true)
    expect(
      Number.isFinite(lumpyRadius({ x: Number.NaN, y: 1, z: 0 }, { lobes: Number.NaN, seed: Number.NaN })),
    ).toBe(true)
  })
})
