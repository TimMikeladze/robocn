// @vitest-environment node
import { describe, expect, it } from "vitest"
import { libraryComponents, loadLibraryComponent } from "../library"
import { compileRobot } from "../compiler"
import registry from "../../../../registry.json"
import { readFile } from "node:fs/promises"

describe("dogfooding the complete robocn library", () => {
  it("lists every registry UI component without maintaining another allow-list", () => {
    expect(libraryComponents.map(c => c.id).sort()).toEqual(registry.items.filter(i => i.type === "registry:ui").map(i => i.name).sort())
  })
  it.each(registry.items.filter(i => i.type === "registry:ui"))("loads and compiles the actual source for $name", async item => {
    const loaded = loadLibraryComponent(item.name)
    expect(loaded).not.toBeNull()
    const original = await readFile(item.files[0].path, "utf8")
    expect(loaded!.code.startsWith(original)).toBe(true)
    expect((await compileRobot(loaded!.code)).javascript).toContain("__Robot")
  })
  it("does not load arbitrary paths or server source", () => {
    expect(loadLibraryComponent("../../.env.local")).toBeNull()
    expect(loadLibraryComponent("@/lib/builder/agent")).toBeNull()
  })
  it("selects the component export, not uppercase geometry constants", () => {
    expect(loadLibraryComponent("robot-arm")!.code).toContain("export default RobotArm\n")
    expect(loadLibraryComponent("robot-arm")!.code).not.toContain("export default ROBOT_ARM_FLOOR")
  })
  it("tracks shadcn and npm dependencies as well as robocn dependencies for export", async () => {
    const result = await compileRobot(loadLibraryComponent("arm-controls")!.code)
    expect(result.shadcnDependencies).toEqual(expect.arrayContaining(["button", "card", "label", "select", "slider"]))
    expect(result.packages).toContain("lucide-react")
    expect(result.dependencies).toContain("robot-arm")
  })
})
