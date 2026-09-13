import { describe, expect, it } from 'vitest'
import { distance2 } from '@/lib/robocn/kinematics'
import { solveQuadruped, type QuadrupedGait } from '@/lib/robocn/quadruped'

describe('quadruped poses', () => {
  it('preserves all eight link lengths across gaits and pose extremes', () => {
    for (const gait of ['stand', 'walk', 'trot'] as QuadrupedGait[]) {
      for (const height of [0, 0.5, 1]) {
        for (const phase of [0, 0.125, 0.25, 0.5, 0.75, 0.999]) {
          const pose = solveQuadruped({ gait, height, phase, stride: 1, lift: 1 })
          expect(pose.legs).toHaveLength(4)
          for (const leg of pose.legs) {
            expect(distance2(leg.hip, leg.knee)).toBeCloseTo(30, 6)
            expect(distance2(leg.knee, leg.foot)).toBeCloseTo(28, 6)
            expect(leg.foot.y).toBeGreaterThanOrEqual(0)
          }
        }
      }
    }
  })

  it('moves diagonal pairs together during trot and only one swing leg during walk', () => {
    const trot = solveQuadruped({ gait: 'trot', phase: 0.75 })
    expect(trot.legs.filter(leg => !leg.contact).map(leg => leg.id)).toEqual(['front-left', 'rear-right'])
    for (let phase = 0.01; phase < 1; phase += 0.05) {
      expect(solveQuadruped({ gait: 'walk', phase }).legs.filter(leg => !leg.contact)).toHaveLength(1)
    }
  })

  it('wraps phase, keeps a standing pose still, and does not mutate options', () => {
    expect(solveQuadruped({ gait: 'trot', phase: -0.25 })).toEqual(solveQuadruped({ gait: 'trot', phase: 0.75 }))
    expect(solveQuadruped({ gait: 'stand', phase: 0 })).toEqual(solveQuadruped({ gait: 'stand', phase: 0.7 }))
    const options = Object.freeze({ gait: 'walk' as const, phase: 0.4 })
    expect(() => solveQuadruped(options)).not.toThrow()
  })

  it('keeps foot positions continuous across the cycle seam', () => {
    for (const gait of ['walk', 'trot'] as QuadrupedGait[]) {
      const before = solveQuadruped({ gait, phase: 0.999999 })
      const after = solveQuadruped({ gait, phase: 0 })
      before.legs.forEach((leg, index) => expect(distance2(leg.foot, after.legs[index].foot)).toBeLessThan(0.001))
    }
  })

  it('normalizes non-finite controls and bounds dimensions', () => {
    const pose = solveQuadruped({ phase: Infinity, height: NaN, stride: -2, lift: 10 })
    expect(JSON.stringify(pose)).not.toMatch(/null|NaN|Infinity/)
    expect(pose.height).toBe(45)
    expect(pose.legs.every(leg => Number.isFinite(leg.knee.x))).toBe(true)
  })
})
