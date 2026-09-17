"use client"

/** Reference files: photos, briefs, exports — picked from the asset library, never copied out of it. */

import * as React from "react"
import { useRouter } from "next/navigation"
import { Download, File as FileIcon, Paperclip, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { AssetPicker } from "@/components/studio/assets/asset-picker"
import { useAction } from "@/components/studio/kit"
import { attachAssets, detachAsset } from "@/lib/studio/actions/designs"
import { formatBytes } from "@/lib/studio/asset-kinds"
import { can } from "@/lib/studio/permissions"

export interface FileRow {
  id: string
  name: string
  kind: string
  mime: string
  size: number
  width: number | null
  height: number | null
  hasThumbnail: boolean
}

function FilesPanel({
  orgSlug,
  role,
  designId,
  files,
}: {
  orgSlug: string
  role: string
  designId: string
  files: FileRow[]
}) {
  const router = useRouter()
  const { call } = useAction()
  const [picking, setPicking] = React.useState(false)
  const canEdit = can(role, "design:update")

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <span className="font-mono text-[11px] text-muted-foreground">
          {files.length} file{files.length === 1 ? "" : "s"}
        </span>
        {canEdit ? (
          <Button variant="outline" size="xs" onClick={() => setPicking(true)}>
            <Paperclip /> Attach
          </Button>
        ) : null}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <li className="px-3 py-8 text-center text-[13px] text-muted-foreground">
            Attach reference images, briefs or exports from the asset library.
          </li>
        ) : null}
        {files.map((file) => (
          <li key={file.id} className="flex items-center gap-2.5 border-b border-border/60 px-3 py-2">
            <a
              href={`/api/studio/assets/${file.id}/file`}
              target="_blank"
              rel="noreferrer"
              className="flex size-11 shrink-0 items-center justify-center overflow-hidden border border-border bg-background"
            >
              {file.hasThumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/studio/assets/${file.id}/file?thumb=1`}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              ) : (
                <FileIcon className="size-4 text-muted-foreground" />
              )}
            </a>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium">{file.name}</p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {formatBytes(file.size)}
                {file.width && file.height ? ` · ${file.width}×${file.height}` : ""}
              </p>
            </div>
            <a
              href={`/api/studio/assets/${file.id}/file?download=1`}
              aria-label={`Download ${file.name}`}
              className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Download className="size-3.5" />
            </a>
            {canEdit ? (
              <button
                type="button"
                aria-label={`Detach ${file.name}`}
                onClick={async () => {
                  const ok = await call(() => detachAsset(orgSlug, designId, file.id))
                  if (ok !== null) router.refresh()
                }}
                className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <AssetPicker
        orgSlug={orgSlug}
        open={picking}
        multiple
        canUpload={can(role, "asset:create")}
        onClose={() => setPicking(false)}
        onPick={async (picked) => {
          setPicking(false)
          const ok = await call(
            () =>
              attachAssets(
                orgSlug,
                designId,
                picked.map((asset) => asset.id),
              ),
            { success: `Attached ${picked.length} file${picked.length === 1 ? "" : "s"}` },
          )
          if (ok !== null) router.refresh()
        }}
      />
    </div>
  )
}

export { FilesPanel }
