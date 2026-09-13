import { describe, expect, it } from 'vitest'
import { distance3 } from '@/lib/robocn/kinematics'
import { defaultStewartGeometry, solveStewart } from '@/lib/robocn/stewart'

describe('stewart platform', () => {
  it('rests with six equal legs at zero stroke', () => {
    const rest = solveStewart()
    expect(rest.legs).toHaveLength(6)
    expect(rest.reachable).toBe(true)
    for (const leg of rest.legs) {
      expect(leg.length).toBeCloseTo(rest.homeLength, 9)
      expect(leg.stroke).toBeCloseTo(0, 9)
      expect(distance3(leg.base, leg.platform)).toBeCloseTo(leg.length, 9)
      expect(leg.base.y).toBe(0)
      expect(leg.platform.y).toBeCloseTo(defaultStewartGeometry.height, 9)
    }
    expect(rest.center).toEqual({ x: 0, y: defaultStewartGeometry.height, z: 0 })
  })

  it('moves the platform rigidly: rotation preserves anchor spacing', () => {
    const rest = solveStewart()
    const posed = solveStewart({ yaw: 22, pitch: -11, roll: 7, sway: 4, heave: -3, surge: 5 })
    for (let i = 0; i < 6; i++) {
      for (let j = i + 1; j < 6; j++) {
        expect(distance3(posed.legs[i].platform, posed.legs[j].platform))
          .toBeCloseTo(distance3(rest.legs[i].platform, rest.legs[j].platform), 9)
      }
      expect(posed.legs[i].base).toEqual(rest.legs[i].base)
    }
  })

  it('reads pitch and heave the way a head does', () => {
    // Legs 0 and 1 anchor at the front of the ring: a nose-down pitch pulls
    // them in and pushes every rear leg out.
    const nodded = solveStewart({ pitch: 15 })
    expect(nodded.legs[0].stroke).toBeLessThan(0)
    expect(nodded.legs[1].stroke).toBeCloseTo(nodded.legs[0].stroke, 9)
    for (const leg of nodded.legs.slice(2)) expect(leg.stroke).toBeGreaterThan(0)
    // And the mirror pose is the mirror answer.
    const raised = solveStewart({ pitch: -15 })
    expect(raised.legs[0].stroke).toBeGreaterThan(0)
    for (const leg of solveStewart({ heave: 4 }).legs) expect(leg.stroke).toBeGreaterThan(0)
    for (const leg of solveStewart({ heave: -4 }).legs) expect(leg.stroke).toBeLessThan(0)
  })

  it('flags legs that run out of travel without throwing away the geometry', () => {
    const stretched = solveStewart({ heave: 40 })
    expect(stretched.reachable).toBe(false)
    expect(stretched.legs.every(leg => !leg.withinLimits)).toBe(true)
    expect(stretched.legs.every(leg => Number.isFinite(leg.length))).toBe(true)
    expect(solveStewart({ heave: 4 }, { ...defaultStewartGeometry, travel: 1 }).reachable).toBe(false)
    expect(solveStewart({ heave: 4 }, { ...defaultStewartGeometry, travel: 20 }).reachable).toBe(true)
  })

  it('treats non-finite input as a rest pose and does not mutate its arguments', () => {
    const pose = Object.freeze({ yaw: NaN, pitch: Infinity, heave: undefined })
    expect(solveStewart(pose)).toEqual(solveStewart())
    const geometry = Object.freeze({ ...defaultStewartGeometry })
    expect(() => solveStewart({ yaw: 10 }, geometry)).not.toThrow()
    expect(geometry).toEqual(defaultStewartGeometry)
  })
})
