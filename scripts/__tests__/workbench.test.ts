import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

import {
  classify,
  controlsFor,
  groupFor,
  indexTypes,
  isRobotSource,
  numberRange,
  readSignature,
  titleCase,
} from "../lib/workbench.mjs"

/**
 * The workbench derives every knob from a component's own TypeScript, so these
 * check the derivation against real sources rather than fixtures: if a robot
 * changes how it declares its props, that is exactly when this should fail.
 */

const read = async (file: string) => ({ file, source: await readFile(file, "utf8") })

const shared = await Promise.all([
  read("src/lib/robocn/style.ts"),
  read("src/components/ui/utility-droid.tsx"),
  read("src/components/ui/robot-arm.tsx"),
])
const index = indexTypes(shared)

describe("type index", () => {
  it("collects string-literal unions across files", () => {
    expect(index.unions.RobotVariant).toEqual(["solid", "outline", "blueprint", "wire"])
    expect(index.unions.UtilityDroidSeries).toEqual(["workshop", "navigator", "rescue"])
  })

  it("keeps interfaces with their heritage, so shared props can be expanded", () => {
    expect(index.interfaces.UtilityDroidProps.heritage).toContain("RobotPaletteProps")
    expect(index.interfaces.RobotPaletteProps.members.map((m) => m.name)).toContain("accent")
  })
})

describe("controls", () => {
  const droid = controlsFor({
    ...shared[1],
    exportName: "UtilityDroid",
    index,
  })
  const control = (name: string) => droid.controls.find((entry) => entry.name === name)

  it("reads the props interface the component actually takes", () => {
    expect(droid.props).toBe("UtilityDroidProps")
  })

  it("turns an alias union into a picker with its real options", () => {
    expect(control("series")).toMatchObject({
      kind: "enum",
      options: ["workshop", "navigator", "rescue"],
      default: "workshop",
    })
  })

  it("turns an inline union into a picker too", () => {
    expect(control("dome")).toMatchObject({
      kind: "enum",
      options: ["round", "flat", "faceted"],
      default: "faceted",
    })
  })

  it("reads defaults out of the component's own destructuring", () => {
    expect(control("variant")?.default).toBe("solid")
    expect(control("speed")?.default).toBe(0.22)
    expect(control("animate")?.default).toBe(true)
  })

  it("follows a default named as a constant to the value behind it", () => {
    // `view = NATIVE_VIEW`, and NATIVE_VIEW is "front" at the top of the file.
    expect(control("view")?.default).toBe("front")
    const arm = controlsFor({ ...shared[2], exportName: "RobotArm", index })
    expect(arm.controls.find((entry) => entry.name === "reach")?.default).toBe(64)
  })

  it("inherits the shared palette as colour wells", () => {
    expect(control("color")).toMatchObject({ kind: "color", group: "palette" })
    expect(control("accent")?.kind).toBe("color")
  })

  it("ranges a slider from the prop's own name and doc", () => {
    expect(control("headAngle")).toMatchObject({ min: -180, max: 180 })
    expect(control("toolExtension")).toMatchObject({ min: 0, max: 1 })
  })

  it("marks what a panel cannot drive rather than guessing", () => {
    expect(control("palette")?.kind).toBe("unsupported")
  })

  it("never offers React plumbing as a knob", () => {
    expect(control("className")).toBeUndefined()
    expect(control("style")).toBeUndefined()
  })

  it("groups frame, motion and shape props apart", () => {
    expect(groupFor("variant")).toBe("frame")
    expect(groupFor("paused")).toBe("motion")
    expect(groupFor("dome")).toBe("shape")
    expect(groupFor("glow")).toBe("palette")
  })

  it("offers a callback as something to watch, not something to set", () => {
    const arm = controlsFor({ ...shared[2], exportName: "RobotArm", index })
    const target = arm.controls.find((entry) => entry.name === "onTargetChange")
    expect(target?.kind).toBe("action")
  })
})

describe("classify", () => {
  const of = (
    member: { name: string; type: string; numbers?: number[] | null },
    fallback?: string | number | boolean,
  ) => classify({ doc: "", union: null, numbers: null, ...member }, index, fallback)

  it("reads a size prop as the shared size scale", () => {
    expect(of({ name: "size", type: "RobotSize | number" }, "md")).toMatchObject({
      kind: "size",
      options: ["xs", "sm", "md", "lg", "xl"],
    })
  })

  it("reads a numeric-literal union as a picker of numbers", () => {
    expect(of({ name: "wheels", type: "2 | 4", numbers: [2, 4] })).toMatchObject({
      kind: "enum",
      options: [2, 4],
      numeric: true,
    })
  })

  it("reads a plain string as text unless it names a palette role", () => {
    expect(of({ name: "label", type: "string" }).kind).toBe("text")
    expect(of({ name: "glow", type: "string" }).kind).toBe("color")
  })
})

describe("numberRange", () => {
  it("uses degrees for an angle", () => {
    expect(numberRange("headAngle", "Dome heading in degrees.", undefined)).toEqual({
      min: -180,
      max: 180,
      step: 1,
    })
  })

  it("uses a unit interval where the doc describes one", () => {
    expect(numberRange("toolExtension", "0 stowed to 1 out.", undefined)).toMatchObject({
      min: 0,
      max: 1,
    })
  })

  it("falls back to a span around the component's own default", () => {
    expect(numberRange("wobble", "", 2)).toMatchObject({ min: 0, max: 6 })
  })
})

describe("drafts", () => {
  it("counts a file that speaks robocn as a machine", () => {
    expect(isRobotSource(shared[1].source)).toBe(true)
    expect(isRobotSource('import { useRobotClock } from "@/hooks/use-robot-motion"')).toBe(true)
  })

  it("does not count a shadcn primitive that happens to share the folder", async () => {
    const button = await readFile("src/components/ui/button.tsx", "utf8")
    expect(isRobotSource(button)).toBe(false)
  })

  it("names a draft from its file name", () => {
    expect(titleCase("harbour-crane")).toBe("Harbour crane")
  })
})

describe("readSignature", () => {
  it("returns no defaults for a component it cannot find", () => {
    expect(readSignature("x.tsx", "export const a = 1", "Missing")).toEqual({
      props: null,
      defaults: {},
    })
  })
})
