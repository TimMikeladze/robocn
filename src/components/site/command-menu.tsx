"use client"

/**
 * The ⌘K palette.
 *
 * 208 registry items is past the point where browsing works, and the catalogue
 * filter on `/docs` is only reachable *from* `/docs`. This puts every component
 * one keystroke from every page. Reasoning: `docs/site-polish.md`.
 *
 * Built on the Base UI dialog rather than a command library, because the only
 * thing a command library would add here is a fuzzy matcher, and a substring
 * match over title, slug and summary finds what people actually type.
 */

import * as React from "react"
import { Dialog } from "@base-ui/react/dialog"
import { useRouter } from "next/navigation"
import { CornerDownLeft, Search } from "lucide-react"

import type { CatalogueEntry } from "@/components/site/docs-catalogue"
import { cn } from "@/lib/utils"

/** Destinations that are not components, listed first so they stay findable. */
const pages = [
  { href: "/docs", title: "Components", hint: "The whole catalogue" },
  { href: "/workbench", title: "Workbench", hint: "Every machine with its controls" },
  { href: "/docs/installation", title: "Install", hint: "How the registry install works" },
  { href: "/about", title: "About", hint: "What robocn is and what it solves" },
  { href: "/llms.txt", title: "llms.txt", hint: "The site as one file, for agents" },
] as const

interface Result {
  href: string
  title: string
  hint: string
  group: string
}

/** How many component hits to draw. Enough to scroll, few enough to render fast. */
const LIMIT = 40

function resultsFor(query: string, entries: CatalogueEntry[]): Result[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const matches = (text: string) => words.every((word) => text.includes(word))

  const destinations: Result[] = pages
    .filter((page) => matches(`${page.title} ${page.hint}`.toLowerCase()))
    .map((page) => ({ ...page, group: "Pages" }))

  const components: Result[] = entries
    .filter((entry) => matches(`${entry.title} ${entry.slug} ${entry.summary}`.toLowerCase()))
    .slice(0, LIMIT)
    .map((entry) => ({
      href: `/docs/${entry.slug}`,
      title: entry.title,
      hint: entry.summary,
      group: entry.group,
    }))

  return [...destinations, ...components]
}

/** The groups in the order their first hit appeared, so headings never reorder. */
function grouped(results: Result[]) {
  const order: string[] = []
  for (const result of results) {
    if (!order.includes(result.group)) order.push(result.group)
  }
  return order.map((group) => ({
    group,
    items: results.filter((result) => result.group === group),
  }))
}

function CommandMenu({ entries }: { entries: CatalogueEntry[] }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(0)
  const listRef = React.useRef<HTMLDivElement>(null)

  const results = React.useMemo(() => resultsFor(query, entries), [query, entries])
  const sections = React.useMemo(() => grouped(results), [results])

  // ⌘K and Ctrl-K anywhere, and `/` when the visitor is not already typing.
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))
      const shortcut = event.key === "k" && (event.metaKey || event.ctrlKey)
      if (!shortcut && !(event.key === "/" && !typing)) return
      event.preventDefault()
      setOpen((wasOpen) => !wasOpen)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Keep the highlighted row on screen while the arrows walk past the fold.
  React.useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" })
  }, [active])

  /**
   * A fresh palette every time: a stale query from last week is never what the
   * next ⌘K meant. Reset on the transition rather than in an effect watching
   * `open`, which would be a second render for no reason.
   */
  function onOpenChange(next: boolean) {
    if (next) {
      setQuery("")
      setActive(0)
    }
    setOpen(next)
  }

  function onQueryChange(next: string) {
    setQuery(next)
    setActive(0)
  }

  function go(href: string) {
    setOpen(false)
    // `/llms.txt` is served by a route handler, not a page: the client router
    // has nothing to push, so it is a real navigation.
    if (href.endsWith(".txt")) window.location.assign(href)
    else router.push(href)
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || (event.key === "n" && event.ctrlKey)) {
      event.preventDefault()
      setActive((index) => (results.length ? (index + 1) % results.length : 0))
    } else if (event.key === "ArrowUp" || (event.key === "p" && event.ctrlKey)) {
      event.preventDefault()
      setActive((index) => (results.length ? (index - 1 + results.length) % results.length : 0))
    } else if (event.key === "Enter" && results[active]) {
      event.preventDefault()
      go(results[active].href)
    }
  }

  let row = -1

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger
        className="flex h-8 items-center gap-2 rounded-md border border-border bg-panel px-2.5 text-[13px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:w-40 lg:w-56"
        aria-label="Search components"
      >
        <Search className="size-3.5 shrink-0" />
        {/* The icon carries it below `md`; `aria-label` names it at every width. */}
        <span className="hidden md:inline">Search…</span>
        {/* The hint is the affordance: without it nobody discovers ⌘K. */}
        <kbd className="ml-auto hidden shrink-0 items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] text-muted-foreground lg:inline-flex">
          ⌘K
        </kbd>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-background/70 backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Popup
          className="fixed top-[12vh] left-1/2 z-50 flex max-h-[70vh] w-[min(38rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden border border-border bg-panel shadow-2xl outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          onKeyDown={onKeyDown}
        >
          <Dialog.Title className="sr-only">Search robocn</Dialog.Title>
          <div className="flex items-center gap-2.5 border-b border-border px-3.5">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search arms, sensors, tools…"
              aria-label="Search components"
              className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
              esc
            </kbd>
          </div>

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {results.length === 0 ? (
              <p className="px-2.5 py-8 text-center text-[13px] text-muted-foreground">
                Nothing matches “{query}”.
              </p>
            ) : (
              sections.map((section) => (
                <div key={section.group} className="mb-1.5 last:mb-0">
                  <h2 className="px-2.5 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground">
                    {section.group}
                  </h2>
                  {section.items.map((item) => {
                    row += 1
                    const index = row
                    return (
                      <button
                        key={item.href}
                        type="button"
                        data-active={index === active}
                        onMouseMove={() => setActive(index)}
                        onClick={() => go(item.href)}
                        className={cn(
                          "flex w-full items-center gap-3 px-2.5 py-2 text-left transition-colors",
                          index === active ? "bg-muted text-foreground" : "text-muted-foreground",
                        )}
                      >
                        <span className="shrink-0 text-[13.5px] font-medium text-foreground">
                          {item.title}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px]">{item.hint}</span>
                        {index === active && (
                          <CornerDownLeft className="size-3 shrink-0 opacity-60" aria-hidden />
                        )}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-border px-3.5 py-2 font-mono text-[10.5px] text-muted-foreground">
            <span>↑↓ move</span>
            <span>↵ open</span>
            <span className="ml-auto tabular-nums">
              {results.length} {results.length === 1 ? "result" : "results"}
            </span>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export { CommandMenu, resultsFor }
