import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import {
  controlsFor,
  indexTypes,
  isRobotSource as isRobotSourceInNode,
} from "../../../../scripts/lib/workbench.mjs"
import { draftFile, draftSource } from "@/lib/workbench/draft"
import { isRobotSource } from "@/lib/workbench/controls"

const root = path.resolve(import.meta.dirname, "../../../..")
const read = (file: string) => readFileSync(path.join(root, file), "utf8")

const source = draftSource({
  slug: "harbour-crane",
  subject: "A quayside container crane: a portal on rails and a spreader on cables.",
  reference: "robot-arm",
})

describe("draftSource", () => {
  it("writes the file the dialog says it will", () => {
    expect(draftFile("harbour-crane")).toBe("src/components/ui/harbour-crane.tsx")
  })

  it("exports the name the workbench resolves by", () => {
    expect(source).toContain("export { HarbourCrane }")
    expect(source).toContain("export interface HarbourCraneProps")
  })

  it("carries the subject and the machine it was started from", () => {
    expect(source).toContain("quayside container crane")
    expect(source).toContain("Started from `robot-arm`")
  })

  it("reads as a machine, not as a shadcn primitive", () => {
    expect(isRobotSource(source)).toBe(true)
    expect(isRobotSource(read("src/components/ui/button.tsx"))).toBe(false)
  })

  /**
   * The point of writing a skeleton rather than an empty file: the generator
   * has to find knobs in it, or the draft lands on the stage with nothing to
   * turn. This runs the real derivation over the real template.
   */
  it("gives the generator something to derive controls from", () => {
    const index = indexTypes([
      { file: "src/lib/robocn/style.ts", source: read("src/lib/robocn/style.ts") },
      { file: "src/components/ui/harbour-crane.tsx", source },
    ])
    const { props, controls } = controlsFor({
      file: "src/components/ui/harbour-crane.tsx",
      source,
      exportName: "HarbourCrane",
      index,
    })
    expect(props).toBe("HarbourCraneProps")

    const byName = new Map(controls.map((control) => [control.name, control]))
    expect(byName.get("variant")?.kind).toBe("enum")
    expect(byName.get("view")?.options).toEqual(["plan", "front", "profile", "iso"])
    expect(byName.get("behavior")?.options).toEqual(["sweep", "hold", "static"])
    expect(byName.get("paused")?.kind).toBe("boolean")
    expect(byName.get("reach")?.kind).toBe("number")
    expect(byName.get("color")?.kind).toBe("color")

    // Defaults come from the component's own destructuring, so the stage opens
    // on what `<HarbourCrane />` actually draws.
    expect(byName.get("view")?.default).toBe("front")
    expect(byName.get("reach")?.default).toBe(34)
    // `palette` is the whole-object override every machine in the library
    // carries, and no knob can drive it. Nothing else in the template is a
    // shape the generator cannot classify.
    expect(
      controls.filter((control) => control.kind === "unsupported").map((control) => control.name),
    ).toEqual(["palette"])
  })
})

describe("isRobotSource", () => {
  /** The browser copy and the generator's copy have to agree, or a draft
   *  appears in one place and not the other. */
  it("agrees with its twin in the generator", () => {
    const samples = [
      source,
      read("src/components/ui/button.tsx"),
      read("src/components/ui/stepper-motor.tsx"),
      'import { cn } from "@/lib/utils"',
    ]
    for (const sample of samples) {
      expect(isRobotSource(sample)).toBe(isRobotSourceInNode(sample))
    }
  })
})
