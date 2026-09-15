import { describe, expect, it } from "vitest"

import { checkoutFilter, onPath } from "@/lib/fs/filters"

/** Filters take the handle they are deciding about; none of these read it. */
const nowhere = {} as never

const build = async () => {
  const filter = await checkoutFilter()()
  return {
    enters: (relativePath: string) =>
      filter.shouldProcessDirectory(
        { path: relativePath, rootPath: "robocn", relativePath, name: relativePath.split("/").pop() ?? "" },
        nowhere,
      ),
    reads: (relativePath: string) =>
      filter.shouldIncludeFile(
        { path: relativePath, rootPath: "robocn", relativePath, name: relativePath.split("/").pop() ?? "" },
        nowhere,
      ),
  }
}

describe("onPath", () => {
  it("is true for an ancestor and for something inside", () => {
    expect(onPath("src", "src/components/ui")).toBe(true)
    expect(onPath("src/components/ui/parts", "src/components/ui")).toBe(true)
  })

  it("is false for a sibling", () => {
    expect(onPath("src/app", "src/components/ui")).toBe(false)
  })
})

describe("checkoutFilter", () => {
  it("never enters node_modules, or anything else off the path", async () => {
    const filter = await build()
    expect(await filter.enters("node_modules")).toBe(false)
    expect(await filter.enters(".next")).toBe(false)
    expect(await filter.enters("public")).toBe(false)
    expect(await filter.enters("src/app")).toBe(false)
  })

  it("enters the ancestors of what it does read", async () => {
    const filter = await build()
    expect(await filter.enters("src")).toBe(true)
    expect(await filter.enters("src/components")).toBe(true)
    expect(await filter.enters("src/components/ui")).toBe(true)
    expect(await filter.enters("src/lib/robocn")).toBe(true)
  })

  it("reads the machines, the solvers and the manifests", async () => {
    const filter = await build()
    expect(await filter.reads("src/components/ui/robot-arm.tsx")).toBe(true)
    expect(await filter.reads("src/lib/robocn/style.ts")).toBe(true)
    expect(await filter.reads("registry.json")).toBe(true)
    expect(await filter.reads("components.json")).toBe(true)
  })

  it("reads text and nothing else — a recording is not a string", async () => {
    const filter = await build()
    expect(await filter.reads("src/components/ui/robot-arm.webp")).toBe(false)
    expect(await filter.reads("src/app/page.tsx")).toBe(false)
    expect(await filter.reads("pnpm-lock.yaml")).toBe(false)
  })
})
