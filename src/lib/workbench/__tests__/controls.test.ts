import { describe, expect, it } from "vitest"

import {
  agentPrompt,
  componentsByCategory,
  exportName,
  newRobotPrompt,
  shipDraftPrompt,
  slugify,
  fallbackValue,
  jsxSnippet,
  matchesQuery,
  readPose,
  resolvedPose,
  workbenchComponent,
  workbenchComponentList,
  writePose,
  type Control,
  type WorkbenchComponent,
} from "@/lib/workbench/controls"

const control = (over: Partial<Control>): Control => ({
  name: "variant",
  type: "RobotVariant",
  doc: "",
  group: "frame",
  kind: "enum",
  options: ["solid", "outline"],
  ...over,
})

const component: WorkbenchComponent = {
  id: "test-bot",
  title: "Test bot",
  description: "A machine for a test.",
  categories: ["robots"],
  draft: false,
  file: "src/components/ui/test-bot.tsx",
  module: "@/components/ui/test-bot",
  export: "TestBot",
  webgl: false,
  wrap: null,
  props: "TestBotProps",
  controls: [
    control({ default: "solid" }),
    control({ name: "speed", type: "number", kind: "number", min: 0, max: 3, step: 0.01, default: 0.4, options: undefined }),
    control({ name: "paused", type: "boolean", kind: "boolean", group: "motion", default: false, options: undefined }),
    control({ name: "color", type: "string", kind: "color", group: "palette", options: undefined }),
    control({ name: "palette", type: "Partial<RobotPalette>", kind: "unsupported", group: "palette", options: undefined }),
  ],
}

describe("the manifest", () => {
  it("carries every registry component with a file and an export", () => {
    expect(workbenchComponentList.length).toBeGreaterThan(100)
    for (const entry of workbenchComponentList) {
      expect(entry.file).toMatch(/^src\/components\/ui\/.+\.tsx$/)
      expect(entry.export).toMatch(/^[A-Z]/)
    }
  })

  it("finds a component by item name and nothing by a made-up one", () => {
    expect(workbenchComponent("robot-arm")?.export).toBe("RobotArm")
    expect(workbenchComponent("not-a-robot")).toBeNull()
  })

  it("groups the index past the catch-all first category", () => {
    const sections = componentsByCategory(workbenchComponentList)
    // Everything leads with "robotics"; the group is the one after it.
    expect(sections.map((section) => section.category)).toContain("droids")
    expect(sections.map((section) => section.category)).toContain("animals")
    expect(sections.map((section) => section.category)).not.toContain("robotics")
    expect(sections.flatMap((section) => section.items)).toHaveLength(
      workbenchComponentList.length,
    )
  })

  it("matches a search on every word, across name and description", () => {
    const arm = workbenchComponent("robot-arm")!
    expect(matchesQuery(arm, "robot arm")).toBe(true)
    expect(matchesQuery(arm, "ROBOT")).toBe(true)
    expect(matchesQuery(arm, "submarine")).toBe(false)
  })
})

describe("a component that does not exist yet", () => {
  it("turns a name into the file, the item and the export", () => {
    expect(slugify("  Harbour Crane  ")).toBe("harbour-crane")
    expect(slugify("Robot Arm 3D!")).toBe("robot-arm-3d")
    expect(exportName("harbour-crane")).toBe("HarbourCrane")
  })

  it("writes a brief that names all three, and the skill that knows the rest", () => {
    const prompt = newRobotPrompt({
      name: "Harbour crane",
      subject: "A quayside container crane.",
      reference: workbenchComponent("robot-arm"),
    })
    expect(prompt).toContain("build-robot skill")
    expect(prompt).toContain("src/components/ui/harbour-crane.tsx")
    expect(prompt).toContain("`HarbourCrane`")
    expect(prompt).toContain("`harbour-crane`")
    expect(prompt).toContain("src/components/ui/robot-arm.tsx")
    expect(prompt).toContain("A quayside container crane.")
  })

  it("leaves the subject as a blank to fill, and skips a reference nobody picked", () => {
    const prompt = newRobotPrompt({ name: "Harbour crane" })
    expect(prompt).toContain("<describe the component")
    expect(prompt).not.toContain("component to follow")
  })

  it("asks for the ten touchpoints a draft is still missing", () => {
    const draft = { ...component, draft: true }
    const prompt = shipDraftPrompt(draft)
    expect(prompt).toContain("build-robot skill")
    expect(prompt).toContain("src/components/ui/test-bot.tsx")
    expect(prompt).toContain("registry item `test-bot`")
    expect(prompt).toContain("pnpm robot:check test-bot")
  })

  it("puts drafts at the top of the index", () => {
    const sections = componentsByCategory([
      { ...component, id: "a-machine", categories: ["robotics", "machines"] },
      { ...component, id: "a-draft", draft: true, categories: ["drafts"] },
    ])
    expect(sections[0].category).toBe("drafts")
  })
})

describe("the pose in the URL", () => {
  it("reads only values the control actually accepts", () => {
    const params = new URLSearchParams(
      "p.variant=outline&p.speed=1.5&p.paused=true&p.color=%23ff0000&p.palette=x&p.bogus=1",
    )
    expect(readPose(params, component.controls)).toEqual({
      variant: "outline",
      speed: 1.5,
      paused: true,
      color: "#ff0000",
    })
  })

  it("drops a value outside an enum rather than passing it on", () => {
    expect(readPose(new URLSearchParams("p.variant=chrome"), component.controls)).toEqual({})
  })

  it("round-trips through the query string", () => {
    const pose = { variant: "outline", speed: 1.5, paused: true }
    const params = writePose(new URLSearchParams("c=test-bot&p.stale=1"), pose)
    expect(params.get("c")).toBe("test-bot")
    expect(params.get("p.stale")).toBeNull()
    expect(readPose(params, component.controls)).toEqual(pose)
  })
})

describe("defaults", () => {
  it("fills a pose out with what the component itself would do", () => {
    expect(resolvedPose(component, { variant: "outline" })).toEqual({
      variant: "outline",
      speed: 0.4,
      paused: false,
    })
  })

  it("starts an undefaulted slider somewhere on its own scale", () => {
    expect(fallbackValue(control({ name: "x", kind: "number", min: -1, max: 1, options: undefined }))).toBe(0)
    expect(fallbackValue(control({ name: "x", kind: "number", min: 2, max: 8, options: undefined }))).toBe(2)
  })
})

describe("handoff", () => {
  it("writes the pose as JSX, with only what was actually set", () => {
    expect(jsxSnippet(component, { variant: "outline", speed: 1.5, paused: true })).toBe(
      '<TestBot paused speed={1.5} variant="outline" />',
    )
  })

  it("writes a bare element when nothing is set", () => {
    expect(jsxSnippet(component, {})).toBe("<TestBot />")
  })

  it("breaks a long pose over lines rather than running off the panel", () => {
    const droid = workbenchComponent("utility-droid")!
    const long = jsxSnippet(droid, resolvedPose(droid, { variant: "blueprint" }))
    expect(long.split("\n").length).toBeGreaterThan(1)
    expect(long).toContain("<UtilityDroid\n")
  })

  it("names the file, the export and the pose in the agent's brief", () => {
    const prompt = agentPrompt(component, { variant: "outline" }, {
      url: "http://localhost:3000/workbench?c=test-bot",
      request: "Give it a longer neck.",
    })
    expect(prompt).toContain("src/components/ui/test-bot.tsx")
    expect(prompt).toContain("TestBot")
    expect(prompt).toContain('variant="outline"')
    expect(prompt).toContain("Give it a longer neck.")
    expect(prompt).toContain("http://localhost:3000/workbench?c=test-bot")
  })

  it("leaves a blank for the request when there is not one yet", () => {
    expect(agentPrompt(component, {})).toContain("<describe it>")
  })

  it("sends the agent to the scaffolder, or past it when the file is already there", () => {
    const fresh = newRobotPrompt({ name: "Harbour crane" })
    expect(fresh).toContain("pnpm robot:new harbour-crane")

    // The workbench wrote the skeleton itself; `robot:new` would refuse it.
    const drafted = newRobotPrompt({ name: "Harbour crane", drafted: true })
    expect(drafted).not.toContain("pnpm robot:new")
    expect(drafted).toContain("The file already exists")
    expect(drafted).toContain("pnpm robot:check harbour-crane")
  })
})
