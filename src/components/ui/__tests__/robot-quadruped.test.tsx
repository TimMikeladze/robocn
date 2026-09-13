import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RobotQuadruped } from '@/components/ui/robot-quadruped'

describe('robot quadruped', () => {
  it('draws four solved legs and responds to controlled gait phase', () => {
    const { container, getByRole, rerender } = render(<RobotQuadruped gait="trot" phase={0} />)
    expect(container.querySelectorAll('[data-leg]')).toHaveLength(4)
    expect(container.querySelectorAll('[data-leg] path')).toHaveLength(8)
    const pose = container.querySelector('[data-leg="front-left"]')!.innerHTML
    rerender(<RobotQuadruped gait="trot" phase={0.75} />)
    expect(container.querySelector('[data-leg="front-left"]')!.innerHTML).not.toBe(pose)
    expect(getByRole('img').getAttribute('aria-label')).toContain('trot')
  })
  it('supports scoped styling, naming, and contact indicators', () => {
    const { container, getByRole } = render(<RobotQuadruped gait="stand" color="#abcdef" size={280} showContacts aria-label="Inspection robot" />)
    expect(container.querySelectorAll('[data-contact]')).toHaveLength(4)
    expect(container.innerHTML).toContain('#abcdef')
    expect(getByRole('img', { name: 'Inspection robot' }).getAttribute('width')).toBe('280')
  })
})
