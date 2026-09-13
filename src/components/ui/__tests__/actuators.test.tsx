import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { LinearActuator } from "@/components/ui/linear-actuator"
import { ServoMotor } from "@/components/ui/servo-motor"

describe('linear actuator', () => {
  it('moves the piston and rod through the same stroke while the housing stays fixed', () => {
    const { container, rerender } = render(<LinearActuator extension={0} cutaway />)
    const housing = container.querySelector('[data-housing]')!.outerHTML
    const first = container.querySelector('[data-rod]')!.getAttribute('transform')
    rerender(<LinearActuator extension={1} cutaway />)
    expect(container.querySelector('[data-housing]')!.outerHTML).toBe(housing)
    expect(container.querySelector('[data-rod]')!.getAttribute('transform')).not.toBe(first)
    expect(container.querySelector('[data-piston]')!.getAttribute('transform')).toBe(container.querySelector('[data-rod]')!.getAttribute('transform'))
  })
  it('clamps extension and hides internals outside cutaway mode', () => {
    const { getByRole, container, rerender } = render(<LinearActuator extension={3} />)
    expect(getByRole('img').getAttribute('aria-label')).toContain('100%')
    expect(container.querySelector('[data-piston]')).toBeNull()
    rerender(<LinearActuator extension={NaN} />)
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(getByRole('img').getAttribute('aria-label')).toContain('0%')
  })
})

describe('servo motor', () => {
  it('rotates the horn without moving the motor and changes attachment geometry', () => {
    const { container, rerender } = render(<ServoMotor angle={0} horn="single" />)
    const body = container.querySelector('[data-motor]')!.outerHTML
    const first = container.querySelector('[data-horn]')!.innerHTML
    rerender(<ServoMotor angle={90} horn="cross" />)
    expect(container.querySelector('[data-motor]')!.outerHTML).toBe(body)
    expect(container.querySelector('[data-horn]')!.getAttribute('transform')).toBe('rotate(90)')
    expect(container.querySelector('[data-horn]')!.innerHTML).not.toBe(first)
    expect(container.querySelectorAll('[data-horn-arm]')).toHaveLength(4)
  })
  it('limits the horn to the declared travel and supports an accessible name', () => {
    const { container, getByRole, rerender } = render(<ServoMotor angle={999} aria-label="Camera pan servo" />)
    expect(container.querySelector('[data-horn]')!.getAttribute('transform')).toBe('rotate(180)')
    expect(getByRole('img', { name: 'Camera pan servo' })).toBeTruthy()
    rerender(<ServoMotor angle={-999} />)
    expect(container.querySelector('[data-horn]')!.getAttribute('transform')).toBe('rotate(-180)')
    rerender(<ServoMotor angle={Infinity} />)
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })
})
