import { act, fireEvent, render } from "@testing-library/react"
import { beforeEach, expect, it } from "vitest"

import { Logo } from "@/components/site/logo"

/** The tool tip, read back off the tool group's own transform. */
function tipOf(container: HTMLElement) {
  const transform = container.querySelector("g")!.getAttribute("transform")!
  const [x, y] = transform.match(/translate\(([-\d.]+) ([-\d.]+)\)/)!.slice(1)
  return { x: Number(x), y: Number(y) }
}

/** The mark is a 36 px square in the header; jsdom has no layout, so say so. */
function place(container: HTMLElement, box: { left: number; top: number }) {
  const svg = container.querySelector("svg")!
  svg.getBoundingClientRect = () =>
    ({ ...box, width: 36, height: 36, right: box.left + 36, bottom: box.top + 36 }) as DOMRect
}

/** Long enough for the solver to close a cross-envelope move at 96 units/s. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 400)))

beforeEach(() => {
  window.localStorage.clear()
})

it("parks at the mark pose when static, so the social card captures the same file twice", () => {
  const first = render(<Logo behavior="static" />)
  const second = render(<Logo behavior="static" />)
  // Within the solver's own tolerance of the parked tip.
  expect(tipOf(first.container).x).toBeCloseTo(17.2, 1)
  expect(tipOf(first.container).y).toBeCloseTo(6.8, 1)
  expect(first.container.innerHTML).toBe(second.container.innerHTML)
})

it("draws three links on a base", () => {
  const { container } = render(<Logo behavior="static" />)
  // Two static pieces — foot and pedestal — then one path per link.
  expect(container.querySelectorAll("path")).toHaveLength(5)
  // Three hubs, a bore through the two big ones, plus the tool tip. The wrist
  // hub is solid: at 28 px its ring would be under a pixel.
  expect(container.querySelectorAll("circle")).toHaveLength(6)
})

it("stands the machine in a cell, which the caller can take away", () => {
  // The cell is what gives the mark a footprint at 16 px, and an edge for the
  // wordmark to align to.
  const { container } = render(<Logo behavior="static" />)
  expect(container.querySelector("rect")).not.toBeNull()

  const bare = render(<Logo behavior="static" cell={false} />)
  expect(bare.container.querySelector("rect")).toBeNull()
  // Taking the cell away takes nothing off the machine.
  expect(bare.container.querySelectorAll("circle")).toHaveLength(6)
})

it("is painted in the machines' orange, not the chrome's teal", () => {
  const { container } = render(<Logo behavior="static" />)
  // Three links plus the undercarriage; three hubs plus the plinth.
  // Three links plus the foot; three hubs plus the pedestal. The cell's own
  // tinted fill and ring carry an opacity, so they are separate class tokens.
  expect(container.querySelectorAll(".stroke-shell")).toHaveLength(4)
  expect(container.querySelectorAll(".fill-shell")).toHaveLength(4)
  expect(container.querySelector(".fill-shell-hot")).not.toBeNull()
  expect(container.querySelector('[class*="signal"]')).toBeNull()
})

it("takes its pose from where the page was clicked", async () => {
  const { container } = render(<Logo />)
  place(container, { left: 300, top: 20 })
  // Well to the left of the mark: the arm has to swing across its envelope.
  fireEvent.pointerDown(window, { clientX: 20, clientY: 0 })
  await settle()
  expect(tipOf(container).x).toBeLessThan(9.2)
})

it("holds that pose until the next click — the cursor alone never moves it", async () => {
  const { container } = render(<Logo />)
  place(container, { left: 300, top: 20 })
  fireEvent.pointerDown(window, { clientX: 20, clientY: 0 })
  await settle()
  const aimed = tipOf(container)

  // A cursor sweeping the other side of the page is not a click, so nothing moves.
  fireEvent.pointerMove(window, { clientX: 900, clientY: 600 })
  await settle()
  expect(tipOf(container)).toEqual(aimed)

  // The next click does.
  fireEvent.pointerDown(window, { clientX: 900, clientY: 40 })
  await settle()
  expect(tipOf(container).x).toBeGreaterThan(aimed.x)
})

it("remembers the aim, so the pose survives a reload", async () => {
  const first = render(<Logo />)
  place(first.container, { left: 300, top: 20 })
  fireEvent.pointerDown(window, { clientX: 20, clientY: 0 })
  await settle()
  const aimed = tipOf(first.container)
  first.unmount()

  const second = render(<Logo />)
  await settle()
  expect(tipOf(second.container).x).toBeCloseTo(aimed.x, 1)
  expect(tipOf(second.container).y).toBeCloseTo(aimed.y, 1)
})

it("fires the tool while the link it sits in is pressed", () => {
  const { container, getByRole } = render(
    <a href="/home">
      <Logo />
    </a>,
  )
  const link = getByRole("link")
  expect(container.querySelectorAll(".robocn-spark")).toHaveLength(0)
  fireEvent.pointerDown(link)
  expect(container.querySelectorAll(".robocn-spark")).toHaveLength(4)
  fireEvent.pointerUp(window)
  expect(container.querySelectorAll(".robocn-spark")).toHaveLength(0)
})

it("fires the tool while the link it sits in is focused, so a keyboard reaches it", () => {
  const { container, getByRole } = render(
    <a href="/home">
      <Logo />
    </a>,
  )
  fireEvent.focusIn(getByRole("link"))
  expect(container.querySelectorAll(".robocn-spark")).toHaveLength(4)
  fireEvent.focusOut(getByRole("link"))
  expect(container.querySelectorAll(".robocn-spark")).toHaveLength(0)
})
