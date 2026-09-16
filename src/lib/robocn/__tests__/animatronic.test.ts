import { describe, expect, it } from "vitest"

import {
  animatronicBlink,
  animatronicBreath,
  animatronicRoutines,
  attentionShare,
  balanceOf,
  balanceRoll,
  balanceRollLimit,
  blendIntent,
  centreOfMass,
  footHalfWidth,
  handFrame,
  placeIn,
  polygonMargin,
  restIntent,
  ribCage,
  rollAbout,
  routineIntent,
  segmentMass,
  solveAnimatronic,
  solveAttention,
  spineAt,
  supportPolygon,
  type AnimatronicRoutine,
} from "@/lib/robocn/animatronic"
import { distance3, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import { defaultProportions, solveSkeleton } from "@/lib/robocn/skeleton"

const clocks = [0, 0.17, 0.4, 0.83, 1.6, 2.9, 5.5, 11.3]
const routines = animatronicRoutines as readonly AnimatronicRoutine[]

const finiteVec3 = (v: Vec3) =>
  Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)

describe("animatronic routines", () => {
  it("returns a finite, bounded intent for every routine at every phase", () => {
    for (const routine of routines) {
      for (const clock of clocks) {
        const intent = routineIntent(routine, clock)
        expect(intent.stance).toBeGreaterThanOrEqual(0)
        expect(intent.stance).toBeLessThanOrEqual(1)
        expect(intent.blink).toBeGreaterThanOrEqual(0)
        expect(intent.blink).toBeLessThanOrEqual(1)
        expect(intent.breath).toBeGreaterThanOrEqual(0)
        expect(intent.breath).toBeLessThanOrEqual(1)
        expect(intent.grip).toBeGreaterThanOrEqual(0)
        expect(intent.grip).toBeLessThanOrEqual(1)
        expect(Number.isFinite(intent.lean)).toBe(true)
        expect(Number.isFinite(intent.twist)).toBe(true)
        expect(Math.abs(intent.look.x)).toBeLessThanOrEqual(1)
        expect(Math.abs(intent.look.y)).toBeLessThanOrEqual(1)
        if (intent.reach) expect(finiteVec3(intent.reach)).toBe(true)
      }
    }
  })

  it("parks completely on static and never parks on anything else", () => {
    const still = routineIntent("static", 3.7)
    expect(still.speech).toBe(0)
    expect(still.blink).toBe(0)
    expect(still.reach).toBeNull()
    expect(still.gait).toBe("stand")

    // Every other routine moves something over a cycle.
    for (const routine of routines.filter((r) => r !== "static")) {
      const samples = clocks.map((clock) => routineIntent(routine, clock))
      const moved = samples.some(
        (intent, index) =>
          index > 0 &&
          (intent.neckYaw !== samples[0].neckYaw ||
            intent.breath !== samples[0].breath ||
            intent.look.x !== samples[0].look.x),
      )
      expect(moved, `${routine} never moves`).toBe(true)
    }
  })

  it("gives the neutral intent for rubbish clocks", () => {
    for (const routine of routines) {
      const intent = routineIntent(routine, Number.NaN)
      expect(Number.isFinite(intent.lean)).toBe(true)
      expect(Number.isFinite(intent.neckYaw)).toBe(true)
      expect(Number.isFinite(intent.breath)).toBe(true)
    }
  })

  it("waves with one arm and offers with two, rather than clasping its hands", () => {
    // A wave is one hand: the other stays where it hangs.
    const greet = routineIntent("greet", 0.4)
    expect(greet.reach).toBeNull()
    expect(greet.reachLeft).not.toBeNull()
    expect(greet.reachRight).toBeNull()

    // Offering is two hands, and they stay on their own sides of the machine.
    const present = routineIntent("present", 0.4)
    expect(present.reachLeft!.x).toBeLessThan(0)
    expect(present.reachRight!.x).toBeGreaterThan(0)
  })

  it("only walks when the walk routine asks for it", () => {
    expect(routineIntent("walk", 0.3).gait).toBe("walk")
    for (const routine of routines.filter((r) => r !== "walk")) {
      expect(routineIntent(routine, 0.3).gait).toBe("stand")
    }
  })

  it("blinks as spikes, not as a wave", () => {
    const samples = Array.from({ length: 400 }, (_, i) => animatronicBlink(i * 0.05))
    const shut = samples.filter((v) => v > 0.5).length
    expect(shut).toBeGreaterThan(0)
    // An eye is open far more often than it is shut.
    expect(shut / samples.length).toBeLessThan(0.2)
    expect(Math.max(...samples)).toBeGreaterThan(0.9)
    expect(animatronicBlink(Number.NaN)).toBeGreaterThanOrEqual(0)
  })

  it("breathes a full cycle that fills faster than it empties", () => {
    const rate = 0.25
    const period = 1 / rate
    // The fill takes 38% of the cycle; the peak is inside that.
    const peak = animatronicBreath(period * 0.38, rate)
    expect(peak).toBeGreaterThan(0.99)
    expect(animatronicBreath(0, rate)).toBeLessThan(0.02)
    expect(animatronicBreath(period, rate)).toBeCloseTo(animatronicBreath(0, rate), 6)
  })
})

describe("blendIntent", () => {
  it("returns each end exactly at its own end of the fade", () => {
    const a = routineIntent("idle", 1.2)
    const b = routineIntent("converse", 3.4)
    expect(blendIntent(a, b, 0).neckYaw).toBeCloseTo(a.neckYaw, 9)
    expect(blendIntent(a, b, 1).neckYaw).toBeCloseTo(b.neckYaw, 9)
    expect(blendIntent(a, b, 0).breath).toBeCloseTo(a.breath, 9)
    expect(blendIntent(a, b, 1).speech).toBeCloseTo(b.speech, 9)
  })

  it("keeps the discrete fields discrete", () => {
    const stand = routineIntent("idle", 0.4)
    const walk = routineIntent("walk", 0.4)
    expect(blendIntent(stand, walk, 0.2).gait).toBe("stand")
    expect(blendIntent(stand, walk, 0.8).gait).toBe("walk")
  })

  it("fades a reach in and out without inventing a target at the wrong end", () => {
    const swinging = routineIntent("idle", 0.4)
    const reaching = routineIntent("present", 0.4)
    expect(swinging.reachLeft).toBeNull()
    expect(reaching.reachLeft).not.toBeNull()
    expect(blendIntent(swinging, reaching, 0).reachLeft).toBeNull()
    expect(blendIntent(swinging, reaching, 0.5).reachLeft).not.toBeNull()
    expect(blendIntent(swinging, reaching, 1).reachRight).toEqual(reaching.reachRight)
  })
})

describe("attention", () => {
  it("spends the eyes before the neck and the neck before the waist", () => {
    const small = solveAttention({ x: 0.2, y: 0 })
    expect(Math.abs(small.neckYaw)).toBeLessThan(1e-9)
    expect(Math.abs(small.twist)).toBeLessThan(1e-9)
    expect(Math.abs(small.look.x)).toBeGreaterThan(0.5)

    const medium = solveAttention({ x: 0.55, y: 0 })
    expect(Math.abs(medium.look.x)).toBeCloseTo(1, 9)
    expect(Math.abs(medium.neckYaw)).toBeGreaterThan(0)
    expect(Math.abs(medium.twist)).toBeLessThan(1e-9)

    const far = solveAttention({ x: 1, y: 0 })
    expect(Math.abs(far.look.x)).toBeCloseTo(1, 9)
    expect(Math.abs(far.neckYaw)).toBeCloseTo(attentionShare.neckYaw, 9)
    expect(Math.abs(far.twist)).toBeCloseTo(attentionShare.waistTwist, 9)
    expect(far.reached).toBe(true)
  })

  it("keeps every stage inside its own limit, and clamps rubbish", () => {
    for (const x of [-4, -1, -0.3, 0, 0.7, 1, 9, Number.NaN]) {
      for (const y of [-2, 0, 1, Number.POSITIVE_INFINITY]) {
        const out = solveAttention({ x, y })
        expect(Math.abs(out.look.x)).toBeLessThanOrEqual(1)
        expect(Math.abs(out.look.y)).toBeLessThanOrEqual(1)
        expect(Math.abs(out.neckYaw)).toBeLessThanOrEqual(attentionShare.neckYaw + 1e-9)
        expect(Math.abs(out.neckPitch)).toBeLessThanOrEqual(attentionShare.neckPitch + 1e-9)
        expect(Math.abs(out.twist)).toBeLessThanOrEqual(attentionShare.waistTwist + 1e-9)
        expect(Math.abs(out.lean)).toBeLessThanOrEqual(attentionShare.waistLean + 1e-9)
      }
    }
  })

  it("leaves the look to the eyes when the effort is low", () => {
    const lazy = solveAttention({ x: 1, y: 0 }, 0)
    expect(Math.abs(lazy.look.x)).toBeCloseTo(1, 9)
    expect(Math.abs(lazy.neckYaw)).toBeLessThan(1e-9)
    expect(Math.abs(lazy.twist)).toBeLessThan(1e-9)
  })

  it("rests when there is nothing to look at", () => {
    expect(solveAttention(null).look).toEqual({ x: 0, y: 0 })
    expect(solveAttention(null).twist).toBe(0)
  })
})

describe("balance", () => {
  it("has a mass model that sums to one body", () => {
    const total =
      segmentMass.head +
      segmentMass.trunk +
      2 * (segmentMass.upperArm + segmentMass.forearm + segmentMass.thigh + segmentMass.shank + segmentMass.foot)
    expect(total).toBeCloseTo(1, 6)
  })

  it("puts a standing machine's weight between its feet, at about hip height", () => {
    const pose = solveSkeleton({ gait: "stand" })
    const com = centreOfMass(pose)
    expect(Math.abs(com.x)).toBeLessThan(1)
    // A human's COM sits a little above the hip joint, not at the shoulders.
    expect(com.y).toBeGreaterThan(defaultProportions.hip * 0.8)
    expect(com.y).toBeLessThan(defaultProportions.hip * 1.4)

    const balance = balanceOf(pose)
    expect(balance.support.length).toBeGreaterThanOrEqual(3)
    expect(balance.stable).toBe(true)
    expect(balance.margin).toBeGreaterThan(0)
  })

  it("moves the weight when an arm goes up", () => {
    const hanging = centreOfMass(solveSkeleton({ gait: "stand" }))
    const reaching = centreOfMass(
      solveSkeleton({ gait: "stand", reach: { x: -40, y: 160, z: -40 } }),
    )
    expect(reaching.y).toBeGreaterThan(hanging.y)
    expect(reaching.z).toBeLessThan(hanging.z)
  })

  it("shrinks the support polygon to one foot in mid-swing", () => {
    const both = supportPolygon(solveSkeleton({ gait: "stand" }))
    const single = supportPolygon(solveSkeleton({ gait: "walk", phase: 0.75, stride: 1 }))
    const area = (polygon: Vec2[]) => {
      let sum = 0
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        sum += (polygon[j].x + polygon[i].x) * (polygon[j].y - polygon[i].y)
      }
      return Math.abs(sum / 2)
    }
    expect(area(single)).toBeLessThan(area(both))
    expect(area(single)).toBeGreaterThan(0)
  })

  it("reports a signed margin: positive inside, negative outside", () => {
    const square: Vec2[] = [
      { x: -10, y: -10 },
      { x: 10, y: -10 },
      { x: 10, y: 10 },
      { x: -10, y: 10 },
    ]
    expect(polygonMargin({ x: 0, y: 0 }, square)).toBeCloseTo(10, 6)
    expect(polygonMargin({ x: 9, y: 0 }, square)).toBeCloseTo(1, 6)
    expect(polygonMargin({ x: 14, y: 0 }, square)).toBeCloseTo(-4, 6)
    expect(polygonMargin({ x: 0, y: 0 }, [])).toBe(Number.NEGATIVE_INFINITY)
  })

  it("rolls rigidly: every distance survives the correction", () => {
    const pivot: Vec2 = { x: 3, y: -2 }
    const a: Vec3 = { x: 10, y: 40, z: 5 }
    const b: Vec3 = { x: -6, y: 90, z: -12 }
    expect(distance3(rollAbout(a, pivot, 17), rollAbout(b, pivot, 17))).toBeCloseTo(
      distance3(a, b),
      9,
    )
    expect(rollAbout(a, pivot, 0)).toEqual(a)
  })

  it("does not roll a machine that is already over its feet", () => {
    expect(Math.abs(balanceRoll(solveSkeleton({ gait: "stand" })))).toBeLessThan(1.5)
  })

  it("stays inside the waist's limit however bad the pose is", () => {
    for (const phase of [0, 0.2, 0.37, 0.5, 0.68, 0.9]) {
      const roll = balanceRoll(solveSkeleton({ gait: "run", phase, stride: 1, lift: 1 }))
      expect(Math.abs(roll)).toBeLessThanOrEqual(balanceRollLimit + 1e-9)
    }
  })

  it("the correction never makes the margin worse", () => {
    for (const phase of [0.1, 0.25, 0.4, 0.6, 0.75, 0.9]) {
      const loose = solveAnimatronic({ gait: "walk", cycle: phase, stride: 1, balance: false })
      const held = solveAnimatronic({ gait: "walk", cycle: phase, stride: 1, balance: true })
      expect(held.balance.margin).toBeGreaterThanOrEqual(loose.balance.margin - 1e-6)
    }
  })

  it("keeps a support polygon under the machine at all times when standing", () => {
    for (const halfWidth of [1, footHalfWidth, 12]) {
      const balance = balanceOf(solveSkeleton({ gait: "stand" }), halfWidth)
      expect(balance.support.length).toBeGreaterThanOrEqual(3)
    }
  })
})

describe("ribcage", () => {
  it("opens in depth more than in width when it fills", () => {
    const spine = solveSkeleton({ gait: "stand" }).spine
    const empty = ribCage(spine, { breath: 0 })
    const full = ribCage(spine, { breath: 1 })
    const span = (ribs: ReturnType<typeof ribCage>, axis: "x" | "z") => {
      const values = ribs.flatMap((rib) => [...rib.left, ...rib.right].map((p) => p[axis]))
      return Math.max(...values) - Math.min(...values)
    }
    const widened = span(full, "x") - span(empty, "x")
    const deepened = span(full, "z") - span(empty, "z")
    expect(deepened).toBeGreaterThan(widened)
    expect(widened).toBeGreaterThanOrEqual(0)
  })

  it("hangs the cage forward of the column rather than around it", () => {
    const spine = solveSkeleton({ gait: "stand" }).spine
    const centred = ribCage(spine, { front: 0 })
    const hung = ribCage(spine, { front: 8 })
    const back = (ribs: ReturnType<typeof ribCage>) =>
      Math.max(...ribs.flatMap((rib) => [...rib.left, ...rib.right].map((p) => p.z)))
    // Less of it behind the spine, and the sternum further in front.
    expect(back(hung)).toBeLessThan(back(centred))
    expect(hung[3].front.z).toBeLessThan(centred[3].front.z)
  })

  it("clamps its hoop count and stays finite for rubbish", () => {
    const spine = solveSkeleton({ gait: "stand" }).spine
    expect(ribCage(spine, { count: 0 })).toHaveLength(3)
    expect(ribCage(spine, { count: 90 })).toHaveLength(12)
    for (const rib of ribCage(spine, { count: Number.NaN, breath: Number.NaN })) {
      expect(rib.left.every(finiteVec3)).toBe(true)
      expect(rib.right.every(finiteVec3)).toBe(true)
    }
  })

  it("walks the spine end to end", () => {
    const spine = solveSkeleton({ gait: "stand" }).spine
    expect(spineAt(spine, 0)).toEqual(spine[0])
    expect(spineAt(spine, 1)).toEqual(spine[spine.length - 1])
    expect(spineAt(spine, -5)).toEqual(spine[0])
    expect(spineAt([], 0.5)).toEqual({ x: 0, y: 0, z: 0 })
  })
})

describe("hand framing", () => {
  it("is orthonormal, so a hand is not sheared onto the wrist", () => {
    const pose = solveSkeleton({ gait: "walk", phase: 0.3 })
    for (const arm of pose.arms) {
      const frame = handFrame(arm)
      for (const axis of [frame.right, frame.up, frame.out]) {
        expect(Math.hypot(axis.x, axis.y, axis.z)).toBeCloseTo(1, 6)
      }
      const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
      expect(dot(frame.right, frame.up)).toBeCloseTo(0, 6)
      expect(dot(frame.right, frame.out)).toBeCloseTo(0, 6)
    }
  })

  it("places the wrist origin exactly on the wrist and scales the rest", () => {
    const pose = solveSkeleton({ gait: "stand" })
    const frame = handFrame(pose.arms[0], 0.3)
    const at = placeIn(frame, { x: 0, y: 0, z: 0 })
    expect(distance3(at, pose.arms[0].wrist)).toBeCloseTo(0, 9)
    const out = placeIn(frame, { x: 0, y: 10, z: 0 })
    expect(distance3(out, pose.arms[0].wrist)).toBeCloseTo(3, 6)
  })
})

describe("solveAnimatronic", () => {
  it("builds a whole machine for every routine and phase, with no NaN anywhere", () => {
    for (const routine of routines) {
      for (const clock of clocks) {
        const body = solveAnimatronic({ ...routineIntent(routine, clock), balance: true })
        expect(body.skeleton.legs).toHaveLength(2)
        expect(body.hands).toHaveLength(2)
        expect(body.ribs.length).toBeGreaterThan(2)
        expect(finiteVec3(body.headCentre)).toBe(true)
        expect(finiteVec3(body.balance.com)).toBe(true)
        expect(Number.isFinite(body.roll)).toBe(true)
        expect(body.face.withinLimits).toBe(true)
        for (const hand of body.hands) {
          for (const digit of hand.pose.digits) {
            expect(digit.joints.every(finiteVec3)).toBe(true)
          }
        }
      }
    }
  })

  it("keeps every bone the same length through the balance correction", () => {
    const p = defaultProportions
    for (const phase of [0.1, 0.4, 0.62, 0.88]) {
      const body = solveAnimatronic({ gait: "walk", cycle: phase, stride: 1, balance: true })
      for (const leg of body.skeleton.legs) {
        expect(distance3(leg.hip, leg.knee)).toBeCloseTo(p.femur, 6)
        expect(distance3(leg.knee, leg.ankle)).toBeCloseTo(p.tibia, 6)
      }
      for (const arm of body.skeleton.arms) {
        expect(distance3(arm.shoulder, arm.elbow)).toBeCloseTo(p.humerus, 6)
        expect(distance3(arm.elbow, arm.wrist)).toBeCloseTo(p.forearm, 6)
      }
    }
  })

  it("re-solves one arm to its own target without moving the other", () => {
    const shared = { x: 0, y: 130, z: -50 }
    const both = solveAnimatronic({ reach: shared })
    const oneUp = solveAnimatronic({ reachLeft: { x: -40, y: 160, z: -20 } })

    const left = oneUp.skeleton.arms.find((a) => a.side === "left")!
    const right = oneUp.skeleton.arms.find((a) => a.side === "right")!
    expect(distance3(left.wrist, { x: -40, y: 160, z: -20 })).toBeLessThan(1)
    // The right arm is still hanging, not dragged along with it.
    expect(right.wrist.y).toBeLessThan(right.shoulder.y)
    // Bone lengths survive the override.
    expect(distance3(left.shoulder, left.elbow)).toBeCloseTo(defaultProportions.humerus, 6)
    expect(distance3(left.elbow, left.wrist)).toBeCloseTo(defaultProportions.forearm, 6)

    // A raised arm moves the weight, so the balance is measured on the armed pose.
    expect(oneUp.balance.com.x).toBeLessThan(both.balance.com.x)
  })

  it("clamps an out-of-reach per-side target instead of producing NaN", () => {
    const far = solveAnimatronic({ reachRight: { x: 900, y: 900, z: -900 } })
    const arm = far.skeleton.arms.find((a) => a.side === "right")!
    expect(Number.isFinite(arm.wrist.x)).toBe(true)
    expect(distance3(arm.shoulder, arm.elbow)).toBeCloseTo(defaultProportions.humerus, 6)
    expect(distance3(arm.elbow, arm.wrist)).toBeCloseTo(defaultProportions.forearm, 6)
    // Rubbish is refused outright rather than solved to.
    const bad = solveAnimatronic({ reachLeft: { x: Number.NaN, y: 1, z: 1 } })
    expect(Number.isFinite(bad.skeleton.arms[0].wrist.y)).toBe(true)
  })

  it("solves the arms to a reach and leaves them swinging without one", () => {
    const target = { x: 0, y: 130, z: -50 }
    const reaching = solveAnimatronic({ reach: target })
    for (const arm of reaching.skeleton.arms) {
      expect(distance3(arm.wrist, target)).toBeLessThan(1)
    }
    const swinging = solveAnimatronic({ reach: null })
    for (const arm of swinging.skeleton.arms) {
      expect(arm.wrist.y).toBeLessThan(arm.shoulder.y)
    }
  })

  it("drives the face rig from the intent rather than from a name", () => {
    const talking = solveAnimatronic({ speech: 1 })
    const quiet = solveAnimatronic({ speech: 0 })
    expect(talking.face.jaw).toBeGreaterThan(quiet.face.jaw)

    const shut = solveAnimatronic({ blink: 1 })
    expect(shut.face.left.lidUpper).toBeCloseTo(1, 6)
    expect(shut.face.right.lidUpper).toBeCloseTo(1, 6)
  })

  it("defaults to the rest intent and leaves the pose alone without balance", () => {
    const body = solveAnimatronic()
    expect(body.intent.gait).toBe(restIntent.gait)
    expect(body.roll).toBe(0)
    expect(body.skeleton.legs[0].hip.x).toBeCloseTo(-defaultProportions.hipSpan, 6)
  })

  it("survives rubbish inputs with a stable pose rather than throwing", () => {
    const body = solveAnimatronic({
      cycle: Number.NaN,
      stance: Number.NaN,
      lean: Number.POSITIVE_INFINITY,
      breath: Number.NaN,
      grip: Number.NaN,
      reach: { x: Number.NaN, y: 0, z: 0 },
      balance: true,
    })
    expect(finiteVec3(body.skeleton.pelvis)).toBe(true)
    expect(body.skeleton.legs.every((leg) => finiteVec3(leg.ankle))).toBe(true)
    expect(body.ribs.every((rib) => rib.left.every(finiteVec3))).toBe(true)
    expect(Number.isFinite(body.balance.margin)).toBe(true)
  })
})
