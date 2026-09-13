import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { BallLauncher, launcherFeed } from "@/components/ui/ball-launcher"
import { BlockingSled, sledLoad } from "@/components/ui/blocking-sled"
import { GridironKicker, kickerSwing } from "@/components/ui/gridiron-kicker"
import { GridironLineman, linemanPose } from "@/components/ui/gridiron-lineman"
import { GridironQuarterback, quarterbackPose } from "@/components/ui/gridiron-quarterback"
import { GridironReceiver, receiverRun } from "@/components/ui/gridiron-receiver"
import { RobotFootball } from "@/components/ui/robot-football"
import type { RobotVariant, RobotView } from "@/lib/robocn/style"

const views: RobotView[] = ["plan", "front", "profile", "iso"]
const variants: RobotVariant[] = ["solid", "outline", "blueprint", "wire"]

afterEach(cleanup)

/** Nothing in this family may put a NaN into the DOM. */
function expectNoNaN(container: HTMLElement) {
  for (const element of container.querySelectorAll("*")) {
    for (const attribute of element.attributes) {
      expect(attribute.value, `${element.tagName}.${attribute.name}`).not.toContain("NaN")
    }
  }
}

describe("robot football", () => {
  it("rolls the ball, which takes the laces round the back", () => {
    const { container, rerender } = render(<RobotFootball roll={0} pitch={0} yaw={90} />)
    const front = container.querySelectorAll("[data-lace]").length
    expect(front).toBeGreaterThan(0)

    rerender(<RobotFootball roll={180} pitch={0} yaw={90} />)
    expect(container.querySelectorAll("[data-lace]").length).toBeLessThan(front)
  })

  it("draws the end-on silhouette as a circle and the broadside one as a long ellipse", () => {
    const box = (markup: HTMLElement) => {
      const shell = markup.querySelector("[data-shell]")!.getAttribute("d")!
      const numbers = shell.match(/-?\d+(\.\d+)?/g)!.map(Number)
      const xs = numbers.filter((_, index) => index % 2 === 0)
      const ys = numbers.filter((_, index) => index % 2 === 1)
      return {
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      }
    }
    // Nose straight at a front camera: a circle.
    const { container: endOn } = render(
      <RobotFootball view="front" yaw={0} pitch={0} roll={0} showGround={false} />,
    )
    const round = box(endOn)
    expect(round.width / round.height).toBeCloseTo(1, 1)

    cleanup()
    // Nose across it: the full length.
    const { container: broadside } = render(
      <RobotFootball view="front" yaw={90} pitch={0} roll={0} showGround={false} />,
    )
    const long = box(broadside)
    expect(long.width).toBeGreaterThan(round.width * 1.6)
  })

  it("says what it is doing, and drops the loop when driven", () => {
    const { container, rerender } = render(<RobotFootball behavior="tumble" />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("tumbling")
    expect(container.querySelector("[data-ball]")!.getAttribute("data-flight")).toBe("tumble")

    rerender(<RobotFootball behavior="tumble" pitch={40} />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("40°")
  })

  it("renders a neutral ball from rubbish input, in every view and variant", () => {
    for (const view of views) {
      for (const variant of variants) {
        const { container } = render(
          <RobotFootball
            view={view}
            variant={variant}
            roll={Number.NaN}
            pitch={Number.NaN}
            yaw={Number.NaN}
            spin={Number.NaN}
          />,
        )
        expect(container.querySelector("[data-shell]")).not.toBeNull()
        expectNoNaN(container)
        cleanup()
      }
    }
  })

  it("takes a colour override and an accessible label", () => {
    const { container } = render(
      <RobotFootball color="#ff0044" accent="#00ffcc" behavior="static" label="BALL / 01" />,
    )
    expect(container.innerHTML).toContain("#ff0044")
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain(
      "Robot football",
    )
  })
})

describe("gridiron lineman", () => {
  it("fires out of the stance: the arms leave the turf and the legs move", () => {
    const { container, rerender } = render(<GridironLineman fire={0} number="74" />)
    const arm = container.querySelector('[data-arm="right"] path')!.getAttribute("d")
    const leg = container.querySelector('[data-leg="left"] path')!.getAttribute("d")
    expect(container.querySelector("[data-down-hand]")).not.toBeNull()

    rerender(<GridironLineman fire={1} number="74" />)
    expect(container.querySelector('[data-arm="right"] path')!.getAttribute("d")).not.toBe(arm)
    expect(container.querySelector('[data-leg="left"] path')!.getAttribute("d")).not.toBe(leg)
    // Out of the stance, nothing is on the turf any more.
    expect(container.querySelector("[data-down-hand]")).toBeNull()
  })

  it("only the three-point stance puts a hand down", () => {
    const { container, rerender } = render(<GridironLineman fire={0} stance="three-point" />)
    expect(container.querySelector("[data-down-hand]")).not.toBeNull()
    rerender(<GridironLineman fire={0} stance="upright" />)
    expect(container.querySelector("[data-down-hand]")).toBeNull()
    expect(container.querySelector("svg")!.getAttribute("data-stance")).toBe("upright")
  })

  it("lays the back flatter in a stance than standing up", () => {
    const shoulderY = (markup: HTMLElement) => {
      const helmet = markup.querySelector("[data-helmet] path")!.getAttribute("d")!
      return Math.min(...helmet.match(/-?\d+(\.\d+)?/g)!.filter((_, i) => i % 2 === 1).map(Number))
    }
    const { container: down } = render(<GridironLineman fire={0} stance="three-point" />)
    const low = shoulderY(down)
    cleanup()
    const { container: up } = render(<GridironLineman fire={0} stance="upright" />)
    // Screen y grows downward, so a stance puts the helmet lower on the page.
    expect(low).toBeGreaterThan(shoulderY(up))
  })

  it("renders neutrally from rubbish input, in every view and variant", () => {
    for (const view of views) {
      for (const variant of variants) {
        const { container } = render(
          <GridironLineman
            view={view}
            variant={variant}
            fire={Number.NaN}
            padLevel={Number.NaN}
            // @ts-expect-error — a stale prop from a consumer must degrade.
            stance="nonsense"
          />,
        )
        expect(container.querySelector("[data-helmet]")).not.toBeNull()
        expectNoNaN(container)
        cleanup()
      }
    }
  })
})

describe("gridiron quarterback", () => {
  it("moves the throwing arm through the swing and lets the ball go", () => {
    const { container, rerender } = render(<GridironQuarterback release={0} />)
    const arm = container.querySelector("[data-throw-arm] path")!.getAttribute("d")
    expect(container.querySelector("[data-ball]")!.hasAttribute("data-away")).toBe(false)

    rerender(<GridironQuarterback release={0.9} />)
    expect(container.querySelector("[data-throw-arm] path")!.getAttribute("d")).not.toBe(arm)
    expect(container.querySelector("[data-ball]")!.hasAttribute("data-away")).toBe(true)
    expect(container.querySelector("[data-release]")).not.toBeNull()
  })

  it("puts the range it solved into the label, and a harder throw goes further", () => {
    const range = (markup: HTMLElement) =>
      Number(markup.querySelector("svg")!.getAttribute("aria-label")!.match(/(\d+) yard range/)![1])
    const { container: soft } = render(<GridironQuarterback release={0.5} velocity={18} />)
    const near = range(soft)
    cleanup()
    const { container: hard } = render(<GridironQuarterback release={0.5} velocity={34} />)
    expect(range(hard)).toBeGreaterThan(near)
  })

  it("renders neutrally from rubbish input", () => {
    const { container } = render(
      <GridironQuarterback release={Number.NaN} velocity={Number.NaN} steps={Number.NaN} view="iso" />,
    )
    expect(container.querySelector("[data-helmet]")).not.toBeNull()
    expectNoNaN(container)
  })
})

describe("gridiron receiver", () => {
  it("walks the machine along the route and leans it into the break", () => {
    const { container, rerender } = render(<GridironReceiver route="out" depth={12} distance={4} />)
    const stem = container.querySelector('[data-leg="left"] path')!.getAttribute("d")
    expect(container.querySelector("[data-runner]")).not.toBeNull()
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("running straight")

    // Just past the corner at the top of the stem: the whole body turns with
    // the route's heading and banks into the break.
    rerender(<GridironReceiver route="out" depth={12} distance={12.4} />)
    expect(container.querySelector('[data-leg="left"] path')!.getAttribute("d")).not.toBe(stem)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("cutting")
  })

  it("draws the route map, and changing the route redraws it", () => {
    const { container, rerender } = render(<GridironReceiver route="post" depth={12} distance={4} />)
    const line = container.querySelector("[data-route-line]")!.getAttribute("d")
    expect(container.querySelectorAll("[data-break]").length).toBeGreaterThanOrEqual(1)

    rerender(<GridironReceiver route="wheel" depth={12} distance={4} />)
    expect(container.querySelector("[data-route-line]")!.getAttribute("d")).not.toBe(line)
    expect(container.querySelector("svg")!.getAttribute("data-route")).toBe("wheel")
  })

  it("drops the map when it is not wanted, and survives rubbish", () => {
    const { container } = render(
      <GridironReceiver showRoute={false} distance={Number.NaN} depth={Number.NaN} />,
    )
    expect(container.querySelector("[data-route-map]")).toBeNull()
    expectNoNaN(container)
  })
})

describe("gridiron kicker", () => {
  it("swings the kicking leg and lets the ball off the tee", () => {
    const { container, rerender } = render(<GridironKicker swing={0} />)
    const leg = container.querySelector("[data-kick-leg] path")!.getAttribute("d")
    expect(container.querySelector("[data-tee]")).not.toBeNull()

    rerender(<GridironKicker swing={0.9} />)
    expect(container.querySelector("[data-kick-leg] path")!.getAttribute("d")).not.toBe(leg)
    expect(container.querySelector("[data-ball]")!.hasAttribute("data-away")).toBe(true)
    expect(container.querySelector("[data-tee]")).toBeNull()
  })

  it("decides CLEARS or SHORT from the flight rather than being told", () => {
    const { container, rerender } = render(<GridironKicker swing={0.5} power={1} distance={30} />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("clears")

    rerender(<GridironKicker swing={0.5} power={0.4} distance={60} />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("misses")
  })

  it("gives a punt more hang time than a placement at the same power", () => {
    const hang = (markup: HTMLElement) =>
      Number(markup.querySelector("svg")!.getAttribute("aria-label")!.match(/([\d.]+) second hang/)![1])
    const { container: flat } = render(<GridironKicker kick="place" swing={0.5} power={0.9} />)
    const low = hang(flat)
    cleanup()
    const { container: high } = render(<GridironKicker kick="punt" swing={0.5} power={0.9} />)
    expect(hang(high)).toBeGreaterThan(low)
  })

  it("renders neutrally from rubbish input, and drops the plot on request", () => {
    const { container } = render(
      <GridironKicker
        swing={Number.NaN}
        power={Number.NaN}
        angle={Number.NaN}
        distance={Number.NaN}
        showPlot={false}
        view="plan"
      />,
    )
    expect(container.querySelector("[data-trajectory]")).toBeNull()
    expectNoNaN(container)
  })
})

describe("blocking sled", () => {
  it("gives ground under load, and the last degrees cost more than the first", () => {
    const give = (markup: HTMLElement) =>
      Number(markup.querySelector("svg")!.getAttribute("aria-label")!.match(/(\d+) degrees/)![1])
    const { container: light } = render(<BlockingSled load={0.3} />)
    const small = give(light)
    cleanup()
    const { container: heavy } = render(<BlockingSled load={0.6} />)
    const middle = give(heavy)
    cleanup()
    const { container: full } = render(<BlockingSled load={1} />)
    expect(middle).toBeGreaterThan(small)
    expect(give(full) - middle).toBeLessThan(middle - small)
  })

  it("holds the frame until the drive beats the friction under it", () => {
    const { container, rerender } = render(<BlockingSled load={0.1} weight={400} />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("held by friction")
    rerender(<BlockingSled load={1} weight={60} />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("sliding")
  })

  it("carries as many pads as it is asked for, and clamps the ask", () => {
    const { container, rerender } = render(<BlockingSled load={0.4} pads={5} />)
    expect(container.querySelectorAll("[data-pad]")).toHaveLength(5)
    rerender(<BlockingSled load={0.4} pads={99} />)
    expect(container.querySelectorAll("[data-pad]")).toHaveLength(5)
    rerender(<BlockingSled load={0.4} pads={Number.NaN} />)
    expect(container.querySelectorAll("[data-pad]")).toHaveLength(3)
    expectNoNaN(container)
  })
})

describe("ball launcher", () => {
  it("makes topspin from a faster top wheel and backspin from a faster bottom one", () => {
    const { container, rerender } = render(<BallLauncher top={48} bottom={16} behavior="spin" />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("topspin")
    rerender(<BallLauncher top={16} bottom={48} behavior="spin" />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("backspin")
    rerender(<BallLauncher top={32} bottom={32} behavior="spin" />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("flat")
  })

  it("elevates the whole head, wheels and muzzle together", () => {
    const { container, rerender } = render(<BallLauncher elevation={0} behavior="static" />)
    const muzzle = container.querySelector("[data-muzzle]")!.getAttribute("d")
    const wheel = container.querySelector('[data-wheel="top"] path')!.getAttribute("d")

    rerender(<BallLauncher elevation={60} behavior="static" />)
    expect(container.querySelector("[data-muzzle]")!.getAttribute("d")).not.toBe(muzzle)
    expect(container.querySelector('[data-wheel="top"] path')!.getAttribute("d")).not.toBe(wheel)
  })

  it("renders neutrally from rubbish input", () => {
    const { container } = render(
      <BallLauncher top={Number.NaN} bottom={Number.NaN} elevation={Number.NaN} view="iso" />,
    )
    expect(container.querySelector("[data-head]")).not.toBeNull()
    expectNoNaN(container)
  })
})

describe("the behaviour samplers", () => {
  it("run the lineman's snap through the stance, the fire and back", () => {
    expect(linemanPose("snap", 0).fire).toBe(0)
    expect(linemanPose("snap", 0.5).fire).toBe(1)
    expect(linemanPose("snap", 0.999).fire).toBeLessThan(0.05)
    // Whole cycles repeat, in both directions.
    expect(linemanPose("snap", 2.3).fire).toBeCloseTo(linemanPose("snap", 0.3).fire, 8)
    expect(linemanPose("snap", -0.7).fire).toBeCloseTo(linemanPose("snap", 0.3).fire, 8)
    expect(linemanPose("static", 0.4).fire).toBe(0)
    expect(linemanPose("snap", Number.NaN).fire).toBe(0)
  })

  it("take the quarterback back into the pocket before the swing starts", () => {
    expect(quarterbackPose("throw", 0.2).swing).toBe(0)
    expect(quarterbackPose("throw", 0.2).depth).toBeGreaterThan(0)
    expect(quarterbackPose("throw", 0.72).swing).toBe(1)
    expect(quarterbackPose("throw", 1.5).swing).toBeCloseTo(quarterbackPose("throw", 0.5).swing, 8)
    expect(quarterbackPose("static", 0.4).depth).toBe(0)
    expect(quarterbackPose("throw", Number.NaN).swing).toBe(0)
  })

  it("walk the receiver the whole route and keep the release on the line", () => {
    expect(receiverRun("route", 0, 20).along).toBe(0)
    expect(receiverRun("route", 1, 20).along).toBeCloseTo(0, 8)
    expect(receiverRun("route", 0.5, 20).along).toBeCloseTo(10, 8)
    expect(receiverRun("release", 0.3, 20).along).toBeLessThan(3)
    expect(receiverRun("catch", 0.9, 20).reach).toBeGreaterThan(0)
    expect(receiverRun("route", Number.NaN, 20).along).toBe(0)
  })

  it("put the kicker's contact in the middle of the swing", () => {
    expect(kickerSwing("kick", 0.1).swing).toBe(0)
    expect(kickerSwing("kick", 0.7).swing).toBeGreaterThan(0.5)
    expect(kickerSwing("kick", 1.2).swing).toBeCloseTo(kickerSwing("kick", 0.2).swing, 8)
    expect(kickerSwing("static", 0.5).swing).toBe(0)
    expect(kickerSwing("kick", Number.NaN).swing).toBe(0)
  })

  it("load and release the sled", () => {
    expect(sledLoad("hit", 0)).toBe(0)
    expect(sledLoad("hit", 0.12)).toBeCloseTo(1, 8)
    expect(sledLoad("hit", 0.9)).toBe(0)
    expect(sledLoad("recoil", 0)).toBe(1)
    expect(sledLoad("static", 0.5)).toBe(0)
    expect(sledLoad("drive", Number.NaN)).toBe(0)
  })

  it("feed a ball through the launcher and out the other side", () => {
    expect(launcherFeed("feed", 0)).toBeLessThan(0)
    expect(launcherFeed("feed", 1)).toBeLessThan(0)
    expect(launcherFeed("feed", 0.6)).toBeGreaterThan(0)
    expect(launcherFeed("spin", 0.5)).toBeLessThan(0)
    expect(launcherFeed("feed", Number.NaN)).toBe(-1)
  })
})
