"use client"

/** Labels: coloured tags on designs. Each row saves on its own, because each is its own row in the database. */

import * as React from "react"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ColorField } from "@/components/studio/admin/color-field"
import { ConfirmModal, Pill, Section, fieldClass, useAction } from "@/components/studio/kit"
import { deleteLabel, saveLabel } from "@/lib/studio/actions/workspace"

export interface LabelRow {
  id: string
  name: string
  color: string
}

function LabelEditor({
  orgSlug,
  label,
  readOnly,
  onChanged,
  onDelete,
}: {
  orgSlug: string
  /** `null` is the row that makes a new one. */
  label: LabelRow | null
  readOnly: boolean
  onChanged: () => void
  onDelete?: () => void
}) {
  const { pending, call } = useAction()
  const [name, setName] = React.useState(label?.name ?? "")
  const [color, setColor] = React.useState(label?.color ?? "#64748b")
  const dirty = label ? name !== label.name || color !== label.color : name.trim() !== ""

  return (
    <form
      className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5"
      onSubmit={async (event) => {
        event.preventDefault()
        const saved = await call(() => saveLabel(orgSlug, label?.id ?? null, { name, color }), {
          success: label ? "Label saved." : "Label created.",
        })
        if (!saved) return
        if (!label) setName("")
        onChanged()
      }}
    >
      <input
        aria-label={label ? `Name of label ${label.name}` : "New label name"}
        value={name}
        maxLength={24}
        required
        disabled={readOnly}
        placeholder={label ? undefined : "New label"}
        onChange={(event) => setName(event.target.value)}
        className={`${fieldClass} min-w-0 flex-1 basis-36`}
      />
      <ColorField label={name || "Label"} value={color} disabled={readOnly} onChange={setColor} />
      <span className="hidden w-28 sm:block">{name.trim() ? <Pill color={color}>{name}</Pill> : null}</span>
      {readOnly ? null : (
        <div className="ml-auto flex items-center gap-1">
          <Button type="submit" variant={label ? "outline" : "default"} size="sm" disabled={!dirty || pending}>
            {label ? "Save" : <><Plus /> Add</>}
          </Button>
          {label ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete label ${label.name}`}
              onClick={onDelete}
            >
              <Trash2 />
            </Button>
          ) : null}
        </div>
      )}
    </form>
  )
}

function LabelSettings({
  orgSlug,
  labels,
  readOnly,
  onChanged,
}: {
  orgSlug: string
  labels: LabelRow[]
  readOnly: boolean
  onChanged: () => void
}) {
  const { pending, call } = useAction()
  const [deleting, setDeleting] = React.useState<LabelRow | null>(null)

  return (
    <Section title="Labels" description="Tags for designs: a client, a product line, a sprint. Filter by them on the designs page.">
      <div className="-m-4 divide-y divide-border">
        {labels.length === 0 && readOnly ? (
          <p className="px-4 py-3 text-[13px] text-muted-foreground">No labels yet.</p>
        ) : null}
        {labels.map((label) => (
          <LabelEditor
            // Keyed on the saved values so a refresh resets the draft to them.
            key={`${label.id}:${label.name}:${label.color}`}
            orgSlug={orgSlug}
            label={label}
            readOnly={readOnly}
            onChanged={onChanged}
            onDelete={() => setDeleting(label)}
          />
        ))}
        {readOnly ? null : <LabelEditor orgSlug={orgSlug} label={null} readOnly={false} onChanged={onChanged} />}
      </div>

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete label ${deleting?.name ?? ""}?`}
        pending={pending}
        onConfirm={async () => {
          if (!deleting) return
          const done = await call(() => deleteLabel(orgSlug, deleting.id), { success: "Label deleted." })
          setDeleting(null)
          if (done !== null) onChanged()
        }}
      >
        It comes off every design that wears it. The designs themselves are not touched.
      </ConfirmModal>
    </Section>
  )
}

export { LabelSettings }
