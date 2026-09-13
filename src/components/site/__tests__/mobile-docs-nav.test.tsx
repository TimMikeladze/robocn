import { fireEvent, render } from "@testing-library/react"
import { expect, it } from "vitest"
import { MobileDocsNav } from "@/components/site/mobile-docs-nav"

it('starts collapsed and closes when a documentation link is selected', () => {
  const { container, getByText } = render(<MobileDocsNav><a href="#component"><span>Robot arm</span></a></MobileDocsNav>)
  const disclosure = container.querySelector('details')!
  expect(disclosure.open).toBe(false)
  disclosure.open = true
  fireEvent.click(getByText('Robot arm'))
  expect(disclosure.open).toBe(false)
})
