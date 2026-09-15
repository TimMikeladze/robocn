import { describe, expect, it } from "vitest"

import { checkoutPath, entriesIn, repoFiles, repoPath, stemOf } from "@/lib/fs/paths"

describe("repoPath", () => {
  it("strips the watched root's own name", () => {
    expect(repoPath("robocn", "robocn/src/components/ui/robot-arm.tsx")).toBe(
      "src/components/ui/robot-arm.tsx",
    )
  })

  it("returns null for a path under some other root", () => {
    expect(repoPath("robocn", "other/src/index.ts")).toBeNull()
    // A folder whose name merely starts the same is not inside it.
    expect(repoPath("robo", "robocn/src/index.ts")).toBeNull()
  })
})

describe("checkoutPath", () => {
  it("is the inverse of repoPath", () => {
    const path = "src/lib/robocn/style.ts"
    expect(repoPath("my-app", checkoutPath("my-app", path))).toBe(path)
  })

  it("tolerates a leading slash or dot-slash", () => {
    expect(checkoutPath("robocn", "./registry.json")).toBe("robocn/registry.json")
    expect(checkoutPath("robocn", "/registry.json")).toBe("robocn/registry.json")
  })
})

describe("repoFiles", () => {
  it("re-keys what is inside the root and drops what is not", () => {
    const files = repoFiles(
      "robocn",
      new Map([
        ["robocn/registry.json", "{}"],
        ["elsewhere/registry.json", "{}"],
      ]),
    )
    expect([...files.keys()]).toEqual(["registry.json"])
  })
})

describe("entriesIn", () => {
  it("lists one directory only, not the tree below it", () => {
    const files = new Map([
      ["src/components/ui/robot-arm.tsx", ""],
      ["src/components/ui/nested/thing.tsx", ""],
      ["src/lib/robocn/style.ts", ""],
    ])
    expect(entriesIn(files, "src/components/ui")).toEqual(["src/components/ui/robot-arm.tsx"])
  })
})

describe("stemOf", () => {
  it("is the registry item's name", () => {
    expect(stemOf("src/components/ui/robot-arm.tsx")).toBe("robot-arm")
  })
})
