import { describe, expect, it } from "vitest"

import { fitCell } from "@/components/workbench/matrix"

/** The pane matrix mode gets with the handoff panel open, and its measured chrome. */
const pane = { width: 1500, height: 700, label: 120, header: 26, zoom: 1 }

/** What the markup spends per column and per row, on top of the drawing itself. */
const wide = (cell: number, columns: number) => columns * (cell + 32) + pane.label + 32
const tall = (cell: number, rows: number) => rows * (cell + 33) + pane.header + 32

describe("fitting the matrix to its pane", () => {
  it("makes the whole cross product fit, both ways", () => {
    const cell = fitCell({ ...pane, columns: 4, rows: 4 })
    expect(wide(cell, 4)).toBeLessThanOrEqual(pane.width)
    expect(tall(cell, 4)).toBeLessThanOrEqual(pane.height)
  })

  it("lets the tighter axis win — a short pane shrinks a tall grid", () => {
    // Two columns leave plenty of room across; six rows do not, down.
    const six = fitCell({ ...pane, columns: 2, rows: 6 })
    const two = fitCell({ ...pane, columns: 2, rows: 2 })
    expect(six).toBeLessThan(two)
    expect(tall(six, 6)).toBeLessThanOrEqual(pane.height)
  })

  it("treats zoom as a multiplier on the fit, so 100% is the whole grid", () => {
    const fitted = fitCell({ ...pane, columns: 4, rows: 4 })
    expect(fitCell({ ...pane, columns: 4, rows: 4, zoom: 2 })).toBe(fitted * 2)
  })

  it("stops shrinking rather than drawing a smudge", () => {
    // Forty rows in a short pane: the grid scrolls instead of vanishing.
    expect(fitCell({ ...pane, columns: 4, rows: 40 })).toBe(48)
  })

  it("caps a lone cell rather than drawing one poster-sized machine", () => {
    expect(fitCell({ ...pane, columns: 1, rows: 1 })).toBe(240)
  })

  it("falls back to a fixed cell before the pane has been measured", () => {
    expect(fitCell({ ...pane, width: 0, height: 0, columns: 4, rows: 4 })).toBe(140)
  })
})
