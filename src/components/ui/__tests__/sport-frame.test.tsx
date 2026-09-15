import { cleanup, render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { BattingRig } from "@/components/ui/batting-rig"
import { RobotBaseball } from "@/components/ui/robot-baseball"
import { RobotBasketball } from "@/components/ui/robot-basketball"
import { RobotHockeyPuck } from "@/components/ui/robot-hockey-puck"
import { RobotSoccerBall } from "@/components/ui/robot-soccer-ball"
import type { RobotView } from "@/lib/robocn/style"

/**
 * A camera that makes a machine wider must not push it off the edge. These five
 * all travel — a pitch, a swing, a bounce, a roll, a slide — so the camera is
 * not the only thing that can take them out of the frame, and the check sweeps
 * the whole of each one's motion as well as all four views.
 */

const views: RobotView[] = ["plan", "front", "profile", "iso"]

/** The bounding box of everything drawn, in viewBox units. */
function extent(container: HTMLElement) {
  const transform = container.querySelector("[data-view]")?.getAttribute("transform") ?? ""
  const fitted = transform.match(/translate\((-?[\d.]+) (-?[\d.]+)\) scale\((-?[\d.]+)\)/)
  const dx = fitted ? Number(fitted[1]) : 0
  const dy = fitted ? Number(fitted[2]) : 0
  const scale = fitted ? Number(fitted[3]) : 1
  let x0 = Number.POSITIVE_INFINITY
  let x1 = Number.NEGATIVE_INFINITY
  let y0 = Number.POSITIVE_INFINITY
  let y1 = Number.NEGATIVE_INFINITY
  const seeX = (value: number) => {
    x0 = Math.min(x0, dx + value * scale)
    x1 = Math.max(x1, dx + value * scale)
  }
  const seeY = (value: number) => {
    y0 = Math.min(y0, dy + value * scale)
    y1 = Math.max(y1, dy + value * scale)
  }

  for (const path of container.querySelectorAll("path")) {
    const numbers = (path.getAttribute("d")?.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
    for (let index = 0; index + 1 < numbers.length; index += 2) {
      seeX(numbers[index])
      seeY(numbers[index + 1])
    }
  }
  for (const round of container.querySelectorAll("circle, ellipse")) {
    const cx = Number(round.getAttribute("cx"))
    const cy = Number(round.getAttribute("cy"))
    const rx = Number(round.getAttribute("r") ?? round.getAttribute("rx"))
    const ry = Number(round.getAttribute("r") ?? round.getAttribute("ry"))
    seeX(cx - rx)
    seeX(cx + rx)
    seeY(cy - ry)
    seeY(cy + ry)
  }

  const viewBox = (container.querySelector("svg")!.getAttribute("viewBox") ?? "").split(" ").map(Number)
  return { x0, x1, y0, y1, width: viewBox[2], height: viewBox[3] }
}

const machines: [string, (view: RobotView, at: number) => React.ReactElement][] = [
  ["robot-baseball", (view, at) => <RobotBaseball animate={false} view={view} along={at} behavior="curveball" />],
  ["robot-baseball fastball", (view, at) => <RobotBaseball animate={false} view={view} along={at} behavior="fastball" />],
  ["batting-rig", (view, at) => <BattingRig animate={false} view={view} swing={at} />],
  ["batting-rig jammed", (view, at) => <BattingRig animate={false} view={view} swing={at} stance={22} />],
  ["batting-rig off the end", (view, at) => <BattingRig animate={false} view={view} swing={at} stance={44} />],
  ["robot-basketball", (view, at) => <RobotBasketball animate={false} view={view} height={at} />],
  ["robot-soccer-ball", (view, at) => <RobotSoccerBall animate={false} view={view} travel={at} />],
  ["robot-hockey-puck", (view, at) => <RobotHockeyPuck animate={false} view={view} along={at} />],
  ["robot-hockey-puck dumped", (view, at) => <RobotHockeyPuck animate={false} view={view} along={at} behavior="dump" heading={72} />],
]

/**
 * The same sweep over the *behaviours*, driven by parking the clock at a phase.
 * A controlled prop only walks one axis; a behaviour can take the object
 * somewhere no controlled value reaches — which is how the soccer ball's kick
 * first ran off the bottom of its own drawing.
 */
const behaviours: [string, (view: RobotView, phase: number) => React.ReactElement][] = [
  ...(["fastball", "curveball", "slider", "sinker", "knuckler", "spin"] as const).map(
    (behavior) =>
      [
        `robot-baseball ${behavior}`,
        (view: RobotView, phase: number) => (
          <RobotBaseball animate={false} view={view} behavior={behavior} phase={phase} />
        ),
      ] as [string, (view: RobotView, phase: number) => React.ReactElement],
  ),
  ...(["swing", "load", "check"] as const).map(
    (behavior) =>
      [
        `batting-rig ${behavior}`,
        (view: RobotView, phase: number) => (
          <BattingRig animate={false} view={view} behavior={behavior} phase={phase} />
        ),
      ] as [string, (view: RobotView, phase: number) => React.ReactElement],
  ),
  ...(["dribble", "travel", "drop", "spin"] as const).map(
    (behavior) =>
      [
        `robot-basketball ${behavior}`,
        (view: RobotView, phase: number) => (
          <RobotBasketball animate={false} view={view} behavior={behavior} phase={phase} />
        ),
      ] as [string, (view: RobotView, phase: number) => React.ReactElement],
  ),
  ...(["roll", "bend", "juggle", "spin"] as const).map(
    (behavior) =>
      [
        `robot-soccer-ball ${behavior}`,
        (view: RobotView, phase: number) => (
          <RobotSoccerBall animate={false} view={view} behavior={behavior} phase={phase} />
        ),
      ] as [string, (view: RobotView, phase: number) => React.ReactElement],
  ),
  ...(["slap", "wrist", "dump", "spin"] as const).map(
    (behavior) =>
      [
        `robot-hockey-puck ${behavior}`,
        (view: RobotView, phase: number) => (
          <RobotHockeyPuck animate={false} view={view} behavior={behavior} phase={phase} />
        ),
      ] as [string, (view: RobotView, phase: number) => React.ReactElement],
  ),
]

describe("the sports objects stay inside their own frame", () => {
  for (const [name, machine] of machines) {
    it.each(views)(`keeps ${name} inside the viewBox from %s`, (view) => {
      for (let step = 0; step <= 12; step += 1) {
        const { container } = render(machine(view, step / 12))
        const box = extent(container)
        expect(box.x0).toBeGreaterThan(-1)
        expect(box.y0).toBeGreaterThan(-1)
        expect(box.x1).toBeLessThan(box.width + 1)
        expect(box.y1).toBeLessThan(box.height + 1)
        cleanup()
      }
    })
  }

  for (const [name, machine] of behaviours) {
    it.each(views)(`keeps ${name} inside the viewBox from %s`, (view) => {
      for (let step = 0; step <= 12; step += 1) {
        const { container } = render(machine(view, step / 12))
        const box = extent(container)
        expect(box.x0).toBeGreaterThan(-1)
        expect(box.y0).toBeGreaterThan(-1)
        expect(box.x1).toBeLessThan(box.width + 1)
        expect(box.y1).toBeLessThan(box.height + 1)
        cleanup()
      }
    })
  }
})
