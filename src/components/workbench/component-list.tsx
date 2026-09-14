"use client"

/**
 * The index: every `registry:ui` item in the repository, grouped by its
 * registry category. Filtering is a plain substring match over title, item
 * name, description and categories, so "iso arm" and "rail" both land.
 */

import * as React from "react"
import { Search } from "lucide-react"

import {
  componentsByCategory,
  matchesQuery,
  workbenchComponentList,
  type WorkbenchComponent,
} from "@/lib/workbench/controls"
import { cn } from "@/lib/utils"

export interface ComponentListProps {
  selected: string
  onSelect: (id: string) => void
  query: string
  onQueryChange: (query: string) => void
  searchRef?: React.Ref<HTMLInputElement>
}

function ComponentList({
  selected,
  onSelect,
  query,
  onQueryChange,
  searchRef,
}: ComponentListProps) {
  const matches = React.useMemo(
    () => workbenchComponentList.filter((component) => matchesQuery(component, query)),
    [query],
  )
  const sections = React.useMemo(() => componentsByCategory(matches), [matches])
  const selectedRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    // Optional call: jsdom has no scroller, and neither does a hidden rail.
    selectedRef.current?.scrollIntoView?.({ block: "nearest" })
  }, [selected])

  /** Up and down move through the filtered list from the search box. */
  const step = (direction: 1 | -1) => {
    if (!matches.length) return
    const order = sections.flatMap((section) => section.items)
    const index = order.findIndex((component: WorkbenchComponent) => component.id === selected)
    const next = order[(index + direction + order.length) % order.length] ?? order[0]
    onSelect(next.id)
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={searchRef}
          type="search"
          value={query}
          placeholder="Search components  /"
          aria-label="Search components"
          className="h-6 w-full bg-transparent font-mono text-[12px] outline-none placeholder:text-muted-foreground"
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault()
              step(1)
            }
            if (event.key === "ArrowUp") {
              event.preventDefault()
              step(-1)
            }
            if (event.key === "Escape") onQueryChange("")
          }}
        />
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto" aria-label="Components">
        {sections.map((section) => (
          <div key={section.category}>
            <h2 className="sticky top-0 z-10 border-b border-border bg-muted/70 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur">
              {section.category}
              <span className="ml-1.5 opacity-60">{section.items.length}</span>
            </h2>
            {section.items.map((component) => (
              <button
                key={component.id}
                ref={component.id === selected ? selectedRef : undefined}
                type="button"
                aria-current={component.id === selected}
                onClick={() => onSelect(component.id)}
                className={cn(
                  "flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left transition-colors hover:bg-accent",
                  component.id === selected && "bg-foreground text-background hover:bg-foreground",
                )}
              >
                <span className="truncate text-[12px]">{component.title}</span>
                <span className="shrink-0 font-mono text-[10px] opacity-60">
                  {component.draft
                    ? "draft"
                    : component.controls.filter((control) => control.kind !== "unsupported").length}
                </span>
              </button>
            ))}
          </div>
        ))}
        {matches.length === 0 ? (
          <p className="px-3 py-4 text-[12px] text-muted-foreground">
            Nothing matches “{query}”.
          </p>
        ) : null}
      </nav>
      <div className="border-t border-border px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
        {matches.length} of {workbenchComponentList.length} components
      </div>
    </div>
  )
}

export { ComponentList }
