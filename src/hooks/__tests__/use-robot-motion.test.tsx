import { act, fireEvent, render } from "@testing-library/react"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

import {
  approach,
  arrowStep,
  useRobotClock,
  useRobotDrag,
  useRobotScalar,
} from "@/hooks/use-robot-motion"

describe("approach", () => {
  it("rate limits toward the goal and lands on it exactly", () => {
    expect(approach(0, 10, 4)).toBe(4)
    expect(approach(8, 10, 4)).toBe(10)
    expect(approach(10, 0, 4)).toBe(6)
    // Infinity is the controlled case: no easing, straight to the value.
    expect(approach(0, 10, Infinity)).toBe(10)
  })

  it("holds rather than corrupting the drawing on bad input", () => {
    expect(approach(3, NaN, 1)).toBe(3)
    expect(approach(3, 10, 0)).toBe(3)
    expect(approach(3, 10, -1)).toBe(3)
  })
})

describe("arrowStep", () => {
  it("maps arrows and page keys to a signed delta and ignores the rest", () => {
    expect(arrowStep("ArrowRight", 5)).toBe(5)
    expect(arrowStep("ArrowUp", 5)).toBe(5)
    expect(arrowStep("ArrowLeft", 5)).toBe(-5)
    expect(arrowStep("ArrowDown", 5)).toBe(-5)
    expect(arrowStep("PageUp", 5, 45)).toBe(45)
    expect(arrowStep("PageDown", 5, 45)).toBe(-45)
    expect(arrowStep("Enter", 5)).toBe(0)
  })
})

function Clock(props: Parameters<typeof useRobotClock>[0]) {
  return <output>{useRobotClock(props)}</output>
}

describe("useRobotClock", () => {
  it("parks at phase when animation is off, whatever the speed", () => {
    const { container, rerender } = render(<Clock speed={2} animate={false} phase={1.5} />)
    expect(container.textContent).toBe("1.5")
    rerender(<Clock speed={0} animate phase={0.25} />)
    expect(container.textContent).toBe("0.25")
  })

  it("advances while it is running", () => {
    let now = 0
    vi.spyOn(performance, "now").mockImplementation(() => now)
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback)
      return frames.length
    })
    const { container } = render(<Clock speed={2} />)
    now = 500
    act(() => frames.at(-1)!(500))
    // Half a second at two cycles a second.
    expect(Number(container.textContent)).toBeCloseTo(0.1, 5)
    vi.restoreAllMocks()
  })
})

function Scalar({ hold }: { hold: number | null }) {
  const motion = useRobotScalar((clock) => clock * 10, { hold, animate: false, phase: 2 })
  return <output>{motion.value}</output>
}

describe("useRobotScalar", () => {
  it("renders the held value over the goal, and the goal once released", () => {
    const { container, rerender } = render(<Scalar hold={7} />)
    expect(container.textContent).toBe("7")
    rerender(<Scalar hold={null} />)
    // Parked: sampled at phase rather than left where the grab left it.
    expect(container.textContent).toBe("20")
  })
})

function Draggable({ onDrag }: { onDrag: (x: number, y: number) => void }) {
  const ref = React.useRef<SVGSVGElement>(null)
  const dragging = useRobotDrag(ref, {
    onDrag: React.useCallback((unit) => onDrag(unit.x, unit.y), [onDrag]),
  })
  return <svg ref={ref} data-dragging={dragging} />
}

describe("useRobotDrag", () => {
  it("reports unit coordinates from press through release", () => {
    const onDrag = vi.fn()
    const { container } = render(<Draggable onDrag={onDrag} />)
    const svg = container.querySelector("svg")!
    svg.getBoundingClientRect = () =>
      ({ left: 100, top: 50, width: 200, height: 100 }) as DOMRect

    fireEvent.pointerDown(svg, { clientX: 150, clientY: 75, pointerId: 1 })
    expect(onDrag).toHaveBeenLastCalledWith(0.25, 0.25)
    expect(svg.getAttribute("data-dragging")).toBe("true")

    fireEvent.pointerMove(svg, { clientX: 200, clientY: 100, pointerId: 1 })
    expect(onDrag).toHaveBeenLastCalledWith(0.5, 0.5)

    fireEvent.pointerUp(svg, { pointerId: 1 })
    expect(svg.getAttribute("data-dragging")).toBe("false")
    // Moves after release are not drags.
    fireEvent.pointerMove(svg, { clientX: 300, clientY: 150, pointerId: 1 })
    expect(onDrag).toHaveBeenCalledTimes(2)
  })

  it("ignores a move that never started with a press", () => {
    const onDrag = vi.fn()
    const { container } = render(<Draggable onDrag={onDrag} />)
    const svg = container.querySelector("svg")!
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect
    fireEvent.pointerMove(svg, { clientX: 50, clientY: 50, pointerId: 1 })
    expect(onDrag).not.toHaveBeenCalled()
  })
})
