"use client"

/** What the design is for, where it is filed, and the code that reproduces what is on the stage. */

import * as React from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import type { EditorDesign } from "@/components/studio/editor/editor"
import { CopyButton, Field, eyebrow, fieldClass, useAction } from "@/components/studio/kit"
import { updateDesign } from "@/lib/studio/actions/designs"
import { jsxSnippet, type Pose, type WorkbenchComponent } from "@/lib/workbench/controls"
import { cn } from "@/lib/utils"

function DetailsPanel({
  orgSlug,
  canEdit,
  design,
  component,
  pose,
  projects,
  labels,
}: {
  orgSlug: string
  canEdit: boolean
  design: EditorDesign
  component: WorkbenchComponent
  pose: Pose
  projects: { id: string; name: string }[]
  labels: { id: string; name: string; color: string }[]
}) {
  const router = useRouter()
  const { pending, call } = useAction()
  const [description, setDescription] = React.useState(design.description)
  const snippet = jsxSnippet(component, pose)

  const patch = async (input: Parameters<typeof updateDesign>[2], success?: string) => {
    const ok = await call(() => updateDesign(orgSlug, design.id, input), { success })
    if (ok !== null) router.refresh()
  }

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
      <Field label="Description" htmlFor="design-description">
        <textarea
          id="design-description"
          rows={4}
          maxLength={2000}
          disabled={!canEdit}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What this design is for, and what is decided."
          className={cn(fieldClass, "h-auto py-1.5")}
        />
        {canEdit && description !== design.description ? (
          <Button size="xs" disabled={pending} onClick={() => patch({ description }, "Saved")}>
            Save description
          </Button>
        ) : null}
      </Field>

      <Field label="Project" htmlFor="design-project">
        <select
          id="design-project"
          disabled={!canEdit}
          value={design.projectId ?? ""}
          onChange={(event) => patch({ projectId: event.target.value || null })}
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

      <div className="space-y-1.5">
        <p className="text-[12px] font-medium">Labels</p>
        {labels.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">
            No labels yet. An admin can add them in Settings.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {labels.map((label) => {
              const on = design.labelIds.includes(label.id)
              return (
                <button
                  key={label.id}
                  type="button"
                  aria-pressed={on}
                  disabled={!canEdit || pending}
                  onClick={() =>
                    patch({
                      labelIds: on
                        ? design.labelIds.filter((id) => id !== label.id)
                        : [...design.labelIds, label.id],
                    })
                  }
                  className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border px-2 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors hover:bg-accent disabled:opacity-60 aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
                >
                  <span aria-hidden className="size-1.5 rounded-full" style={{ background: label.color }} />
                  {label.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className={eyebrow}>What is on the stage, as JSX</p>
          <CopyButton value={snippet} className="h-6 px-2 text-[11px]" />
        </div>
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap border border-border bg-background p-2 font-mono text-[11px] leading-relaxed">
          {snippet}
        </pre>
        <p className="text-[11px] text-muted-foreground">
          Machine: <code className="font-mono">{component.id}</code> ·{" "}
          <a className="underline underline-offset-2" href={`/docs/${component.id}`} target="_blank" rel="noreferrer">
            docs
          </a>
        </p>
      </div>
    </div>
  )
}

export { DetailsPanel }
