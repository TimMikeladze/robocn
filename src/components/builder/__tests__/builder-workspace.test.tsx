import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { BuilderWorkspace } from "../builder-workspace"
import { loadLibraryComponent } from "@/lib/builder/library"

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }))
const initialVersion = loadLibraryComponent("robot-arm")!
const drone = loadLibraryComponent("robot-drone")!
const compiled = { javascript: "window.__Robot = () => null;", dependencies: ["robot-style"], packages: [], shadcnDependencies: [] }
const library = [{ id: "robot-arm", title: "Robot arm", description: "Articulated arm" }, { id: "robot-drone", title: "Robot drone", description: "Flying drone" }]

beforeEach(() => {
  localStorage.clear()
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function mount() { render(<BuilderWorkspace initialVersion={initialVersion} library={library} serverAgent tokenRequired={false} restoreDraft />) }

describe("library-to-agent workspace", () => {
  it("searches the library and loads the full source into the editable sandbox", async () => {
    const fetcher = vi.fn(async (url: string) => Response.json(url.includes("/library?") ? drone : compiled))
    vi.stubGlobal("fetch", fetcher)
    mount()
    await screen.findByTitle("Robot live preview")
    fireEvent.click(screen.getByRole("button", { name: "Load from library" }))
    fireEvent.change(screen.getByLabelText("Search component library"), { target: { value: "flying" } })
    fireEvent.click(screen.getByRole("button", { name: /Robot drone Flying drone/ }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith("/api/builder/library?component=robot-drone"))
    fireEvent.click(screen.getByRole("tab", { name: "Code" }))
    await waitFor(() => expect((screen.getByLabelText("React component source") as HTMLTextAreaElement).value).toBe(drone.code))
    expect(fetcher.mock.calls.some(([url]) => url.includes("/generate"))).toBe(false)
  })

  it("restarts an unchanged preview with a fresh frame instead of leaving it loading", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(compiled)))
    mount()
    const first = await screen.findByTitle("Robot live preview") as HTMLIFrameElement
    fireEvent(window, new MessageEvent("message", { source: first.contentWindow, data: { type: "robocn-ready" } }))
    await screen.findByText("Live preview")
    fireEvent.click(screen.getByRole("button", { name: "Restart preview" }))
    await waitFor(() => expect(screen.getByTitle("Robot live preview")).not.toBe(first))
  })

  it("sends manually edited library code to the agent and makes its returned version editable", async () => {
    const updated = 'export default function RevisedRobot(){return <svg aria-label="Revised robot"/>}'
    const fetcher = vi.fn(async (url: string) => url.includes("/generate")
      ? new Response(JSON.stringify({ type: "result", ...compiled, code: updated, name: "revised-robot", explanation: "Added your new optic." }) + "\n")
      : Response.json(compiled))
    vi.stubGlobal("fetch", fetcher)
    mount()
    await screen.findByTitle("Robot live preview")
    fireEvent.click(screen.getByRole("tab", { name: "Code" }))
    const edited = initialVersion.code + "\n// A user's manual edit\n"
    fireEvent.change(screen.getByLabelText("React component source"), { target: { value: edited } })
    fireEvent.change(screen.getByLabelText("Describe your robot"), { target: { value: "Add an optic" } })
    fireEvent.click(screen.getByRole("button", { name: "Build robot" }))
    await screen.findByText("Added your new optic.")
    const call = fetcher.mock.calls.find(([url]) => url.includes("/generate"))!
    const options = (call as unknown as [string, RequestInit])[1]
    expect(JSON.parse(options.body as string).code).toBe(edited)
    fireEvent.click(screen.getByRole("tab", { name: "Code" }))
    expect((screen.getByLabelText("React component source") as HTMLTextAreaElement).value).toBe(updated)
  })
})
