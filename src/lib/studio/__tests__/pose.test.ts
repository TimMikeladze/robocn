import { describe, expect, it } from "vitest"

import { applyPalette, diffPose, samePose, sanitizePose } from "@/lib/studio/pose"
import { workbenchComponent } from "@/lib/workbench/controls"

// A real machine from the generated manifest: the rule is "whatever the
// component's own props accept", so a hand-written control list would test nothing.
const arm = workbenchComponent("robot-arm")!

describe("sanitizePose", () => {
  it("keeps every kind of value the machine accepts", () => {
    const pose = {
      variant: "blueprint",
      size: "lg",
      reach: 120,
      paused: true,
      color: "#ff0000",
      label: "Loader",
    }
    expect(sanitizePose(arm, pose)).toEqual(pose)
  })

  it("accepts a pixel size as well as a named one", () => {
    expect(sanitizePose(arm, { size: 320 })).toEqual({ size: 320 })
    expect(sanitizePose(arm, { size: 0 })).toEqual({})
    expect(sanitizePose(arm, { size: 99999 })).toEqual({})
  })

  it("drops props the machine does not have", () => {
    expect(sanitizePose(arm, { variant: "wire", dangerouslySetInnerHTML: "x", __proto__: 1 })).toEqual({
      variant: "wire",
    })
  })

  it("drops props a panel cannot drive: callbacks and unsupported types", () => {
    expect(sanitizePose(arm, { onPose: "alert(1)", target: "1,2", palette: "x" })).toEqual({})
  })

  it("drops values of the wrong type", () => {
    expect(
      sanitizePose(arm, {
        paused: "true",
        reach: "120",
        speed: Number.NaN,
        grip: Infinity,
        color: 0xff0000,
        label: { toString: () => "x" },
      }),
    ).toEqual({})
  })

  it("drops enum values outside the options", () => {
    expect(sanitizePose(arm, { variant: "hologram", tool: "laser", view: "iso" })).toEqual({ view: "iso" })
  })

  it("drops strings too long to be a colour or a label", () => {
    expect(sanitizePose(arm, { label: "x".repeat(121) })).toEqual({})
    expect(sanitizePose(arm, { label: "x".repeat(120) })).toEqual({ label: "x".repeat(120) })
  })

  it.each([null, undefined, "pose", 4, [], [["variant", "wire"]]])("answers {} for %j", (input) => {
    expect(sanitizePose(arm, input)).toEqual({})
  })
})

describe("diffPose", () => {
  it("lists what moved in name order, whichever side it came from", () => {
    expect(diffPose({ view: "iso", reach: 64 }, { reach: 80, bend: "down", view: "iso" })).toEqual([
      { name: "bend", from: undefined, to: "down" },
      { name: "reach", from: 64, to: 80 },
    ])
  })

  it("reports a prop going back to the machine's default as unset", () => {
    expect(diffPose({ paused: true }, {})).toEqual([{ name: "paused", from: true, to: undefined }])
  })

  it("does not confuse false with unset", () => {
    expect(diffPose({ showBase: false }, {})).toHaveLength(1)
  })
})

describe("samePose", () => {
  it("ignores key order and sees a changed value", () => {
    expect(samePose({ a: 1, b: "x" }, { b: "x", a: 1 })).toBe(true)
    expect(samePose({ a: 1 }, { a: 2 })).toBe(false)
    expect(samePose({}, {})).toBe(true)
  })
})

describe("applyPalette", () => {
  const colors = { color: "#111111", accent: "#222222", glow: "#333333", stroke: "#444444" }

  it("sets the roles the machine has and nothing else", () => {
    expect(applyPalette(arm, { variant: "wire" }, colors)).toEqual({
      variant: "wire",
      color: "#111111",
      accent: "#222222",
      glow: "#333333",
    })
  })

  it("skips a role the machine lacks", () => {
    const glowless = { ...arm, controls: arm.controls.filter((control) => control.name !== "glow") }
    expect(applyPalette(glowless, {}, colors)).toEqual({ color: "#111111", accent: "#222222" })
  })

  it("leaves unnamed roles and the original pose alone", () => {
    const pose = { metal: "#abcdef" }
    expect(applyPalette(arm, pose, { color: "#111111", metal: "" })).toEqual({
      metal: "#abcdef",
      color: "#111111",
    })
    expect(pose).toEqual({ metal: "#abcdef" })
  })
})
