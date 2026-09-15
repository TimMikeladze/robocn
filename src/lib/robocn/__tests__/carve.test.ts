import { describe, expect, it } from "vitest"

import {
  carveStage,
  carveTrace,
  carveWindow,
  cutPerimeter,
  facePattern,
  flameAt,
  pickShell,
  shellAspect,
  strokeOutline,
  lightThrough,
  scallopedRim,
  shellAzimuth,
  shellCut,
  toothedMouth,
  wedgeCut,
  wrapOutline,
  type CutAperture,
} from "@/lib/robocn/carve"
import { lobeFactor, profilePoint, type ProduceProfile } from "@/lib/robocn/produce"

/** A squat lobed gourd: wide at the waist, closed at both ends. */
const gourd: ProduceProfile = (t) => ({
  height: 60 * t,
  radius: 46 * Math.sin(Math.PI * Math.min(1, Math.max(0, t))) + 6,
})

const SHELL = { lobes: 8, lobeDepth: 0.22 }

const length3 = (a: { x: number; y: number; z: number }) => Math.hypot(a.x, a.y, a.z)

describe("carve-geometry", () => {
  describe("shell coordinates", () => {
    it("puts u = 0 on the front of the machine, at -z", () => {
      const front = profilePoint(gourd, 0.5, shellAzimuth(0))
      expect(front.z).toBeLessThan(0)
      expect(front.x).toBeCloseTo(0, 6)
    })

    it("sends positive u to starboard", () => {
      expect(profilePoint(gourd, 0.5, shellAzimuth(40)).x).toBeGreaterThan(0)
      expect(profilePoint(gourd, 0.5, shellAzimuth(-40)).x).toBeLessThan(0)
    })

    it("wraps an outline onto the skin, furrows and all", () => {
      const wrapped = wrapOutline(
        gourd,
        [
          { u: -20, v: 0.6 },
          { u: 20, v: 0.6 },
          { u: 0, v: 0.4 },
        ],
        SHELL,
      )
      expect(wrapped).toHaveLength(3)
      for (const [index, point] of wrapped.entries()) {
        const source = [
          { u: -20, v: 0.6 },
          { u: 20, v: 0.6 },
          { u: 0, v: 0.4 },
        ][index]
        const section = gourd(source.v)
        const expected =
          section.radius * lobeFactor(shellAzimuth(source.u), SHELL.lobes, SHELL.lobeDepth)
        expect(Math.hypot(point.x, point.z)).toBeCloseTo(expected, 6)
        expect(point.y).toBeCloseTo(section.height, 6)
      }
    })

    it("turns the whole face with `spin`", () => {
      const straight = wrapOutline(gourd, [{ u: 0, v: 0.5 }], SHELL)[0]
      const turned = wrapOutline(gourd, [{ u: 0, v: 0.5 }], { ...SHELL, spin: 90 })[0]
      expect(turned.x).not.toBeCloseTo(straight.x, 3)
      expect(Math.hypot(turned.x, turned.z)).toBeGreaterThan(0)
    })
  })

  describe("a cut", () => {
    const eye = wedgeCut({ id: "eye", u: -18, v: 0.62, width: 22, height: 0.16 })
    const cut = shellCut(gourd, eye, { ...SHELL, wall: 3 })

    it("stands its plug exactly one wall inside the rim", () => {
      expect(cut.plug).toHaveLength(cut.rim.length)
      for (const [index, rim] of cut.rim.entries()) {
        const plug = cut.plug[index]
        expect(
          length3({ x: rim.x - plug.x, y: rim.y - plug.y, z: rim.z - plug.z }),
        ).toBeCloseTo(3, 6)
        expect(Math.hypot(plug.x, plug.z)).toBeLessThan(Math.hypot(rim.x, rim.z))
      }
    })

    it("faces out of the skin", () => {
      expect(length3(cut.normal)).toBeCloseTo(1, 6)
      // Outward: the normal leans the same way as the radial under it.
      expect(cut.normal.x * cut.centroid.x + cut.normal.z * cut.centroid.z).toBeGreaterThan(0)
    })

    it("measures its area on the shell, so a bigger outline is a bigger hole", () => {
      const twice = shellCut(
        gourd,
        wedgeCut({ id: "eye", u: -18, v: 0.62, width: 44, height: 0.32 }),
        { ...SHELL, wall: 3 },
      )
      expect(cut.area).toBeGreaterThan(0)
      // Four times the outline is about four times the area, on a curved shell.
      expect(twice.area / cut.area).toBeGreaterThan(3)
      expect(twice.area / cut.area).toBeLessThan(5)
      expect(cut.perimeter).toBeCloseTo(cutPerimeter(cut.rim), 6)
    })

    it("degrades rather than throwing on rubbish", () => {
      const broken = shellCut(gourd, { id: "x", points: [] }, SHELL)
      expect(broken.area).toBe(0)
      expect(broken.perimeter).toBe(0)
      expect(Number.isFinite(broken.centroid.x)).toBe(true)
      const nonsense = shellCut(
        gourd,
        { id: "x", points: [{ u: Number.NaN, v: Number.NaN }, { u: 0, v: 0.5 }, { u: 5, v: 0.5 }] },
        SHELL,
      )
      expect(nonsense.rim.every((p) => Number.isFinite(p.x + p.y + p.z))).toBe(true)
    })
  })

  describe("carving along the perimeter", () => {
    const rim = shellCut(gourd, wedgeCut({ id: "eye", u: 0, v: 0.6, width: 24, height: 0.18 }), SHELL)

    it("cuts nothing at 0 and closes the loop at 1", () => {
      expect(carveTrace(rim.rim, 0)).toHaveLength(0)
      const whole = carveTrace(rim.rim, 1)
      expect(whole).toHaveLength(rim.rim.length + 1)
      expect(whole[whole.length - 1]).toEqual(whole[0])
      expect(cutPerimeter(whole)).toBeCloseTo(rim.perimeter, 6)
    })

    it("reaches half way round at half way through", () => {
      const half = carveTrace(rim.rim, 0.5)
      const cutLength = half
        .slice(1)
        .reduce(
          (total, point, index) =>
            total +
            length3({
              x: point.x - half[index].x,
              y: point.y - half[index].y,
              z: point.z - half[index].z,
            }),
          0,
        )
      expect(cutLength).toBeCloseTo(rim.perimeter / 2, 4)
    })

    it("only ever goes forward", () => {
      let previous = 0
      for (let step = 0; step <= 20; step++) {
        const traced = carveTrace(rim.rim, step / 20)
        const length = traced.length > 1 ? cutPerimeter([...traced, traced[0]]) : 0
        expect(traced.length).toBeGreaterThanOrEqual(previous)
        previous = traced.length
        expect(length).toBeGreaterThanOrEqual(0)
      }
      expect(carveTrace(rim.rim, Number.NaN)).toHaveLength(0)
    })
  })

  describe("the schedule", () => {
    it("cuts one feature at a time, in order", () => {
      expect(carveStage(0, 4, 0)).toBe(0)
      expect(carveStage(3, 4, 0)).toBe(0)
      expect(carveStage(0, 4, 1)).toBe(1)
      expect(carveStage(3, 4, 1)).toBe(1)
      // The first is finished before the last has started.
      expect(carveStage(0, 4, 0.3)).toBeGreaterThan(carveStage(3, 4, 0.3))
      expect(carveStage(3, 4, 0.2)).toBe(0)
    })

    it("says when each feature was cut", () => {
      const first = carveWindow(0, 4)
      const last = carveWindow(3, 4)
      expect(first.start).toBe(0)
      expect(last.end).toBe(1)
      expect(first.end).toBeLessThan(last.start + 0.5)
      // The window is exactly the slice `carveStage` runs over.
      expect(carveStage(2, 4, carveWindow(2, 4).end)).toBeCloseTo(1, 6)
      expect(carveStage(2, 4, carveWindow(2, 4).start)).toBe(0)
      expect(carveWindow(0, 1)).toEqual({ start: 0, end: 1 })
    })

    it("is a single feature straight through", () => {
      expect(carveStage(0, 1, 0.5)).toBeCloseTo(0.5, 6)
      expect(carveStage(0, 0, 0.5)).toBeCloseTo(0.5, 6)
      expect(carveStage(Number.NaN, 4, Number.NaN)).toBe(0)
    })
  })

  describe("the generators", () => {
    it("builds a grin with the tooth count it was asked for", () => {
      const four = toothedMouth({ id: "mouth", u: 0, v: 0.45, width: 70, height: 0.12, teeth: 4 })
      const nine = toothedMouth({ id: "mouth", u: 0, v: 0.45, width: 70, height: 0.12, teeth: 9 })
      expect(nine.points.length).toBeGreaterThan(four.points.length)
      for (const point of four.points) {
        expect(Math.abs(point.u)).toBeLessThanOrEqual(35.001)
        expect(point.v).toBeGreaterThan(0)
        expect(point.v).toBeLessThan(1)
      }
      // Closed without repeating the first vertex.
      expect(four.points[0]).not.toEqual(four.points[four.points.length - 1])
    })

    it("builds a wedge of the sides it was asked for", () => {
      expect(wedgeCut({ id: "e", u: 0, v: 0.5, width: 10, height: 0.1 }).points).toHaveLength(3)
      expect(
        wedgeCut({ id: "e", u: 0, v: 0.5, width: 10, height: 0.1, sides: 5 }).points,
      ).toHaveLength(5)
    })

    it("keys the lid rim so it seats one way round", () => {
      const rim = scallopedRim({ id: "lid", v: 0.82, scallops: 6, amplitude: 0.03, steps: 6 })
      expect(rim.points.length).toBeGreaterThan(12)
      const us = rim.points.map((point) => point.u)
      expect(Math.min(...us)).toBeLessThan(-150)
      expect(Math.max(...us)).toBeGreaterThan(150)
      const vs = rim.points.map((point) => point.v)
      expect(Math.max(...vs) - Math.min(...vs)).toBeGreaterThan(0.03)
      // The key is the one notch cut deeper than any scallop.
      const deepest = rim.points.reduce((low, point) => (point.v < low.v ? point : low))
      expect(Math.abs(deepest.u)).toBeLessThan(30)
    })

    it("ships four faces, eyes before mouth, and falls back on an unknown one", () => {
      for (const name of ["classic", "grin", "scowl", "sly"] as const) {
        const face = facePattern(name)
        expect(face.length).toBeGreaterThanOrEqual(3)
        expect(face[0].id).toMatch(/eye/)
        expect(face[face.length - 1].id).toMatch(/mouth/)
        for (const outline of face) expect(outline.points.length).toBeGreaterThanOrEqual(3)
      }
      expect(facePattern("blank")).toEqual([])
      // @ts-expect-error — a name from a newer version should not blow up.
      expect(facePattern("pumpkin-spice").map((cut) => cut.id)).toEqual(
        facePattern("classic").map((cut) => cut.id),
      )
      expect(facePattern("classic", { teeth: 7 })).not.toEqual(facePattern("classic", { teeth: 3 }))
    })
  })

  describe("picking a point on the skin", () => {
    // A front elevation, near enough: x across, height up, the face at -z.
    const project = (p: { x: number; y: number; z: number }) => ({
      x: -p.x,
      y: -p.y + p.z * 0.17,
    })
    const depth = (v: { x: number; y: number; z: number }) => v.y * 0.17 - v.z

    it("finds a point on the skin under the target", () => {
      for (const [u, v] of [[0, 0.5], [-35, 0.7], [48, 0.32], [12, 0.9]] as const) {
        const target = project(profilePoint(gourd, v, shellAzimuth(u), SHELL))
        const pick = pickShell(gourd, project, target, { ...SHELL, depth })
        expect(pick.hit).toBe(true)
        expect(pick.distance).toBeLessThan(0.5)
        // Whatever parameters it found, the point it found is under the target.
        const landed = project(pick.point)
        expect(Math.hypot(landed.x - target.x, landed.y - target.y)).toBeLessThan(0.5)
      }
    })

    it("stays on the branch it was already on while a drag crosses the limb", () => {
      // Near the limb two places on the near face sit under one pixel. Seeded
      // with the last pick, the walk follows one of them instead of hopping.
      let seed = { u: 20, v: 0.5 }
      for (let step = 0; step <= 12; step++) {
        const u = 20 + step * 5
        const target = project(profilePoint(gourd, 0.5, shellAzimuth(u), SHELL))
        const pick = pickShell(gourd, project, target, { ...SHELL, depth, seed })
        expect(Math.abs(pick.u - seed.u)).toBeLessThan(25)
        seed = { u: pick.u, v: pick.v }
      }
      expect(seed.u).toBeGreaterThan(55)
    })

    it("stays on the face the camera can see", () => {
      // The point directly behind the front of the shell projects to the same
      // place; the pick has to come back with the near one.
      const behind = profilePoint(gourd, 0.5, shellAzimuth(180), SHELL)
      const pick = pickShell(gourd, project, project(behind), { ...SHELL, depth })
      expect(Math.abs(pick.u)).toBeLessThan(90)
      expect(depth(pick.normal)).toBeGreaterThan(0)
    })

    it("misses rather than snapping onto the nearest edge", () => {
      const pick = pickShell(gourd, project, { x: 400, y: -400 }, { ...SHELL, depth, tolerance: 6 })
      expect(pick.hit).toBe(false)
      expect(pick.distance).toBeGreaterThan(6)
      expect(Number.isFinite(pick.point.x)).toBe(true)
      // Rubbish in, a stable answer out.
      expect(
        pickShell(gourd, project, { x: Number.NaN, y: Number.NaN }, SHELL).hit,
      ).toBe(false)
    })
  })

  describe("cutting by hand", () => {
    it("cuts a disc where the knife was put down once", () => {
      const tap = strokeOutline([{ u: 10, v: 0.5 }], { aspect: 4, width: 0.06 })
      expect(tap.length).toBeGreaterThanOrEqual(6)
      const vs = tap.map((point) => point.v)
      const us = tap.map((point) => point.u)
      expect(Math.max(...vs) - Math.min(...vs)).toBeCloseTo(0.06, 2)
      // Round on the skin, not in the authoring space: 0.06 stations of height
      // is four times that many degrees across.
      expect(Math.max(...us) - Math.min(...us)).toBeCloseTo(0.24, 2)
    })

    it("cuts a slot along the path the knife took", () => {
      const short = strokeOutline(
        [{ u: 0, v: 0.5 }, { u: 20, v: 0.5 }],
        { aspect: 4, width: 0.05 },
      )
      const long = strokeOutline(
        [{ u: 0, v: 0.5 }, { u: 60, v: 0.5 }],
        { aspect: 4, width: 0.05 },
      )
      const spread = (outline: { u: number }[]) =>
        Math.max(...outline.map((p) => p.u)) - Math.min(...outline.map((p) => p.u))
      expect(spread(long)).toBeGreaterThan(spread(short))
      // Closed, and never repeating its first vertex.
      expect(long[0]).not.toEqual(long[long.length - 1])
      // A wider nib cuts a wider slot.
      const fat = strokeOutline([{ u: 0, v: 0.5 }, { u: 60, v: 0.5 }], { aspect: 4, width: 0.12 })
      const height = (outline: { v: number }[]) =>
        Math.max(...outline.map((p) => p.v)) - Math.min(...outline.map((p) => p.v))
      expect(height(fat)).toBeGreaterThan(height(long))
    })

    it("drops the jitter between two samples rather than folding the ribbon", () => {
      const jittery = strokeOutline(
        Array.from({ length: 40 }, (_, index) => ({ u: index * 0.05, v: 0.5 })),
        { aspect: 4, width: 0.08 },
      )
      const clean = strokeOutline([{ u: 0, v: 0.5 }, { u: 1.95, v: 0.5 }], {
        aspect: 4,
        width: 0.08,
      })
      const span = (outline: { u: number }[]) =>
        Math.max(...outline.map((p) => p.u)) - Math.min(...outline.map((p) => p.u))
      // The same slot either way, and the vertex count stays bounded.
      expect(span(jittery)).toBeCloseTo(span(clean), 1)
      expect(jittery.length).toBeLessThan(60)
      expect(strokeOutline([], {})).toEqual([])
      expect(
        strokeOutline([{ u: Number.NaN, v: Number.NaN }], {}).every(
          (point) => Number.isFinite(point.u) && Number.isFinite(point.v),
        ),
      ).toBe(true)
    })

    it("takes its metric from the shell", () => {
      // Wide and shallow: many degrees to the station.
      expect(shellAspect(gourd, 0.5)).toBeGreaterThan(0)
      // A hand-cut outline is a cut like any other.
      const cut = shellCut(
        gourd,
        { id: "hand", points: strokeOutline([{ u: -10, v: 0.5 }, { u: 10, v: 0.55 }], {
          aspect: shellAspect(gourd, 0.5),
          width: 0.07,
        }) },
        { ...SHELL, wall: 3 },
      )
      expect(cut.area).toBeGreaterThan(0)
      expect(cut.perimeter).toBeGreaterThan(0)
      expect(cut.plug).toHaveLength(cut.rim.length)
    })
  })

  describe("the light that gets out", () => {
    const apertures: CutAperture[] = [
      { id: "left", area: 40, open: 1, centroid: { x: -10, y: 30, z: -30 }, normal: { x: -0.3, y: 0, z: -0.95 } },
      { id: "right", area: 40, open: 1, centroid: { x: 10, y: 30, z: -30 }, normal: { x: 0.3, y: 0, z: -0.95 } },
      { id: "mouth", area: 120, open: 0.5, centroid: { x: 0, y: 18, z: -32 }, normal: { x: 0, y: 0, z: -1 } },
    ]
    const shellArea = 4000

    it("lets out the fraction of the skin that is hole", () => {
      const light = lightThrough(apertures, 1, { shellArea })
      expect(light.openArea).toBeCloseTo(40 + 40 + 60, 6)
      expect(light.escape).toBeCloseTo(140 / shellArea, 6)
      // Shares of the same flame: they sum to the whole of it.
      expect(light.spills.reduce((sum, spill) => sum + spill.share, 0)).toBeCloseTo(1, 6)
    })

    it("throws by the inverse-square law", () => {
      const light = lightThrough(apertures, 1, { shellArea, length: 100 })
      const mouth = light.spills.find((spill) => spill.id === "mouth")!
      const eye = light.spills.find((spill) => spill.id === "left")!
      // The mouth passes 60 of 140, an eye 40: reach goes as the square root.
      expect(mouth.reach / eye.reach).toBeCloseTo(Math.sqrt(60 / 40), 5)
      expect(mouth.reach).toBeCloseTo(100 * Math.sqrt(60 / 140), 5)
      expect(mouth.halfWidth).toBeGreaterThan(0)
    })

    it("emits nothing through an uncarved shell, or with the candle out", () => {
      expect(lightThrough([], 1, { shellArea }).escape).toBe(0)
      expect(lightThrough(apertures, 0, { shellArea }).spills.every((s) => s.reach === 0)).toBe(true)
      const broken = lightThrough(
        [{ id: "x", area: Number.NaN, open: 2, centroid: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 0 } }],
        Number.NaN,
        { shellArea: 0 },
      )
      expect(Number.isFinite(broken.escape)).toBe(true)
      expect(broken.spills.every((spill) => Number.isFinite(spill.reach))).toBe(true)
    })
  })

  describe("the flame", () => {
    it("stays inside its own envelope and repeats for the same clock", () => {
      for (let step = 0; step < 60; step++) {
        const flame = flameAt(step * 0.37)
        expect(flame.intensity).toBeGreaterThanOrEqual(0)
        expect(flame.intensity).toBeLessThanOrEqual(1)
        expect(flame.height).toBeGreaterThan(0)
        expect(Math.abs(flame.lean)).toBeLessThanOrEqual(40)
      }
      expect(flameAt(3.25)).toEqual(flameAt(3.25))
    })

    it("flickers rather than pulsing on a beat", () => {
      expect(flameAt(1).intensity).not.toBeCloseTo(flameAt(2).intensity, 3)
    })

    it("leans and guts in a draught", () => {
      const still = flameAt(2.5, { draught: 0 })
      const open = flameAt(2.5, { draught: 1 })
      expect(Math.abs(open.lean)).toBeGreaterThan(Math.abs(still.lean))
      expect(open.height).toBeLessThan(still.height)
      expect(open.intensity).toBeLessThan(still.intensity)
    })

    it("gives a neutral flame for rubbish", () => {
      const flame = flameAt(Number.NaN, { draught: Number.NaN })
      expect(Number.isFinite(flame.intensity + flame.height + flame.lean)).toBe(true)
      expect(flameAt(0, { draught: -3 }).lean).toBeCloseTo(flameAt(0, { draught: 0 }).lean, 6)
    })
  })
})
