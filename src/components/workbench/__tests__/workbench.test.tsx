import * as React from "react"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { Workbench } from "@/components/workbench/workbench"

/**
 * The workbench mounts the library's real components, so these drive it the way
 * a person does: pick a machine, turn a knob, read the pose back out of the URL.
 */

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }))

// Every machine on the stage runs its own animation frame loop. Ask for reduced
// motion and they all park on a pose, which is the only way a matrix of sixteen
// of them is a test rather than a benchmark.
beforeAll(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

const open = (query: Record<string, string> = {}) =>
  render(<Workbench initialQuery={{ c: "robot-arm", ...query }} />)

afterEach(() => {
  window.history.replaceState(null, "", "/workbench")
  window.localStorage.clear()
})

describe("setup", () => {
  it("explains how to run it the first time, and not after it is dismissed", async () => {
    const first = open()
    const guide = await screen.findByRole("dialog", { name: /getting started/i })
    expect(within(guide).getByText(/git clone/)).toBeTruthy()
    // Every agent this loop is written for is named, with the command to run.
    for (const command of ["claude", "codex", "opencode"]) {
      expect(within(guide).getByRole("link", { name: new RegExp(command) })).toBeTruthy()
    }
    fireEvent.click(within(guide).getByRole("button", { name: /open the workbench/i }))
    expect(screen.queryByRole("dialog")).toBeNull()

    first.unmount()
    open()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("takes an explicit answer from the URL, either way", async () => {
    const asked = open({ setup: "1" })
    expect(screen.getByRole("dialog", { name: /getting started/i })).toBeTruthy()
    asked.unmount()
    // A first visit that says no: what a screenshot of the tool itself needs.
    open({ setup: "0" })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("comes back from the toolbar", async () => {
    window.localStorage.setItem("robocn-workbench-setup", "1")
    open()
    await screen.findByRole("img", { name: /robotic arm/i })
    fireEvent.click(screen.getByRole("button", { name: /Setup/ }))
    expect(screen.getByRole("dialog", { name: /getting started/i })).toBeTruthy()
  })
})

describe("starting a new component", () => {
  beforeEach(() => {
    window.localStorage.setItem("robocn-workbench-setup", "1")
  })

  it("writes the brief for a component that does not exist yet", async () => {
    open()
    await screen.findByRole("img", { name: /robotic arm/i })
    fireEvent.click(screen.getByRole("button", { name: /New/ }))
    const dialog = screen.getByRole("dialog", { name: /write the brief for a new component/i })
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^name$/i }), {
      target: { value: "Harbour crane" },
    })
    const brief = within(dialog).getByText(/build-robot skill/)
    expect(brief.textContent).toContain("src/components/ui/harbour-crane.tsx")
    expect(brief.textContent).toContain("HarbourCrane")
    // The component on the stage is offered as the one to follow.
    expect(brief.textContent).toContain("src/components/ui/robot-arm.tsx")
  })

  it("opens from the URL as well as the toolbar", async () => {
    open({ new: "1" })
    expect(screen.getByRole("dialog", { name: /write the brief for a new component/i })).toBeTruthy()
  })
})

describe("the workbench", () => {
  beforeEach(() => {
    // The guide is covered above; the rest of the tool is what these drive.
    window.localStorage.setItem("robocn-workbench-setup", "1")
  })

  it("opens on the component the URL names and draws it", async () => {
    open()
    expect(await screen.findByRole("img", { name: /robotic arm/i })).toBeTruthy()
    // The status bar names the file; so does the handoff panel, which is open.
    expect(screen.getAllByText("src/components/ui/robot-arm.tsx").length).toBeGreaterThan(0)
  })

  it("shows the handoff without being asked, and takes no for an answer", async () => {
    // Handing a pose to an agent is the loop, so the panel is the default.
    const first = open()
    await screen.findByRole("img", { name: /robotic arm/i })
    expect(screen.getByText(/paste this into an agent/i)).toBeTruthy()

    fireEvent.keyDown(window, { key: "s" })
    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get("panel")).toBe("none")
    })
    expect(screen.queryByText(/paste this into an agent/i)).toBeNull()

    // And a link that says so opens closed.
    first.unmount()
    open({ panel: "none" })
    await screen.findByRole("img", { name: /robotic arm/i })
    expect(screen.queryByText(/paste this into an agent/i)).toBeNull()
  })

  it("derives its knobs from the component's own props", async () => {
    open()
    await screen.findByRole("img", { name: /robotic arm/i })
    const panel = screen.getByRole("group", { name: "variant" })
    for (const value of ["solid", "outline", "blueprint", "wire"]) {
      expect(within(panel).getByRole("button", { name: value })).toBeTruthy()
    }
    // A callback is watched, not set.
    expect(screen.getByText(/calls are logged here/i)).toBeTruthy()
  })

  it("writes a turned knob into the URL, so the pose survives a reload", async () => {
    open()
    await screen.findByRole("img", { name: /robotic arm/i })
    fireEvent.click(
      within(screen.getByRole("group", { name: "variant" })).getByRole("button", {
        name: "blueprint",
      }),
    )
    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get("p.variant")).toBe("blueprint")
    })
  })

  it("reads a pose back out of the URL it was given", async () => {
    open({ "p.variant": "wire", "p.tool": "welder" })
    await screen.findByRole("img", { name: /robotic arm/i })
    // Four variants fit as chips; eight tools become a select.
    expect(
      within(screen.getByRole("group", { name: "variant" }))
        .getByRole("button", { name: "wire" })
        .getAttribute("data-on"),
    ).toBe("true")
    expect((screen.getByRole("combobox", { name: "tool" }) as HTMLSelectElement).value).toBe(
      "welder",
    )
  })

  it("switches machines from the index and forgets the last pose", async () => {
    open({ "p.variant": "wire" })
    await screen.findByRole("img", { name: /robotic arm/i })
    fireEvent.click(screen.getByRole("button", { name: /Utility droid/ }))
    await screen.findByRole("img", { name: /utility droid/i })
    await waitFor(() => {
      const params = new URLSearchParams(window.location.search)
      expect(params.get("c")).toBe("utility-droid")
      expect(params.get("p.variant")).toBeNull()
    })
  })

  it("draws a matrix across two of the component's props", async () => {
    open()
    await screen.findByRole("img", { name: /robotic arm/i })
    fireEvent.click(screen.getByRole("button", { name: /Matrix/ }))
    const columns = screen.getByRole("combobox", { name: "Matrix columns" })
    await waitFor(() => expect((columns as HTMLSelectElement).value).toBe("variant"))
    // One drawing per cell: four variants against whatever the rows are.
    await waitFor(() => {
      expect(screen.getAllByRole("img", { name: /robotic arm/i }).length).toBeGreaterThan(4)
    })
  })

  it("keeps the search box filtering the index", async () => {
    open()
    await screen.findByRole("img", { name: /robotic arm/i })
    fireEvent.change(screen.getByRole("searchbox", { name: "Search components" }), {
      target: { value: "duck" },
    })
    expect(screen.queryByRole("button", { name: /Utility droid/ })).toBeNull()
    expect(screen.getByRole("button", { name: /Micro duck/ })).toBeTruthy()
  })
})
