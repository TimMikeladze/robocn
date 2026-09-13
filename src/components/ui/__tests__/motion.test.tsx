import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ConveyorBelt } from "@/components/ui/conveyor-belt"
import { LinearActuator, strokeGoal } from "@/components/ui/linear-actuator"
import { MicroDuck, duckBehaviorPose } from "@/components/ui/micro-duck"
import { ReachyMini, reachyBehaviorPose } from "@/components/ui/reachy-mini"
import { RobotFace, faceGaze } from "@/components/ui/robot-face"
import { RobotGripper, gripperCarrying, gripperGoal } from "@/components/ui/robot-gripper"
import { RobotQuadruped } from "@/components/ui/robot-quadruped"
import { RobotRover, roverGoal } from "@/components/ui/robot-rover"
import { RotaryTable } from "@/components/ui/rotary-table"
import { ServoMotor, servoGoal } from "@/components/ui/servo-motor"
import { LidarScan, returnFreshness } from "@/components/ui/lidar-scan"

/** The behaviours are pure functions of the clock, so they sample directly. */
describe("behaviour profiles", () => {
  it("strokes the actuator out, dwells, and brings it back", () => {
    expect(strokeGoal("cycle", 0)).toBe(0)
    expect(strokeGoal("cycle", 0.4)).toBe(1)
    expect(strokeGoal("cycle", 0.95)).toBe(0)
    // Whole cycles repeat, in both directions.
    expect(strokeGoal("cycle", 1.4)).toBe(strokeGoal("cycle", -0.6))
    expect(strokeGoal("breathe", 0.5)).toBeCloseTo(1, 5)
    expect(strokeGoal("static", 9)).toBe(0.5)
    expect(strokeGoal("cycle", NaN)).toBe(0)
  })

  it("gives the servo a sweep, discrete steps, and a hunting wobble", () => {
    expect(servoGoal("sweep", 0.25)).toBeCloseTo(90, 5)
    expect(servoGoal("sweep", 0.75)).toBeCloseTo(-90, 5)
    expect(servoGoal("step", 0.1)).toBe(-90)
    expect(servoGoal("step", 0.6)).toBe(90)
    expect(Math.abs(servoGoal("hunt", 0.37))).toBeLessThan(3)
    expect(servoGoal("static", 4)).toBe(0)
  })

  it("closes the gripper onto a part and carries it for the closed half", () => {
    expect(gripperGoal("cycle", 0)).toBe(0.9)
    expect(gripperGoal("cycle", 0.5)).toBe(0.12)
    expect(gripperCarrying(0.1)).toBe(false)
    expect(gripperCarrying(0.5)).toBe(true)
    expect(gripperCarrying(0.95)).toBe(false)
  })

  it("patrols the rover in square turns and aims it at a bearing on demand", () => {
    expect(roverGoal("patrol", 0.4)).toBe(0)
    expect(roverGoal("patrol", 1.2)).toBe(90)
    expect(roverGoal("pointer", 3, 210)).toBe(210)
    expect(roverGoal("pointer", 3, null)).toBe(0)
    expect(roverGoal("static", 7)).toBe(0)
  })

  it("lights a lidar return as the ray passes and fades it behind", () => {
    expect(returnFreshness(90, 90)).toBe(1)
    expect(returnFreshness(90, 270)).toBe(0)
    // Just behind the ray is brighter than well behind it.
    expect(returnFreshness(90, 60)).toBeGreaterThan(returnFreshness(90, 10))
  })

  it("keeps the companions' idle poses inside their own limits", () => {
    for (const clock of [0, 0.3, 1.1, 4.7]) {
      const duck = duckBehaviorPose("idle", clock)
      expect(Math.abs(duck.gaze)).toBeLessThanOrEqual(1)
      expect(duck.beak).toBeGreaterThanOrEqual(0)
      const head = reachyBehaviorPose("scan", clock)
      expect(Math.abs(head.yaw)).toBeLessThanOrEqual(30)
      expect(Math.abs(head.pitch)).toBeLessThanOrEqual(24)
      const gaze = faceGaze("wander", clock)
      expect(Math.hypot(gaze.x, gaze.y)).toBeLessThanOrEqual(1)
    }
    expect(duckBehaviorPose("peck", 0.42).gaze).toBeLessThan(0)
    expect(faceGaze("still", 3)).toEqual({ x: 0, y: 0 })
  })
})

describe("controlled wins", () => {
  it("ignores the behaviour while a value prop is supplied", () => {
    const { container, rerender } = render(<LinearActuator extension={0.25} behavior="cycle" />)
    expect(container.querySelector("[data-rod]")!.getAttribute("transform")).toBe("translate(12 0)")
    rerender(<LinearActuator extension={0.25} behavior="breathe" speed={9} />)
    expect(container.querySelector("[data-rod]")!.getAttribute("transform")).toBe("translate(12 0)")
  })

  it("parks an uncontrolled machine at its phase when animation is off", () => {
    const { container } = render(<ServoMotor behavior="sweep" animate={false} />)
    expect(container.querySelector("[data-horn]")!.getAttribute("transform")).toBe("rotate(0)")
  })

  it("runs the pick cycle only while the jaws are its own", () => {
    const { container, rerender } = render(<RobotGripper animate={false} behavior="cycle" />)
    // Phase zero is open and empty-handed.
    expect(container.querySelector("[data-jaw='left']")!.getAttribute("transform")).toBe("translate(-11.7 0)")
    rerender(<RobotGripper opening={0} behavior="cycle" holding />)
    expect(container.querySelector("[data-jaw='left']")!.getAttribute("transform")).toBe("translate(0 0)")
  })
})

describe("interaction", () => {
  it("exposes an interactive machine as a slider and steps it from the keyboard", () => {
    const onExtensionChange = vi.fn()
    const { getByRole } = render(
      <LinearActuator interactive extension={0.5} onExtensionChange={onExtensionChange} />,
    )
    const slider = getByRole("slider")
    expect(slider.getAttribute("aria-valuenow")).toBe("50")
    fireEvent.keyDown(slider, { key: "ArrowRight" })
    expect(onExtensionChange).toHaveBeenLastCalledWith(0.55)
    fireEvent.keyDown(slider, { key: "End" })
    expect(onExtensionChange).toHaveBeenLastCalledWith(1)
    // Controlled: the drawing still only shows what it was given.
    expect(slider.getAttribute("aria-valuenow")).toBe("50")
  })

  it("leaves a machine as an image until it is made interactive", () => {
    const { getByRole } = render(<ServoMotor angle={30} />)
    expect(getByRole("img")).toBeTruthy()
  })

  it("turns the servo horn toward a press", () => {
    const onAngleChange = vi.fn()
    const { getByRole } = render(<ServoMotor interactive onAngleChange={onAngleChange} animate={false} />)
    const svg = getByRole("slider")
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 160, height: 180 }) as DOMRect
    // Straight right of the hub at (80, 69) is a quarter turn clockwise.
    fireEvent.pointerDown(svg, { clientX: 140, clientY: 69, pointerId: 1 })
    expect(onAngleChange).toHaveBeenLastCalledWith(90)
    expect(svg.getAttribute("aria-valuenow")).toBe("90")
    fireEvent.pointerUp(svg, { pointerId: 1 })
  })

  it("indexes the rotary table to the fixture that was clicked", () => {
    const onStationChange = vi.fn()
    const onAngleChange = vi.fn()
    const { getByRole } = render(
      <RotaryTable interactive animate={false} stations={4}
        onStationChange={onStationChange} onAngleChange={onAngleChange} />,
    )
    const svg = getByRole("slider")
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 180, height: 180 }) as DOMRect
    // A press to the right of the centre, released without a sweep, is a click
    // on the station a quarter turn round.
    fireEvent.pointerDown(svg, { clientX: 160, clientY: 86, pointerId: 1 })
    fireEvent.pointerUp(svg, { pointerId: 1 })
    expect(onStationChange).toHaveBeenLastCalledWith(1)
    expect(onAngleChange).toHaveBeenLastCalledWith(270)
  })

  it("scrubs the conveyor with the belt under the finger", () => {
    const onPositionChange = vi.fn()
    const { getByRole } = render(<ConveyorBelt interactive animate={false} onPositionChange={onPositionChange} />)
    const svg = getByRole("slider")
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 76 }) as DOMRect
    fireEvent.pointerDown(svg, { clientX: 0, clientY: 40, pointerId: 1 })
    fireEvent.pointerMove(svg, { clientX: 100, clientY: 40, pointerId: 1 })
    expect(onPositionChange).toHaveBeenLastCalledWith(0.5)
  })

  it("aims the rover at a press and reports the bearing", () => {
    const onHeadingChange = vi.fn()
    const { getByRole } = render(
      <RobotRover interactive animate={false} onHeadingChange={onHeadingChange} />,
    )
    const svg = getByRole("slider")
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 180, height: 180 }) as DOMRect
    fireEvent.pointerDown(svg, { clientX: 90, clientY: 10, pointerId: 1 })
    expect(onHeadingChange).toHaveBeenLastCalledWith(0)
    fireEvent.pointerMove(svg, { clientX: 170, clientY: 90, pointerId: 1 })
    expect(onHeadingChange).toHaveBeenLastCalledWith(90)
  })

  it("quacks when the duck is poked", () => {
    const onQuack = vi.fn()
    const { container, getByRole } = render(<MicroDuck onQuack={onQuack} />)
    const shut = container.querySelector("[data-beak]")!.getAttribute("transform")
    fireEvent.pointerDown(getByRole("img"))
    expect(onQuack).toHaveBeenCalledTimes(1)
    expect(container.querySelector("[data-beak]")!.getAttribute("transform")).not.toBe(shut)
  })

  it("nods the companion head when it is clicked", () => {
    const onNod = vi.fn()
    const { container, getByRole } = render(<ReachyMini track={false} behavior="static" onNod={onNod} />)
    const still = container.querySelector("[data-head]")!.getAttribute("transform")
    fireEvent.pointerDown(getByRole("img"))
    expect(onNod).toHaveBeenCalledTimes(1)
    expect(container.querySelector("[data-rod='0'] line")!.getAttribute("y2")).toBeTruthy()
    expect(container.querySelector("[data-head]")!.getAttribute("transform")).toBe(still)
  })

  it("gets the quadruped up when it is watched and sits it down when clicked", () => {
    const onGaitChange = vi.fn()
    const { getByRole } = render(<RobotQuadruped onGaitChange={onGaitChange} />)
    const svg = getByRole("img")
    expect(svg.getAttribute("aria-label")).toContain("stand")
    fireEvent.pointerEnter(svg)
    expect(svg.getAttribute("aria-label")).toContain("walk")
    expect(onGaitChange).toHaveBeenLastCalledWith("walk")
    fireEvent.pointerDown(svg)
    expect(svg.getAttribute("aria-label")).toContain("sitting")
  })

  it("flinches the face when it is poked", () => {
    const onPoke = vi.fn()
    const { container, getByRole } = render(<RobotFace behavior="still" onPoke={onPoke} />)
    const rest = container.querySelector("[data-head]")!.getAttribute("transform")
    fireEvent.pointerDown(getByRole("img"))
    expect(onPoke).toHaveBeenCalledTimes(1)
    expect(container.querySelector("[data-head]")!.getAttribute("transform")).not.toBe(rest)
  })

  it("reads out the lidar return under the pointer", () => {
    const onSampleHover = vi.fn()
    const { container } = render(
      <LidarScan interactive animate={false} maxRange={10} onSampleHover={onSampleHover}
        samples={[{ angle: 90, distance: 5 }]} />,
    )
    const svg = container.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 180, height: 180 }) as DOMRect
    // The return plots 36 units to the right of the centre at (90, 90).
    fireEvent.pointerMove(svg, { clientX: 126, clientY: 90, pointerId: 1 })
    expect(onSampleHover).toHaveBeenLastCalledWith({ angle: 90, distance: 5 })
    expect(container.textContent).toContain("90° · 5")
  })
})
