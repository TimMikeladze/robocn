import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { DocsCatalogue, type CatalogueEntry } from "@/components/site/docs-catalogue"

const entries: CatalogueEntry[] = [
  { slug: 'robot-arm', title: 'Robot arm', summary: 'Articulated chain with eight tools.', group: 'Arms', item: 'robot-arm' },
  { slug: 'robot-rover', title: 'Robot rover', summary: 'Ground vehicle with steering.', group: 'Robots', item: 'robot-rover' },
  { slug: 'installation', title: 'Installation', summary: 'Install source and dependencies.', group: 'Foundations', item: null },
]

describe('docs catalogue', () => {
  it('matches case-insensitive title, slug and description terms', () => {
    const { getByRole, queryByRole } = render(<DocsCatalogue entries={entries} />)
    fireEvent.change(getByRole('searchbox'), { target: { value: '  GROUND steering ' } })
    expect(getByRole('link', { name: /Robot rover/ })).toBeTruthy()
    expect(queryByRole('link', { name: /Robot arm/ })).toBeNull()
    fireEvent.change(getByRole('searchbox'), { target: { value: 'robot-arm' } })
    expect(getByRole('link', { name: /Robot arm/ })).toBeTruthy()
  })

  it('combines category and search, then clears both from an empty result', () => {
    const { getByRole, queryByRole } = render(<DocsCatalogue entries={entries} />)
    fireEvent.click(getByRole('button', { name: /^Arms/ }))
    fireEvent.change(getByRole('searchbox'), { target: { value: 'rover' } })
    expect(getByRole('status').textContent).toContain('0')
    expect(queryByRole('link', { name: /Robot rover/ })).toBeNull()
    fireEvent.click(getByRole('button', { name: 'Clear filters' }))
    expect(getByRole('searchbox').getAttribute('value')).toBe('')
    expect(getByRole('link', { name: /Robot rover/ })).toBeTruthy()
    expect(getByRole('link', { name: /Installation/ })).toBeTruthy()
    expect(getByRole('button', { name: /^All/ }).getAttribute('aria-pressed')).toBe('true')
  })
})
