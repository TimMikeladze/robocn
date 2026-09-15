import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ExportMenu, RobotExport } from "@/components/ui/robot-export"

const openMenu = () => fireEvent.click(screen.getByLabelText("Export this as a picture"))

const mount = (props: React.ComponentProps<typeof RobotExport> = {}) =>
  render(
    <RobotExport {...props}>
      <svg data-testid="machine" />
    </RobotExport>,
  )

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe("the export wrapper", () => {
  it("draws the machine it was given and puts a record button over it", () => {
    const { container } = mount({ name: "robot-arm" })
    expect(container.querySelector("[data-testid=machine]")).not.toBeNull()
    expect(screen.getByLabelText("Export this as a picture")).toBeTruthy()
  })

  it("marks the button as chrome, so it is not in the recording of itself", () => {
    const { container } = mount()
    const chrome = container.querySelector("[data-robocn-hide]")
    expect(chrome).not.toBeNull()
    expect(chrome?.querySelector("button")).not.toBeNull()
  })
})

describe("the export menu", () => {
  it("offers a field for every number the recording is made of", async () => {
    mount()
    openMenu()
    for (const field of ["Seconds", "Rate", "Frames", "Scale", "File name"]) {
      expect(await screen.findByLabelText(field)).toBeTruthy()
    }
    expect(await screen.findByRole("group", { name: "Format" })).toBeTruthy()
    expect(await screen.findByRole("group", { name: "Ground" })).toBeTruthy()
  })

  it("drops WebP where the browser's canvas cannot write it", async () => {
    // jsdom has no canvas encoder at all, which is the case this guards.
    mount()
    openMenu()
    const formats = await screen.findByRole("group", { name: "Format" })
    const offered = Array.from(formats.querySelectorAll("button")).map((button) => button.textContent)
    expect(offered).toEqual(["GIF", "PNG"])
  })

  it("takes any length, not only the ones on the chips", async () => {
    mount()
    openMenu()
    await screen.findByLabelText("Seconds")
    type("Seconds", "7.5")
    expect(await screen.findByRole("button", { name: /Record 7\.5s GIF/ })).toBeTruthy()
    // 7.5s at the default 15 fps is 113 frames, and the readout says so.
    expect(screen.getByLabelText("Frames")).toHaveProperty("value", "113")
  })

  it("keeps a decimal legible while it is being typed", async () => {
    mount()
    openMenu()
    await screen.findByLabelText("Seconds")
    type("Seconds", "0.")
    expect(screen.getByLabelText("Seconds")).toHaveProperty("value", "0.")
    type("Seconds", "0.25")
    expect(await screen.findByRole("button", { name: /Record 0\.25s/ })).toBeTruthy()
  })

  it("treats frames as the other side of seconds and rate", async () => {
    mount()
    openMenu()
    await screen.findByLabelText("Rate")
    type("Rate", "30")
    type("Frames", "90")
    expect(await screen.findByRole("button", { name: /Record 3s GIF/ })).toBeTruthy()
    expect(screen.getByLabelText("Seconds")).toHaveProperty("value", "3")
  })

  it("clamps a number the format or the machine cannot honour", async () => {
    mount()
    openMenu()
    await screen.findByLabelText("Rate")
    type("Rate", "999")
    fireEvent.blur(screen.getByLabelText("Rate"))
    expect(screen.getByLabelText("Rate")).toHaveProperty("value", "60")
    type("Scale", "-4")
    fireEvent.blur(screen.getByLabelText("Scale"))
    expect(screen.getByLabelText("Scale")).toHaveProperty("value", "0.1")
  })

  it("takes wider limits from the page that mounted it", async () => {
    mount({ limits: { fps: [1, 120] }, presets: { fps: [60, 120] } })
    openMenu()
    await screen.findByLabelText("Rate")
    type("Rate", "120")
    fireEvent.blur(screen.getByLabelText("Rate"))
    expect(screen.getByLabelText("Rate")).toHaveProperty("value", "120")
  })

  it("asks for a colour only when the ground is a colour", async () => {
    mount()
    openMenu()
    const ground = await screen.findByRole("group", { name: "Ground" })
    expect(screen.queryByLabelText("Ground colour")).toBeNull()
    fireEvent.click(Array.from(ground.querySelectorAll("button")).find((b) => b.textContent === "Colour")!)
    expect(await screen.findByLabelText("Ground colour")).toBeTruthy()
    fireEvent.change(screen.getByLabelText("Ground colour value"), { target: { value: "#101010" } })
    expect(screen.getByLabelText("Ground colour value")).toHaveProperty("value", "#101010")
  })

  it("opens on the settings it was handed", async () => {
    mount({ defaults: { seconds: 6, fps: 24, scale: 1.5, format: "gif" } })
    openMenu()
    expect(await screen.findByLabelText("Seconds")).toHaveProperty("value", "6")
    expect(screen.getByLabelText("Rate")).toHaveProperty("value", "24")
    expect(screen.getByLabelText("Scale")).toHaveProperty("value", "1.5")
    expect(screen.getByRole("button", { name: /Record 6s GIF/ })).toBeTruthy()
  })

  it("says what the record button is about to do, and drops the length for a still", async () => {
    mount()
    openMenu()
    expect(await screen.findByRole("button", { name: /Record 2s GIF/ })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Still" }))
    expect(await screen.findByRole("button", { name: /Save GIF/ })).toBeTruthy()
  })

  it("reports having nothing to record rather than failing silently", async () => {
    render(<ExportMenu target={() => null} name="nothing" />)
    openMenu()
    fireEvent.click(await screen.findByRole("button", { name: /Record 2s GIF/ }))
    await waitFor(() => expect(screen.getByText("Nothing to record.")).toBeTruthy())
  })
})
