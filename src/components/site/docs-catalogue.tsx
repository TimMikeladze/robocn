"use client"

import * as React from "react"
import Link from "next/link"

import { Panel } from "@/components/site/panel"
import type { DocEntry } from "@/lib/docs"
import { cn } from "@/lib/utils"

/** Only catalogue metadata crosses the server boundary, not source and API tables. */
export type CatalogueEntry = Pick<DocEntry, "slug" | "title" | "summary" | "group" | "item">

function DocsCatalogue({ entries }: { entries: CatalogueEntry[] }) {
  const [query, setQuery] = React.useState("")
  const [category, setCategory] = React.useState("All")
  const searchRef = React.useRef<HTMLInputElement>(null)
  const categories = [...new Set(entries.map(entry => entry.group))]
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const matches = entries.filter(entry => {
    const text = `${entry.title} ${entry.slug} ${entry.summary}`.toLowerCase()
    return (category === "All" || entry.group === category) && words.every(word => text.includes(word))
  })
  const filtered = words.length > 0 || category !== "All"

  function clearFilters() {
    setQuery("")
    setCategory("All")
    searchRef.current?.focus()
  }

  return (
    <div className="space-y-7">
      <div className="space-y-4">
        <label className="block space-y-2">
          <span className="text-[13px] font-medium">Find a component</span>
          <input ref={searchRef} type="search" value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search arms, sensors, tools…"
            className="w-full rounded-none border border-border bg-panel px-3 py-2.5 text-sm outline-none focus-visible:border-foreground focus-visible:ring-1 focus-visible:ring-foreground"
          />
        </label>
        <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
          {["All", ...categories].map(group => (
            <button key={group} type="button" aria-pressed={category === group} onClick={() => setCategory(group)}
              className={cn("border border-border px-3 py-2 text-[12px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
                category === group ? "border-foreground bg-foreground text-background" : "bg-panel text-muted-foreground hover:text-foreground")}>
              {group} <span className="ml-1 tabular-nums opacity-65">{group === "All" ? entries.length : entries.filter(entry => entry.group === group).length}</span>
            </button>
          ))}
        </div>
        <div className="flex min-h-7 items-center justify-between gap-3">
          <p role="status" className="text-[12px] text-muted-foreground">
            {matches.length} of {entries.length} entries{category !== "All" ? ` · ${category}` : ""}
          </p>
          {filtered && <button type="button" onClick={clearFilters} className="text-[12px] underline underline-offset-4 hover:text-muted-foreground">Clear filters</button>}
        </div>
      </div>
      {matches.length === 0 ? (
        <Panel className="px-5 py-10 text-center">
          <h2 className="font-medium">No matching components</h2>
          <p className="mt-2 text-sm text-muted-foreground">Try a broader search or clear the category filter.</p>
        </Panel>
      ) : categories.map(group => {
        const groupEntries = matches.filter(entry => entry.group === group)
        if (!groupEntries.length) return null
        return (
          <section key={group} className="space-y-3">
            <h2 className="text-[13px] font-medium text-muted-foreground">{group}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {groupEntries.map(entry => (
                <Link key={entry.slug} href={`/docs/${entry.slug}`} className="group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
                  <Panel className="h-full p-4 transition-colors group-hover:border-foreground">
                    <h3 className="text-[15px] font-medium">{entry.title}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{entry.summary}</p>
                    {entry.item && <code className="mt-3 block font-mono text-[11px] text-muted-foreground">{entry.item}</code>}
                  </Panel>
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export { DocsCatalogue }
