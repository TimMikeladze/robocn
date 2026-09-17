"use client"

/** History. Versions are immutable, so everything here either reads one or writes a new one. */

import * as React from "react"
import { useRouter } from "next/navigation"
import { Globe, History, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { EditorDesign } from "@/components/studio/editor/editor"
import { Pill, TimeAgo, useAction } from "@/components/studio/kit"
import { publishDesign, restoreVersion } from "@/lib/studio/actions/designs"
import { can } from "@/lib/studio/permissions"
import { diffPose } from "@/lib/studio/pose"
import type { StageJson } from "@/db/schema/studio"
import type { Pose } from "@/lib/workbench/controls"

export interface VersionRow {
  id: string
  number: number
  note: string
  pose: Pose
  stage: StageJson
  hasThumbnail: boolean
  createdAt: Date | string
  authorName: string | null
}

function VersionsPanel({
  orgSlug,
  role,
  design,
  versions,
  onLoad,
}: {
  orgSlug: string
  role: string
  design: EditorDesign
  versions: VersionRow[]
  workingPose: Pose
  onLoad: (version: VersionRow) => void
}) {
  const router = useRouter()
  const { pending, call } = useAction()
  const [open, setOpen] = React.useState<string | null>(null)
  const canEdit = can(role, "design:update") && !design.archived
  const canPublish = can(role, "design:publish") && !design.archived

  return (
    <ol className="min-h-0 flex-1 overflow-y-auto">
      {versions.map((version, index) => {
        const previous = versions[index + 1]
        const changes = previous ? diffPose(previous.pose, version.pose) : []
        const isCurrent = version.id === design.currentVersionId
        const isLive = version.id === design.publishedVersionId
        const expanded = open === version.id
        return (
          <li key={version.id} className="border-b border-border/60">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : version.id)}
              className="flex w-full items-start gap-3 px-3 py-2.5 text-left outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent"
            >
              <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden border border-border bg-background">
                {version.hasThumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/studio/thumbnails/${version.id}`}
                    alt=""
                    loading="lazy"
                    className="size-full object-contain"
                  />
                ) : (
                  <History className="size-4 text-muted-foreground" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[12px] font-medium">v{version.number}</span>
                  {isCurrent ? <Pill>Current</Pill> : null}
                  {isLive ? <Pill color="#16a34a">Live</Pill> : null}
                </span>
                <span className="mt-0.5 block truncate text-[12px]">
                  {version.note || <span className="text-muted-foreground">No note</span>}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {version.authorName ?? "Someone"} · <TimeAgo date={version.createdAt} />
                  {previous ? ` · ${changes.length} change${changes.length === 1 ? "" : "s"}` : ""}
                </span>
              </span>
            </button>
            {expanded ? (
              <div className="space-y-2 px-3 pb-3">
                {changes.length ? (
                  <ul className="max-h-36 space-y-0.5 overflow-y-auto border border-border bg-background p-2 font-mono text-[11px] text-muted-foreground">
                    {changes.map((change) => (
                      <li key={change.name} className="truncate">
                        <span className="text-foreground">{change.name}</span>{" "}
                        {String(change.from ?? "default")} → {String(change.to ?? "default")}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {previous ? "Same props as the version before; the stage changed." : "Where it started."}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="outline" size="xs" onClick={() => onLoad(version)}>
                    <Upload /> Load on stage
                  </Button>
                  {canEdit && !isCurrent ? (
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={pending}
                      onClick={async () => {
                        const restored = await call(() => restoreVersion(orgSlug, design.id, version.id))
                        if (restored) {
                          router.refresh()
                          onLoad({ ...version, number: restored.number })
                        }
                      }}
                    >
                      <History /> Restore as newest
                    </Button>
                  ) : null}
                  {canPublish && !isLive ? (
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={pending}
                      onClick={async () => {
                        const ok = await call(() => publishDesign(orgSlug, design.id, version.id), {
                          success: `v${version.number} is live`,
                        })
                        if (ok) router.refresh()
                      }}
                    >
                      <Globe /> Publish this version
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

export { VersionsPanel }
