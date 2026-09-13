import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Slider } from "@/components/ui/slider"

describe("slider accessible name", () => {
  it("names the interactive range input", async () => {
    const { findByLabelText } = render(<Slider value={[0.5]} min={0} max={1} aria-label="Jaw opening" />)
    expect((await findByLabelText("Jaw opening", { selector: "input" })).getAttribute("aria-valuenow")).toBe("0.5")
  })

  it("associates a visible label with the interactive input", async () => {
    const { findByLabelText } = render(<><span id="travel-label">Belt travel</span><Slider value={[0.25]} aria-labelledby="travel-label" /></>)
    expect(await findByLabelText("Belt travel", { selector: "input" })).toBeTruthy()
  })
})
