"use client"

/**
 * Brand palettes. The six roles are literally the machines' colour props, so a
 * palette is a partial pose and the preview is no mock-up: it is the real
 * machine, handed the colours as they are typed.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ColorField } from "@/components/studio/admin/color-field"
import {
  ConfirmModal,
  EmptyState,
  Field,
  Modal,
  PageBody,
  PageHeader,
  eyebrow,
  fieldClass,
  useAction,
} from "@/components/studio/kit"
import { MachineView } from "@/components/studio/machine-view"
import { deletePalette, savePalette } from "@/lib/studio/actions/workspace"
import { can } from "@/lib/studio/permissions"
import { paletteRoles, type PaletteRole } from "@/lib/studio/pose"
import { cn } from "@/lib/utils"

export interface PaletteRow {
  id: string
  name: string
  colors: Record<string, string>
}

type Colors = Partial<Record<PaletteRole, string>>

const roleInfo: Record<PaletteRole, { label: string; hint: string; start: string }> = {
  color: { label: "Shell", hint: "The body panels.", start: "#f38b4a" },
  accent: { label: "Accent", hint: "Joints, lights and details.", start: "#2dd4bf" },
  metal: { label: "Metal", hint: "Shafts, rails and bare parts.", start: "#aab1bd" },
  dark: { label: "Dark", hint: "Housings and shadowed parts.", start: "#353b47" },
  glow: { label: "Glow", hint: "Follows the accent unless set.", start: "#2dd4bf" },
  grid: { label: "Grid", hint: "The floor and guide lines.", start: "#98a0ad" },
}

/** Well-known machines that between them wear every role. */
const previewMachines = [
  { id: "robot-arm", name: "Robot arm" },
  { id: "robot-face", name: "Robot face" },
  { id: "robot-quadruped", name: "Quadruped" },
  { id: "scara-arm", name: "SCARA arm" },
  { id: "delta-arm", name: "Delta arm" },
]

/** Only the six roles, only real values: what a stored palette is trusted for. */
const rolesOf = (colors: Record<string, string>): Colors =>
  Object.fromEntries(paletteRoles.filter((role) => colors[role]).map((role) => [role, colors[role]]))

function Swatches({ colors, className }: { colors: Colors; className?: string }) {
  return (
    <ul className={cn("flex", className)} aria-label="Colours">
      {paletteRoles.map((role) => (
        <li
          key={role}
          title={`${roleInfo[role].label}: ${colors[role] ?? "machine default"}`}
          className="h-5 flex-1 border-y border-r border-border first:border-l"
          style={
            colors[role]
              ? { background: colors[role] }
              : {
                  // Unset: hatched, so "not part of this palette" does not read as a colour.
                  backgroundImage:
                    "repeating-linear-gradient(135deg, transparent 0 3px, var(--border) 3px 4px)",
                }
          }
        >
          <span className="sr-only">
            {roleInfo[role].label}: {colors[role] ?? "not set"}
          </span>
        </li>
      ))}
    </ul>
  )
}

function PaletteModal({
  orgSlug,
  palette,
  onClose,
  onSaved,
}: {
  orgSlug: string
  /** `null` makes a new one. */
  palette: PaletteRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const { pending, call } = useAction()
  const [name, setName] = React.useState(palette?.name ?? "")
  const [colors, setColors] = React.useState<Colors>(
    palette ? rolesOf(palette.colors) : { color: roleInfo.color.start, accent: roleInfo.accent.start },
  )
  // What an unticked role comes back as, so ticking it again does not lose the colour.
  const [remembered, setRemembered] = React.useState<Colors>({})
  const [machine, setMachine] = React.useState(previewMachines[0].id)
  const count = Object.keys(colors).length

  const toggle = (role: PaletteRole, on: boolean) => {
    if (on) {
      setColors({ ...colors, [role]: remembered[role] ?? roleInfo[role].start })
      return
    }
    const { [role]: dropped, ...rest } = colors
    setRemembered({ ...remembered, [role]: dropped })
    setColors(rest)
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      eyebrow="Palette"
      title={palette ? `Edit ${palette.name}` : "New palette"}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="palette-form" size="sm" disabled={pending || count === 0 || !name.trim()}>
            {palette ? "Save palette" : "Create palette"}
          </Button>
        </>
      }
    >
      <form
        id="palette-form"
        className="grid gap-5 sm:grid-cols-[1fr_15rem]"
        onSubmit={async (event) => {
          event.preventDefault()
          const saved = await call(() => savePalette(orgSlug, palette?.id ?? null, { name, colors }), {
            success: palette ? "Palette saved." : "Palette created.",
          })
          if (saved) onSaved()
        }}
      >
        <div className="space-y-4">
          <Field label="Name" htmlFor="palette-name">
            <input
              id="palette-name"
              required
              maxLength={40}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Brand, dark"
              className={fieldClass}
            />
          </Field>
          <fieldset>
            <legend className="text-[12px] font-medium">Colours</legend>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Tick the roles this palette sets. The rest stay as the design has them.
            </p>
            <ul className="mt-2 divide-y divide-border border border-border">
              {paletteRoles.map((role) => {
                const on = colors[role] !== undefined
                return (
                  <li key={role} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-background px-2.5 py-2">
                    <label className="flex min-w-0 flex-1 basis-32 items-start gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(event) => toggle(role, event.target.checked)}
                        className="mt-0.5 size-3.5 accent-foreground"
                      />
                      <span className="min-w-0">
                        <span className="font-medium">{roleInfo[role].label}</span>{" "}
                        <code className="font-mono text-[10px] text-muted-foreground">{role}</code>
                        <span className="block text-[11px] text-muted-foreground">{roleInfo[role].hint}</span>
                      </span>
                    </label>
                    <ColorField
                      label={roleInfo[role].label}
                      value={colors[role] ?? remembered[role] ?? roleInfo[role].start}
                      disabled={!on}
                      onChange={(value) => setColors({ ...colors, [role]: value })}
                    />
                  </li>
                )
              })}
            </ul>
            {count === 0 ? (
              <p role="alert" className="mt-1.5 text-[12px] text-destructive">
                Set at least one colour.
              </p>
            ) : null}
          </fieldset>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className={eyebrow}>Preview</p>
            <select
              aria-label="Preview machine"
              value={machine}
              onChange={(event) => setMachine(event.target.value)}
              className={cn(fieldClass, "h-7 w-36 text-[12px]")}
            >
              {previewMachines.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex aspect-square items-center justify-center overflow-hidden border border-border bg-background">
            <MachineView componentId={machine} pose={{ ...colors }} size="sm" />
          </div>
          <Swatches colors={colors} />
        </div>
      </form>
    </Modal>
  )
}

function PalettesAdmin({
  org,
  role,
  palettes,
  defaultPaletteId,
}: {
  org: { name: string; slug: string }
  role: string
  palettes: PaletteRow[]
  defaultPaletteId: string | null
}) {
  const router = useRouter()
  const { pending, call } = useAction()
  // `undefined` closed, `null` new, a row to edit it.
  const [editing, setEditing] = React.useState<PaletteRow | null | undefined>(undefined)
  const [deleting, setDeleting] = React.useState<PaletteRow | null>(null)
  const create = can(role, "palette:create")

  const newButton = create ? (
    <Button size="sm" onClick={() => setEditing(null)}>
      <Plus /> New palette
    </Button>
  ) : null

  return (
    <>
      <PageHeader
        eyebrow={org.name}
        title="Palettes"
        description="Named sets of colours, applied to any design in one click. A palette sets only the roles it names."
      >
        {newButton}
      </PageHeader>

      <PageBody>
        {palettes.length === 0 ? (
          <EmptyState title="No palettes yet" action={newButton}>
            Put the brand&apos;s colours in once and every machine can wear them.
          </EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {palettes.map((palette) => {
              const colors = rolesOf(palette.colors)
              return (
                <li key={palette.id} className="flex flex-col border border-border bg-panel">
                  <div className="flex aspect-[4/3] items-center justify-center overflow-hidden border-b border-border bg-background">
                    <MachineView componentId="robot-arm" pose={{ ...colors }} size="sm" still />
                  </div>
                  <Swatches colors={colors} className="px-3 pt-3" />
                  <div className="flex items-center gap-1 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{palette.name}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                        {Object.keys(colors).length} of {paletteRoles.length} roles
                        {palette.id === defaultPaletteId ? " · default" : ""}
                      </p>
                    </div>
                    {can(role, "palette:update") ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${palette.name}`}
                        onClick={() => setEditing(palette)}
                      >
                        <Pencil />
                      </Button>
                    ) : null}
                    {can(role, "palette:delete") ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${palette.name}`}
                        onClick={() => setDeleting(palette)}
                      >
                        <Trash2 />
                      </Button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </PageBody>

      {editing !== undefined ? (
        <PaletteModal
          key={editing?.id ?? "new"}
          orgSlug={org.slug}
          palette={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined)
            router.refresh()
          }}
        />
      ) : null}

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? "palette"}?`}
        pending={pending}
        onConfirm={async () => {
          if (!deleting) return
          await call(() => deletePalette(org.slug, deleting.id), { success: "Palette deleted." })
          setDeleting(null)
          router.refresh()
        }}
      >
        Designs that already wear it keep their colours: applying a palette copies it.
        {deleting?.id === defaultPaletteId ? " New designs will stop starting with it." : ""}
      </ConfirmModal>
    </>
  )
}

export { PalettesAdmin }
