import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { InstallToFolder } from "@/components/site/install-to-folder"

/**
 * The installer is the one place a page writes into someone else's repository,
 * so these drive the whole path: pick a folder, resolve the closure, show the
 * plan, and only then write. The folder is an in-memory fake implementing the
 * three handle methods the code actually calls.
 */

const missing = () => new DOMException("not found", "NotFoundError")

class FakeFile {
  constructor(
    private store: Map<string, string>,
    private path: string,
  ) {}
  async getFile() {
    return { text: async () => this.store.get(this.path) ?? "" }
  }
  async createWritable() {
    let buffer = ""
    return {
      write: async (data: string) => {
        buffer += data
      },
      close: async () => {
        this.store.set(this.path, buffer)
      },
      abort: async () => {},
    }
  }
}

class FakeDirectory {
  constructor(
    private store: Map<string, string>,
    private prefix = "",
    readonly name = "my-app",
  ) {}
  private at(entry: string) {
    return this.prefix ? `${this.prefix}/${entry}` : entry
  }
  async getDirectoryHandle(entry: string, options?: { create?: boolean }) {
    const path = this.at(entry)
    const exists = [...this.store.keys()].some((key) => key.startsWith(`${path}/`))
    if (!exists && !options?.create) throw missing()
    return new FakeDirectory(this.store, path, entry)
  }
  async getFileHandle(entry: string, options?: { create?: boolean }) {
    const path = this.at(entry)
    if (!this.store.has(path) && !options?.create) throw missing()
    return new FakeFile(this.store, path)
  }
}

const REGISTRY: Record<string, unknown> = {
  "robot-arm": {
    name: "robot-arm",
    registryDependencies: ["http://localhost:3000/r/robot-style.json", "button"],
    files: [
      {
        path: "src/components/ui/robot-arm.tsx",
        target: "@ui/robot-arm.tsx",
        content: "// the arm\n",
      },
    ],
  },
  "robot-style": {
    name: "robot-style",
    files: [
      { path: "src/lib/robocn/style.ts", target: "@lib/robocn/style.ts", content: "// style\n" },
    ],
  },
}

/** A folder with the two files the planner reads, plus whatever is on disk. */
function project(files: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(files))
  const handle = new FakeDirectory(store)
  vi.stubGlobal("showDirectoryPicker", async () => handle)
  vi.stubGlobal("fetch", async (url: string) => {
    const name = url.split("/").pop()?.replace(".json", "") ?? ""
    const item = REGISTRY[name]
    return { ok: Boolean(item), json: async () => item } as Response
  })
  return store
}

const srcProject = (extra: Record<string, string> = {}) =>
  project({
    "components.json": JSON.stringify({ aliases: { ui: "@/components/ui", lib: "@/lib" } }),
    "tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }),
    ...extra,
  })

const choose = async () => {
  fireEvent.click(screen.getByRole("button", { name: /choose a folder/i }))
  await screen.findByText(/src\/components\/ui\/robot-arm\.tsx/)
}

afterEach(() => vi.unstubAllGlobals())

describe("InstallToFolder", () => {
  it("renders nothing in a browser with no picker", () => {
    vi.stubGlobal("showDirectoryPicker", undefined)
    const { container } = render(<InstallToFolder item="robot-arm" />)
    expect(container.firstChild).toBeNull()
  })

  it("shows the whole plan, and writes nothing until it is confirmed", async () => {
    const store = srcProject({ "src/lib/robocn/style.ts": "// already here\n" })
    render(<InstallToFolder item="robot-arm" />)
    await choose()

    // The dependency is followed, and a file already on disk says so.
    expect(screen.getByText("src/lib/robocn/style.ts")).toBeTruthy()
    expect(screen.getAllByText("replace")).toHaveLength(1)
    expect(screen.getByText(/1 replaced/)).toBeTruthy()
    // shadcn's own primitives are named, not written.
    expect(screen.getByText(/shadcn@latest add button/)).toBeTruthy()
    expect(store.get("src/components/ui/robot-arm.tsx")).toBeUndefined()

    fireEvent.click(screen.getByRole("button", { name: /write 2 files/i }))
    await waitFor(() => expect(store.get("src/components/ui/robot-arm.tsx")).toBe("// the arm\n"))
    expect(store.get("src/lib/robocn/style.ts")).toBe("// style\n")
    expect(screen.getByText(/wrote 2 files/)).toBeTruthy()
  })

  it("follows a project that keeps its source at the root", async () => {
    const store = project({
      "components.json": JSON.stringify({ aliases: { ui: "@/parts", lib: "@/lib" } }),
      "tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "@/*": ["./*"] } } }),
    })
    render(<InstallToFolder item="robot-arm" />)
    fireEvent.click(screen.getByRole("button", { name: /choose a folder/i }))
    await screen.findByText("parts/robot-arm.tsx")

    fireEvent.click(screen.getByRole("button", { name: /write 2 files/i }))
    await waitFor(() => expect(store.get("parts/robot-arm.tsx")).toBe("// the arm\n"))
    expect(store.get("lib/robocn/style.ts")).toBe("// style\n")
  })

  it("can be cancelled without touching the folder", async () => {
    const store = srcProject()
    render(<InstallToFolder item="robot-arm" />)
    await choose()
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(screen.queryByText(/src\/components\/ui\/robot-arm\.tsx/)).toBeNull()
    expect(store.has("src/components/ui/robot-arm.tsx")).toBe(false)
  })
})
