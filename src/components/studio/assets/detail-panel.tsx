"use client"

/**
 * One file, in full: what it looks like, what it is called, who can reach it,
 * and what would break if it went. Every edit saves on its own — a rename on
 * blur, a tag on Enter — because a panel with a Save button is a form, and
 * this is a property sheet.
 */

import * as React from "react"
import Link from "next/link"
import { Download, ExternalLink, RefreshCw, RotateCcw, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { CopyButton, TimeAgo, eyebrow, fieldClass, useAction } from "@/components/studio/kit"
import {
  AssetThumb,
  FolderSelect,
  KindIcon,
  checkerboard,
  extensionOf,
  fileUrl,
  type LibraryAsset,
  type LibraryFolder,
  type LibraryPermissions,
} from "@/components/studio/assets/shared"
import { useFilePicker } from "@/components/studio/assets/upload"
import { getAssetUsage, moveAssets, updateAsset } from "@/lib/studio/actions/assets"
import { cleanTags, formatBytes, mustDownload } from "@/lib/studio/asset-kinds"
import { cn } from "@/lib/utils"

/** Past this, the panel shows the thumbnail and leaves the original a click away. */
const INLINE_IMAGE_BYTES = 4 * 1024 * 1024

function Preview({ asset }: { asset: LibraryAsset }) {
  const src = fileUrl(asset.id, { version: asset.updatedAt })
  const frame = "flex aspect-[4/3] w-full items-center justify-center overflow-hidden border-b border-border bg-muted/40"

  if (asset.kind === "image" && (asset.hasThumbnail || !mustDownload(asset.mime))) {
    const full = asset.size <= INLINE_IMAGE_BYTES || !asset.hasThumbnail
    return (
      <div className={cn(frame, checkerboard)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- an authenticated route the image optimizer cannot fetch */}
        <img
          src={full ? src : fileUrl(asset.id, { thumb: true, version: asset.updatedAt })}
          alt={asset.description || asset.name}
          className="size-full object-contain"
        />
      </div>
    )
  }
  if (asset.kind === "video") {
    return (
      <div className={cn(frame, "bg-black")}>
        <video src={src} controls preload="metadata" className="size-full" />
      </div>
    )
  }
  if (asset.kind === "audio") {
    return (
      <div className={cn(frame, "aspect-auto flex-col gap-3 px-4 py-6")}>
        <KindIcon kind="audio" className="size-7 text-muted-foreground" />
        <audio src={src} controls preload="metadata" className="w-full" />
      </div>
    )
  }
  return <AssetThumb asset={asset} iconClassName="size-10" className="aspect-[4/3] w-full border-b border-border" />
}

/** Chips and an input. Enter or a comma adds; Backspace on an empty input takes the last one back. */
export function TagEditor({
  tags,
  suggestions,
  disabled,
  onChange,
}: {
  tags: string[]
  suggestions: string[]
  disabled?: boolean
  onChange: (tags: string[]) => void
}) {
  const [draft, setDraft] = React.useState("")
  const listId = React.useId()

  function add(raw: string) {
    const next = cleanTags([...tags, ...raw.split(",")])
    setDraft("")
    if (next.length !== tags.length) onChange(next)
  }

  return (
    <div
      className={cn(
        "flex min-h-8 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-1.5 py-1 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/50",
        disabled && "border-transparent bg-transparent px-0",
      )}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex h-5 items-center gap-1 rounded-full border border-border bg-panel pl-2 pr-1 font-mono text-[10px] uppercase tracking-[0.08em]"
        >
          {tag}
          {disabled ? (
            <span className="w-1" />
          ) : (
            <button
              type="button"
              onClick={() => onChange(tags.filter((entry) => entry !== tag))}
              aria-label={`Remove tag ${tag}`}
              className="rounded-full p-0.5 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-2.5" />
            </button>
          )}
        </span>
      ))}
      {disabled ? (
        tags.length ? null : <span className="text-[12px] text-muted-foreground">No tags.</span>
      ) : (
        <>
          <input
            value={draft}
            list={listId}
            maxLength={32}
            aria-label="Add a tag"
            placeholder={tags.length ? "" : "Add a tag…"}
            onChange={(event) => {
              const value = event.target.value
              if (value.includes(",")) add(value)
              else setDraft(value)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                if (draft.trim()) add(draft)
              } else if (event.key === "Backspace" && !draft && tags.length) {
                onChange(tags.slice(0, -1))
              }
            }}
            onBlur={() => {
              if (draft.trim()) add(draft)
            }}
            className="h-5 min-w-[5rem] flex-1 bg-transparent px-1 text-[12px] outline-none placeholder:text-muted-foreground"
          />
          <datalist id={listId}>
            {suggestions
              .filter((tag) => !tags.includes(tag))
              .map((tag) => (
                <option key={tag} value={tag} />
              ))}
          </datalist>
        </>
      )}
    </div>
  )
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border px-4 py-3 last:border-b-0">
      <h3 className={cn(eyebrow, "mb-2")}>{label}</h3>
      {children}
    </section>
  )
}

function Usage({ orgSlug, asset }: { orgSlug: string; asset: LibraryAsset }) {
  const [designs, setDesigns] = React.useState<{ id: string; name: string }[] | null>(null)
  React.useEffect(() => {
    if (!asset.uses) return
    let live = true
    getAssetUsage(orgSlug, asset.id)
      .then((result) => {
        if (live) setDesigns(result.ok ? result.data : [])
      })
      .catch(() => {
        if (live) setDesigns([])
      })
    return () => {
      live = false
    }
  }, [orgSlug, asset.id, asset.uses])

  if (!asset.uses) return <p className="text-[12px] text-muted-foreground">Not used in any design.</p>
  if (!designs) return <p className="text-[12px] text-muted-foreground">Looking…</p>
  return (
    <ul className="space-y-1">
      {designs.map((design) => (
        <li key={design.id}>
          <Link
            href={`/studio/${orgSlug}/designs/${design.id}`}
            className="flex items-center gap-1.5 truncate text-[13px] underline-offset-4 hover:underline"
          >
            <ExternalLink aria-hidden className="size-3 shrink-0 text-muted-foreground" />
            <span className="truncate">{design.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export interface DetailPanelProps {
  orgSlug: string
  asset: LibraryAsset
  folders: LibraryFolder[]
  tagSuggestions: string[]
  permissions: LibraryPermissions
  onClose: () => void
  /** Server data moved; the page should be read again. */
  onChanged: () => void
  onReplace: (file: File) => void
  onTrash: () => void
  onRestore: () => void
  onPurge: () => void
}

export function DetailPanel({
  orgSlug,
  asset,
  folders,
  tagSuggestions,
  permissions,
  onClose,
  onChanged,
  onReplace,
  onTrash,
  onRestore,
  onPurge,
}: DetailPanelProps) {
  const { pending, call } = useAction()
  const trashed = !!asset.deletedAt
  const editable = permissions.update && !trashed
  // What was just asked for, shown until the server's answer replaces it.
  const [sent, setSent] = React.useState<{ tags?: string[]; isPublic?: boolean }>({})
  const tags = sent.tags ?? asset.tags
  const isPublic = sent.isPublic ?? asset.isPublic
  const replace = useFilePicker((files) => onReplace(files[0]))

  async function save(change: Parameters<typeof updateAsset>[2], success?: string) {
    const result = await call(() => updateAsset(orgSlug, asset.id, change), { success })
    if (result !== null) onChanged()
    return result !== null
  }

  async function saveOptimistic(change: { tags?: string[]; isPublic?: boolean }, success?: string) {
    setSent((current) => ({ ...current, ...change }))
    await save(change, success)
    setSent({})
  }

  const facts: [string, React.ReactNode][] = [
    ["Type", asset.mime],
    ["Size", formatBytes(asset.size)],
    ...(asset.width && asset.height
      ? [["Dimensions", `${asset.width} × ${asset.height} px`] as [string, React.ReactNode]]
      : []),
    ["Uploaded by", asset.uploaderName ?? "Someone who has left"],
    ["Added", <TimeAgo key="added" date={asset.createdAt} />],
    ["Changed", <TimeAgo key="changed" date={asset.updatedAt} />],
    ...(asset.deletedAt
      ? [["Trashed", <TimeAgo key="trashed" date={asset.deletedAt} />] as [string, React.ReactNode]]
      : []),
  ]

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-panel px-4 py-2">
        <p className={eyebrow}>
          {asset.kind}
          {extensionOf(asset.name) ? ` · ${extensionOf(asset.name)}` : ""}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="rounded-sm p-1 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
      </div>

      <Preview asset={asset} />

      <div className="space-y-2 border-b border-border px-4 py-3">
        {editable ? (
          <input
            key={asset.name}
            defaultValue={asset.name}
            aria-label="File name"
            maxLength={120}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur()
              if (event.key === "Escape") {
                event.currentTarget.value = asset.name
                event.currentTarget.blur()
                event.stopPropagation()
              }
            }}
            onBlur={(event) => {
              const name = event.currentTarget.value.trim()
              if (name && name !== asset.name) void save({ name }, "Renamed.")
              else event.currentTarget.value = asset.name
            }}
            className={cn(fieldClass, "-mx-1.5 w-[calc(100%+0.75rem)] border-transparent bg-transparent px-1.5 text-[14px] font-medium hover:border-input")}
          />
        ) : (
          <p className="break-words text-[14px] font-medium">{asset.name}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={fileUrl(asset.id, { download: true })} download={asset.name} />}
          >
            <Download /> Download
          </Button>
          {!mustDownload(asset.mime) ? (
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={
                <a href={fileUrl(asset.id, { version: asset.updatedAt })} target="_blank" rel="noreferrer" />
              }
            >
              <ExternalLink /> Open
            </Button>
          ) : null}
          {editable ? (
            <Button variant="ghost" size="sm" onClick={replace.open} title="Upload new bytes under the same file, so every design using it updates">
              <RefreshCw /> Replace
            </Button>
          ) : null}
          {replace.input}
        </div>
      </div>

      <Block label="Description">
        {editable ? (
          <textarea
            key={asset.description}
            defaultValue={asset.description}
            aria-label="Description"
            rows={3}
            maxLength={1000}
            placeholder="What this file is, and what it is for."
            onBlur={(event) => {
              const description = event.currentTarget.value.trim()
              if (description !== asset.description) void save({ description }, "Description saved.")
            }}
            className={cn(fieldClass, "h-auto resize-y py-1.5 leading-relaxed")}
          />
        ) : (
          <p className="whitespace-pre-wrap text-[13px] text-muted-foreground">
            {asset.description || "No description."}
          </p>
        )}
      </Block>

      <Block label="Tags">
        <TagEditor
          tags={tags}
          suggestions={tagSuggestions}
          disabled={!editable}
          onChange={(next) => void saveOptimistic({ tags: next })}
        />
      </Block>

      {trashed ? null : (
        <Block label="Folder">
          {editable ? (
            <FolderSelect
              aria-label="Folder"
              folders={folders}
              value={asset.folderId}
              rootLabel="All files (no folder)"
              onChange={async (folderId) => {
                const result = await call(() => moveAssets(orgSlug, [asset.id], folderId), {
                  success: "Moved.",
                })
                if (result !== null) onChanged()
              }}
            />
          ) : (
            <p className="text-[13px] text-muted-foreground">
              {folders.find((folder) => folder.id === asset.folderId)?.name ?? "All files"}
            </p>
          )}
        </Block>
      )}

      {trashed ? null : (
        <Block label="Public link">
          <div className="flex items-start justify-between gap-3">
            <p id={`public-${asset.id}`} className="text-[12px] text-muted-foreground">
              {isPublic
                ? "Anyone holding the link can open this file, signed in or not."
                : "Only members of this organization can open this file."}
            </p>
            {editable ? (
              <Switch
                checked={isPublic}
                disabled={pending}
                aria-label="Public link"
                aria-describedby={`public-${asset.id}`}
                onCheckedChange={(checked) =>
                  void saveOptimistic({ isPublic: checked }, checked ? "Public link on." : "Public link off.")
                }
              />
            ) : null}
          </div>
          {isPublic ? (
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
                {fileUrl(asset.id)}
              </code>
              <CopyButton label="Copy link" value={() => window.location.origin + fileUrl(asset.id)} />
            </div>
          ) : null}
        </Block>
      )}

      <Block label="Used in">
        <Usage orgSlug={orgSlug} asset={asset} />
      </Block>

      <Block label="Details">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px]">
          {facts.map(([term, value]) => (
            <React.Fragment key={term}>
              <dt className="text-muted-foreground">{term}</dt>
              <dd className="min-w-0 break-words text-right">{value}</dd>
            </React.Fragment>
          ))}
        </dl>
      </Block>

      {permissions.remove ? (
        <div className="mt-auto flex flex-wrap gap-2 border-t border-border px-4 py-3">
          {trashed ? (
            <>
              <Button variant="outline" size="sm" onClick={onRestore}>
                <RotateCcw /> Restore
              </Button>
              <Button variant="destructive" size="sm" onClick={onPurge}>
                <Trash2 /> Delete permanently
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={onTrash}>
              <Trash2 /> Move to trash
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}
