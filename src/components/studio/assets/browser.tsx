"use client"

/**
 * The files in one place, and what is selected among them. The library keys
 * this component by place and filter, so its state — the selection, the open
 * detail sheet, a half-answered dialog — starts over whenever "these files"
 * stops meaning the same files.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ConfirmModal, EmptyState, useAction } from "@/components/studio/kit"
import {
  AssetGrid,
  AssetList,
  FolderTiles,
  type SelectMode,
} from "@/components/studio/assets/asset-views"
import { BulkBar, MoveAssetsDialog, TagAssetsDialog } from "@/components/studio/assets/bulk-bar"
import { DetailPanel } from "@/components/studio/assets/detail-panel"
import {
  downloadAssets,
  placeHref,
  shortcutsBlocked,
  useWindowEvent,
  type LibraryAsset,
  type LibraryFolder,
  type LibraryPermissions,
  type LibraryState,
} from "@/components/studio/assets/shared"
import type { ActionResult } from "@/lib/studio/action"
import { purgeAssets, restoreAssets, tagAssets, trashAssets } from "@/lib/studio/actions/assets"
import { cn } from "@/lib/utils"

type BrowserDialog = "trash" | "purge" | "move" | "addTag" | "removeTag"

const files = (count: number) => `${count} file${count === 1 ? "" : "s"}`

export function AssetBrowser({
  orgSlug,
  assets,
  folders,
  tagSuggestions,
  state,
  filtered,
  permissions,
  footer,
  onNavigate,
  onClearFilters,
  onUpload,
  onMoveTo,
  onReplace,
}: {
  orgSlug: string
  assets: LibraryAsset[]
  folders: LibraryFolder[]
  tagSuggestions: string[]
  state: LibraryState
  filtered: boolean
  permissions: LibraryPermissions
  footer?: React.ReactNode
  onNavigate: () => void
  onClearFilters: () => void
  /** Absent when the viewer cannot upload here. */
  onUpload?: () => void
  onMoveTo: (assetIds: string[], folderId: string | null) => Promise<boolean>
  onReplace: (asset: LibraryAsset, file: File) => void
}) {
  const router = useRouter()
  const { pending, call } = useAction()
  const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(new Set())
  const [anchor, setAnchor] = React.useState<string | null>(null)
  // Below the widest layout the detail panel is a sheet, and only a plain click opens it.
  const [sheet, setSheet] = React.useState(false)
  const [dialog, setDialog] = React.useState<BrowserDialog | null>(null)

  // A refresh can take files away; what is selected is only ever what is still here.
  const selection = assets.filter((asset) => selectedIds.has(asset.id))
  const selected: ReadonlySet<string> = new Set(selection.map((asset) => asset.id))
  const ids = [...selected]
  const single = selection.length === 1 ? selection[0] : null
  const used = selection.filter((asset) => asset.uses > 0)
  const carriedTags = [...new Set(selection.flatMap((asset) => asset.tags))].sort()
  const childFolders = filtered || state.trash ? [] : folders.filter((folder) => folder.parentId === state.folderId)

  function clear() {
    setSelectedIds(new Set())
    setAnchor(null)
    setSheet(false)
  }

  function select(asset: LibraryAsset, mode: SelectMode) {
    if (mode === "range" && anchor) {
      const from = assets.findIndex((entry) => entry.id === anchor)
      const to = assets.findIndex((entry) => entry.id === asset.id)
      if (from >= 0 && to >= 0) {
        const range = assets.slice(Math.min(from, to), Math.max(from, to) + 1)
        setSelectedIds(new Set(range.map((entry) => entry.id)))
        setSheet(false)
        return
      }
    }
    if (mode === "only") {
      setSelectedIds(new Set([asset.id]))
      setSheet(true)
    } else {
      const next = new Set(selected)
      if (!next.delete(asset.id)) next.add(asset.id)
      setSelectedIds(next)
      setSheet(false)
    }
    setAnchor(asset.id)
  }

  function selectAll() {
    const all = assets.length > 0 && selection.length === assets.length
    setSelectedIds(all ? new Set() : new Set(assets.map((asset) => asset.id)))
    setSheet(false)
  }

  /** Run an action on the selection, then read the page again. */
  async function act<T>(
    work: () => Promise<ActionResult<T>>,
    options: { success?: string; keepSelection?: boolean } = {},
  ) {
    const result = await call(work, { success: options.success })
    setDialog(null)
    if (result === null) return null
    if (!options.keepSelection) clear()
    router.refresh()
    return result
  }

  useWindowEvent("keydown", (event) => {
    if (shortcutsBlocked(event.target)) return
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a" && assets.length) {
      event.preventDefault()
      setSelectedIds(new Set(assets.map((asset) => asset.id)))
      setSheet(false)
    } else if (event.key === "Escape" && selection.length) {
      clear()
    } else if ((event.key === "Delete" || event.key === "Backspace") && selection.length && permissions.remove) {
      event.preventDefault()
      setDialog(state.trash ? "purge" : "trash")
    }
  })

  const view = {
    assets,
    selected,
    onSelect: select,
    onSelectAll: selectAll,
    draggable: permissions.update && !state.trash,
    trash: state.trash,
  }

  const empty = state.trash ? (
    <EmptyState title="The trash is empty">
      Files moved to the trash wait here until someone restores them or deletes them for good.
    </EmptyState>
  ) : filtered ? (
    <EmptyState
      title="Nothing matches"
      action={
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          Clear filters
        </Button>
      }
    >
      No file in the library fits that search and those filters.
    </EmptyState>
  ) : childFolders.length ? (
    <p className="text-[13px] text-muted-foreground">
      No files here yet, only folders.{onUpload ? " Drop some in, or upload." : ""}
    </p>
  ) : (
    <EmptyState
      title={state.folderId ? "This folder is empty" : "No files yet"}
      action={
        onUpload ? (
          <Button size="sm" onClick={onUpload}>
            <Upload /> Upload files
          </Button>
        ) : undefined
      }
    >
      {onUpload
        ? state.folderId
          ? "Drop files anywhere on this page to put them here."
          : "Images, video, audio, fonts, documents — drop them anywhere on this page, or pick them."
        : "Nothing has been uploaded here yet."}
    </EmptyState>
  )

  return (
    <div className="flex items-start">
      <div className="min-w-0 flex-1 px-5 pb-10 pt-4 sm:px-8">
        <div className="space-y-4">
          <FolderTiles
            folders={childFolders}
            hrefFor={(folderId) => placeHref(orgSlug, state, { folderId })}
            onNavigate={onNavigate}
            onMoveAssets={permissions.update ? (moved, folderId) => void onMoveTo(moved, folderId) : undefined}
          />

          {assets.length ? (
            <>
              <div className="flex items-center justify-between gap-3 text-[12px] text-muted-foreground">
                <p aria-live="polite">
                  {assets.length >= 500 ? "First 500 files" : files(assets.length)}
                  {state.q ? ` matching “${state.q}”` : ""}
                  {filtered && !state.trash ? ", across every folder" : ""}
                </p>
                <button
                  type="button"
                  onClick={selectAll}
                  className="rounded-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {selection.length === assets.length ? "Clear selection" : "Select all"}
                </button>
              </div>
              {state.view === "list" ? <AssetList {...view} /> : <AssetGrid {...view} />}
            </>
          ) : (
            empty
          )}
        </div>

        {selection.length && !(sheet && single) ? (
          <BulkBar
            count={selection.length}
            trash={state.trash}
            permissions={permissions}
            pending={pending}
            canRemoveTag={carriedTags.length > 0}
            onClear={clear}
            onMove={() => setDialog("move")}
            onAddTag={() => setDialog("addTag")}
            onRemoveTag={() => setDialog("removeTag")}
            onTrash={() => setDialog("trash")}
            onDownload={() => downloadAssets(selection)}
            onRestore={() => void act(() => restoreAssets(orgSlug, ids), { success: `Restored ${files(ids.length)}.` })}
            onPurge={() => setDialog("purge")}
          />
        ) : null}

        {footer}
      </div>

      {single ? (
        <aside
          aria-label={`Details for ${single.name}`}
          // Pinned to the viewport so its last row — the trash button — is never below the
          // fold. On the widest layout the library makes room for it (`data-detail`, in
          // library.tsx); below that it is a sheet, and only a plain click opens it.
          data-detail
          className={cn(
            "overflow-y-auto border-border bg-panel xl:fixed xl:bottom-0 xl:right-0 xl:top-14 xl:z-30 xl:block xl:w-[22rem] xl:border-l xl:shadow-none",
            sheet
              ? "fixed inset-x-0 bottom-0 top-14 z-40 shadow-xl sm:left-auto sm:w-[24rem] sm:border-l"
              : "hidden",
          )}
        >
          <DetailPanel
            key={single.id}
            orgSlug={orgSlug}
            asset={single}
            folders={folders}
            tagSuggestions={tagSuggestions}
            permissions={permissions}
            onClose={clear}
            onChanged={() => router.refresh()}
            onReplace={(file) => onReplace(single, file)}
            onTrash={() => setDialog("trash")}
            onRestore={() => void act(() => restoreAssets(orgSlug, ids), { success: "Restored." })}
            onPurge={() => setDialog("purge")}
          />
        </aside>
      ) : null}

      <ConfirmModal
        open={dialog === "trash"}
        onClose={() => setDialog(null)}
        title={single ? `Move “${single.name}” to the trash?` : `Move ${files(ids.length)} to the trash?`}
        confirmLabel="Move to trash"
        pending={pending}
        onConfirm={() => void act(() => trashAssets(orgSlug, ids), { success: `Moved ${files(ids.length)} to the trash.` })}
      >
        <p>It can be restored from the trash until someone deletes it for good.</p>
        {used.length ? (
          <p role="alert" className="mt-2 border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-destructive">
            {used.length === 1 && single
              ? `This file is used in ${single.uses} design${single.uses === 1 ? "" : "s"}.`
              : `${used.length} of these files are used in designs.`}{" "}
            Those designs keep the reference, but should not rely on a file that is on its way out.
          </p>
        ) : null}
      </ConfirmModal>

      <ConfirmModal
        open={dialog === "purge"}
        onClose={() => setDialog(null)}
        title={`Delete ${single ? `“${single.name}”` : files(ids.length)} for good?`}
        confirmLabel="Delete permanently"
        pending={pending}
        onConfirm={async () => {
          const result = await act(() => purgeAssets(orgSlug, ids))
          if (result) toast.success(`${files(result.count)} deleted for good.`)
        }}
      >
        <p>The bytes are destroyed and every design that referenced them loses the reference. This cannot be undone.</p>
      </ConfirmModal>

      {dialog === "move" ? (
        <MoveAssetsDialog
          folders={folders}
          count={ids.length}
          initial={selection[0]?.folderId ?? null}
          pending={pending}
          onClose={() => setDialog(null)}
          onSubmit={async (folderId) => {
            const moved = await onMoveTo(ids, folderId)
            setDialog(null)
            if (moved) clear()
          }}
        />
      ) : null}

      {dialog === "addTag" || dialog === "removeTag" ? (
        <TagAssetsDialog
          mode={dialog === "addTag" ? "add" : "remove"}
          count={ids.length}
          tags={dialog === "addTag" ? tagSuggestions : carriedTags}
          pending={pending}
          onClose={() => setDialog(null)}
          onSubmit={(tags) =>
            void act(
              () => tagAssets(orgSlug, ids, dialog === "addTag" ? { add: tags } : { remove: tags }),
              { success: dialog === "addTag" ? "Tagged." : "Tags removed.", keepSelection: true },
            )
          }
        />
      ) : null}
    </div>
  )
}
