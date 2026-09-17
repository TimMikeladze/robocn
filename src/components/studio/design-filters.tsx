"use client"

/** The designs list's filters. All of it lives in the URL, so a filtered view is a link. */

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"

import { fieldClass } from "@/components/studio/kit"
import { cn } from "@/lib/utils"

type Option = { id: string; name: string }

function DesignFilters({
  workflow,
  labels,
  projects,
}: {
  workflow: Option[]
  labels: Option[]
  projects: Option[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [, startTransition] = React.useTransition()
  const timer = React.useRef<number | undefined>(undefined)

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }))
  }
  const active = [...params.keys()].length > 0
  const select = cn(fieldClass, "w-auto min-w-28 pr-6")

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-48 flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          key={params.get("q") ?? ""}
          type="search"
          aria-label="Search designs"
          placeholder="Search designs"
          defaultValue={params.get("q") ?? ""}
          onChange={(event) => {
            const value = event.target.value
            window.clearTimeout(timer.current)
            timer.current = window.setTimeout(() => set("q", value.trim()), 250)
          }}
          className={cn(fieldClass, "pl-8")}
        />
      </div>
      <select aria-label="Stage" value={params.get("stage") ?? ""} onChange={(e) => set("stage", e.target.value)} className={select}>
        <option value="">Any stage</option>
        {workflow.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      {projects.length ? (
        <select aria-label="Project" value={params.get("project") ?? ""} onChange={(e) => set("project", e.target.value)} className={select}>
          <option value="">Any project</option>
          <option value="none">No project</option>
          {projects.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      ) : null}
      {labels.length ? (
        <select aria-label="Label" value={params.get("label") ?? ""} onChange={(e) => set("label", e.target.value)} className={select}>
          <option value="">Any label</option>
          {labels.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      ) : null}
      {(["published", "archived"] as const).map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={params.get(key) === "1"}
          onClick={() => set(key, params.get(key) === "1" ? "" : "1")}
          className="h-8 rounded-md border border-border px-2.5 text-[12px] capitalize transition-colors hover:bg-accent aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
        >
          {key}
        </button>
      ))}
      {active ? (
        <button
          type="button"
          onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
          className="inline-flex h-8 items-center gap-1 px-1.5 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <X className="size-3" /> Clear
        </button>
      ) : null}
    </div>
  )
}

export { DesignFilters }
