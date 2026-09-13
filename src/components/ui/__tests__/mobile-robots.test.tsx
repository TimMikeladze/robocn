import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { RobotRover } from "@/components/ui/robot-rover"
import { RobotDrone } from "@/components/ui/robot-drone"
import { LidarScan } from "@/components/ui/lidar-scan"

describe("robot rover", () => {
  it("supports four and six wheels and only steers the front axle", () => {
    const { container, rerender } = render(<RobotRover wheels={4} steering={30} />)
    expect(container.querySelectorAll('[data-wheel]')).toHaveLength(4)
    expect(container.querySelectorAll('[data-steering="30"]')).toHaveLength(2)
    rerender(<RobotRover wheels={6} steering={-100} />)
    expect(container.querySelectorAll('[data-wheel]')).toHaveLength(6)
    expect(container.querySelectorAll('[data-steering="-45"]')).toHaveLength(2)
  })

  it("wraps its heading and wheel travel and tolerates non-finite inputs", () => {
    const { container, rerender } = render(<RobotRover heading={90} wheelTravel={0.25} />)
    const pose = container.querySelector('[data-chassis]')!.getAttribute('transform')
    const tread = container.querySelector('[data-tread]')!.getAttribute('transform')
    rerender(<RobotRover heading={450} wheelTravel={-0.75} />)
    expect(container.querySelector('[data-chassis]')!.getAttribute('transform')).toBe(pose)
    expect(container.querySelector('[data-tread]')!.getAttribute('transform')).toBe(tread)
    rerender(<RobotRover heading={NaN} steering={Infinity} wheelTravel={Infinity} />)
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })
})

describe("robot drone", () => {
  it("switches rotor counts and alternates rotation between neighbouring rotors", () => {
    const { container, rerender } = render(<RobotDrone rotors={4} rotorAngle={30} />)
    expect(container.querySelectorAll('[data-rotor]')).toHaveLength(4)
    const transforms = Array.from(container.querySelectorAll('[data-propeller]')).map(e => e.getAttribute('transform'))
    expect(transforms[0]).toBe('rotate(30)')
    expect(transforms[1]).toBe('rotate(-30)')
    rerender(<RobotDrone rotors={6} guards={false} />)
    expect(container.querySelectorAll('[data-rotor]')).toHaveLength(6)
    expect(container.querySelectorAll('[data-guard]')).toHaveLength(0)
  })

  it("honours accessible naming, sizes and palette overrides", () => {
    const { getByRole, container } = render(<RobotDrone aria-label="Inspection drone" size={300} color="#abcdef" heading={NaN} rotorAngle={Infinity} />)
    expect(getByRole('img', { name: 'Inspection drone' }).getAttribute('width')).toBe('300')
    expect(container.innerHTML).toContain('#abcdef')
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })
})

describe("lidar scan", () => {
  it("plots actual polar distances clockwise from the top", () => {
    const { container, getByRole } = render(<LidarScan maxRange={10} samples={[{ angle: 0, distance: 5 }, { angle: 90, distance: 10 }, { angle: 180, distance: 5 }]} />)
    const points = Array.from(container.querySelectorAll('[data-return]')).map(e => [e.getAttribute('cx'), e.getAttribute('cy')])
    expect(points).toEqual([['0', '-36'], ['72', '0'], ['0', '36']])
    expect(getByRole('img').getAttribute('aria-label')).toContain('3 returns')
  })

  it("drops invalid and out-of-range samples instead of inventing obstacles", () => {
    const samples = [{ angle: 0, distance: -1 }, { angle: 0, distance: 11 }, { angle: NaN, distance: 1 }, { angle: 90, distance: Infinity }, { angle: 0, distance: 0 }]
    const { container, rerender } = render(<LidarScan samples={samples} maxRange={10} showRays />)
    expect(container.querySelectorAll('[data-return]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-ray]')).toHaveLength(1)
    rerender(<LidarScan samples={samples} maxRange={0} scanAngle={NaN} heading={Infinity} />)
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })
})
