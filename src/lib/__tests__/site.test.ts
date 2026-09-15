import { describe, expect, it } from "vitest"

import {
  defaultManager,
  installCommand,
  itemUrl,
  packageManagers,
  shadcnRunner,
} from "@/lib/site"

/**
 * The install line is the one thing every visitor copies, and it is printed in
 * five places — the hero, each docs page, the social cards, the Markdown
 * mirrors and the README. They all read `packageManagers` now, so this pins the
 * order and the runners rather than each caller doing it again.
 */

describe("install command", () => {
  it("leads with bun, and defaults to it", () => {
    expect(packageManagers[0]).toBe("bun")
    expect(defaultManager).toBe("bun")
    expect(installCommand("robot-arm", undefined, "https://robocn.dev")).toBe(
      "bunx --bun shadcn@latest add https://robocn.dev/r/robot-arm.json",
    )
  })

  it("offers the other three, each with its own one-off runner", () => {
    expect([...packageManagers]).toEqual(["bun", "pnpm", "npm", "yarn"])
    expect(shadcnRunner("pnpm")).toBe("pnpm dlx")
    expect(shadcnRunner("npm")).toBe("npx")
    expect(shadcnRunner("yarn")).toBe("yarn dlx")
  })

  it("falls back to npx for a manager it does not know", () => {
    expect(shadcnRunner("deno")).toBe("npx")
  })

  it("installs from the host it was handed, not the build's own", () => {
    // A preview deployment must not print the production URL, and vice versa.
    expect(installCommand("robot-arm", "bun", "http://localhost:3000")).toContain(
      "http://localhost:3000/r/robot-arm.json",
    )
    expect(itemUrl("robot-arm", "https://robocn.dev")).toBe(
      "https://robocn.dev/r/robot-arm.json",
    )
  })
})
