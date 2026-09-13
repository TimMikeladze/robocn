import { describe, expect, it } from 'vitest'
import {
  dropTimings,
  hopTimings,
  solveDrop,
  solveHop,
  springCoils,
  squashRadii,
} from '@/lib/robocn/hopper'

/** Samples of one steady cycle, at the cycle fractions a drawing actually asks for. */
const fractions = [0, 0.05, 0.1, 0.25, 0.4, 0.5, 0.62, 0.75, 0.9, 0.999]

describe('hop timings', () => {
  it('derives the split between stance and flight from the spring rate, not a knob', () => {
    const soft = hopTimings({ height: 0.5, stiffness: 12 })
    const stiff = hopTimings({ height: 0.5, stiffness: 120 })

    // Same drop, so the same flight — the ballistic half cannot know about the spring.
    expect(soft.flight).toBeCloseTo(stiff.flight, 9)
    // A stiffer spring holds the machine for less time and squashes less.
    expect(stiff.contact).toBeLessThan(soft.contact)
    expect(stiff.depth).toBeLessThan(soft.depth)
    expect(stiff.duty).toBeLessThan(soft.duty)
    expect(soft.duty).toBeGreaterThan(0)
    expect(soft.duty).toBeLessThan(1)
  })

  it('matches the closed forms it claims: flight 2v, sag g/k, and contact past a half period', () => {
    const timings = hopTimings({ height: 0.5, stiffness: 40 })
    expect(timings.takeoff).toBeCloseTo(Math.sqrt(2 * 0.5), 9)
    expect(timings.flight).toBeCloseTo(2 * timings.takeoff, 9)
    expect(timings.sag).toBeCloseTo(1 / 40, 9)
    // Gravity biases the oscillation, so contact runs longer than half a period.
    expect(timings.contact).toBeGreaterThan(Math.PI / Math.sqrt(40))
    expect(timings.contact).toBeLessThan((2 * Math.PI) / Math.sqrt(40))
    expect(timings.cycle).toBeCloseTo(timings.contact + timings.flight, 9)
  })
})

describe('the steady hop', () => {
  it('touches down at phase zero, sinks, and comes back to the ground where it started', () => {
    const touchdown = solveHop({ phase: 0 })
    expect(touchdown.contact).toBe(true)
    expect(touchdown.altitude).toBeCloseTo(0, 6)
    expect(touchdown.velocity).toBeLessThan(0)

    const seam = solveHop({ phase: 0.999999 })
    expect(Math.abs(seam.altitude)).toBeLessThan(0.002)
  })

  it('is a parabola in the air and a loaded spring on the ground', () => {
    const { duty } = hopTimings({})
    const apex = solveHop({ phase: duty + (1 - duty) / 2 })
    expect(apex.contact).toBe(false)
    expect(apex.altitude).toBeCloseTo(0.5, 3)
    expect(apex.velocity).toBeCloseTo(0, 3)
    expect(apex.compression).toBe(0)
    expect(apex.load).toBe(0)

    const mid = solveHop({ phase: duty / 2 })
    expect(mid.contact).toBe(true)
    expect(mid.altitude).toBeLessThan(0)
    expect(mid.compression).toBeCloseTo(hopTimings({}).depth, 2)
    // Deepest point carries several times the machine's own weight.
    expect(mid.load).toBeGreaterThan(2)
    expect(mid.squeeze).toBeCloseTo(1, 2)
  })

  it('never puts the machine underground, and wraps phase in both directions', () => {
    for (const phase of fractions) {
      const state = solveHop({ phase })
      expect(state.squeeze).toBeGreaterThanOrEqual(0)
      expect(state.squeeze).toBeLessThanOrEqual(1)
      expect(state.compression).toBe(Math.max(0, -state.altitude))
      expect(state.contact).toBe(state.altitude <= 0)
      const wrapped = solveHop({ phase: phase - 1 })
      expect(wrapped.altitude).toBeCloseTo(state.altitude, 9)
      expect(wrapped.contact).toBe(state.contact)
    }
  })

  it('renders a stable neutral state for nonsense input instead of throwing', () => {
    const neutral = solveHop({ phase: Number.NaN, height: Number.NaN, stiffness: 0 })
    expect(Number.isFinite(neutral.altitude)).toBe(true)
    expect(Number.isFinite(neutral.load)).toBe(true)
    expect(neutral.squeeze).toBeGreaterThanOrEqual(0)
    expect(() => solveHop({ height: -4, stiffness: -1, phase: Infinity })).not.toThrow()
  })
})

describe('a dropped machine settling', () => {
  it('loses the same fraction of its height every bounce', () => {
    const restitution = 0.7
    const { bounces, settleTime } = dropTimings({ height: 1, restitution })
    expect(bounces).toBeGreaterThan(3)
    expect(settleTime).toBeGreaterThan(0)
    expect(Number.isFinite(settleTime)).toBe(true)

    const apexes = Array.from({ length: 3 }, (_, index) => {
      const { apexAt } = dropTimings({ height: 1, restitution })
      return solveDrop({ time: apexAt(index), height: 1, restitution }).altitude
    })
    expect(apexes[1] / apexes[0]).toBeCloseTo(restitution ** 2, 2)
    expect(apexes[2] / apexes[1]).toBeCloseTo(restitution ** 2, 2)
  })

  it('comes to rest in finite time and sits at its static sag afterwards', () => {
    const options = { height: 1, restitution: 0.6, stiffness: 40 }
    const { settleTime } = dropTimings(options)
    const rest = solveDrop({ ...options, time: settleTime + 5 })
    expect(rest.resting).toBe(true)
    expect(rest.contact).toBe(true)
    expect(rest.altitude).toBeCloseTo(-1 / 40, 6)
    expect(rest.load).toBeCloseTo(1, 6)
    expect(rest.velocity).toBeCloseTo(0, 9)
    expect(solveDrop({ ...options, time: 0 }).resting).toBe(false)
  })

  it('is the steady hop when nothing is lost', () => {
    const timings = hopTimings({ height: 0.5, stiffness: 40 })
    // Released from the apex, so the first touchdown is half a flight in.
    const landed = solveDrop({ time: timings.flight / 2, height: 0.5, restitution: 1, stiffness: 40 })
    expect(landed.altitude).toBeCloseTo(0, 4)
    expect(landed.bounce).toBe(0)
    const second = solveDrop({ time: timings.flight / 2 + timings.cycle, height: 0.5, restitution: 1, stiffness: 40 })
    expect(second.altitude).toBeCloseTo(0, 4)
    expect(second.bounce).toBe(1)
  })
})

describe('spring geometry', () => {
  it('keeps its coils and its radius at every length, and bottoms out on itself', () => {
    const free = springCoils({ length: 40, turns: 6, radius: 7, wire: 1.4 })
    const squashed = springCoils({ length: 12, turns: 6, radius: 7, wire: 1.4 })
    expect(free.solid).toBeCloseTo(6 * 1.4, 9)
    expect(free.bottomedOut).toBe(false)
    expect(free.pitch).toBeCloseTo(40 / 6, 9)
    expect(squashed.pitch).toBeLessThan(free.pitch)
    // Radius is fixed: a compressed spring gets shorter, not fatter.
    for (const points of [free.points, squashed.points]) {
      expect(Math.max(...points.map((point) => Math.abs(point.x)))).toBeCloseTo(7, 6)
    }
    expect(free.points[0].y).toBeCloseTo(0, 9)
    expect(free.points[free.points.length - 1].y).toBeCloseTo(40, 9)
  })

  it('cannot be compressed through its own wire', () => {
    const crushed = springCoils({ length: 1, turns: 6, radius: 7, wire: 1.4 })
    expect(crushed.bottomedOut).toBe(true)
    expect(crushed.length).toBeCloseTo(crushed.solid, 9)
    expect(crushed.points[crushed.points.length - 1].y).toBeCloseTo(crushed.solid, 9)
    expect(() => springCoils({ length: Number.NaN, turns: 0, radius: -3, wire: Number.NaN })).not.toThrow()
  })
})

describe('shell squash', () => {
  it('conserves volume, so flattening widens it by exactly that much', () => {
    for (const squeeze of [0, 0.15, 0.4, 0.75]) {
      const { rx, ry } = squashRadii(30, squeeze)
      expect(rx * rx * ry).toBeCloseTo(30 ** 3, 4)
      expect(ry).toBeLessThanOrEqual(30)
      expect(rx).toBeGreaterThanOrEqual(30)
    }
    expect(squashRadii(30, 0)).toEqual({ rx: 30, ry: 30 })
  })

  it('never collapses to nothing on nonsense input', () => {
    const bad = squashRadii(30, Number.NaN)
    expect(bad).toEqual({ rx: 30, ry: 30 })
    const crushed = squashRadii(30, 9)
    expect(crushed.ry).toBeGreaterThan(0)
    expect(Number.isFinite(crushed.rx)).toBe(true)
  })
})
