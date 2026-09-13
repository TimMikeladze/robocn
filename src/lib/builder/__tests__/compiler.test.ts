// @vitest-environment node
import { describe, expect, it } from "vitest"
import { compileRobot } from "../compiler"
import { loadLibraryComponent } from "../library"
import { previewDocument } from "../preview"

describe("builder compilation boundary", () => {
  it("compiles a real animated robot against the actual library", async () => {
    const result = await compileRobot(loadLibraryComponent("servo-motor")!.code)
    expect(result.javascript).toContain("__Robot")
    expect(result.dependencies).toContain("robot-style")
    expect(result.dependencies).toContain("use-robot-motion")
  })
  it("rejects invented library exports and requires a default component", async () => {
    await expect(compileRobot('import { madeUpSolver } from "@/lib/robocn/style"; export default function R(){return madeUpSolver()}')).rejects.toThrow("No matching export")
    await expect(compileRobot('export function Robot(){return null}')).rejects.toThrow("default")
  })
  it.each(["node:fs", "../../.env.local", "https://evil.example/module.js", "@/lib/builder/agent", "/etc/passwd"])("never resolves %s against the host filesystem", async path => {
    await expect(compileRobot(`import value from ${JSON.stringify(path)}; export default function Robot(){return value}`)).rejects.toThrow("Unsupported import")
  })
  it("rejects oversized source", async () => {
    await expect(compileRobot("a".repeat(60_001))).rejects.toThrow("60,000")
  })
  it("keeps script-closing text inside the script and locks down the preview", () => {
    const html = previewDocument('const text = "</script><script>alert(1)</script>";', "https://robocn.dev")
    expect(html).toContain('<script src="https://robocn.dev/builder-runtime.js"')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain("connect-src 'none'")
    expect(html).toContain("frame-src 'none'")
  })
})
