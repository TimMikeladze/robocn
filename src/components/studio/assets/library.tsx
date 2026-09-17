"use client"

/**
 * The asset library's shell. It owns the three things that outlive any one
 * view of the files: the URL (every filter, the folder, the view — so a link
 * to the library is a link to *this* library), the uploads in flight, and the
 * folder dialogs. What is selected belongs to `AssetBrowser`, which is keyed
 * by place and filter so a selection never follows you somewhere it makes no
 * sense.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { FolderPlus, LayoutGrid, List, Search, Trash2, Upload, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ConfirmModal, PageHeader, fieldClass, useAction } from "@/components/studio/kit"
import { AssetBrowser } from "@/components/studio/assets/browser"
import {
  Breadcrumbs,
  FolderDialogs,
  FolderMenu,
  FolderRail,
  PlaceSelect,
  StorageMeter,
  type FolderDialog,
} from "@/components/studio/assets/folder-tree"
import {
  kindLabels,
  libraryHref,
  placeHref,
  shortcutsBlocked,
  sorts,
  useWindowEvent,
  type LibraryAsset,
  type LibraryFolder,
  type LibraryPermissions,
  type LibrarySort,
  type LibraryState,
} from "@/components/studio/assets/shared"
import { DropOverlay, UploadTray, useFilePicker, useUploads } from "@/components/studio/assets/upload"
import { moveAssets, purgeAssets } from "@/lib/studio/actions/assets"
import { assetKinds, formatBytes, MAX_ASSET_BYTES } from "@/lib/studio/asset-kinds"
import { cn } from "@/lib/utils"

export interface AssetLibraryProps {
  orgSlug: string
  assets: LibraryAsset[]
  folders: LibraryFolder[]
  tags: { tag: string; uses: number }[]
  storage: { bytes: number; files: number }
  trashCount: number
  state: LibraryState
  permissions: LibraryPermissions
}

const sortLabels: Record<LibrarySort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  name: "Name",
  largest: "Largest first",
}

const hasFiles = (event: React.DragEvent) => event.dataTransfer.types.includes("Files")

export function AssetLibrary({
  orgSlug,
  assets,
  folders,
  tags,
  storage,
  trashCount,
  state,
  permissions,
}: AssetLibraryProps) {
  const router = useRouter()
  const { pending, call } = useAction()
  const uploads = useUploads(orgSlug, () => router.refresh())
  const [text, setText] = React.useState(state.q)
  const [folderDialog, setFolderDialog] = React.useState<FolderDialog | null>(null)
  const [emptying, setEmptying] = React.useState(false)
  const [dragging, setDragging] = React.useState(false)
  const dragDepth = React.useRef(0)
  const searchTimer = React.useRef<number | undefined>(undefined)
  const searchRef = React.useRef<HTMLInputElement>(null)

  const canUpload = permissions.create && !state.trash
  const currentFolder = folders.find((folder) => folder.id === state.folderId) ?? null
  const filtered = !!(state.q || state.kind || state.tag)
  const picker = useFilePicker((files) => void uploads.enqueue(files, { folderId: state.folderId }), {
    multiple: true,
  })

  /** Every change of view goes through the URL. A pending search is folded in rather than lost. */
  function go(patch: Partial<LibraryState>) {
    window.clearTimeout(searchTimer.current)
    router.replace(libraryHref(orgSlug, { ...state, q: text, ...patch }), { scroll: false })
  }

  function onSearch(value: string) {
    setText(value)
    window.clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(
      () => router.replace(libraryHref(orgSlug, { ...state, q: value }), { scroll: false }),
      300,
    )
  }

  /** A folder link was followed: the filters are gone from the URL, so the box empties too. */
  function onNavigate() {
    window.clearTimeout(searchTimer.current)
    setText("")
  }

  function clearFilters() {
    setText("")
    go({ q: "", kind: null, tag: null })
  }

  async function moveTo(assetIds: string[], folderId: string | null) {
    if (!assetIds.length) return false
    const name = folders.find((folder) => folder.id === folderId)?.name ?? "All files"
    const result = await call(() => moveAssets(orgSlug, assetIds, folderId), {
      success: `Moved ${assetIds.length} file${assetIds.length === 1 ? "" : "s"} to ${name}.`,
    })
    if (result === null) return false
    router.refresh()
    return true
  }

  useWindowEvent("keydown", (event) => {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return
    if (shortcutsBlocked(event.target)) return
    event.preventDefault()
    searchRef.current?.focus()
    searchRef.current?.select()
  })

  const dropHandlers = {
    onDragEnter: (event: React.DragEvent) => {
      if (!hasFiles(event)) return
      dragDepth.current++
      if (canUpload) setDragging(true)
    },
    onDragOver: (event: React.DragEvent) => {
      // Always claimed: a file that is not caught makes the browser navigate to it.
      if (hasFiles(event)) event.preventDefault()
    },
    onDragLeave: (event: React.DragEvent) => {
      if (!hasFiles(event)) return
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setDragging(false)
    },
    onDrop: (event: React.DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      if (canUpload) void uploads.enqueue([...event.dataTransfer.files], { folderId: state.folderId })
      else toast.error(state.trash ? "Leave the trash to upload." : "Your role does not allow uploads.")
    },
  }

  const chip = (on: boolean) =>
    cn(
      "inline-flex h-7 shrink-0 items-center rounded-full border px-3 text-[12px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
      on
        ? "border-foreground bg-foreground text-background"
        : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
    )
  const viewButton = (on: boolean) =>
    cn(
      "flex size-8 items-center justify-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      on ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
    )

  const toolbar = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Breadcrumbs orgSlug={orgSlug} folders={folders} state={state} onNavigate={onNavigate}>
          {currentFolder && !state.trash ? (
            <FolderMenu folder={currentFolder} permissions={permissions} onAction={setFolderDialog} />
          ) : null}
        </Breadcrumbs>
      </div>

      <PlaceSelect
        folders={folders}
        state={state}
        trashCount={trashCount}
        onChange={(place) => {
          onNavigate()
          router.push(placeHref(orgSlug, state, place))
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            type="search"
            value={text}
            onChange={(event) => onSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && text) {
                event.stopPropagation()
                setText("")
                go({ q: "" })
              }
            }}
            aria-label="Search files"
            aria-keyshortcuts="/"
            placeholder={state.trash ? "Search the trash" : "Search names, descriptions and tags"}
            className={cn(fieldClass, "pl-8 pr-8 [&::-webkit-search-cancel-button]:hidden")}
          />
          {text ? (
            <button
              type="button"
              onClick={() => {
                setText("")
                go({ q: "" })
                searchRef.current?.focus()
              }}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <kbd aria-hidden className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-sm border border-border px-1 font-mono text-[10px] text-muted-foreground sm:block">
              /
            </kbd>
          )}
        </div>

        {tags.length || state.tag ? (
          <select
            aria-label="Filter by tag"
            value={state.tag ?? ""}
            onChange={(event) => go({ tag: event.target.value || null })}
            className={cn(fieldClass, "w-auto max-w-[10rem]")}
          >
            <option value="">Any tag</option>
            {state.tag && !tags.some((entry) => entry.tag === state.tag) ? (
              <option value={state.tag}>#{state.tag}</option>
            ) : null}
            {tags.map((entry) => (
              <option key={entry.tag} value={entry.tag}>
                #{entry.tag} ({entry.uses})
              </option>
            ))}
          </select>
        ) : null}

        <select
          aria-label="Sort"
          value={state.sort}
          onChange={(event) => go({ sort: event.target.value as LibrarySort })}
          className={cn(fieldClass, "w-auto")}
        >
          {sorts.map((sort) => (
            <option key={sort} value={sort}>
              {sortLabels[sort]}
            </option>
          ))}
        </select>

        <div role="group" aria-label="View" className="flex overflow-hidden rounded-md border border-input">
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={state.view === "grid"}
            onClick={() => go({ view: "grid" })}
            className={viewButton(state.view === "grid")}
          >
            <LayoutGrid className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={state.view === "list"}
            onClick={() => go({ view: "list" })}
            className={cn(viewButton(state.view === "list"), "border-l border-input")}
          >
            <List className="size-3.5" />
          </button>
        </div>
      </div>

      <div role="group" aria-label="Filter by kind" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
        <button type="button" aria-pressed={!state.kind} onClick={() => go({ kind: null })} className={chip(!state.kind)}>
          All kinds
        </button>
        {assetKinds.map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={state.kind === kind}
            onClick={() => go({ kind: state.kind === kind ? null : kind })}
            className={chip(state.kind === kind)}
          >
            {kindLabels[kind]}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="flex" {...dropHandlers}>
      <FolderRail
        orgSlug={orgSlug}
        folders={folders}
        state={state}
        trashCount={trashCount}
        storage={storage}
        permissions={permissions}
        onAction={setFolderDialog}
        onNavigate={onNavigate}
        onMoveAssets={permissions.update ? (ids, folderId) => void moveTo(ids, folderId) : undefined}
      />

      <div className="min-w-0 flex-1 xl:has-[[data-detail]]:pr-[22rem]">
        <PageHeader
          eyebrow="Library"
          title={state.trash ? "Trash" : "Assets"}
          description={
            state.trash
              ? "Trashed files keep their place in any design that uses them until they are deleted for good."
              : `Every file that goes with your machines. Up to ${formatBytes(MAX_ASSET_BYTES)} each.`
          }
        >
          {state.trash ? (
            permissions.remove && trashCount ? (
              <Button variant="destructive" size="sm" onClick={() => setEmptying(true)}>
                <Trash2 /> Empty trash
              </Button>
            ) : null
          ) : (
            <>
              {permissions.create ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFolderDialog({ type: "create", parentId: state.folderId })}
                >
                  <FolderPlus /> New folder
                </Button>
              ) : null}
              {canUpload ? (
                <Button size="sm" onClick={picker.open}>
                  <Upload /> Upload
                </Button>
              ) : null}
            </>
          )}
          {picker.input}
        </PageHeader>

        {/* Outside the keyed browser, so typing a search never remounts the box being typed in. */}
        <div className="px-5 pt-5 sm:px-8">{toolbar}</div>

        <AssetBrowser
          key={[state.trash, state.folderId, state.q, state.kind, state.tag].join("|")}
          orgSlug={orgSlug}
          assets={assets}
          folders={folders}
          tagSuggestions={tags.map((entry) => entry.tag)}
          state={state}
          filtered={filtered}
          permissions={permissions}
          footer={<StorageMeter storage={storage} className="mt-8 border-t border-border pt-4 lg:hidden" />}
          onNavigate={onNavigate}
          onClearFilters={clearFilters}
          onUpload={canUpload ? picker.open : undefined}
          onMoveTo={moveTo}
          onReplace={(asset, file) => void uploads.enqueue([file], { replace: asset.id })}
        />
      </div>

      <FolderDialogs
        orgSlug={orgSlug}
        folders={folders}
        dialog={folderDialog}
        onClose={() => setFolderDialog(null)}
        onDone={({ deleted, parentId }) => {
          setFolderDialog(null)
          // Standing in a folder that just went: step out to where it was.
          if (deleted && state.folderId && deleted.has(state.folderId)) {
            router.replace(placeHref(orgSlug, state, { folderId: parentId ?? null }))
          } else {
            router.refresh()
          }
        }}
      />

      <ConfirmModal
        open={emptying}
        onClose={() => setEmptying(false)}
        title="Empty the trash?"
        confirmLabel="Delete everything"
        pending={pending}
        onConfirm={async () => {
          const result = await call(() => purgeAssets(orgSlug, "all"))
          setEmptying(false)
          if (!result) return
          toast.success(`${result.count} file${result.count === 1 ? "" : "s"} deleted for good.`)
          router.refresh()
        }}
      >
        <p>
          {trashCount >= 500
            ? "Every file in the trash is"
            : trashCount === 1
              ? "The one file in the trash is"
              : `All ${trashCount} files in the trash are`}{" "}
          deleted for good, bytes and all. Any design that referenced one loses the reference. This cannot be
          undone.
        </p>
      </ConfirmModal>

      <UploadTray uploads={uploads} />
      {dragging ? (
        <DropOverlay label={currentFolder ? `Into ${currentFolder.name}` : "Into All files"} />
      ) : null}
    </div>
  )
}
