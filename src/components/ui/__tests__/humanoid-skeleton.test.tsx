import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { RobotFoot, footGoal } from "@/components/ui/robot-foot"
import { RobotHand } from "@/components/ui/robot-hand"
import { RobotLeg, legFoot, legStance } from "@/components/ui/robot-leg"
import { RobotSkeleton } from "@/components/ui/robot-skeleton"
import { RobotTorso, torsoBreath, torsoLean, torsoTwist } from "@/components/ui/robot-torso"

const path = (container: HTMLElement, selector: string) =>
  container.querySelector(selector)!.getAttribute("d")

/** The pinch caliper's own readout, which is a number the solver produced. */
const gapOf = (container: HTMLElement) =>
  Number(/GAP ([\d.]+)/.exec(container.textContent ?? "")?.[1])

describe("robot hand", () => {
  it("curls every digit through its own three-link chain", () => {
    const { container, rerender } = render(<RobotHand curl={0} grasp="power" behavior="static" />)
    const tip = (name: string) => path(container, `[data-phalanx="${name}-2"] path`)
    const open = ["index", "middle", "ring", "pinky", "thumb"].map(tip)
    expect(container.querySelectorAll("[data-digit]")).toHaveLength(5)
    expect(container.querySelectorAll("[data-phalanx]")).toHaveLength(15)

    rerender(<RobotHand curl={1} grasp="power" behavior="static" />)

    expect(["index", "middle", "ring", "pinky", "thumb"].map(tip)).not.toEqual(open)
  })

  it("closes the pinch the saddle-jointed thumb exists to close", () => {
    const { container, rerender } = render(<RobotHand curl={0} grasp="open" behavior="static" />)
    const apart = gapOf(container)

    rerender(<RobotHand curl={1} grasp="pinch" behavior="static" />)
    const pinched = gapOf(container)
    expect(pinched).toBeLessThan(apart * 0.35)

    // A hook never opposes, so its thumb never arrives anywhere near a pad.
    rerender(<RobotHand curl={1} grasp="hook" behavior="static" />)
    expect(gapOf(container)).toBeGreaterThan(pinched * 2)
  })

  it("leaves the pointing finger out of the grip, and names the grasp", () => {
    // Spread is pinned, so closure is the only thing left that can move a finger.
    const { container, rerender, getByRole } = render(
      <RobotHand curl={1} grasp="open" spread={0} behavior="static" />,
    )
    const index = () => path(container, '[data-phalanx="index-1"] path')
    const straight = index()
    rerender(<RobotHand curl={1} grasp="point" spread={0} behavior="static" />)
    // `point` holds the index at zero, so it stays exactly where `open` had it.
    expect(index()).toBe(straight)
    expect(path(container, '[data-phalanx="middle-1"] path')).not.toBe(straight)
    expect(getByRole("img").getAttribute("aria-label")).toContain("point grasp")
  })

  it("mirrors a left hand and takes a per-digit pose", () => {
    const right = render(<RobotHand curl={0.7} grasp="tripod" behavior="static" />)
    const left = render(<RobotHand curl={0.7} grasp="tripod" side="left" behavior="static" />)
    expect(path(left.container, '[data-digit="thumb"] path')).not.toBe(
      path(right.container, '[data-digit="thumb"] path'),
    )
    expect(left.container.querySelector("svg")!.getAttribute("aria-label")).toContain("left hand")

    const posed = render(
      <RobotHand curl={1} grasp="power" digits={[null, 0, null, null, null]} behavior="static" />,
    )
    expect(path(posed.container, '[data-phalanx="index-0"] path')).not.toBe(
      path(right.container, '[data-phalanx="index-0"] path'),
    )
  })

  it("stays neutral on nonsense and takes a colour override", () => {
    const { container } = render(
      // @ts-expect-error a stale grasp from a consumer must degrade, not throw.
      <RobotHand curl={NaN} grasp="crush" spread={NaN} wristPitch={NaN} color="#aabbcc" behavior="static" />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.innerHTML).toContain("#aabbcc")
  })
})

describe("robot foot", () => {
  it("rolls the sole heel to toe and hinges the toe plate at the ball", () => {
    const { container, rerender } = render(<RobotFoot roll={0} behavior="static" />)
    const strike = { sole: path(container, "[data-sole]"), toe: path(container, "[data-toe]") }

    rerender(<RobotFoot roll={1} behavior="static" />)

    expect(path(container, "[data-sole]")).not.toBe(strike.sole)
    expect(path(container, "[data-toe]")).not.toBe(strike.toe)
    expect(container.querySelector("[data-actuator='ankle']")).not.toBeNull()
  })

  it("moves the load from the heel to the toe through the stance", () => {
    const { container, rerender, getByRole } = render(<RobotFoot roll={0} behavior="static" />)
    const bearing = (part: string) =>
      Number(container.querySelector(`[data-pad="${part}"]`)!.getAttribute("fill-opacity"))
    expect(bearing("heel")).toBeGreaterThan(bearing("toe"))
    expect(getByRole("img").getAttribute("aria-label")).toContain("0 percent through its stance")

    rerender(<RobotFoot roll={1} behavior="static" />)

    expect(bearing("toe")).toBeGreaterThan(bearing("heel"))
    expect(getByRole("img").getAttribute("aria-label")).toContain("100 percent")
  })

  it("stays neutral on nonsense", () => {
    const { container } = render(<RobotFoot roll={NaN} behavior="static" phase={NaN} />)
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("runs the step loop through a stance and a lifted return", () => {
    expect(footGoal("step", 0)).toBe(0)
    expect(footGoal("step", 0.9)).toBeCloseTo(0.9, 6)
    // `rock` never leaves the floor, so it stays inside the stance window.
    for (const t of [0, 0.25, 0.5, 0.75]) expect(footGoal("rock", t)).toBeLessThanOrEqual(0.72)
    expect(footGoal("static", 0.5)).toBe(0)
    expect(footGoal("step", NaN)).toBe(0)
  })
})

describe("robot leg", () => {
  it("solves the hip and knee to a controlled foot", () => {
    const { container, rerender, getByRole } = render(
      <RobotLeg target={{ x: 0, y: 7 }} behavior="static" />,
    )
    const planted = {
      femur: path(container, "[data-femur]"),
      tibia: path(container, "[data-tibia]"),
      bend: getByRole("img").getAttribute("aria-label"),
    }

    rerender(<RobotLeg target={{ x: 26, y: 34 }} behavior="static" />)

    expect(path(container, "[data-femur]")).not.toBe(planted.femur)
    expect(path(container, "[data-tibia]")).not.toBe(planted.tibia)
    expect(getByRole("img").getAttribute("aria-label")).not.toBe(planted.bend)
    expect(container.querySelectorAll("[data-actuator]")).toHaveLength(2)
  })

  it("lowers the hip without shortening the leg, and names the knee", () => {
    const { container, rerender, getByRole } = render(
      <RobotLeg target={{ x: 0, y: 7 }} stance={1} behavior="static" />,
    )
    const tall = path(container, "[data-femur]")
    expect(getByRole("img").getAttribute("aria-label")).toMatch(/knee bent \d+ degrees/)

    rerender(<RobotLeg target={{ x: 0, y: 7 }} stance={0} behavior="static" />)

    expect(path(container, "[data-femur]")).not.toBe(tall)
  })

  it("stays neutral on nonsense", () => {
    const { container } = render(
      <RobotLeg target={{ x: NaN, y: NaN }} stance={NaN} stride={NaN} behavior="static" />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("drives the foot and the hip from pure functions of the clock", () => {
    expect(legFoot("static", 0.4).x).toBe(0)
    expect(legFoot("squat", 0.4).x).toBe(0)
    expect(legFoot("kick", 0.25).x).toBeGreaterThan(20)
    expect(legFoot("stride", 0.1).x).not.toBe(legFoot("stride", 0.8).x)
    expect(legFoot("stride", NaN).x).toBe(0)
    expect(legStance("squat", 0.5)).toBeLessThan(legStance("squat", 0))
    expect(legStance("stride", 0.5)).toBe(1)
  })
})

describe("robot torso", () => {
  it("leans and twists the column without changing how many bones it has", () => {
    const { container, rerender, getByRole } = render(
      <RobotTorso lean={0} twist={0} breath={0.4} ribs={7} />,
    )
    const upright = {
      vertebrae: container.querySelectorAll("[data-vertebra]").length,
      shoulder: path(container, '[data-shoulder="left"] path'),
      spine: path(container, '[data-vertebra="4"] path'),
    }
    expect(container.querySelectorAll("[data-rib]")).toHaveLength(7)

    rerender(<RobotTorso lean={35} twist={-30} breath={0.4} ribs={7} />)

    expect(container.querySelectorAll("[data-vertebra]").length).toBe(upright.vertebrae)
    expect(path(container, '[data-shoulder="left"] path')).not.toBe(upright.shoulder)
    expect(path(container, '[data-vertebra="4"] path')).not.toBe(upright.spine)
    expect(getByRole("img").getAttribute("aria-label")).toContain("leaning 35 degrees")
  })

  it("opens the cage as it breathes, and builds it from the rib count asked for", () => {
    const { container, rerender } = render(<RobotTorso lean={0} twist={0} breath={0} ribs={5} />)
    expect(container.querySelectorAll("[data-rib]")).toHaveLength(5)
    const empty = path(container, '[data-rib="2"] path')

    rerender(<RobotTorso lean={0} twist={0} breath={1} ribs={5} />)
    expect(path(container, '[data-rib="2"] path')).not.toBe(empty)

    rerender(<RobotTorso lean={0} twist={0} breath={1} ribs={9} />)
    expect(container.querySelectorAll("[data-rib]")).toHaveLength(9)
  })

  it("stays neutral on nonsense", () => {
    const { container } = render(
      <RobotTorso lean={NaN} twist={NaN} sway={NaN} breath={NaN} ribs={NaN} />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("drives the cage and the shoulders from pure functions of the clock", () => {
    expect(torsoBreath("breathe", 0.38)).toBeCloseTo(1, 6)
    expect(torsoBreath("breathe", 0)).toBe(0)
    expect(torsoBreath("static", 0.5)).toBe(0.3)
    expect(torsoTwist("twist", 0.25)).toBeGreaterThan(20)
    expect(torsoTwist("breathe", 0.25)).toBe(0)
    expect(torsoTwist("twist", NaN)).toBe(0)
  })
})

describe("robot skeleton", () => {
  it("walks: the cycle moves both legs and both arms", () => {
    const { container, rerender } = render(
      <RobotSkeleton gait="walk" phase={0} behavior="static" />,
    )
    const stood = {
      left: path(container, '[data-leg="left"] path'),
      right: path(container, '[data-leg="right"] path'),
      arm: path(container, '[data-arm="left"] path'),
    }
    expect(container.querySelectorAll("[data-leg]")).toHaveLength(2)
    expect(container.querySelectorAll("[data-arm]")).toHaveLength(2)
    expect(container.querySelectorAll("[data-hand]")).toHaveLength(2)

    rerender(<RobotSkeleton gait="walk" phase={0.4} behavior="static" />)

    expect(path(container, '[data-leg="left"] path')).not.toBe(stood.left)
    expect(path(container, '[data-leg="right"] path')).not.toBe(stood.right)
    expect(path(container, '[data-arm="left"] path')).not.toBe(stood.arm)
  })

  it("reports the flight a run has and the contact a walk keeps", () => {
    const { getByRole, rerender } = render(
      <RobotSkeleton gait="run" phase={0.44} stride={1} lift={1} behavior="static" />,
    )
    expect(getByRole("img").getAttribute("aria-label")).toContain("both feet clear of the floor")

    rerender(<RobotSkeleton gait="walk" phase={0.44} behavior="static" />)
    expect(getByRole("img").getAttribute("aria-label")).toContain("a foot on the floor")
  })

  it("closes the hands on the same grasp table the standalone hand uses", () => {
    const { container, rerender } = render(
      <RobotSkeleton gait="stand" phase={0} grasp="open" grip={0} behavior="static" />,
    )
    const relaxed = path(container, '[data-digit="left-index"]')
    expect(container.querySelectorAll('[data-hand="left"] [data-digit]')).toHaveLength(5)

    rerender(<RobotSkeleton gait="stand" phase={0} grasp="power" grip={1} behavior="static" />)

    expect(path(container, '[data-digit="left-index"]')).not.toBe(relaxed)
  })

  it("crouches, and names the view it is drawn from", () => {
    const { container, rerender, getByRole } = render(
      <RobotSkeleton gait="stand" phase={0} stance={1} view="profile" behavior="static" />,
    )
    const tall = path(container, '[data-leg="left"] path')
    expect(getByRole("img").getAttribute("aria-label")).toContain("side elevation")

    rerender(<RobotSkeleton gait="stand" phase={0} stance={0} view="profile" behavior="static" />)
    expect(path(container, '[data-leg="left"] path')).not.toBe(tall)
  })

  it("stays neutral on nonsense", () => {
    const { container } = render(
      // @ts-expect-error a stale gait from a consumer must degrade, not throw.
      <RobotSkeleton gait="sprint" phase={NaN} stance={NaN} stride={NaN} lean={NaN} behavior="static" />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })
})

/**
 * Every machine in the family runs on the shared clock, so reduced motion has
 * to park all of them at `phase` — and it has to park them at exactly the pose
 * the equivalent controlled props draw, not merely somewhere still.
 */
describe("reduced motion", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "matchMedia")
  })

  const askForLessMotion = () =>
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    })

  it("parks every loop at the pose its controlled props would draw", () => {
    askForLessMotion()
    const drawing = (markup: HTMLElement) => markup.querySelector("svg")!.innerHTML

    expect(drawing(render(<RobotSkeleton behavior="walk" />).container)).toBe(
      drawing(render(<RobotSkeleton gait="walk" phase={0} behavior="static" />).container),
    )
    expect(drawing(render(<RobotHand behavior="grip" grasp="power" />).container)).toBe(
      drawing(render(<RobotHand curl={0} grasp="power" behavior="static" />).container),
    )
    expect(drawing(render(<RobotFoot behavior="step" />).container)).toBe(
      drawing(render(<RobotFoot roll={0} behavior="static" />).container),
    )
    // Parked means "at phase", which for the torso is its own resting lean.
    expect(drawing(render(<RobotTorso behavior="breathe" />).container)).toBe(
      drawing(
        render(
          <RobotTorso lean={torsoLean("breathe", 0)} twist={0} breath={torsoBreath("breathe", 0)} />,
        ).container,
      ),
    )
  })
})
