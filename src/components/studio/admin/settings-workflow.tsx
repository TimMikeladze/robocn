"use client"

/**
 * The review stages, in order. A stage's id is what designs point at, so it is
 * minted once — from the name, when the stage is first saved — and never
 * changes after: renaming "In review" must not orphan everything in review.
 */

import * as React from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ColorField } from "@/components/studio/admin/color-field"
import { Section, fieldClass, useAction } from "@/components/studio/kit"
import { updateSettings } from "@/lib/studio/actions/workspace"
import { slugify } from "@/lib/studio/ids"
import type { OrgSettings, WorkflowStage } from "@/lib/studio/settings"

interface Draft extends WorkflowStage {
  /** Not saved yet: the id is a placeholder until it is. */
  fresh?: boolean
}

const stageColors = ["#64748b", "#d97706", "#16a34a", "#2563eb", "#9333ea", "#dc2626", "#0891b2"]

/** `slugify(name)`, inside the schema's 32 characters, walked to `-2`, `-3` until free. */
export function stageId(name: string, taken: ReadonlySet<string>) {
  const base = slugify(name).slice(0, 28).replace(/-+$/g, "") || "stage"
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

function WorkflowSettings({
  orgSlug,
  settings,
  readOnly,
  onSaved,
}: {
  orgSlug: string
  settings: OrgSettings
  readOnly: boolean
  onSaved: (next: OrgSettings) => void
}) {
  const { pending, call } = useAction()
  const [stages, setStages] = React.useState<Draft[]>(settings.workflow)

  const patch = (index: number, change: Partial<Draft>) =>
    setStages((current) => current.map((stage, i) => (i === index ? { ...stage, ...change } : stage)))
  const move = (index: number, by: -1 | 1) =>
    setStages((current) => {
      const next = [...current]
      const [stage] = next.splice(index, 1)
      next.splice(index + by, 0, stage)
      return next
    })

  const removed = settings.workflow.filter((saved) => !stages.some((stage) => stage.id === saved.id))
  const dirty =
    JSON.stringify(stages.map(({ id, name, color, done }) => ({ id, name, color, done }))) !==
    JSON.stringify(settings.workflow)
  const unnamed = stages.some((stage) => !stage.name.trim())

  async function save() {
    const taken = new Set(stages.filter((stage) => !stage.fresh).map((stage) => stage.id))
    const workflow = stages.map(({ fresh, ...stage }) => {
      if (!fresh) return stage
      const id = stageId(stage.name, taken)
      taken.add(id)
      return { ...stage, id }
    })
    const next = { ...settings, workflow }
    const done = await call(() => updateSettings(orgSlug, next), { success: "Workflow saved." })
    if (done === null) return
    setStages(workflow)
    onSaved(next)
  }

  return (
    <Section
      title="Workflow"
      description="The stages a design moves through on its way to done. The first is where new designs start."
    >
      <ol className="space-y-2">
        {stages.map((stage, index) => (
          <li
            key={stage.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border border-border bg-background p-2"
          >
            <span className="w-4 text-center font-mono text-[11px] text-muted-foreground">{index + 1}</span>
            <input
              aria-label={`Stage ${index + 1} name`}
              value={stage.name}
              maxLength={32}
              disabled={readOnly}
              onChange={(event) => patch(index, { name: event.target.value })}
              className={`${fieldClass} min-w-0 flex-1 basis-40`}
            />
            <ColorField
              label={stage.name || `Stage ${index + 1}`}
              value={stage.color}
              disabled={readOnly}
              onChange={(color) => patch(index, { color })}
            />
            <label className="flex items-center gap-1.5 text-[12px]">
              <input
                type="checkbox"
                checked={stage.done}
                disabled={readOnly}
                onChange={(event) => patch(index, { done: event.target.checked })}
                className="size-3.5 accent-foreground"
              />
              Counts as done
            </label>
            {readOnly ? null : (
              <div className="ml-auto flex items-center">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${stage.name} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${stage.name} down`}
                  disabled={index === stages.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${stage.name}`}
                  disabled={stages.length === 1}
                  onClick={() => setStages((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ol>

      {removed.length ? (
        <p role="status" className="mt-3 text-[12px] text-amber-600 dark:text-amber-500">
          Designs in {removed.map((stage) => stage.name).join(", ")} will fall back to{" "}
          {stages[0]?.name || "the first stage"} when you save.
        </p>
      ) : (
        <p className="mt-3 text-[12px] text-muted-foreground">
          Deleting a stage moves its designs to the first stage. At least one stage stays.
        </p>
      )}

      {readOnly ? null : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={stages.length >= 12}
            onClick={() => {
              // A colon cannot appear in a real id, so the placeholder never collides with one.
              const id = `new:${Math.random().toString(36).slice(2)}`
              setStages((current) => [
                ...current,
                {
                  id,
                  name: "New stage",
                  color: stageColors[current.length % stageColors.length],
                  done: false,
                  fresh: true,
                },
              ])
            }}
          >
            <Plus /> Add stage
          </Button>
          <div className="ml-auto flex gap-2">
            {dirty ? (
              <Button variant="ghost" size="sm" onClick={() => setStages(settings.workflow)}>
                Reset
              </Button>
            ) : null}
            <Button size="sm" disabled={!dirty || unnamed || pending} onClick={save}>
              Save workflow
            </Button>
          </div>
        </div>
      )}
    </Section>
  )
}

export { WorkflowSettings }
