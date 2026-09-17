"use client"

/**
 * Where a file lives: the folder rail, its collapsed form for narrow screens,
 * the breadcrumb trail, and the four things that can happen to a folder.
 * Folders are links, not buttons — a place in the library is a URL.
 */

import * as React from "react"
import Link from "next/link"
import {
  ChevronRight,
  Ellipsis,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Images,
  Pencil,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConfirmModal, Field, Modal, eyebrow, fieldClass, useAction } from "@/components/studio/kit"
import {
  ASSET_DRAG_TYPE,
  FolderSelect,
  descendantIds,
  flattenTree,
  folderPath,
  folderTree,
  placeHref,
  type FolderNode,
  type LibraryFolder,
  type LibraryPermissions,
  type LibraryState,
} from "@/components/studio/assets/shared"
import { createFolder, deleteFolder, moveFolder, renameFolder } from "@/lib/studio/actions/assets"
import { formatBytes } from "@/lib/studio/asset-kinds"
import { cn } from "@/lib/utils"

export type FolderDialog =
  | { type: "create"; parentId: string | null }
  | { type: "rename" | "move" | "delete"; folder: LibraryFolder }

const row =
  "group/row flex h-7 items-center gap-1.5 rounded-md pr-1 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground has-[a[aria-current=page]]:bg-accent has-[a[aria-current=page]]:font-medium has-[a[aria-current=page]]:text-foreground data-[drop=true]:bg-accent data-[drop=true]:text-foreground data-[drop=true]:ring-1 data-[drop=true]:ring-ring"

const rowLink =
  "flex h-full min-w-0 flex-1 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"

/** A row files can be dropped on to move them there. */
export function useAssetDrop(onDropAssets: ((assetIds: string[]) => void) | undefined) {
  const [over, setOver] = React.useState(false)
  if (!onDropAssets) return { "data-drop": false }
  return {
    "data-drop": over,
    onDragOver: (event: React.DragEvent) => {
      if (!event.dataTransfer.types.includes(ASSET_DRAG_TYPE)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = "move"
      setOver(true)
    },
    onDragLeave: () => setOver(false),
    onDrop: (event: React.DragEvent) => {
      setOver(false)
      const raw = event.dataTransfer.getData(ASSET_DRAG_TYPE)
      if (!raw) return
      event.preventDefault()
      event.stopPropagation()
      try {
        const ids: unknown = JSON.parse(raw)
        if (Array.isArray(ids)) onDropAssets(ids.filter((id): id is string => typeof id === "string"))
      } catch {
        // Not ours after all.
      }
    },
  }
}

export function FolderMenu({
  folder,
  permissions,
  onAction,
  className,
}: {
  folder: LibraryFolder
  permissions: LibraryPermissions
  onAction: (dialog: FolderDialog) => void
  className?: string
}) {
  if (!permissions.create && !permissions.update && !permissions.remove) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for folder ${folder.name}`}
        className={cn(
          "shrink-0 rounded-sm p-1 text-muted-foreground outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <Ellipsis className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {permissions.create ? (
          <DropdownMenuItem onClick={() => onAction({ type: "create", parentId: folder.id })}>
            <FolderPlus /> New subfolder
          </DropdownMenuItem>
        ) : null}
        {permissions.update ? (
          <>
            <DropdownMenuItem onClick={() => onAction({ type: "rename", folder })}>
              <Pencil /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction({ type: "move", folder })}>
              <FolderInput /> Move
            </DropdownMenuItem>
          </>
        ) : null}
        {permissions.remove ? (
          <>
            {permissions.create || permissions.update ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem variant="destructive" onClick={() => onAction({ type: "delete", folder })}>
              <Trash2 /> Delete folder
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface RailProps {
  orgSlug: string
  folders: LibraryFolder[]
  state: LibraryState
  trashCount: number
  storage: { bytes: number; files: number }
  permissions: LibraryPermissions
  onAction: (dialog: FolderDialog) => void
  /** Leaving for another place: the shell clears its search box. */
  onNavigate: () => void
  onMoveAssets?: (assetIds: string[], folderId: string | null) => void
}

function FolderRow({
  node,
  open,
  onToggle,
  ...props
}: RailProps & { node: FolderNode; open: (id: string) => boolean; onToggle: (id: string) => void }) {
  const { orgSlug, state, permissions, onAction, onNavigate, onMoveAssets } = props
  const current = !state.trash && state.folderId === node.id
  const expanded = open(node.id)
  const drop = useAssetDrop(onMoveAssets ? (ids) => onMoveAssets(ids, node.id) : undefined)
  const Icon = current || expanded ? FolderOpen : Folder

  return (
    <li>
      <div className={row} style={{ paddingLeft: 4 + node.depth * 12 }} {...drop}>
        {node.children.length ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${node.name}`}
            className="shrink-0 rounded-sm p-0.5 outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className={cn("size-3 transition-transform", expanded && "rotate-90")} />
          </button>
        ) : (
          <span aria-hidden className="w-4 shrink-0" />
        )}
        <Link
          href={placeHref(orgSlug, state, { folderId: node.id })}
          aria-current={current ? "page" : undefined}
          onClick={onNavigate}
          className={rowLink}
        >
          <Icon aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{node.name}</span>
        </Link>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground group-hover/row:hidden group-focus-within/row:hidden">
          {node.files || ""}
        </span>
        <FolderMenu
          folder={node}
          permissions={permissions}
          onAction={onAction}
          className="hidden group-hover/row:block group-focus-within/row:block data-popup-open:block"
        />
      </div>
      {expanded && node.children.length ? (
        <ul>
          {node.children.map((child) => (
            <FolderRow key={child.id} {...props} node={child} open={open} onToggle={onToggle} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/** The left rail: every folder, the trash, and how much the library holds. */
export function FolderRail(props: RailProps) {
  const { orgSlug, folders, state, trashCount, storage, permissions, onAction, onNavigate, onMoveAssets } = props
  const tree = folderTree(folders)
  // The way to the current folder is always open; the rest is the viewer's to fold.
  const onPath = new Set(folderPath(folders, state.folderId).map((folder) => folder.id))
  const [toggled, setToggled] = React.useState<Record<string, boolean>>({})
  const open = (id: string) => toggled[id] ?? onPath.has(id)
  const onToggle = (id: string) => setToggled((current) => ({ ...current, [id]: !open(id) }))
  const rootDrop = useAssetDrop(onMoveAssets ? (ids) => onMoveAssets(ids, null) : undefined)
  const atRoot = !state.trash && !state.folderId

  return (
    <nav
      aria-label="Folders"
      className="hidden w-52 shrink-0 flex-col border-r border-border bg-panel lg:flex lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)]"
    >
      <div className="flex items-center justify-between px-3 pb-1 pt-3">
        <p className={eyebrow}>Folders</p>
        {permissions.create ? (
          <button
            type="button"
            onClick={() => onAction({ type: "create", parentId: state.trash ? null : state.folderId })}
            aria-label="New folder"
            title="New folder"
            className="rounded-sm p-1 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FolderPlus className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <ul>
          <li>
            <div className={cn(row, "pl-1")} {...rootDrop}>
              <Link
                href={placeHref(orgSlug, state, { folderId: null })}
                aria-current={atRoot ? "page" : undefined}
                onClick={onNavigate}
                className={cn(rowLink, "pl-1")}
              >
                <Images aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">All files</span>
              </Link>
            </div>
          </li>
          {tree.map((node) => (
            <FolderRow key={node.id} {...props} node={node} open={open} onToggle={onToggle} />
          ))}
        </ul>
        {folders.length === 0 ? (
          <p className="px-2 py-2 text-[12px] text-muted-foreground">
            No folders yet.{permissions.create ? " Make one to start sorting." : ""}
          </p>
        ) : null}

        <div className="mt-2 border-t border-border pt-2">
          <div className={cn(row, "pl-1")}>
            <Link
              href={placeHref(orgSlug, state, "trash")}
              aria-current={state.trash ? "page" : undefined}
              onClick={onNavigate}
              className={cn(rowLink, "pl-1")}
            >
              <Trash2 aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">Trash</span>
            </Link>
            <span className="shrink-0 pr-1 text-[11px] tabular-nums text-muted-foreground">
              {trashCount ? (trashCount >= 500 ? "500+" : trashCount) : ""}
            </span>
          </div>
        </div>
      </div>

      <StorageMeter storage={storage} className="border-t border-border px-3 py-3" />
    </nav>
  )
}

/** Files and bytes held, trash included — it is what the organization is storing. */
export function StorageMeter({
  storage,
  className,
}: {
  storage: { bytes: number; files: number }
  className?: string
}) {
  return (
    <div className={className}>
      <p className={cn(eyebrow, "flex items-center gap-1.5")}>
        <HardDrive aria-hidden className="size-3" /> Storage
      </p>
      <p className="mt-1 text-[13px] font-medium tabular-nums">{formatBytes(storage.bytes)}</p>
      <p className="text-[11px] text-muted-foreground">
        {storage.files} file{storage.files === 1 ? "" : "s"}, trash included
      </p>
    </div>
  )
}

/** The rail, folded into one control for screens that have no room for it. */
export function PlaceSelect({
  folders,
  state,
  trashCount,
  onChange,
}: {
  folders: LibraryFolder[]
  state: LibraryState
  trashCount: number
  onChange: (place: { folderId: string | null } | "trash") => void
}) {
  return (
    <select
      aria-label="Folder"
      value={state.trash ? "__trash" : (state.folderId ?? "")}
      onChange={(event) => {
        const value = event.target.value
        onChange(value === "__trash" ? "trash" : { folderId: value || null })
      }}
      className={cn(fieldClass, "lg:hidden")}
    >
      <option value="">All files</option>
      {flattenTree(folderTree(folders)).map((folder) => (
        <option key={folder.id} value={folder.id}>
          {" ".repeat(folder.depth)}
          {folder.name}
          {folder.files ? ` (${folder.files})` : ""}
        </option>
      ))}
      <option value="__trash">Trash{trashCount ? ` (${trashCount})` : ""}</option>
    </select>
  )
}

export function Breadcrumbs({
  orgSlug,
  folders,
  state,
  onNavigate,
  children,
}: {
  orgSlug: string
  folders: LibraryFolder[]
  state: LibraryState
  onNavigate: () => void
  children?: React.ReactNode
}) {
  const path = folderPath(folders, state.folderId)
  const crumb =
    "truncate rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-[13px] text-muted-foreground">
        <li className="flex min-w-0 items-center">
          {state.trash || path.length ? (
            <Link href={placeHref(orgSlug, state, { folderId: null })} onClick={onNavigate} className={crumb}>
              All files
            </Link>
          ) : (
            <span aria-current="page" className="font-medium text-foreground">
              All files
            </span>
          )}
        </li>
        {state.trash ? (
          <li className="flex min-w-0 items-center gap-1">
            <ChevronRight aria-hidden className="size-3 shrink-0" />
            <span aria-current="page" className="font-medium text-foreground">
              Trash
            </span>
          </li>
        ) : (
          path.map((folder, index) => (
            <li key={folder.id} className="flex min-w-0 items-center gap-1">
              <ChevronRight aria-hidden className="size-3 shrink-0" />
              {index === path.length - 1 ? (
                <span aria-current="page" className="max-w-[16rem] truncate font-medium text-foreground">
                  {folder.name}
                </span>
              ) : (
                <Link
                  href={placeHref(orgSlug, state, { folderId: folder.id })}
                  onClick={onNavigate}
                  className={cn(crumb, "max-w-[10rem]")}
                >
                  {folder.name}
                </Link>
              )}
            </li>
          ))
        )}
      </ol>
      {children}
    </nav>
  )
}

/* ------------------------------------------------------------------ dialogs */

const FORM_ID = "asset-folder-form"

function NameDialog({
  title,
  label,
  initial,
  submitLabel,
  pending,
  onClose,
  onSubmit,
}: {
  title: string
  label: string
  initial: string
  submitLabel: string
  pending: boolean
  onClose: () => void
  onSubmit: (name: string) => void
}) {
  // `showModal()` focuses the first control — the close button — and React's
  // `autoFocus` fires before the dialog is showing. This runs after both.
  const input = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [])

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      eyebrow={label}
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} size="sm" disabled={pending}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        onSubmit={(event) => {
          event.preventDefault()
          const name = String(new FormData(event.currentTarget).get("name") ?? "").trim()
          if (name) onSubmit(name)
        }}
      >
        <Field label="Name" htmlFor="asset-folder-name">
          <input
            id="asset-folder-name"
            name="name"
            required
            maxLength={60}
            ref={input}
            autoComplete="off"
            defaultValue={initial}
            className={fieldClass}
          />
        </Field>
      </form>
    </Modal>
  )
}

function MoveFolderDialog({
  folder,
  folders,
  pending,
  onClose,
  onSubmit,
}: {
  folder: LibraryFolder
  folders: LibraryFolder[]
  pending: boolean
  onClose: () => void
  onSubmit: (parentId: string | null) => void
}) {
  const [parentId, setParentId] = React.useState(folder.parentId)
  return (
    <Modal
      open
      onClose={onClose}
      title={`Move “${folder.name}”`}
      eyebrow="Folder"
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={pending || parentId === folder.parentId} onClick={() => onSubmit(parentId)}>
            Move here
          </Button>
        </>
      }
    >
      <Field
        label="Into"
        htmlFor="asset-folder-parent"
        hint="Everything inside the folder moves with it."
      >
        <FolderSelect
          id="asset-folder-parent"
          folders={folders}
          value={parentId}
          onChange={setParentId}
          exclude={descendantIds(folders, folder.id)}
        />
      </Field>
    </Modal>
  )
}

/** The dialog behind each folder action. Mounted only while open, so every opening starts clean. */
export function FolderDialogs({
  orgSlug,
  folders,
  dialog,
  onClose,
  onDone,
}: {
  orgSlug: string
  folders: LibraryFolder[]
  dialog: FolderDialog | null
  onClose: () => void
  /** `deleted` carries every folder id that went, so the shell can step out of one it was standing in. */
  onDone: (result: { deleted?: ReadonlySet<string>; parentId?: string | null }) => void
}) {
  const { pending, call } = useAction()
  if (!dialog) return null

  if (dialog.type === "create") {
    const parent = folders.find((folder) => folder.id === dialog.parentId)
    return (
      <NameDialog
        title="New folder"
        label={parent ? `Inside ${parent.name}` : "At the top level"}
        initial=""
        submitLabel="Create folder"
        pending={pending}
        onClose={onClose}
        onSubmit={async (name) => {
          const made = await call(() => createFolder(orgSlug, name, dialog.parentId), {
            success: "Folder created.",
          })
          if (made) onDone({})
        }}
      />
    )
  }

  const { folder } = dialog
  if (dialog.type === "rename") {
    return (
      <NameDialog
        title="Rename folder"
        label={folder.name}
        initial={folder.name}
        submitLabel="Rename"
        pending={pending}
        onClose={onClose}
        onSubmit={async (name) => {
          if (name === folder.name) return onClose()
          const result = await call(() => renameFolder(orgSlug, folder.id, name), {
            success: "Folder renamed.",
          })
          if (result !== null) onDone({})
        }}
      />
    )
  }

  if (dialog.type === "move") {
    return (
      <MoveFolderDialog
        folder={folder}
        folders={folders}
        pending={pending}
        onClose={onClose}
        onSubmit={async (parentId) => {
          const result = await call(() => moveFolder(orgSlug, folder.id, parentId), {
            success: "Folder moved.",
          })
          if (result !== null) onDone({})
        }}
      />
    )
  }

  const inside = descendantIds(folders, folder.id)
  const files = folders.reduce((sum, entry) => sum + (inside.has(entry.id) ? entry.files : 0), 0)
  return (
    <ConfirmModal
      open
      onClose={onClose}
      title={`Delete “${folder.name}”?`}
      confirmLabel="Delete folder"
      pending={pending}
      onConfirm={async () => {
        const result = await call(() => deleteFolder(orgSlug, folder.id), { success: "Folder deleted." })
        if (result !== null) onDone({ deleted: inside, parentId: folder.parentId })
      }}
    >
      <p>
        {inside.size > 1
          ? `This folder and the ${inside.size - 1} inside it are removed. `
          : "The folder is removed. "}
        {files
          ? `No file is deleted: the ${files} file${files === 1 ? "" : "s"} inside drop${files === 1 ? "s" : ""} back to All files.`
          : "No file is deleted — anything inside drops back to All files."}
      </p>
    </ConfirmModal>
  )
}
