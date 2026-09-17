import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { DemoTheming, themingRoles } from "@/components/site/demo-theming"

/**
 * The palette strip retints by CSS variable, so what these check is the
 * variable landing on `:root` — which is the same thing a consumer pastes into
 * their own stylesheet, and the only place the WebGL machines read from.
 */

const root = () => document.documentElement.style

afterEach(() => {
  document.documentElement.removeAttribute("style")
})

describe("the theming strip", () => {
  it("offers every robot colour role", () => {
    render(
      <DemoTheming>
        <svg role="img" aria-label="machine" />
      </DemoTheming>,
    )
    for (const { role } of themingRoles) {
      expect(screen.getByLabelText(role)).toBeTruthy()
      expect(screen.getByLabelText(`${role} value`)).toBeTruthy()
    }
  })

  it("writes a changed role onto the root as its variable, and only that one", () => {
    render(
      <DemoTheming>
        <svg role="img" aria-label="machine" />
      </DemoTheming>,
    )
    fireEvent.change(screen.getByLabelText("shell"), { target: { value: "#ff0000" } })

    expect(root().getPropertyValue("--robot-shell")).toBe("#ff0000")
    // An untouched role is not written at all, so it still follows the theme.
    expect(root().getPropertyValue("--robot-accent")).toBe("")
  })

  it("hands the page's theme back when the demo goes away", () => {
    const page = render(
      <DemoTheming>
        <svg role="img" aria-label="machine" />
      </DemoTheming>,
    )
    fireEvent.change(screen.getByLabelText("shell"), { target: { value: "#ff0000" } })
    page.unmount()
    expect(root().getPropertyValue("--robot-shell")).toBe("")
  })

  it("takes any CSS colour from the text field, and hands back the CSS", () => {
    render(
      <DemoTheming>
        <svg role="img" aria-label="machine" />
      </DemoTheming>,
    )
    fireEvent.change(screen.getByLabelText("accent value"), {
      target: { value: "oklch(0.8 0.2 120)" },
    })
    expect(root().getPropertyValue("--robot-accent")).toBe("oklch(0.8 0.2 120)")
    expect(screen.getByText(/--robot-accent: oklch\(0\.8 0\.2 120\);/)).toBeTruthy()
  })

  it("puts a role back, and resets the lot", () => {
    render(
      <DemoTheming>
        <svg role="img" aria-label="machine" />
      </DemoTheming>,
    )
    fireEvent.change(screen.getByLabelText("shell"), { target: { value: "#ff0000" } })
    fireEvent.change(screen.getByLabelText("grid"), { target: { value: "#00ff00" } })

    fireEvent.click(screen.getByRole("button", { name: "Reset shell" }))
    expect(root().getPropertyValue("--robot-shell")).toBe("")
    expect(root().getPropertyValue("--robot-grid")).toBe("#00ff00")

    fireEvent.click(screen.getByRole("button", { name: /^reset$/ }))
    expect(root().getPropertyValue("--robot-grid")).toBe("")
  })
})
