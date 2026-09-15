import { describe, expect, it } from "vitest"

import {
  classifyStroke,
  constructArchetypes,
  constructCost,
  constructDetail,
  constructLattice,
  constructOutline,
  constructSettle,
  forgeConstruct,
  neutralFrame,
  polygonArea,
  resampleStroke,
  strokeFrame,
  type Vec2Stroke,
} from "@/lib/robocn/construct"

const circle = (radius = 40, count = 60, center = { x: 0, y: 0 }): Vec2Stroke =>
  Array.from({ length: count }, (_, index) => {
    const t = (index / count) * Math.PI * 2
    return { x: center.x + Math.cos(t) * radius, y: center.y + Math.sin(t) * radius }
  })

const segment = (length = 90, count = 40): Vec2Stroke =>
  Array.from({ length: count }, (_, index) => ({
    x: -length / 2 + (index / (count - 1)) * length,
    y: 0,
  }))

describe("construct-geometry", () => {
  describe("resampleStroke", () => {
    it("spaces samples evenly however unevenly the pointer emitted them", () => {
      // Dense at the start, one long jump at the end: what a real drag looks like.
      const ragged: Vec2Stroke = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 100, y: 0 },
      ]
      const samples = resampleStroke(ragged, 11)

      expect(samples).toHaveLength(11)
      const steps = samples.slice(1).map((p, i) => Math.hypot(p.x - samples[i].x, p.y - samples[i].y))
      for (const step of steps) expect(step).toBeCloseTo(10, 6)
      expect(samples[0]).toEqual({ x: 0, y: 0 })
      expect(samples.at(-1)!.x).toBeCloseTo(100, 6)
    })

    it("survives a degenerate stroke instead of dividing by zero", () => {
      const samples = resampleStroke([{ x: 5, y: 5 }, { x: 5, y: 5 }], 6)
      expect(samples).toHaveLength(6)
      for (const p of samples) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
    })

    it("drops non-finite points rather than propagating them", () => {
      const samples = resampleStroke(
        [{ x: 0, y: 0 }, { x: Number.NaN, y: 3 }, { x: 10, y: 0 }],
        5,
      )
      for (const p of samples) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
    })
  })

  describe("strokeFrame", () => {
    it("measures a drawn circle: closed, circular, square-on aspect", () => {
      const f = strokeFrame(circle(40, 60, { x: 12, y: -8 }))

      expect(f.center.x).toBeCloseTo(12, 0)
      expect(f.center.y).toBeCloseTo(-8, 0)
      expect(f.closure).toBeLessThan(0.05)
      expect(f.circularity).toBeGreaterThan(0.9)
      expect(f.aspect).toBeCloseTo(1, 1)
      expect(f.along).toBeCloseTo(80, 0)
    })

    it("finds the principal axis of a slanted line", () => {
      const slanted = segment(100).map(({ x }) => ({ x, y: x }))
      const f = strokeFrame(slanted)

      // 45°, modulo the axis being undirected.
      expect(Math.abs(((f.angle % 180) + 180) % 180)).toBeCloseTo(45, 0)
      expect(f.aspect).toBeGreaterThan(8)
      expect(f.closure).toBeGreaterThan(0.6)
    })

    it("gives a finite neutral frame for rubbish", () => {
      const f = strokeFrame([{ x: Number.NaN, y: Number.POSITIVE_INFINITY }])
      for (const value of [f.center.x, f.center.y, f.angle, f.along, f.across, f.aspect, f.area]) {
        expect(Number.isFinite(value)).toBe(true)
      }
      expect(f.along).toBeGreaterThan(0)
    })
  })

  describe("classifyStroke", () => {
    it("reads a round closed stroke as a bubble", () => {
      expect(classifyStroke(strokeFrame(circle())).archetype).toBe("bubble")
    })

    it("reads a long straight stroke as a hammer", () => {
      expect(classifyStroke(strokeFrame(segment(120))).archetype).toBe("hammer")
    })

    it("reads a short mitten-shaped stroke as a glove", () => {
      // A stubby closed loop, half again as long as it is wide, one dominant bend.
      const mitt: Vec2Stroke = Array.from({ length: 48 }, (_, index) => {
        const t = (index / 48) * Math.PI * 2
        return { x: Math.cos(t) * 46, y: Math.sin(t) * 27 }
      })
      expect(classifyStroke(strokeFrame(mitt)).archetype).toBe("glove")
    })

    it("always names an archetype, and scores every one of them", () => {
      const { archetype, scores, score } = classifyStroke(neutralFrame())
      expect(constructArchetypes).toContain(archetype)
      expect(Object.keys(scores).sort()).toEqual([...constructArchetypes].sort())
      expect(score).toBe(scores[archetype])
      for (const value of Object.values(scores)) expect(Number.isFinite(value)).toBe(true)
    })
  })

  describe("constructOutline", () => {
    it("gives every archetype a closed, finite outline sitting in its own frame", () => {
      const frame = strokeFrame(circle(50, 60, { x: 20, y: 30 }))
      for (const archetype of constructArchetypes) {
        const outline = constructOutline(archetype, frame)
        expect(outline.length).toBeGreaterThan(7)
        for (const p of outline) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)

        const xs = outline.map((p) => p.x)
        const ys = outline.map((p) => p.y)
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2
        const cy = (Math.min(...ys) + Math.max(...ys)) / 2
        // Centred on the stroke it came from, and no bigger than its span.
        expect(Math.hypot(cx - 20, cy - 30)).toBeLessThan(frame.along * 0.3)
        expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(frame.along * 1.2)
        expect(polygonArea(outline)).toBeGreaterThan(0)
      }
    })

    it("scales with the stroke: twice the span is four times the area", () => {
      const small = constructOutline("bubble", strokeFrame(circle(20)))
      const large = constructOutline("bubble", strokeFrame(circle(40)))
      expect(polygonArea(large) / polygonArea(small)).toBeCloseTo(4, 0)
    })

    it("falls back to a bubble for an archetype it does not know", () => {
      // @ts-expect-error — a stale value from a consumer should degrade, not throw.
      const outline = constructOutline("nonsense", neutralFrame())
      expect(outline).toEqual(constructOutline("bubble", neutralFrame()))
    })
  })

  describe("constructDetail", () => {
    it("gives every archetype seams that sit inside its own outline's frame", () => {
      const frame = strokeFrame(circle(50, 60, { x: -30, y: 12 }))
      for (const archetype of constructArchetypes) {
        const seams = constructDetail(archetype, frame)
        expect(seams.length).toBeGreaterThan(0)
        for (const seam of seams) {
          expect(seam.length).toBeGreaterThan(1)
          for (const p of seam) {
            expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
            expect(Math.hypot(p.x + 30, p.y - 12)).toBeLessThan(frame.along)
          }
        }
      }
    })
  })

  describe("constructLattice", () => {
    it("clips fill lines to the outline it is filling", () => {
      const outline = constructOutline("bubble", strokeFrame(circle(40)))
      const lattice = constructLattice(outline, { spacing: 8, angle: 0 })

      expect(lattice.length).toBeGreaterThan(4)
      for (const [a, b] of lattice) {
        // Every span lies inside the circle it filled.
        expect(Math.hypot(a.x, a.y)).toBeLessThanOrEqual(41)
        expect(Math.hypot(b.x, b.y)).toBeLessThanOrEqual(41)
        expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(0)
      }
    })

    it("rakes with the angle it is given", () => {
      const outline = constructOutline("shield", strokeFrame(circle(40)))
      const flat = constructLattice(outline, { spacing: 9, angle: 0 })
      const raked = constructLattice(outline, { spacing: 9, angle: 60 })
      expect(raked).not.toEqual(flat)
      for (const [a, b] of raked) {
        expect(Number.isFinite(a.x) && Number.isFinite(b.y)).toBe(true)
      }
    })

    it("returns nothing rather than looping forever on a bad spacing", () => {
      const outline = constructOutline("bubble", neutralFrame())
      expect(constructLattice(outline, { spacing: 0, angle: 0 })).toEqual([])
      expect(constructLattice(outline, { spacing: Number.NaN, angle: 0 })).toEqual([])
      expect(constructLattice([], { spacing: 6, angle: 0 })).toEqual([])
    })
  })

  describe("constructCost", () => {
    it("charges for area, and a bigger construct costs more", () => {
      const small = constructCost(constructOutline("bubble", strokeFrame(circle(18))))
      const large = constructCost(constructOutline("bubble", strokeFrame(circle(60))))
      expect(large).toBeGreaterThan(small)
      expect(small).toBeGreaterThan(0)
      expect(large).toBeLessThanOrEqual(1)
    })

    it("clamps, and never returns a non-finite draw", () => {
      expect(constructCost([])).toBe(0)
      expect(constructCost([{ x: Number.NaN, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }])).toBe(0)
    })
  })

  describe("constructSettle", () => {
    it("runs a construct in, holds it, and lets it go", () => {
      expect(constructSettle(-1, 4)).toBe(0)
      expect(constructSettle(0, 4)).toBe(0)
      expect(constructSettle(2, 4)).toBeCloseTo(1, 1)
      expect(constructSettle(4, 4)).toBe(0)
      expect(constructSettle(9, 4)).toBe(0)
      expect(constructSettle(Number.NaN, 4)).toBe(0)
    })
  })

  describe("forgeConstruct", () => {
    it("takes a raw pointer path all the way to a drawable construct", () => {
      const forged = forgeConstruct(circle(44, 50, { x: 10, y: 10 }))

      expect(forged.archetype).toBe("bubble")
      expect(forged.outline.length).toBeGreaterThan(7)
      expect(forged.lattice.length).toBeGreaterThan(1)
      expect(forged.cost).toBeGreaterThan(0)
      expect(forged.frame.center.x).toBeCloseTo(10, 0)
    })

    it("honours an archetype the caller insists on", () => {
      const forged = forgeConstruct(circle(44), { archetype: "glove" })
      expect(forged.archetype).toBe("glove")
    })

    it("forges something rather than nothing from a single click", () => {
      const forged = forgeConstruct([{ x: 4, y: 4 }])
      expect(constructArchetypes).toContain(forged.archetype)
      expect(forged.outline.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
    })
  })
})
