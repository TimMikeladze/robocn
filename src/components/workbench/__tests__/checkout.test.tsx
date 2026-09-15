import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { Workbench } from "@/components/workbench/workbench"

/**
 * What a folder changes about the workbench.
 *
 * `use-fs` is mocked rather than driven: jsdom has no directory picker, no
 * IndexedDB and no disk, and what is worth testing here is the wiring above the
 * library — that the source panel edits the right path, that `New` writes the
 * skeleton where the dialog says it will, and that a machine on disk the
 * manifest has never seen is reported rather than ignored.
 */

const ARM = "robocn/src/components/ui/robot-arm.tsx"

const shared = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  return {
    files: new Map<string, string>(),
    directories: [] as string[],
    writes: [] as { path: string; data: unknown }[],
    listeners,
    /** Replace the scan the way a poll would, and re-render what is watching. */
    push(files: Map<string, string>) {
      shared.files = files
      for (const listener of listeners) listener()
    },
  }
})
vi.mock("use-fs", async () => {
  const React = await import("react")
  /** Re-render when a test pushes a new scan, the way the real poll does. */
  const useScan = () => {
    const [, force] = React.useState(0)
    React.useEffect(() => {
      const listener = () => force((value) => value + 1)
      shared.listeners.add(listener)
      return () => {
        shared.listeners.delete(listener)
      }
    }, [])
  }
  return {
    createFilter: () => () => ({
      shouldIncludeFile: () => true,
      shouldProcessDirectory: () => true,
    }),
    getDirectoryPicker: () => null,
    ensurePermission: async () => true,
    useFs: (options: { mode?: string } = {}) => {
      useScan()
      // The checkout asks for write access up front; the pose shelf does not.
      return options.mode === "readwrite"
        ? {
            files: shared.files,
            directories: shared.directories,
            isBrowserSupported: true,
            isOpfsSupported: false,
            error: null,
            addDirectory: async () => "robocn",
            onClear: async () => {},
            writeFile: async (path: string, data: unknown) => {
              shared.writes.push({ path, data })
            },
          }
        : {
            files: new Map<string, string>(),
            directories: [],
            isBrowserSupported: false,
            isOpfsSupported: false,
            error: null,
            addOpfsDirectory: async () => "robocn",
            writeFile: async () => {},
          }
    },
  }
})

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }))

beforeAll(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

beforeEach(() => {
  shared.files = new Map([[ARM, "// the arm, as it stands\n"]])
  shared.directories = ["robocn"]
  shared.writes = []
  // The workbench is served from localhost in jsdom, so it offers to rescan.
  vi.stubGlobal("fetch", async () => ({
    ok: true,
    json: async () => ({ message: "scanned" }),
  }))
})

afterEach(() => {
  window.history.replaceState(null, "", "/workbench")
  window.localStorage.clear()
})

const open = (query: Record<string, string> = {}) =>
  render(<Workbench initialQuery={{ c: "robot-arm", setup: "0", ...query }} />)

describe("the source panel with a folder open", () => {
  it("edits the real file and writes it back", async () => {
    open({ panel: "source" })
    fireEvent.click(screen.getByRole("button", { name: /^source$/i }))

    const box = (await screen.findByRole("textbox", {
      name: /src\/components\/ui\/robot-arm\.tsx/i,
    })) as HTMLTextAreaElement
    expect(box.value).toBe("// the arm, as it stands\n")

    fireEvent.change(box, { target: { value: "// edited\n" } })
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }))

    await waitFor(() => expect(shared.writes).toHaveLength(1))
    expect(shared.writes[0]).toEqual({ path: ARM, data: "// edited\n" })
  })

  it("says so when the file changed underneath an unsaved edit", async () => {
    open({ panel: "source" })
    fireEvent.click(screen.getByRole("button", { name: /^source$/i }))
    const box = await screen.findByRole("textbox", {
      name: /src\/components\/ui\/robot-arm\.tsx/i,
    })
    fireEvent.change(box, { target: { value: "// mine\n" } })

    // An agent saves the same file while the box is dirty, and the next poll
    // brings it in.
    act(() => shared.push(new Map([[ARM, "// theirs\n"]])))

    expect(await screen.findByText(/changed on disk while you were editing/i)).toBeTruthy()
  })
})

describe("starting a machine with a folder open", () => {
  it("writes the skeleton where the dialog says it will", async () => {
    open()
    fireEvent.click(screen.getByRole("button", { name: /^new$/i }))
    fireEvent.change(await screen.findByPlaceholderText(/harbour crane/i), {
      target: { value: "Harbour crane" },
    })
    fireEvent.click(screen.getByRole("button", { name: /write the file/i }))

    await waitFor(() => expect(shared.writes).toHaveLength(1))
    const [write] = shared.writes
    expect(write.path).toBe("robocn/src/components/ui/harbour-crane.tsx")
    expect(String(write.data)).toContain("export { HarbourCrane }")
    expect(await screen.findByText(/wrote src\/components\/ui\/harbour-crane\.tsx/i)).toBeTruthy()
  })

  it("refuses a name that is already on disk", async () => {
    shared.files.set("robocn/src/components/ui/harbour-crane.tsx", "// already here")
    open()
    fireEvent.click(screen.getByRole("button", { name: /^new$/i }))
    fireEvent.change(await screen.findByPlaceholderText(/harbour crane/i), {
      target: { value: "Harbour crane" },
    })
    expect(screen.getByText(/already on disk/i)).toBeTruthy()
    expect(screen.getByRole("button", { name: /write the file/i })).toHaveProperty("disabled", true)
  })
})

describe("drafts the manifest has not seen", () => {
  it("counts a machine on disk that no control manifest knows about", async () => {
    shared.files.set(
      "robocn/src/components/ui/harbour-crane.tsx",
      'import { robotCamera } from "@/lib/robocn/style"\n',
    )
    open()
    expect(await screen.findByText(/1 on disk, not in the manifest/i)).toBeTruthy()
  })

  it("does not count a shadcn primitive sharing the folder", async () => {
    shared.files.set("robocn/src/components/ui/accordion.tsx", 'import { cn } from "@/lib/utils"\n')
    open()
    expect(screen.queryByText(/on disk, not in the manifest/i)).toBeNull()
  })
})
