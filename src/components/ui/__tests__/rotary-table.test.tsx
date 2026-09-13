import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { RotaryTable } from "@/components/ui/rotary-table"

describe('rotary table', () => {
  it('rotates the platter and fixtures together while keeping the base fixed', () => {
    const { container, rerender } = render(<RotaryTable angle={0} stations={4} />)
    const base = container.querySelector('[data-base]')!.outerHTML
    const initial = container.querySelector('[data-platter]')!.getAttribute('transform')
    rerender(<RotaryTable angle={90} stations={4} />)
    expect(container.querySelector('[data-platter]')!.getAttribute('transform')).not.toBe(initial)
    expect(container.querySelector('[data-base]')!.outerHTML).toBe(base)
    expect(container.querySelectorAll('[data-platter] [data-fixture]')).toHaveLength(4)
    rerender(<RotaryTable angle={450} stations={4} />)
    expect(container.querySelector('[data-platter]')!.getAttribute('transform')).toBe('rotate(90)')
  })

  it('bounds station count and handles invalid poses without corrupting the SVG', () => {
    const { container, getByRole, rerender } = render(<RotaryTable angle={NaN} stations={1000} />)
    expect(container.querySelectorAll('[data-fixture]')).toHaveLength(12)
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    rerender(<RotaryTable stations={0} aria-label="Empty indexing table" />)
    expect(container.querySelectorAll('[data-fixture]')).toHaveLength(0)
    expect(getByRole('img', { name: 'Empty indexing table' })).toBeTruthy()
  })
})
