/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest"

import {
  backgroundBehind,
  exportFileName,
  frameCount,
  frameDelays,
  snapshot,
} from "@/lib/robocn/capture"

/** jsdom lays nothing out, so a target has to be told how big it is. */
const sized = <T extends Element>(node: T, width: number, height: number): T => {
  node.getBoundingClientRect = () =>
    ({ width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0 }) as DOMRect
  return node
}

describe("frameDelays", () => {
  it("writes the deltas that were measured, not the rate that was asked for", () => {
    expect(frameDelays([0, 70, 130, 260], 66)).toEqual([70, 60, 130, 87])
  })

  it("gives the last frame the average of the others, since it has no successor", () => {
    const delays = frameDelays([0, 100, 200], 66)
    expect(delays.slice(0, 2)).toEqual([100, 100])
    expect(delays[2]).toBe(100)
  })

  it("falls back to the nominal interval for a single frame", () => {
    expect(frameDelays([1234], 66)).toEqual([66])
  })

  it("clamps a stalled frame and a zero-length one into what a player will honour", () => {
    expect(frameDelays([0, 2, 100_000], 66)).toEqual([10, 10_000, 5005])
  })
})

describe("frameCount", () => {
  it("takes a single frame for a still and a rate's worth for a recording", () => {
    expect(frameCount(0, 15)).toBe(1)
    expect(frameCount(2, 15)).toBe(30)
    expect(frameCount(0.01, 15)).toBe(1)
  })
})

describe("exportFileName", () => {
  it("slugs the name and takes the extension from the format", () => {
    expect(exportFileName("Robot Arm", "gif")).toBe("robot-arm.gif")
    expect(exportFileName("robot-arm", "webp")).toBe("robot-arm.webp")
  })

  it("still names a file when the name is nothing usable", () => {
    expect(exportFileName("   ", "png")).toBe("robocn.png")
    expect(exportFileName("///", "png")).toBe("robocn.png")
  })
})

describe("backgroundBehind", () => {
  it("returns the first opaque colour above the node", () => {
    document.body.innerHTML = `
      <div id="panel" style="background-color: rgb(10, 20, 30)">
        <div id="inner" style="background-color: transparent"><svg id="machine"></svg></div>
      </div>`
    expect(backgroundBehind(document.querySelector("#machine")!)).toBe("rgb(10, 20, 30)")
  })

  it("falls back to white rather than to nothing", () => {
    document.body.innerHTML = `<div id="bare"></div>`
    expect(backgroundBehind(document.querySelector("#bare")!)).toBe("#ffffff")
  })
})

describe("snapshot", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("takes an SVG target as itself, at the size it is on the page", async () => {
    document.body.innerHTML = `<svg viewBox="0 0 10 10"><circle r="4" fill="red" /></svg>`
    const svg = sized(document.querySelector("svg")!, 240, 180)
    const shot = await snapshot(svg, { fonts: false })
    expect(shot.width).toBe(240)
    expect(shot.height).toBe(180)
    expect(shot.markup).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(shot.markup).toContain('width="240"')
    expect(shot.markup).toContain("<circle")
    expect(shot.markup).toContain('viewBox="0 0 10 10"')
  })

  it("wraps anything else in a foreignObject, which is how HTML rasterizes", async () => {
    document.body.innerHTML = `<div class="panel"><p>Robot arm</p><svg><rect /></svg></div>`
    const panel = sized(document.querySelector("div")!, 300, 200)
    const shot = await snapshot(panel, { fonts: false })
    expect(shot.markup).toContain("<foreignObject")
    expect(shot.markup).toContain('xmlns="http://www.w3.org/1999/xhtml"')
    expect(shot.markup).toContain("Robot arm")
    expect(shot.markup).toContain("<rect")
  })

  it("drops the export control itself, which sits inside what it records", async () => {
    document.body.innerHTML = `
      <div><svg><circle /></svg><div data-robocn-hide=""><button>Export</button></div></div>`
    const panel = sized(document.querySelector("div")!, 100, 100)
    const shot = await snapshot(panel, { fonts: false })
    expect(shot.markup).toContain("<circle")
    expect(shot.markup).not.toContain("Export")
  })

  it("never returns a zero-sized document, however small the target measured", async () => {
    document.body.innerHTML = `<svg></svg>`
    const shot = await snapshot(sized(document.querySelector("svg")!, 0, 0), { fonts: false })
    expect(shot.width).toBe(1)
    expect(shot.height).toBe(1)
  })
})
