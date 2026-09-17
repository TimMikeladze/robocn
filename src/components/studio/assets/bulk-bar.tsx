"use client"

/**
 * What can be done to a selection, and the two dialogs that need an answer
 * first: where to, and which tags. The bar only asks; the browser above it
 * owns the selection and runs the actions.
 */

import * as React from "react"
import { Download, FolderInput, RotateCcw, Tag, Tags, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, Modal } from "@/components/studio/kit"
import { TagEditor } from "@/components/studio/assets/detail-panel"
import {
  FolderSelect,
  type LibraryFolder,
  type LibraryPermissions,
} from "@/components/studio/assets/shared"
import { cn } from "@/lib/utils"

export function BulkBar({
  count,
  trash,
  permissions,
  pending,
  canRemoveTag,
  onClear,
  onMove,
  onAddTag,
  onRemoveTag,
  onTrash,
  onDownload,
  onRestore,
  onPurge,
}: {
  count: number
  trash: boolean
  permissions: LibraryPermissions
  pending: boolean
  /** Whether anything selected carries a tag to take off. */
  canRemoveTag: boolean
  onClear: () => void
  onMove: () => void
  onAddTag: () => void
  onRemoveTag: () => void
  onTrash: () => void
  onDownload: () => void
  onRestore: () => void
  onPurge: () => void
}) {
  // Labels fold away on narrow screens; the icon and its aria-label carry on.
  const label = "hidden sm:inline"
  return (
    <div
      role="toolbar"
      aria-label={`Actions for ${count} selected file${count === 1 ? "" : "s"}`}
      className="sticky bottom-4 z-30 mx-auto mt-4 flex w-fit max-w-full flex-wrap items-center gap-1 border border-border bg-panel p-1.5 shadow-xl"
    >
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className="rounded-sm p-1.5 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-3.5" />
      </button>
      <p className="px-1.5 text-[12px] font-medium tabular-nums" aria-live="polite">
        {count} selected
      </p>
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      {trash ? (
        permissions.remove ? (
          <>
            <Button variant="ghost" size="sm" disabled={pending} onClick={onRestore} aria-label="Restore">
              <RotateCcw /> <span className={label}>Restore</span>
            </Button>
            <Button variant="destructive" size="sm" disabled={pending} onClick={onPurge} aria-label="Delete permanently">
              <Trash2 /> <span className={label}>Delete permanently</span>
            </Button>
          </>
        ) : null
      ) : (
        <>
          {permissions.update ? (
            <>
              <Button variant="ghost" size="sm" disabled={pending} onClick={onMove} aria-label="Move to folder">
                <FolderInput /> <span className={label}>Move</span>
              </Button>
              <Button variant="ghost" size="sm" disabled={pending} onClick={onAddTag} aria-label="Add tag">
                <Tag /> <span className={label}>Add tag</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending || !canRemoveTag}
                onClick={onRemoveTag}
                aria-label="Remove tag"
              >
                <Tags /> <span className={label}>Remove tag</span>
              </Button>
            </>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onDownload} aria-label="Download">
            <Download /> <span className={label}>Download</span>
          </Button>
          {permissions.remove ? (
            <Button variant="ghost" size="sm" disabled={pending} onClick={onTrash} aria-label="Move to trash">
              <Trash2 /> <span className={label}>Trash</span>
            </Button>
          ) : null}
        </>
      )}
    </div>
  )
}

const files = (count: number) => `${count} file${count === 1 ? "" : "s"}`

/** Mounted only while open, so it always starts at the folder the files are in. */
export function MoveAssetsDialog({
  folders,
  count,
  initial,
  pending,
  onClose,
  onSubmit,
}: {
  folders: LibraryFolder[]
  count: number
  initial: string | null
  pending: boolean
  onClose: () => void
  onSubmit: (folderId: string | null) => void
}) {
  const [folderId, setFolderId] = React.useState(initial)
  return (
    <Modal
      open
      onClose={onClose}
      title={`Move ${files(count)}`}
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={pending} onClick={() => onSubmit(folderId)}>
            Move here
          </Button>
        </>
      }
    >
      <Field
        label="Into"
        htmlFor="asset-move-target"
        hint={folders.length ? "Files can also be dragged onto a folder." : "There are no folders yet, so everything lives in All files."}
      >
        <FolderSelect id="asset-move-target" folders={folders} value={folderId} onChange={setFolderId} />
      </Field>
    </Modal>
  )
}

export function TagAssetsDialog({
  mode,
  count,
  tags,
  pending,
  onClose,
  onSubmit,
}: {
  mode: "add" | "remove"
  count: number
  /** Adding: every tag in the library, as suggestions. Removing: the tags the selection carries. */
  tags: string[]
  pending: boolean
  onClose: () => void
  onSubmit: (tags: string[]) => void
}) {
  const [chosen, setChosen] = React.useState<string[]>([])
  const toggle = (tag: string) =>
    setChosen((current) => (current.includes(tag) ? current.filter((entry) => entry !== tag) : [...current, tag]))
  const chip = (on: boolean) =>
    cn(
      "inline-flex h-6 items-center rounded-full border px-2.5 font-mono text-[10px] uppercase tracking-[0.08em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
      on ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground/40",
    )
  const unused = tags.filter((tag) => !chosen.includes(tag)).slice(0, 16)

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "add" ? `Tag ${files(count)}` : `Remove tags from ${files(count)}`}
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={pending || !chosen.length} onClick={() => onSubmit(chosen)}>
            {mode === "add" ? "Add" : "Remove"} {chosen.length || ""} tag{chosen.length === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      {mode === "add" ? (
        <div className="space-y-3">
          <Field label="Tags" hint="Enter or a comma adds one. Tags the files already carry are left alone.">
            <TagEditor tags={chosen} suggestions={tags} onChange={setChosen} />
          </Field>
          {unused.length ? (
            <div className="flex flex-wrap gap-1.5" aria-label="Tags already in the library">
              {unused.map((tag) => (
                <button key={tag} type="button" onClick={() => toggle(tag)} className={chip(false)}>
                  + {tag}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tags on the selected files">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              aria-pressed={chosen.includes(tag)}
              onClick={() => toggle(tag)}
              className={chip(chosen.includes(tag))}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}
