"use client"

import Link from "next/link"
import { Globe } from "lucide-react"

import { Pill, TimeAgo } from "@/components/studio/kit"
import { DesignPreview } from "@/components/studio/machine-view"
import type { Pose } from "@/lib/workbench/controls"

export interface DesignCardData {
  id: string
  name: string
  componentId: string
  currentVersionId: string | null
  versionNumber: number | null
  hasThumbnail: boolean
  pose: Pose | null
  published: boolean
  archived: boolean
  projectName: string | null
  updatedAt: Date | string
  stage: { name: string; color: string }
  labels: { id: string; name: string; color: string }[]
}

function DesignCard({ orgSlug, design }: { orgSlug: string; design: DesignCardData }) {
  return (
    <Link
      href={`/studio/${orgSlug}/designs/${design.id}`}
      className="group flex flex-col border border-border bg-panel outline-none transition-colors hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden border-b border-border bg-background">
        <DesignPreview
          versionId={design.currentVersionId}
          hasThumbnail={design.hasThumbnail}
          componentId={design.componentId}
          pose={design.pose ?? {}}
          size="sm"
          alt={design.name}
        />
        {design.published ? (
          <span
            title="Published"
            className="absolute right-2 top-2 inline-flex size-5 items-center justify-center rounded-full bg-background/90 text-emerald-600 ring-1 ring-border"
          >
            <Globe className="size-3" />
          </span>
        ) : null}
      </div>
      <div className="space-y-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-[13px] font-medium">{design.name}</p>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            v{design.versionNumber ?? 1}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Pill color={design.stage.color}>{design.archived ? "Archived" : design.stage.name}</Pill>
          {design.labels.slice(0, 2).map((label) => (
            <Pill key={label.id} color={label.color}>
              {label.name}
            </Pill>
          ))}
        </div>
        <p className="truncate font-mono text-[10px] text-muted-foreground">
          {design.componentId}
          {design.projectName ? ` · ${design.projectName}` : ""} · <TimeAgo date={design.updatedAt} />
        </p>
      </div>
    </Link>
  )
}

export { DesignCard }
