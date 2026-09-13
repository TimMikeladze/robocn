import { describe, expect, it } from 'vitest'
import { distance2 } from '@/lib/robocn/kinematics'
import { duckAnkleHeight, duckLinks, solveDuck, type DuckGait } from '@/lib/robocn/duck'

describe('duck poses', () => {
  it('preserves every link length across gaits and pose extremes', () => {
    for (const gait of ['stand', 'walk', 'strut'] as DuckGait[]) {
      for (const height of [0, 0.55, 1]) {
        for (const phase of [0, 0.2, 0.5, 0.75, 0.999]) {
          const pose = solveDuck({ gait, height, phase, stride: 1, lift: 1, gaze: 1 })
          expect(pose.legs).toHaveLength(2)
          for (const leg of pose.legs) {
            expect(distance2(leg.hip, leg.knee)).toBeCloseTo(duckLinks.thigh, 6)
            expect(distance2(leg.knee, leg.ankle)).toBeCloseTo(duckLinks.shank, 6)
            expect(leg.ankle.y).toBeGreaterThanOrEqual(duckAnkleHeight - 1e-9)
          }
          expect(pose.neck).toHaveLength(4)
          duckLinks.neck.forEach((link, i) => expect(distance2(pose.neck[i], pose.neck[i + 1])).toBeCloseTo(link, 4))
        }
      }
    }
  })

  it("breaks the knees rearward, the way a bird's do", () => {
    for (const gait of ['stand', 'walk'] as DuckGait[]) {
      for (let phase = 0; phase < 1; phase += 0.05) {
        for (const leg of solveDuck({ gait, phase }).legs) expect(leg.knee.x).toBeLessThan(leg.hip.x)
      }
    }
  })

  it('never lifts both feet at once and keeps the cycle continuous', () => {
    for (const gait of ['walk', 'strut'] as DuckGait[]) {
      for (let phase = 0; phase < 1; phase += 0.02) {
        expect(solveDuck({ gait, phase }).legs.filter(leg => !leg.contact).length).toBeLessThanOrEqual(1)
      }
      const before = solveDuck({ gait, phase: 0.999999 })
      const after = solveDuck({ gait, phase: 0 })
      before.legs.forEach((leg, i) => expect(distance2(leg.ankle, after.legs[i].ankle)).toBeLessThan(0.001))
    }
    // A full walk cycle does swing each foot once.
    const swung = new Set<string>()
    for (let phase = 0; phase < 1; phase += 0.01) {
      for (const leg of solveDuck({ gait: 'walk', phase }).legs) if (!leg.contact) swung.add(leg.id)
    }
    expect([...swung].sort()).toEqual(['left', 'right'])
  })

  it('wraps phase, holds a standing pose still, and does not mutate options', () => {
    expect(solveDuck({ gait: 'walk', phase: -0.25 })).toEqual(solveDuck({ gait: 'walk', phase: 0.75 }))
    expect(solveDuck({ gait: 'stand', phase: 0 })).toEqual(solveDuck({ gait: 'stand', phase: 0.4 }))
    const options = Object.freeze({ gait: 'strut' as const, phase: 0.4 })
    expect(() => solveDuck(options)).not.toThrow()
  })

  it('swings the neck on a constant radius and opens the beak in degrees', () => {
    const shoulderReach = (gaze: number) => {
      const pose = solveDuck({ gaze })
      return distance2(pose.neck[0], pose.head.pivot)
    }
    expect(shoulderReach(-1)).toBeCloseTo(shoulderReach(1), 4)
    expect(solveDuck({ gaze: -1 }).head.pivot.x).toBeGreaterThan(solveDuck({ gaze: 1 }).head.pivot.x)
    expect(solveDuck({ gaze: 1 }).head.pivot.y).toBeGreaterThan(solveDuck({ gaze: -1 }).head.pivot.y)
    expect(solveDuck({ beak: 1 }).head.beak).toBe(34)
    expect(solveDuck({ beak: 0 }).head.beak).toBe(0)
  })

  it('normalizes non-finite controls and bounds the pelvis', () => {
    const pose = solveDuck({ phase: Infinity, height: NaN, stride: -2, lift: 10, gaze: NaN, beak: Infinity })
    expect(JSON.stringify(pose)).not.toMatch(/null|NaN|Infinity/)
    expect(pose.height).toBeCloseTo(24 + 30 * 0.55, 6)
    expect(solveDuck({ height: 0 }).height).toBe(24)
    expect(solveDuck({ height: 1 }).height).toBe(54)
  })
})
