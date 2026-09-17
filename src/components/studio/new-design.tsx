"use client"

/**
 * Starting a design: choose the machine, name it, go. The list is the whole
 * registry — the same manifest the workbench reads — and only the machine under
 * the cursor is mounted, so browsing 190 of them costs one animation loop.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, eyebrow, fieldClass, useAction } from "@/components/studio/kit"
import { MachineView } from "@/components/studio/machine-view"
import { createDesign } from "@/lib/studio/actions/designs"
import { groupTitles, type GroupId } from "@/lib/groups"
import {
  componentsByCategory,
  matchesQuery,
  workbenchComponentList,
  type WorkbenchComponent,
} from "@/lib/workbench/controls"
import { cn } from "@/lib/utils"

const shippable = workbenchComponentList.filter((component) => !component.draft)
const groupTitle = (id: string) => groupTitles[id as GroupId] ?? id.replace(/-/g, " ")

function NewDesign({
  orgSlug,
  projects,
  initialProject,
  initialMachine,
}: {
  orgSlug: string
  projects: { id: string; name: string }[]
  initialProject: string | null
  initialMachine: string | null
}) {
  const router = useRouter()
  const { pending, call } = useAction()
  const [query, setQuery] = React.useState("")
  const [picked, setPicked] = React.useState<WorkbenchComponent>(
    () => shippable.find((component) => component.id === initialMachine) ?? shippable[0],
  )
  const [name, setName] = React.useState<string | null>(null)
  const [projectId, setProjectId] = React.useState(initialProject ?? "")
  const sections = componentsByCategory(shippable.filter((component) => matchesQuery(component, query)))

  return (
    <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
      <div className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
        <div className="relative shrink-0 border-b border-border p-3">
          <Search className="pointer-events-none absolute left-5.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            autoFocus
            aria-label="Search machines"
            placeholder={`Search ${shippable.length} machines`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={cn(fieldClass, "pl-8")}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto max-lg:max-h-[45dvh]">
          {sections.length === 0 ? (
            <p className="p-6 text-center text-[13px] text-muted-foreground">No machine matches “{query}”.</p>
          ) : null}
          {sections.map((section) => (
            <section key={section.category}>
              <h2 className={cn(eyebrow, "sticky top-0 z-10 border-b border-border bg-muted/80 px-3 py-1 backdrop-blur")}>
                {groupTitle(section.category)} · {section.items.length}
              </h2>
              <ul className="grid sm:grid-cols-2 xl:grid-cols-3">
                {section.items.map((component) => (
                  <li key={component.id}>
                    <button
                      type="button"
                      aria-pressed={picked.id === component.id}
                      onClick={() => setPicked(component)}
                      onDoubleClick={() => document.getElementById("design-name")?.focus()}
                      className="w-full border-b border-r border-border/60 px-3 py-2 text-left outline-none transition-colors hover:bg-accent focus-visible:bg-accent aria-pressed:bg-foreground aria-pressed:text-background"
                    >
                      <span className="block truncate text-[13px] font-medium">{component.title}</span>
                      <span className="block truncate font-mono text-[10px] opacity-60">{component.id}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <form
        className="flex min-h-0 flex-col bg-panel"
        onSubmit={async (event) => {
          event.preventDefault()
          const created = await call(() =>
            createDesign(orgSlug, {
              name: (name ?? picked.title).trim(),
              componentId: picked.id,
              projectId: projectId || null,
            }),
          )
          if (created) router.push(`/studio/${orgSlug}/designs/${created.id}`)
        }}
      >
        <div className="flex min-h-64 flex-1 items-center justify-center overflow-hidden border-b border-border bg-background p-4">
          <MachineView key={picked.id} componentId={picked.id} pose={{}} size="md" />
        </div>
        <div className="shrink-0 space-y-4 p-4">
          <div>
            <p className={eyebrow}>{picked.id}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{picked.description}</p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              {picked.controls.filter((control) => control.kind !== "unsupported" && control.kind !== "action").length}{" "}
              adjustable props
            </p>
          </div>
          <Field label="Design name" htmlFor="design-name">
            <input
              id="design-name"
              required
              maxLength={80}
              value={name ?? picked.title}
              onChange={(event) => setName(event.target.value)}
              className={fieldClass}
            />
          </Field>
          {projects.length ? (
            <Field label="Project" htmlFor="new-design-project">
              <select
                id="new-design-project"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className={fieldClass}
              >
                <option value="">No project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Create design"}
          </Button>
        </div>
      </form>
    </div>
  )
}

export { NewDesign }
