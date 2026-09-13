import { cleanup, fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ArmFabricator } from "@/components/ui/arm-fabricator"
import { DroneFabricator } from "@/components/ui/drone-fabricator"
import { Fabricator } from "@/components/ui/fabricator"
import { VoxelForm } from "@/components/ui/voxel-form"
import {
  VOXEL_MAX_RESOLUTION,
  type VoxelBehavior,
  type VoxelShape,
} from "@/lib/robocn/voxel"
import type { RobotView } from "@/lib/robocn/style"

const shapes: VoxelShape[] = ["sphere", "block", "pyramid", "gear", "vessel", "lattice"]

const voxels = (container: HTMLElement) => container.querySelectorAll("[data-voxel]").length
const path = (container: HTMLElement, selector: string) =>
  container.querySelector(selector)!.getAttribute("d")

describe("Fabricator", () => {
  it("lays material as progress rises and walks the head onto the work", () => {
    const { container, rerender } = render(<Fabricator progress={0.2} resolution={6} />)
    const early = voxels(container)
    const nozzle = path(container, "[data-nozzle]")
    const bridge = path(container, "[data-bridge]")
    expect(early).toBeGreaterThan(0)

    rerender(<Fabricator progress={0.85} resolution={6} />)

    expect(voxels(container)).toBeGreaterThan(early)
    expect(path(container, "[data-nozzle]")).not.toBe(nozzle)
    expect(path(container, "[data-bridge]")).not.toBe(bridge)
    // The head is aiming at the work, so there is a beam while material lands.
    expect(container.querySelector("[data-beam]")).not.toBeNull()
  })

  it("parks the head and drops the beam once the build is complete", () => {
    const { container } = render(<Fabricator progress={1} resolution={5} />)
    expect(container.querySelector("[data-beam]")).toBeNull()
    expect(voxels(container)).toBeGreaterThan(0)
    expect(container.querySelector("[data-readout]")!.textContent).toBe("100% · 5³")
  })

  it("rebuilds the same object out of smaller voxels as resolution rises", () => {
    const { container, rerender } = render(<Fabricator progress={1} resolution={4} />)
    const coarse = voxels(container)

    rerender(<Fabricator progress={1} resolution={10} />)

    // More, smaller cells — and the geometry is still one object in the same
    // build volume, so the drawing is finer rather than bigger.
    expect(voxels(container)).toBeGreaterThan(coarse * 2)
    expect(container.querySelector("[data-readout]")!.textContent).toBe("100% · 10³")
    expect(Number(container.querySelector("[data-voxel]")!.getAttribute("stroke-width")))
      .toBeLessThan(Number.parseFloat("0.76"))
  })

  it("builds every shape and names it, with a top face on the exposed cells", () => {
    for (const shape of shapes) {
      const { container, unmount } = render(
        <Fabricator shape={shape} progress={1} resolution={6} />,
      )
      expect(voxels(container), shape).toBeGreaterThan(0)
      expect(container.querySelectorAll('[data-face="top"]').length, shape).toBeGreaterThan(0)
      expect(container.querySelector("svg")!.getAttribute("aria-label"), shape)
        .toContain(`building a ${shape}`)
      unmount()
    }
  })

  it("projects one model into four views and says which it is drawing", () => {
    const views: RobotView[] = ["plan", "front", "profile", "iso"]
    const drawn = views.map((view) => {
      const { container, unmount } = render(
        <Fabricator view={view} progress={0.6} resolution={5} />,
      )
      const label = container.querySelector("svg")!.getAttribute("aria-label")!
      const workpiece = container.querySelector("[data-workpiece]")!
      expect(workpiece.getAttribute("data-view")).toBe(view)
      const shape = workpiece.innerHTML
      unmount()
      return { view, label, shape }
    })
    for (const { view, label } of drawn) {
      expect(label, view).toMatch(view === "plan" ? /plan view/ : /elevation|isometric/)
    }
    expect(new Set(drawn.map((entry) => entry.shape)).size).toBe(views.length)
  })

  it("renders a stable machine from invalid input instead of throwing", () => {
    const { container } = render(
      <Fabricator
        progress={Number.NaN}
        resolution={Number.NaN}
        shape={"banana" as VoxelShape}
        view={"orbit" as RobotView}
        behavior={"melt" as VoxelBehavior}
      />,
    )
    // A non-finite build line is an empty plate, not a broken one.
    expect(voxels(container)).toBe(0)
    expect(container.querySelector("[data-plate]")).not.toBeNull()
    expect(container.querySelector("[data-readout]")!.textContent).toBe("0% · 6³")
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("sphere")
  })

  it("takes a colour override and clamps a resolution above the draw budget", () => {
    const { container } = render(
      <Fabricator progress={1} resolution={900} color="#ff4400" />,
    )
    expect(container.querySelector("[data-voxel]")!.getAttribute("fill")).toBe("#ff4400")
    expect(container.querySelector("[data-readout]")!.textContent)
      .toBe(`100% · ${VOXEL_MAX_RESOLUTION}³`)
  })

  it("is a slider when interactive, and arrow keys step one layer", () => {
    const onProgressChange = vi.fn()
    const { getByRole } = render(
      <Fabricator interactive progress={0.5} resolution={5} onProgressChange={onProgressChange} />,
    )
    const svg = getByRole("slider")
    expect(svg.getAttribute("aria-valuenow")).toBe("50")
    expect(svg.getAttribute("aria-valuetext")).toMatch(/layer \d+ of \d+/)

    fireEvent.keyDown(svg, { key: "ArrowUp" })
    expect(onProgressChange).toHaveBeenCalledWith(0.7)
    fireEvent.keyDown(svg, { key: "Home" })
    expect(onProgressChange).toHaveBeenLastCalledWith(0)
    fireEvent.keyDown(svg, { key: "End" })
    expect(onProgressChange).toHaveBeenLastCalledWith(1)
  })
})

/**
 * The four machines are one family: the same field, the same deposition order,
 * the same build line. What differs is the body carrying the nozzle, so these
 * assert the shared contract once and the distinct mechanism per machine.
 */
describe("the fabricator family", () => {
  const family = [
    { name: "fabricator", render: (p: object) => <Fabricator {...p} /> },
    { name: "arm-fabricator", render: (p: object) => <ArmFabricator {...p} /> },
    { name: "drone-fabricator", render: (p: object) => <DroneFabricator {...p} /> },
    { name: "voxel-form", render: (p: object) => <VoxelForm {...p} /> },
  ] as const

  it.each(family)("$name lays the same solid and grows it with progress", ({ render: draw }) => {
    const { container, rerender } = render(draw({ shape: "block", progress: 0.25, resolution: 6 }))
    const early = voxels(container)
    expect(early).toBeGreaterThan(0)

    rerender(draw({ shape: "block", progress: 0.9, resolution: 6 }))

    expect(voxels(container)).toBeGreaterThan(early)
    expect(container.querySelector("[data-workpiece]")).not.toBeNull()
    expect(container.querySelectorAll('[data-face="top"]').length).toBeGreaterThan(0)
  })

  it.each(family)("$name empties the plate on invalid input and takes a colour", ({ render: draw }) => {
    const { container } = render(
      draw({ shape: "banana", progress: Number.NaN, resolution: Number.NaN, color: "#0af" }),
    )
    expect(voxels(container)).toBe(0)
    // An unknown shape falls back rather than throwing, and a non-finite build
    // line is an empty plate, not a broken one.
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("sphere")

    cleanup()
    const done = render(draw({ progress: 1, resolution: 5, color: "#0af" }))
    expect(done.container.querySelector("[data-voxel]")!.getAttribute("fill")).toBe("#0af")
  })

  it.each(family)("$name projects one model into each view", ({ render: draw }) => {
    const drawings = (["plan", "front", "profile", "iso"] as RobotView[]).map((view) => {
      const { container, unmount } = render(draw({ view, progress: 0.6, resolution: 5 }))
      const workpiece = container.querySelector("[data-workpiece]")!.innerHTML
      unmount()
      return workpiece
    })
    expect(new Set(drawings).size).toBe(4)
  })
})

describe("ArmFabricator", () => {
  it("reaches for the cell being laid: turret, elbow and wrist all move", () => {
    const { container, rerender } = render(<ArmFabricator progress={0.1} resolution={6} />)
    const yaw = container.querySelector("[data-turret]")!.getAttribute("data-yaw")
    const elbow = joint(container, "elbow")
    const wrist = joint(container, "wrist")

    rerender(<ArmFabricator progress={0.75} resolution={6} />)

    // The shoulder sits on the yaw axis and so never translates; the turret it
    // is mounted on is what shows the base has turned.
    expect(container.querySelector("[data-turret]")!.getAttribute("data-yaw")).not.toBe(yaw)
    expect(joint(container, "elbow")).not.toEqual(elbow)
    expect(joint(container, "wrist")).not.toEqual(wrist)
    expect(container.querySelector("[data-beam]")).not.toBeNull()
  })

  it("holds its link lengths in plan view, whatever it is reaching for", () => {
    // Plan view is the identity projection, so screen distance is world
    // distance in the horizontal plane — the arm cannot cheat its geometry.
    for (const progress of [0, 0.3, 0.6, 0.95]) {
      const { container, unmount } = render(
        <ArmFabricator view="plan" progress={progress} resolution={6} />,
      )
      const a = joint(container, "shoulder")!
      const b = joint(container, "elbow")!
      const c = joint(container, "wrist")!
      // Projected onto the plan, the two links are the chords of a chain whose
      // true lengths are fixed; their plan lengths can only ever be shorter.
      expect(Math.hypot(b.x - a.x, b.y - a.y), `${progress} upper`).toBeLessThanOrEqual(52.01)
      expect(Math.hypot(c.x - b.x, c.y - b.y), `${progress} fore`).toBeLessThanOrEqual(44.01)
      unmount()
    }
  })

  it("breaks the elbow the other way on request", () => {
    const { container, rerender } = render(<ArmFabricator progress={0.4} resolution={6} elbow="up" />)
    const up = joint(container, "elbow")
    rerender(<ArmFabricator progress={0.4} resolution={6} elbow="down" />)
    expect(joint(container, "elbow")).not.toEqual(up)
  })
})

describe("DroneFabricator", () => {
  it("flies the platform to the work and banks into where it is going next", () => {
    const { container, rerender } = render(<DroneFabricator progress={0.2} resolution={6} />)
    const deck = container.querySelector("[data-deck]")!.getAttribute("transform")
    const pods = [...container.querySelectorAll("[data-pod]")].map((p) => p.innerHTML)

    rerender(<DroneFabricator progress={0.8} resolution={6} />)

    expect(container.querySelector("[data-deck]")!.getAttribute("transform")).not.toBe(deck)
    expect([...container.querySelectorAll("[data-pod]")].map((p) => p.innerHTML)).not.toEqual(pods)
    expect(container.querySelector("[data-craft-shadow]")).not.toBeNull()
  })

  it("clamps the pod count and keeps every pod drawn", () => {
    for (const [asked, drawn] of [[3, 3], [6, 6], [99, 6], [1, 3]] as const) {
      const { container, unmount } = render(
        <DroneFabricator pods={asked} progress={0.5} resolution={5} />,
      )
      expect(container.querySelectorAll("[data-pod]").length, `${asked}`).toBe(drawn)
      unmount()
    }
    const { container } = render(<DroneFabricator pods={Number.NaN} progress={0.5} resolution={5} />)
    expect(container.querySelectorAll("[data-pod]").length).toBe(4)
  })
})

describe("VoxelForm", () => {
  it("stands on a plate or floats free, and says what it is", () => {
    const { container, rerender } = render(<VoxelForm progress={1} resolution={5} />)
    expect(container.querySelector("[data-plate]")).not.toBeNull()
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/^Voxel form/)

    rerender(<VoxelForm progress={1} resolution={5} showPlate={false} />)
    expect(container.querySelector("[data-plate]")).toBeNull()
    expect(voxels(container)).toBeGreaterThan(0)
  })
})

const joint = (container: HTMLElement, name: string) => {
  const node = container.querySelector(`[data-joint="${name}"]`)
  if (!node) return null
  return { x: Number(node.getAttribute("cx")), y: Number(node.getAttribute("cy")) }
}
