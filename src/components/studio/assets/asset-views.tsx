"use client"

/**
 * The files themselves, as a grid of pictures or a table of facts. Both views
 * speak the same selection language — click, shift-click, cmd-click, and a
 * checkbox for hands that have no modifier keys — and leave deciding what a
 * click *means* to the browser above them.
 */

import * as React from "react"
import Link from "next/link"
import { Folder, Globe, Link2 } from "lucide-react"

import { TimeAgo } from "@/components/studio/kit"
import {
  ASSET_DRAG_TYPE,
  AssetThumb,
  type LibraryAsset,
  type LibraryFolder,
} from "@/components/studio/assets/shared"
import { useAssetDrop } from "@/components/studio/assets/folder-tree"
import { formatBytes } from "@/lib/studio/asset-kinds"
import { cn } from "@/lib/utils"

export type SelectMode = "only" | "toggle" | "range"

export const selectModeOf = (event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }): SelectMode =>
  event.shiftKey ? "range" : event.metaKey || event.ctrlKey ? "toggle" : "only"

export interface AssetViewProps {
  assets: LibraryAsset[]
  selected: ReadonlySet<string>
  onSelect: (asset: LibraryAsset, mode: SelectMode) => void
  onSelectAll: () => void
  /** Files can be dragged onto a folder to move them. */
  draggable: boolean
  trash: boolean
}

const dimensions = (asset: LibraryAsset) =>
  asset.width && asset.height ? `${asset.width} × ${asset.height}` : null

function dragProps(asset: LibraryAsset, { draggable, selected }: AssetViewProps) {
  if (!draggable) return {}
  return {
    draggable: true,
    onDragStart: (event: React.DragEvent) => {
      const ids = selected.has(asset.id) ? [...selected] : [asset.id]
      event.dataTransfer.setData(ASSET_DRAG_TYPE, JSON.stringify(ids))
      event.dataTransfer.setData("text/plain", asset.name)
      event.dataTransfer.effectAllowed = "move"
    },
  }
}

function SelectBox({
  asset,
  checked,
  onSelect,
  className,
}: {
  asset: LibraryAsset
  checked: boolean
  onSelect: AssetViewProps["onSelect"]
  className?: string
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      aria-label={`Select ${asset.name}`}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) =>
        onSelect(asset, (event.nativeEvent as MouseEvent).shiftKey ? "range" : "toggle")
      }
      className={cn("size-4 cursor-pointer accent-foreground", className)}
    />
  )
}

export function AssetGrid(props: AssetViewProps) {
  const { assets, selected, onSelect } = props
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))]">
      {assets.map((asset) => {
        const isSelected = selected.has(asset.id)
        const size = dimensions(asset)
        return (
          <li key={asset.id} className="group/tile relative" {...dragProps(asset, props)}>
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={(event) => onSelect(asset, selectModeOf(event))}
              className={cn(
                "block w-full border border-border bg-panel text-left outline-none transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring",
                isSelected && "border-foreground ring-1 ring-foreground hover:border-foreground",
              )}
            >
              <AssetThumb asset={asset} className="aspect-square w-full border-b border-border" />
              <span className="block px-2.5 py-2">
                <span className="block truncate text-[13px] font-medium" title={asset.name}>
                  {asset.name}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="truncate tabular-nums">
                    {formatBytes(asset.size)}
                    {size ? ` · ${size}` : ""}
                  </span>
                  {asset.isPublic ? (
                    <Globe aria-label="Public link on" className="ml-auto size-3 shrink-0" />
                  ) : null}
                  {asset.uses ? (
                    <span
                      className={cn("flex shrink-0 items-center gap-0.5", !asset.isPublic && "ml-auto")}
                      title={`Used in ${asset.uses} design${asset.uses === 1 ? "" : "s"}`}
                    >
                      <Link2 aria-hidden className="size-3" />
                      {asset.uses}
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
            <span
              className={cn(
                "absolute left-2 top-2 flex rounded-sm bg-background/90 p-1 shadow-sm transition-opacity",
                // Always there for touch; on a pointer it waits for hover, focus or a selection.
                isSelected || selected.size
                  ? "opacity-100"
                  : "opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/tile:opacity-100 [@media(hover:hover)]:group-focus-within/tile:opacity-100",
              )}
            >
              <SelectBox asset={asset} checked={isSelected} onSelect={onSelect} />
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function AssetList(props: AssetViewProps) {
  const { assets, selected, onSelect, onSelectAll, trash } = props
  const all = assets.length > 0 && assets.every((asset) => selected.has(asset.id))
  const head = "px-3 py-2 text-left font-mono text-[10px] font-normal uppercase tracking-[0.12em] text-muted-foreground"
  const cell = "px-3 py-2 align-middle text-[12px] text-muted-foreground"

  return (
    <div className="overflow-x-auto border border-border bg-panel">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="w-9 py-2 pl-3 text-left">
              <input
                type="checkbox"
                checked={all}
                onChange={onSelectAll}
                aria-label={all ? "Clear selection" : "Select all files"}
                className="size-4 cursor-pointer align-middle accent-foreground"
              />
            </th>
            <th scope="col" className={head}>
              Name
            </th>
            <th scope="col" className={cn(head, "hidden md:table-cell")}>
              Kind
            </th>
            <th scope="col" className={cn(head, "text-right")}>
              Size
            </th>
            <th scope="col" className={cn(head, "hidden xl:table-cell")}>
              Dimensions
            </th>
            <th scope="col" className={cn(head, "hidden 2xl:table-cell")}>
              Uploaded by
            </th>
            <th scope="col" className={cn(head, "hidden sm:table-cell")}>
              {trash ? "Trashed" : "Added"}
            </th>
            <th scope="col" className={cn(head, "hidden text-right md:table-cell")}>
              Uses
            </th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => {
            const isSelected = selected.has(asset.id)
            return (
              <tr
                key={asset.id}
                aria-selected={isSelected}
                onClick={(event) => onSelect(asset, selectModeOf(event))}
                className={cn(
                  "cursor-default border-b border-border last:border-b-0 hover:bg-accent/50",
                  isSelected && "bg-accent hover:bg-accent",
                )}
                {...dragProps(asset, props)}
              >
                <td className="py-2 pl-3">
                  <SelectBox asset={asset} checked={isSelected} onSelect={onSelect} className="align-middle" />
                </td>
                <td className="max-w-0 px-3 py-1.5" style={{ width: "50%" }}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <AssetThumb
                      asset={asset}
                      iconClassName="size-4"
                      showExtension={false}
                      className="size-8 shrink-0 border border-border"
                    />
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onSelect(asset, selectModeOf(event))
                        }}
                        className="block max-w-full truncate rounded-sm text-left font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title={asset.name}
                      >
                        {asset.name}
                      </button>
                      {asset.tags.length || asset.isPublic ? (
                        <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                          {asset.isPublic ? <Globe aria-label="Public link on" className="size-3 shrink-0" /> : null}
                          <span className="truncate">{asset.tags.map((tag) => `#${tag}`).join(" ")}</span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className={cn(cell, "hidden capitalize md:table-cell")}>{asset.kind}</td>
                <td className={cn(cell, "whitespace-nowrap text-right tabular-nums")}>{formatBytes(asset.size)}</td>
                <td className={cn(cell, "hidden whitespace-nowrap tabular-nums xl:table-cell")}>
                  {dimensions(asset) ?? "—"}
                </td>
                <td className={cn(cell, "hidden max-w-[10rem] truncate 2xl:table-cell")}>
                  {asset.uploaderName ?? "—"}
                </td>
                <td className={cn(cell, "hidden whitespace-nowrap sm:table-cell")}>
                  <TimeAgo date={trash && asset.deletedAt ? asset.deletedAt : asset.createdAt} />
                </td>
                <td className={cn(cell, "hidden text-right tabular-nums md:table-cell")}>{asset.uses || "—"}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FolderTile({
  folder,
  href,
  onNavigate,
  onMoveAssets,
}: {
  folder: LibraryFolder
  href: string
  onNavigate: () => void
  onMoveAssets?: (assetIds: string[], folderId: string) => void
}) {
  const drop = useAssetDrop(onMoveAssets ? (ids) => onMoveAssets(ids, folder.id) : undefined)
  return (
    <li {...drop} className="group/folder data-[drop=true]:ring-1 data-[drop=true]:ring-ring">
      <Link
        href={href}
        onClick={onNavigate}
        className="flex h-10 items-center gap-2 border border-border bg-panel px-3 text-[13px] outline-none transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring group-data-[drop=true]/folder:bg-accent"
      >
        <Folder aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium">{folder.name}</span>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{folder.files || ""}</span>
      </Link>
    </li>
  )
}

/** The folders inside the current one, so "All files" reads as a place and not just the loose files. */
export function FolderTiles({
  folders,
  hrefFor,
  onNavigate,
  onMoveAssets,
}: {
  folders: LibraryFolder[]
  hrefFor: (folderId: string) => string
  onNavigate: () => void
  onMoveAssets?: (assetIds: string[], folderId: string) => void
}) {
  if (!folders.length) return null
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))]">
      {folders.map((folder) => (
        <FolderTile
          key={folder.id}
          folder={folder}
          href={hrefFor(folder.id)}
          onNavigate={onNavigate}
          onMoveAssets={onMoveAssets}
        />
      ))}
    </ul>
  )
}
