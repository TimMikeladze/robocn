import { describe, expect, it } from "vitest"

import { distance2 } from "@/lib/robocn/kinematics"
import {
  bandLinks,
  detent,
  hingePose,
  listWindow,
  panelPath,
  panelTransform,
  standPose,
  wheelSegment,
} from "@/lib/robocn/device"
import { px, robotCamera } from "@/lib/robocn/style"

describe("hingePose", () => {
  it("keeps the lid's length at every angle it can open to", () => {
    for (let angle = 0; angle <= 135; angle += 7.5) {
      const pose = hingePose(angle, 60, 58)
      expect(distance2(pose.pivot, pose.lidTop)).toBeCloseTo(58, 6)
      expect(distance2(pose.pivot, pose.baseFar)).toBeCloseTo(60, 6)
      // The base is on the desk; the hinge never leaves it.
      expect(pose.baseFar.y).toBeCloseTo(pose.pivot.y, 6)
    }
  })

  it("stands the screen up to vertical and reports when it leans past it", () => {
    expect(hingePose(0, 60, 58).facing).toBeCloseTo(0, 6)
    expect(hingePose(90, 60, 58).facing).toBeCloseTo(1, 6)
    expect(hingePose(90, 60, 58).overCentre).toBe(false)
    expect(hingePose(115, 60, 58).overCentre).toBe(true)
    // Shut, the lid lies forward over the base rather than standing anywhere.
    expect(hingePose(0, 60, 58).lidTop.y).toBeCloseTo(hingePose(0, 60, 58).pivot.y, 6)
  })

  it("clamps the travel and stays neutral on nonsense", () => {
    expect(hingePose(400, 60, 58).angle).toBe(135)
    expect(hingePose(-90, 60, 58).angle).toBe(0)
    expect(hingePose(Number.NaN, 60, 58).angle).toBe(0)
    expect(Number.isFinite(hingePose(Number.NaN, Number.NaN, Number.NaN).lidTop.x)).toBe(true)
  })
})

describe("standPose", () => {
  it("puts the foot on the desk with the leg at its real length", () => {
    for (let recline = 0; recline <= 1; recline += 0.1) {
      const pose = standPose(recline, 74, 44, 40)
      if (pose.folded) continue
      expect(pose.foot.y).toBeCloseTo(0, 6)
      expect(distance2(pose.hinge, pose.foot)).toBeCloseTo(44, 6)
      expect(distance2({ x: 0, y: 0 }, pose.top)).toBeCloseTo(74, 6)
    }
  })

  it("leans the slate further back as recline rises", () => {
    expect(standPose(0, 74, 44, 40).tilt).toBeLessThan(standPose(1, 74, 44, 40).tilt)
    expect(standPose(0.5, 74, 44, 40).foot.x).toBeGreaterThan(0)
  })

  it("folds the stand rather than stretching a leg that cannot reach", () => {
    // A 12-unit leg hinged 40 up the back cannot touch the desk upright.
    const short = standPose(0, 74, 12, 40)
    expect(short.folded).toBe(true)
    expect(distance2(short.hinge, short.foot)).toBeLessThanOrEqual(12 + 1e-6)
  })

  it("stays neutral on nonsense", () => {
    const pose = standPose(Number.NaN, Number.NaN, Number.NaN, Number.NaN)
    for (const value of [pose.tilt, pose.foot.x, pose.foot.y, pose.top.x, pose.spread]) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })
})

describe("detent", () => {
  it("wraps a whole turn of the list back onto the row it started on", () => {
    const rows = 8
    const step = 30
    expect(detent(0, rows, step).index).toBe(0)
    expect(detent(rows * step, rows, step).index).toBe(0)
    expect(detent(-rows * step, rows, step).index).toBe(0)
    expect(detent(3 * step, rows, step).index).toBe(3)
    // Backwards off the top wraps onto the bottom, not onto a negative row.
    expect(detent(-step, rows, step).index).toBe(rows - 1)
  })

  it("counts whole turns and keeps the fraction inside one row", () => {
    const pose = detent(45, 8, 30)
    expect(pose.index).toBe(1)
    expect(pose.offset).toBeGreaterThanOrEqual(1)
    expect(pose.offset).toBeLessThan(2)
    expect(detent(360, 8, 30).turns).toBe(1.5)
  })

  it("stays on row zero for nonsense", () => {
    expect(detent(Number.NaN, 8, 30).index).toBe(0)
    expect(detent(90, 0, 0).index).toBe(0)
  })
})

describe("wheelSegment", () => {
  it("names the quarter of the ring the thumb is on", () => {
    expect(wheelSegment(-90)).toBe("menu")
    expect(wheelSegment(0)).toBe("next")
    expect(wheelSegment(90)).toBe("play")
    expect(wheelSegment(180)).toBe("previous")
    expect(wheelSegment(-270)).toBe("play")
    expect(wheelSegment(Number.NaN)).toBeNull()
  })
})

describe("bandLinks", () => {
  it("keeps its link count and its total length at every closure", () => {
    for (const closure of [0, 0.25, 0.5, 0.75, 1]) {
      const links = bandLinks(9, 6, closure)
      expect(links).toHaveLength(9)
      const run = links
        .slice(1)
        .reduce((total, link, i) => total + distance2(links[i].position, link.position), 0)
      expect(run).toBeCloseTo(8 * 6, 6)
    }
  })

  it("runs straight when open and curls as it closes", () => {
    const open = bandLinks(9, 6, 0)
    const closed = bandLinks(9, 6, 1)
    expect(open.at(-1)!.angle).toBeCloseTo(open[0].angle, 6)
    expect(Math.abs(closed.at(-1)!.angle - closed[0].angle)).toBeGreaterThan(30)
  })

  it("stays neutral on nonsense", () => {
    const links = bandLinks(Number.NaN, Number.NaN, Number.NaN)
    expect(links.length).toBeGreaterThan(0)
    expect(links.every((l) => Number.isFinite(l.position.x) && Number.isFinite(l.angle))).toBe(true)
  })
})

describe("listWindow", () => {
  it("always shows a full window and clamps it at both ends", () => {
    expect(listWindow(0, 10, 4)).toEqual([0, 1, 2, 3])
    expect(listWindow(9, 10, 4)).toEqual([6, 7, 8, 9])
    expect(listWindow(5, 10, 4)).toEqual([4, 5, 6, 7])
    // A list shorter than the window is shown whole.
    expect(listWindow(1, 3, 5)).toEqual([0, 1, 2])
  })
})

describe("panelTransform", () => {
  // A panel facing the front camera. Starboard appears on the left from
  // nose-on, so the panel's own left-to-right axis runs from +x to -x.
  const corner = { x: 10, y: 20, z: 0 }
  const along = { x: -10, y: 20, z: 0 }
  const down = { x: 10, y: 0, z: 0 }

  it("is the identity for artwork already drawn in the camera's own plane", () => {
    // A wall facing the front camera, in that camera: nothing should move.
    const panel = panelTransform(robotCamera("front"), corner, along, down, 20, 20)
    expect(panel.facing).toBeCloseTo(1, 6)
    expect(panel.transform).toBe("matrix(1 0 0 1 -10 -20)")
  })

  it("collapses the panel edge on and flips its sign behind", () => {
    const edge = panelTransform(robotCamera("profile"), corner, along, down, 20, 20)
    expect(Math.abs(edge.facing)).toBeLessThan(0.2)
    // Swapping the two axes turns the panel over; the camera must notice.
    const back = panelTransform(robotCamera("front"), corner, down, along, 20, 20)
    expect(Math.sign(back.facing)).toBe(-1)
  })

  it("agrees with the outline it is drawing into", () => {
    const camera = robotCamera("iso")
    const panel = panelTransform(camera, corner, along, down, 20, 20)
    const start = camera.project(corner.x, corner.y, corner.z)
    expect(panelPath(camera, corner, along, down)).toContain(
      `M ${px(start.x)} ${px(start.y)}`,
    )
    expect(panel.transform).toContain(`${px(start.x)} ${px(start.y)}`)
  })

  it("emits nothing for a panel with no size", () => {
    expect(panelTransform(robotCamera("front"), corner, along, down, 0, 20).transform).toBe("")
  })
})
