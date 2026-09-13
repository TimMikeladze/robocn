import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MicroDuck } from '@/components/ui/micro-duck'
import { ReachyMini } from '@/components/ui/reachy-mini'

describe('micro duck', () => {
  it('draws two solved legs and responds to controlled gait phase', () => {
    const { container, getByRole, rerender } = render(<MicroDuck gait="walk" phase={0} />)
    expect(container.querySelectorAll('[data-leg]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-neck]')).toHaveLength(3)
    const pose = container.querySelector('[data-leg="left"]')!.innerHTML
    rerender(<MicroDuck gait="walk" phase={0.4} />)
    expect(container.querySelector('[data-leg="left"]')!.innerHTML).not.toBe(pose)
    expect(getByRole('img').getAttribute('aria-label')).toContain('walk')
  })

  it('aims the head with gaze and opens the beak', () => {
    const { container, rerender } = render(<MicroDuck gaze={-1} beak={0} />)
    const shut = container.querySelector('[data-beak]')!.getAttribute('transform')
    const pecking = container.querySelector('[data-head]')!.getAttribute('transform')
    rerender(<MicroDuck gaze={1} beak={1} />)
    expect(container.querySelector('[data-beak]')!.getAttribute('transform')).not.toBe(shut)
    expect(container.querySelector('[data-head]')!.getAttribute('transform')).not.toBe(pecking)
    expect(shut).toBe('rotate(0)')
  })

  it('supports scoped styling, naming, and contact marks', () => {
    const { container, getByRole } = render(
      <MicroDuck gait="stand" color="#abcdef" size={280} showContacts aria-label="Lobby greeter" />,
    )
    expect(container.querySelectorAll('[data-contact]')).toHaveLength(2)
    expect(container.innerHTML).toContain('#abcdef')
    expect(getByRole('img', { name: 'Lobby greeter' }).getAttribute('width')).toBe('280')
  })
})

describe('reachy mini', () => {
  it('draws six solved rods that move with the pose', () => {
    const { container, getByRole, rerender } = render(<ReachyMini track={false} />)
    expect(container.querySelectorAll('[data-rod]')).toHaveLength(6)
    const rest = container.querySelector('[data-rod="0"] line')!.getAttribute('x2')
    rerender(<ReachyMini track={false} yaw={25} />)
    expect(container.querySelector('[data-rod="0"] line')!.getAttribute('x2')).not.toBe(rest)
    expect(getByRole('img').getAttribute('aria-label')).toContain('yaw 25')
  })

  it('hides the linkage on request and lights a fault when travel runs out', () => {
    const { container, rerender } = render(<ReachyMini track={false} showLinkage={false} />)
    expect(container.querySelectorAll('[data-rod]')).toHaveLength(0)
    expect(container.querySelector('[data-fault]')).toBeNull()
    rerender(<ReachyMini track={false} pitch={24} geometry={{ travel: 0.5 }} />)
    expect(container.querySelector('[data-fault]')).not.toBeNull()
  })

  it('aims both pupils from a controlled look', () => {
    const { container, rerender } = render(<ReachyMini track={false} look={{ x: -1, y: -1 }} />)
    const left = container.querySelector('[data-eye="left"] circle + g circle')!.getAttribute('cx')
    rerender(<ReachyMini track={false} look={{ x: 1, y: 1 }} />)
    expect(container.querySelector('[data-eye="left"] circle + g circle')!.getAttribute('cx')).not.toBe(left)
    expect(container.querySelectorAll('[data-eye]')).toHaveLength(2)
  })
})
