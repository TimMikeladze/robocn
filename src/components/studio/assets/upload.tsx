"use client"

/**
 * Uploading. One request per file, so a file that fails takes nothing else
 * with it, and `XMLHttpRequest` rather than `fetch` because it is still the
 * only thing that reports how much of a body has gone out.
 */

import * as React from "react"
import { AlertCircle, Check, ChevronDown, Loader2, Upload, X } from "lucide-react"
import { toast } from "sonner"

import { eyebrow } from "@/components/studio/kit"
import { formatBytes, MAX_ASSET_BYTES } from "@/lib/studio/asset-kinds"
import { cn } from "@/lib/utils"

const CONCURRENCY = 3

export interface UploadItem {
  key: number
  name: string
  size: number
  /** 0–1 of the request body sent. The server still has to thumbnail and store after 1. */
  progress: number
  status: "queued" | "uploading" | "done" | "error" | "cancelled"
  error?: string
}

export interface UploadTarget {
  folderId?: string | null
  /** Put the bytes under this asset instead of making a new one. */
  replace?: string
}

export interface UploadedAsset {
  id: string
  name: string
}

/** Why a file cannot be sent, or `null` when it can. The server checks again. */
export function uploadProblem(file: { size: number }) {
  if (file.size === 0) return "This file is empty."
  if (file.size > MAX_ASSET_BYTES) return `Over the ${formatBytes(MAX_ASSET_BYTES)} limit.`
  return null
}

export function useUploads(orgSlug: string, onSettled?: (uploaded: UploadedAsset[]) => void) {
  const [items, setItems] = React.useState<UploadItem[]>([])
  const nextKey = React.useRef(1)
  const requests = React.useRef(new Map<number, XMLHttpRequest>())

  const patch = (key: number, change: Partial<UploadItem>) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item)))

  function send(key: number, file: File, target: UploadTarget) {
    return new Promise<UploadedAsset[]>((resolve) => {
      const body = new FormData()
      body.append("files", file)
      if (target.folderId) body.append("folderId", target.folderId)
      if (target.replace) body.append("replace", target.replace)

      const request = new XMLHttpRequest()
      requests.current.set(key, request)
      const finish = (change: Partial<UploadItem>, uploaded: UploadedAsset[] = []) => {
        requests.current.delete(key)
        patch(key, change)
        resolve(uploaded)
      }
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) patch(key, { progress: event.loaded / event.total })
      }
      request.onload = () => {
        let answer: { assets?: UploadedAsset[]; error?: string } = {}
        try {
          answer = JSON.parse(request.responseText)
        } catch {
          // A proxy's HTML error page, most likely; the status says enough.
        }
        if (request.status >= 200 && request.status < 300 && answer.assets) {
          finish({ status: "done", progress: 1 }, answer.assets)
        } else {
          finish({
            status: "error",
            error: answer.error ?? (request.status === 413 ? "Too large." : "The upload failed."),
          })
        }
      }
      request.onerror = () => finish({ status: "error", error: "The connection dropped." })
      request.onabort = () => finish({ status: "cancelled" })
      request.open("POST", `/api/studio/${encodeURIComponent(orgSlug)}/assets`)
      request.responseType = "text"
      patch(key, { status: "uploading" })
      request.send(body)
    })
  }

  async function enqueue(files: readonly File[], target: UploadTarget = {}) {
    if (!files.length) return []
    const entries = files.map((file) => ({ key: nextKey.current++, file, problem: uploadProblem(file) }))
    setItems((current) => [
      ...current,
      ...entries.map(({ key, file, problem }): UploadItem => ({
        key,
        name: file.name,
        size: file.size,
        progress: 0,
        status: problem ? "error" : "queued",
        error: problem ?? undefined,
      })),
    ])

    const queue = entries.filter((entry) => !entry.problem)
    const uploaded: UploadedAsset[] = []
    const worker = async () => {
      for (let entry = queue.shift(); entry; entry = queue.shift()) {
        uploaded.push(...(await send(entry.key, entry.file, target)))
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))

    const failed = entries.length - uploaded.length
    if (uploaded.length) {
      toast.success(
        target.replace
          ? "File replaced."
          : `${uploaded.length} file${uploaded.length === 1 ? "" : "s"} uploaded.`,
      )
    }
    if (failed && !uploaded.length) toast.error(failed === 1 ? "The upload failed." : "The uploads failed.")
    onSettled?.(uploaded)
    return uploaded
  }

  const cancel = (key: number) => requests.current.get(key)?.abort()
  const clear = () =>
    setItems((current) => current.filter((item) => item.status === "queued" || item.status === "uploading"))
  const active = items.some((item) => item.status === "queued" || item.status === "uploading")

  return { items, active, enqueue, cancel, clear }
}

export type Uploads = ReturnType<typeof useUploads>

/** A hidden file input and the function that opens it. */
export function useFilePicker(
  onFiles: (files: File[]) => void,
  options: { multiple?: boolean; accept?: string } = {},
) {
  const ref = React.useRef<HTMLInputElement>(null)
  const input = (
    <input
      ref={ref}
      type="file"
      hidden
      tabIndex={-1}
      multiple={options.multiple}
      accept={options.accept}
      onChange={(event) => {
        const files = [...(event.target.files ?? [])]
        // Cleared so choosing the same file twice still fires a change.
        event.target.value = ""
        if (files.length) onFiles(files)
      }}
    />
  )
  return { input, open: () => ref.current?.click() }
}

function StatusIcon({ status }: { status: UploadItem["status"] }) {
  if (status === "done") return <Check aria-hidden className="size-3.5 text-emerald-600 dark:text-emerald-400" />
  if (status === "error") return <AlertCircle aria-hidden className="size-3.5 text-destructive" />
  if (status === "cancelled") return <X aria-hidden className="size-3.5 text-muted-foreground" />
  return <Loader2 aria-hidden className="size-3.5 animate-spin text-muted-foreground" />
}

const statusText = (item: UploadItem) =>
  ({
    queued: "Waiting",
    uploading: item.progress >= 1 ? "Processing…" : `${Math.round(item.progress * 100)}%`,
    done: "Done",
    error: item.error ?? "Failed",
    cancelled: "Cancelled",
  })[item.status]

export function UploadList({ uploads, className }: { uploads: Uploads; className?: string }) {
  return (
    <ul className={cn("divide-y divide-border", className)}>
      {uploads.items.map((item) => (
        <li key={item.key} className="px-3 py-2">
          <div className="flex items-center gap-2">
            <StatusIcon status={item.status} />
            <span className="min-w-0 flex-1 truncate text-[12px]" title={item.name}>
              {item.name}
            </span>
            <span
              className={cn(
                "shrink-0 text-[11px] tabular-nums text-muted-foreground",
                item.status === "error" && "text-destructive",
              )}
            >
              {statusText(item)}
            </span>
            {item.status === "uploading" || item.status === "queued" ? (
              <button
                type="button"
                onClick={() => uploads.cancel(item.key)}
                disabled={item.status === "queued"}
                aria-label={`Cancel uploading ${item.name}`}
                className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
              >
                <X className="size-3" />
              </button>
            ) : null}
          </div>
          {item.status === "uploading" || item.status === "queued" ? (
            <div
              role="progressbar"
              aria-label={`Uploading ${item.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(item.progress * 100)}
              className="mt-1.5 h-0.5 w-full bg-border"
            >
              <div
                className="h-full bg-foreground transition-[width] duration-150"
                style={{ width: `${Math.round(item.progress * 100)}%` }}
              />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/** The floating record of a batch: what went, what is going, what did not. */
export function UploadTray({ uploads }: { uploads: Uploads }) {
  const [collapsed, setCollapsed] = React.useState(false)
  if (!uploads.items.length) return null
  const done = uploads.items.filter((item) => item.status === "done").length
  const failed = uploads.items.filter((item) => item.status === "error").length

  return (
    <section
      aria-label="Uploads"
      className="fixed inset-x-4 bottom-20 z-40 border border-border bg-panel shadow-xl sm:left-auto sm:w-80"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <p className={cn(eyebrow, "min-w-0 flex-1 truncate")} aria-live="polite">
          {uploads.active
            ? `Uploading · ${done} of ${uploads.items.length}`
            : `${done} uploaded${failed ? ` · ${failed} failed` : ""}`}
        </p>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Show uploads" : "Hide uploads"}
          className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronDown className={cn("size-3.5 transition-transform", collapsed && "rotate-180")} />
        </button>
        {uploads.active ? null : (
          <button
            type="button"
            onClick={uploads.clear}
            aria-label="Dismiss uploads"
            className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {collapsed ? null : <UploadList uploads={uploads} className="max-h-56 overflow-y-auto" />}
    </section>
  )
}

/** Shown while files are dragged over the library. It never takes the pointer, so the drop lands beneath it. */
export function DropOverlay({ label }: { label: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-2 border-2 border-dashed border-foreground/60 bg-panel px-8 py-12 text-center">
        <Upload className="size-6" />
        <p className="text-[15px] font-medium">Drop to upload</p>
        <p className="text-[13px] text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
