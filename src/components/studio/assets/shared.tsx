"use client"

/**
 * What every part of the asset library agrees on: the plain shapes the server
 * page hands over, where a file's bytes live, and how a file that has no
 * picture is drawn. Kept apart so the picker can borrow it without pulling in
 * the whole library.
 */

import * as React from "react"
import { File, FileText, Film, Image as ImageIcon, Music, Type } from "lucide-react"

import { fieldClass } from "@/components/studio/kit"
import type { AssetKind } from "@/lib/studio/asset-kinds"
import { cn } from "@/lib/utils"

/** An `AssetRow` with its dates as ISO strings, so it crosses to the client as plain data. */
export interface LibraryAsset {
  id: string
  folderId: string | null
  name: string
  kind: string
  mime: string
  size: number
  width: number | null
  height: number | null
  tags: string[]
  description: string
  isPublic: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  hasThumbnail: boolean
  uploaderName: string | null
  uses: number
}

export interface LibraryFolder {
  id: string
  parentId: string | null
  name: string
  files: number
}

/** What the viewer's role lets them do; the server enforces it, this only hides what would fail. */
export interface LibraryPermissions {
  create: boolean
  update: boolean
  remove: boolean
}

export const sorts = ["newest", "oldest", "name", "largest"] as const
export type LibrarySort = (typeof sorts)[number]

export interface LibraryState {
  folderId: string | null
  q: string
  kind: AssetKind | null
  tag: string | null
  sort: LibrarySort
  view: "grid" | "list"
  trash: boolean
}

/** The library's whole state is its URL, so a view can be shared and survives a refresh. */
export function libraryHref(orgSlug: string, state: LibraryState) {
  const params = new URLSearchParams()
  if (state.trash) params.set("trash", "1")
  else if (state.folderId) params.set("folder", state.folderId)
  if (state.q.trim()) params.set("q", state.q.trim())
  if (state.kind) params.set("kind", state.kind)
  if (state.tag) params.set("tag", state.tag)
  if (state.sort !== "newest") params.set("sort", state.sort)
  if (state.view !== "grid") params.set("view", state.view)
  const query = params.toString()
  return `/studio/${orgSlug}/assets${query ? `?${query}` : ""}`
}

/** Going somewhere else in the library drops the filters: a search looks everywhere, a folder does not. */
export const placeHref = (
  orgSlug: string,
  state: LibraryState,
  place: { folderId: string | null } | "trash",
) =>
  libraryHref(orgSlug, {
    ...state,
    q: "",
    kind: null,
    tag: null,
    trash: place === "trash",
    folderId: place === "trash" ? null : place.folderId,
  })

/** The drag payload for files moved onto a folder: a JSON array of asset ids. */
export const ASSET_DRAG_TYPE = "application/x-robocn-assets"

/**
 * `version` is the asset's `updatedAt`: the route caches for five minutes, and
 * a replaced file keeps its id, so the URL has to change when the bytes do.
 */
export function fileUrl(
  id: string,
  options: { thumb?: boolean; download?: boolean; version?: string } = {},
) {
  const params = new URLSearchParams()
  if (options.thumb) params.set("thumb", "1")
  if (options.download) params.set("download", "1")
  if (options.version) params.set("v", String(new Date(options.version).getTime()))
  const query = params.toString()
  return `/api/studio/assets/${id}/file${query ? `?${query}` : ""}`
}

export const kindLabels: Record<AssetKind, string> = {
  image: "Images",
  video: "Video",
  audio: "Audio",
  font: "Fonts",
  document: "Documents",
  other: "Other",
}

const kindIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  font: Type,
  document: FileText,
}

export function KindIcon({ kind, className }: { kind: string; className?: string }) {
  const Icon = kindIcons[kind] ?? File
  return <Icon aria-hidden className={className} />
}

/** `report.final.pdf` → `PDF`: the badge a file without a picture wears. */
export function extensionOf(name: string) {
  const dot = name.lastIndexOf(".")
  if (dot <= 0 || dot === name.length - 1) return ""
  return name.slice(dot + 1, dot + 6).toUpperCase()
}

/** Transparent images sit on a checkerboard so their edges can be seen. */
export const checkerboard =
  "bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:16px_16px]"

/** The square picture of a file: its thumbnail, or its kind and extension. */
export function AssetThumb({
  asset,
  className,
  iconClassName = "size-7",
  showExtension = true,
}: {
  asset: Pick<LibraryAsset, "id" | "name" | "kind" | "hasThumbnail" | "updatedAt">
  className?: string
  iconClassName?: string
  showExtension?: boolean
}) {
  const extension = showExtension ? extensionOf(asset.name) : ""
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-muted/40",
        asset.hasThumbnail && checkerboard,
        className,
      )}
    >
      {asset.hasThumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element -- an authenticated route the image optimizer cannot fetch
        <img
          src={fileUrl(asset.id, { thumb: true, version: asset.updatedAt })}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="size-full object-contain"
        />
      ) : (
        <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
          <KindIcon kind={asset.kind} className={iconClassName} />
          {extension ? (
            <span className="font-mono text-[9px] uppercase tracking-[0.12em]">{extension}</span>
          ) : null}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ folders */

export interface FolderNode extends LibraryFolder {
  depth: number
  children: FolderNode[]
}

/** The flat rows as a tree. A folder whose parent is missing surfaces at the top rather than vanishing. */
export function folderTree(folders: readonly LibraryFolder[]): FolderNode[] {
  const ids = new Set(folders.map((folder) => folder.id))
  const byParent = new Map<string | null, LibraryFolder[]>()
  for (const folder of folders) {
    const parent = folder.parentId && ids.has(folder.parentId) ? folder.parentId : null
    byParent.set(parent, [...(byParent.get(parent) ?? []), folder])
  }
  const build = (parent: string | null, depth: number, seen: Set<string>): FolderNode[] =>
    (byParent.get(parent) ?? [])
      .filter((folder) => !seen.has(folder.id))
      .map((folder) => ({
        ...folder,
        depth,
        children: build(folder.id, depth + 1, new Set(seen).add(folder.id)),
      }))
  return build(null, 0, new Set())
}

export function flattenTree(nodes: readonly FolderNode[]): FolderNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)])
}

/** Root first, the folder itself last. */
export function folderPath(folders: readonly LibraryFolder[], folderId: string | null) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const path: LibraryFolder[] = []
  for (let at = folderId ? byId.get(folderId) : undefined, hops = 0; at && hops < 64; hops++) {
    path.unshift(at)
    at = at.parentId ? byId.get(at.parentId) : undefined
  }
  return path
}

/** A folder and everything beneath it: where it cannot be moved to. */
export function descendantIds(folders: readonly LibraryFolder[], folderId: string) {
  const found = new Set([folderId])
  for (let grew = true; grew; ) {
    grew = false
    for (const folder of folders) {
      if (folder.parentId && found.has(folder.parentId) && !found.has(folder.id)) {
        found.add(folder.id)
        grew = true
      }
    }
  }
  return found
}

/** A destination picker. The empty value is the top level. */
export function FolderSelect({
  folders,
  value,
  onChange,
  exclude,
  rootLabel = "All files (top level)",
  id,
  className,
  "aria-label": ariaLabel,
}: {
  folders: readonly LibraryFolder[]
  value: string | null
  onChange: (folderId: string | null) => void
  exclude?: ReadonlySet<string>
  rootLabel?: string
  id?: string
  className?: string
  "aria-label"?: string
}) {
  const rows = flattenTree(folderTree(folders)).filter((folder) => !exclude?.has(folder.id))
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
      className={cn(fieldClass, className)}
    >
      <option value="">{rootLabel}</option>
      {rows.map((folder) => (
        <option key={folder.id} value={folder.id}>
          {" ".repeat(folder.depth)}
          {folder.name}
        </option>
      ))}
    </select>
  )
}

/* ------------------------------------------------------------------- events */

/** A window listener that always sees the latest handler without resubscribing. */
export function useWindowEvent<K extends keyof WindowEventMap>(
  type: K,
  handler: (event: WindowEventMap[K]) => void,
) {
  const latest = React.useRef(handler)
  React.useEffect(() => {
    latest.current = handler
  })
  React.useEffect(() => {
    const listener = (event: WindowEventMap[K]) => latest.current(event)
    window.addEventListener(type, listener)
    return () => window.removeEventListener(type, listener)
  }, [type])
}

/** Shortcuts stand down while someone is typing or a dialog is up. */
export function shortcutsBlocked(target: EventTarget | null) {
  if (document.querySelector("dialog[open]")) return true
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
}

/** Save several files. Staggered, because a browser drops downloads fired in the same tick. */
export function downloadAssets(assets: readonly Pick<LibraryAsset, "id" | "name">[]) {
  assets.forEach((asset, index) => {
    window.setTimeout(() => {
      const link = document.createElement("a")
      link.href = fileUrl(asset.id, { download: true })
      link.download = asset.name
      document.body.append(link)
      link.click()
      link.remove()
    }, index * 250)
  })
}
