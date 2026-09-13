import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ThemeCustomizer } from "@/components/site/theme-customizer"
import { themeCss, themeData } from "@/lib/site-theme"

const setTheme = vi.fn()

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", resolvedTheme: "dark", setTheme }),
}))

const pressed = (el: Element | null) => el?.getAttribute("aria-pressed")
const stored = () => JSON.parse(window.localStorage.getItem("robocn-theme") ?? "null")

/** Opens the panel; its contents only mount once the popover is open. */
const open = async () => {
  render(<ThemeCustomizer />)
  fireEvent.click(screen.getByLabelText("Change theme"))
  await waitFor(() => screen.getByLabelText("Cobalt"))
}

describe("theme customizer", () => {
  beforeEach(() => {
    document.getElementById("robocn-theme")?.remove()
    window.localStorage.clear()
    setTheme.mockClear()
  })

  it("shows the saved palette as pressed, not the default", async () => {
    window.localStorage.setItem("robocn-theme", '{"preset":"rust","radius":1}')
    await open()
    expect(pressed(screen.getByLabelText("Rust"))).toBe("true")
    expect(pressed(screen.getByLabelText("Steel"))).toBe("false")
    expect(pressed(screen.getByRole("button", { name: "1" }))).toBe("true")
  })

  it("writes the stylesheet and the store when a palette is picked", async () => {
    await open()
    fireEvent.click(screen.getByLabelText("Plasma"))

    expect(document.getElementById("robocn-theme")?.textContent).toBe(
      themeCss(themeData, "plasma", 0.625),
    )
    expect(stored()).toEqual({ preset: "plasma", radius: 0.625 })
  })

  it("keeps the palette when only the radius changes", async () => {
    window.localStorage.setItem("robocn-theme", '{"preset":"mono","radius":0.625}')
    await open()
    fireEvent.click(screen.getByRole("button", { name: "0" }))

    expect(stored()).toEqual({ preset: "mono", radius: 0 })
  })

  it("hands light/dark to next-themes rather than writing its own mode", async () => {
    await open()
    expect(pressed(screen.getByRole("button", { name: "dark" }))).toBe("true")
    fireEvent.click(screen.getByRole("button", { name: "light" }))

    expect(setTheme).toHaveBeenCalledWith("light")
    expect(window.localStorage.getItem("robocn-theme")).toBeNull()
  })

  it("tunes one role from a picked colour and leaves the others on the preset", async () => {
    await open()
    fireEvent.change(screen.getByLabelText("shell colour"), { target: { value: "#e11d48" } })

    const saved = stored()
    expect(saved.preset).toBe("steel")
    expect(saved.tune.shell.hue).toBeGreaterThan(0)
    expect(saved.tune.signal).toBeUndefined()
    expect(document.getElementById("robocn-theme")?.textContent).toBe(
      themeCss(themeData, "steel", 0.625, saved.tune),
    )
  })

  it("drops a role's tune back to the preset", async () => {
    window.localStorage.setItem(
      "robocn-theme",
      '{"preset":"steel","radius":0.625,"tune":{"shell":{"hue":300,"chroma":1}}}',
    )
    await open()
    fireEvent.click(screen.getByLabelText("Reset shell"))

    expect(stored().tune).toBeUndefined()
  })

  it("clears the tune when a different palette is picked", async () => {
    window.localStorage.setItem(
      "robocn-theme",
      '{"preset":"steel","radius":0.625,"tune":{"base":{"hue":10,"chroma":1}}}',
    )
    await open()
    fireEvent.click(screen.getByLabelText("Rust"))

    expect(stored()).toEqual({ preset: "rust", radius: 0.625 })
  })

  it("randomises all three roles at once", async () => {
    await open()
    fireEvent.click(screen.getByRole("button", { name: /random/ }))

    expect(Object.keys(stored().tune)).toEqual(["base", "signal", "shell"])
  })

  it("resets both axes at once", async () => {
    window.localStorage.setItem("robocn-theme", '{"preset":"sulphur","radius":0}')
    await open()
    fireEvent.click(screen.getByRole("button", { name: /^reset$/ }))

    expect(pressed(screen.getByLabelText("Steel"))).toBe("true")
    expect(stored()).toEqual({ preset: "steel", radius: 0.625 })
  })
})
