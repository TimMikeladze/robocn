"use client"

/**
 * Choosing files from the library, from anywhere: the editor attaches
 * references with it, settings picks a logo. It fetches for itself through
 * `browseAssets`, because the surfaces that open it never loaded the library,
 * and it remembers what was picked across folders so a selection can be
 * gathered from several places.
 */

import * as React from "react"
import { Check, ChevronRight, Folder, Search, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState, Modal, fieldClass } from "@/components/studio/kit"
import { AssetThumb, folderPath } from "@/components/studio/assets/shared"
import { UploadList, useFilePicker, useUploads } from "@/components/studio/assets/upload"
import { browseAssets } from "@/lib/studio/actions/asset-browse"
import { formatBytes } from "@/lib/studio/asset-kinds"
import { cn } from "@/lib/utils"

export interface PickedAsset {
  id: string
  name: string
  kind: string
  mime: string
  hasThumbnail: boolean
}

export interface AssetPickerProps {
  orgSlug: string
  open: boolean
  onClose: () => void
  onPick: (assets: PickedAsset[]) => void
  multiple?: boolean
  /** Restrict to a kind. */
  kind?: "image"
  /** Show an upload button inside the picker. */
  canUpload?: boolean
}

type Browsed = Extract<Awaited<ReturnType<typeof browseAssets>>, { ok: true }>["data"]

const picked = (asset: Browsed["assets"][number]): PickedAsset => ({
  id: asset.id,
  name: asset.name,
  kind: asset.kind,
  mime: asset.mime,
  hasThumbnail: asset.hasThumbnail,
})

function PickerDialog({ orgSlug, onClose, onPick, multiple = false, kind, canUpload }: AssetPickerProps) {
  const [folderId, setFolderId] = React.useState<string | null>(null)
  const [text, setText] = React.useState("")
  const [query, setQuery] = React.useState("")
  const [nonce, setNonce] = React.useState(0)
  const [chosen, setChosen] = React.useState<ReadonlyMap<string, PickedAsset>>(new Map())
  const [result, setResult] = React.useState<{ key: string; data: Browsed | null; error?: string } | null>(null)
  const timer = React.useRef<number | undefined>(undefined)
  // Ids fresh from an upload, picked as soon as the listing that contains them arrives.
  const arriving = React.useRef<string[]>([])

  const key = [folderId ?? "", query, nonce].join("|")
  const loading = result?.key !== key
  const data = result?.data ?? null

  React.useEffect(() => {
    let live = true
    browseAssets(orgSlug, { folderId, query: query || undefined, kind })
      .then((answer) => {
        if (!live) return
        if (!answer.ok) return setResult({ key, data: null, error: answer.error })
        setResult({ key, data: answer.data })
        const fresh = answer.data.assets.filter((asset) => arriving.current.includes(asset.id))
        arriving.current = []
        if (!fresh.length) return
        setChosen((current) => {
          const next = new Map(multiple ? current : [])
          for (const asset of multiple ? fresh : fresh.slice(0, 1)) next.set(asset.id, picked(asset))
          return next
        })
      })
      .catch(() => {
        if (live) setResult({ key, data: null, error: "The library could not be loaded." })
      })
    return () => {
      live = false
    }
  }, [orgSlug, folderId, query, kind, multiple, key])

  // `showModal()` focuses the close button; the search box is where a hand wants to land.
  const search = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    search.current?.focus()
    return () => window.clearTimeout(timer.current)
  }, [])

  const uploads = useUploads(orgSlug, (uploaded) => {
    arriving.current = uploaded.map((asset) => asset.id)
    setNonce((value) => value + 1)
  })
  const filePicker = useFilePicker((files) => void uploads.enqueue(files, { folderId }), {
    multiple,
    accept: kind === "image" ? "image/*" : undefined,
  })

  function toggle(asset: Browsed["assets"][number]) {
    setChosen((current) => {
      if (!multiple) return current.has(asset.id) ? new Map() : new Map([[asset.id, picked(asset)]])
      const next = new Map(current)
      if (!next.delete(asset.id)) next.set(asset.id, picked(asset))
      return next
    })
  }

  function confirm(assets: PickedAsset[]) {
    if (!assets.length) return
    onPick(assets)
    onClose()
  }

  const folders = data?.folders ?? []
  const path = folderPath(folders, folderId)
  const children = query ? [] : folders.filter((folder) => folder.parentId === folderId)
  const assets = data?.assets ?? []
  const crumb = "rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      eyebrow="Asset library"
      title={kind === "image" ? (multiple ? "Choose images" : "Choose an image") : multiple ? "Choose files" : "Choose a file"}
      footer={
        <>
          <p className="mr-auto text-[12px] text-muted-foreground" aria-live="polite">
            {chosen.size ? `${chosen.size} chosen` : multiple ? "Pick one or more." : "Pick one. Double-click to choose at once."}
          </p>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={!chosen.size} onClick={() => confirm([...chosen.values()])}>
            {multiple && chosen.size > 1 ? `Choose ${chosen.size} files` : "Choose"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[10rem] flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              ref={search}
              value={text}
              onChange={(event) => {
                const value = event.target.value
                setText(value)
                window.clearTimeout(timer.current)
                timer.current = window.setTimeout(() => setQuery(value.trim()), 250)
              }}
              aria-label="Search the library"
              placeholder="Search every folder"
              className={cn(fieldClass, "pl-8")}
            />
          </div>
          {canUpload ? (
            <Button variant="outline" size="sm" disabled={uploads.active} onClick={filePicker.open}>
              <Upload /> Upload
            </Button>
          ) : null}
          {filePicker.input}
        </div>

        {uploads.items.length ? <UploadList uploads={uploads} className="border border-border" /> : null}

        {query ? null : (
          <nav aria-label="Folder" className="flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
            {path.length ? (
              <button type="button" onClick={() => setFolderId(null)} className={crumb}>
                All files
              </button>
            ) : (
              <span className="font-medium text-foreground">All files</span>
            )}
            {path.map((folder, index) => (
              <React.Fragment key={folder.id}>
                <ChevronRight aria-hidden className="size-3" />
                {index === path.length - 1 ? (
                  <span className="font-medium text-foreground">{folder.name}</span>
                ) : (
                  <button type="button" onClick={() => setFolderId(folder.id)} className={crumb}>
                    {folder.name}
                  </button>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        <div className={cn("min-h-[16rem] space-y-3 transition-opacity", loading && data && "opacity-60")} aria-busy={loading}>
          {children.length ? (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(9rem,1fr))]">
              {children.map((folder) => (
                <li key={folder.id}>
                  <button
                    type="button"
                    onClick={() => setFolderId(folder.id)}
                    className="flex h-9 w-full items-center gap-2 border border-border bg-background px-2.5 text-left text-[13px] outline-none transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Folder aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">{folder.files || ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {result?.error && !loading ? (
            <p role="alert" className="text-[13px] text-destructive">
              {result.error}
            </p>
          ) : !data ? (
            <p className="py-10 text-center text-[13px] text-muted-foreground">Loading the library…</p>
          ) : assets.length ? (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))]">
              {assets.map((asset) => {
                const on = chosen.has(asset.id)
                return (
                  <li key={asset.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(asset)}
                      onDoubleClick={() => confirm(multiple ? [...new Map(chosen).set(asset.id, picked(asset)).values()] : [picked(asset)])}
                      className={cn(
                        "relative block w-full border border-border bg-background text-left outline-none transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring",
                        on && "border-foreground ring-1 ring-foreground hover:border-foreground",
                      )}
                    >
                      <AssetThumb
                        asset={{ ...asset, updatedAt: new Date(asset.updatedAt).toISOString() }}
                        iconClassName="size-6"
                        className="aspect-square w-full border-b border-border"
                      />
                      <span className="block px-2 py-1.5">
                        <span className="block truncate text-[12px] font-medium" title={asset.name}>
                          {asset.name}
                        </span>
                        <span className="block truncate text-[10px] tabular-nums text-muted-foreground">
                          {formatBytes(asset.size)}
                          {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
                        </span>
                      </span>
                      {on ? (
                        <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background">
                          <Check aria-hidden className="size-3" />
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : children.length ? null : (
            <EmptyState
              title={query ? "Nothing matches" : kind === "image" ? "No images here" : "No files here"}
              action={
                canUpload ? (
                  <Button size="sm" onClick={filePicker.open}>
                    <Upload /> Upload
                  </Button>
                ) : undefined
              }
            >
              {query
                ? "No file in the library fits that search."
                : canUpload
                  ? "Upload one and it is chosen for you."
                  : "Ask an editor to add files to the library."}
            </EmptyState>
          )}
        </div>
      </div>
    </Modal>
  )
}

/** Mounted only while open, so every opening starts at the root with nothing chosen. */
export function AssetPicker(props: AssetPickerProps): React.JSX.Element {
  return props.open ? <PickerDialog {...props} /> : <></>
}
