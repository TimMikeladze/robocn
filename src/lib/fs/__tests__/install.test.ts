import { describe, expect, it } from "vitest"

import {
  collectItems,
  planInstall,
  primitiveCommand,
  readAliases,
  readSourceRoot,
  registryItemName,
  resolveTarget,
  type RegistryItem,
} from "@/lib/fs/install"

const DEFAULTS = { ui: "@/components/ui", lib: "@/lib", hooks: "@/hooks", components: "@/components" }

describe("registryItemName", () => {
  it("takes the basename, whatever host was baked in at build time", () => {
    expect(registryItemName("http://localhost:3000/r/robot-style.json")).toBe("robot-style")
    expect(registryItemName("https://robocn.dev/r/robot-style.json")).toBe("robot-style")
  })

  it("leaves shadcn primitives alone", () => {
    expect(registryItemName("button")).toBeNull()
    expect(registryItemName("scroll-area")).toBeNull()
  })

  it("ignores a query string and a fragment", () => {
    expect(registryItemName("https://robocn.dev/r/robot-arm.json?v=2")).toBe("robot-arm")
  })
})

describe("collectItems", () => {
  const registry: Record<string, RegistryItem> = {
    "robot-arm": {
      name: "robot-arm",
      registryDependencies: ["https://robocn.dev/r/robot-style.json", "button"],
      files: [{ path: "src/components/ui/robot-arm.tsx", target: "@ui/robot-arm.tsx", content: "arm" }],
    },
    "robot-style": {
      name: "robot-style",
      registryDependencies: ["https://robocn.dev/r/robot-arm.json", "button", "slider"],
      files: [{ path: "src/lib/robocn/style.ts", target: "@lib/robocn/style.ts", content: "style" }],
    },
  }
  const fetchItem = async (name: string) => registry[name]

  it("walks dependencies and keeps the requested item first", async () => {
    const closure = await collectItems("robot-arm", fetchItem)
    expect(closure.items.map((item) => item.name)).toEqual(["robot-arm", "robot-style"])
  })

  it("terminates on a cycle and collects the primitives once", async () => {
    const closure = await collectItems("robot-arm", fetchItem)
    expect(closure.primitives).toEqual(["button", "slider"])
  })
})

describe("readAliases", () => {
  it("falls back to shadcn's defaults for a missing or broken file", () => {
    expect(readAliases(undefined)).toEqual(DEFAULTS)
    expect(readAliases("{ not json")).toEqual(DEFAULTS)
  })

  it("derives ui from components when it is not spelled out", () => {
    const aliases = readAliases(JSON.stringify({ aliases: { components: "@/app/parts" } }))
    expect(aliases.ui).toBe("@/app/parts/ui")
  })

  it("prefers an explicit ui alias", () => {
    const aliases = readAliases(JSON.stringify({ aliases: { ui: "@/design/ui" } }))
    expect(aliases.ui).toBe("@/design/ui")
  })
})

describe("readSourceRoot", () => {
  it("reads the path mapping, comments and trailing commas included", () => {
    const tsconfig = `{
      // the usual shape
      "compilerOptions": { "paths": { "@/*": ["./src/*"] }, },
    }`
    expect(readSourceRoot(tsconfig, undefined)).toBe("src")
  })

  it("handles a project that keeps everything at the root", () => {
    expect(readSourceRoot('{"compilerOptions":{"paths":{"@/*":["./*"]}}}', undefined)).toBe("")
  })

  it("does not mistake a URL's slashes for a comment", () => {
    const tsconfig = '{"$schema":"https://json.schemastore.org/tsconfig","compilerOptions":{"paths":{"@/*":["./src/*"]}}}'
    expect(readSourceRoot(tsconfig, undefined)).toBe("src")
  })

  it("falls back to the css path when there is no mapping", () => {
    const components = JSON.stringify({ tailwind: { css: "src/app/globals.css" } })
    expect(readSourceRoot(undefined, components)).toBe("src")
    expect(readSourceRoot(undefined, JSON.stringify({ tailwind: { css: "app/globals.css" } }))).toBe("")
  })
})

describe("resolveTarget", () => {
  it("maps every alias robocn ships", () => {
    expect(resolveTarget("@ui/robot-arm.tsx", DEFAULTS, "src")).toBe("src/components/ui/robot-arm.tsx")
    expect(resolveTarget("@lib/robocn/style.ts", DEFAULTS, "src")).toBe("src/lib/robocn/style.ts")
    expect(resolveTarget("@hooks/use-robot-motion.ts", DEFAULTS, "src")).toBe("src/hooks/use-robot-motion.ts")
  })

  it("honours a project that keeps components somewhere else", () => {
    const aliases = { ...DEFAULTS, ui: "@/design/ui" }
    expect(resolveTarget("@ui/robot-arm.tsx", aliases, "")).toBe("design/ui/robot-arm.tsx")
  })

  it("treats an unknown prefix as already project-relative", () => {
    expect(resolveTarget("public/robot.svg", DEFAULTS, "")).toBe("public/robot.svg")
  })
})

describe("planInstall", () => {
  const closure = {
    items: [
      {
        name: "robot-arm",
        files: [
          { path: "src/components/ui/robot-arm.tsx", target: "@ui/robot-arm.tsx", content: "arm" },
          { path: "src/lib/robocn/style.ts", target: "@lib/robocn/style.ts", content: "style" },
        ],
      },
      {
        name: "robot-dog",
        files: [
          { path: "src/components/ui/robot-dog.tsx", target: "@ui/robot-dog.tsx", content: "dog" },
          // The same lib file, shipped again by a second item.
          { path: "src/lib/robocn/style.ts", target: "@lib/robocn/style.ts", content: "style" },
          { path: "src/components/ui/empty.tsx", target: "@ui/empty.tsx" },
        ],
      },
    ],
    primitives: ["button"],
  }

  it("writes each path once and marks what it replaces", () => {
    const plan = planInstall(closure, {
      aliases: DEFAULTS,
      sourceRoot: "src",
      exists: (path) => path === "src/lib/robocn/style.ts",
    })
    expect(plan.writes.map((write) => write.path)).toEqual([
      "src/components/ui/robot-arm.tsx",
      "src/lib/robocn/style.ts",
      "src/components/ui/robot-dog.tsx",
    ])
    expect(plan.writes.filter((write) => write.overwrite).map((write) => write.path)).toEqual([
      "src/lib/robocn/style.ts",
    ])
  })

  it("skips a file with no contents rather than writing an empty one", () => {
    const plan = planInstall(closure, { aliases: DEFAULTS, sourceRoot: "src", exists: () => false })
    expect(plan.skipped).toEqual(["src/components/ui/empty.tsx"])
  })
})

describe("primitiveCommand", () => {
  it("names the runner for each package manager", () => {
    expect(primitiveCommand(["button", "card"])).toBe("bunx --bun shadcn@latest add button card")
    expect(primitiveCommand(["button"], "npm")).toBe("npx shadcn@latest add button")
  })
})
