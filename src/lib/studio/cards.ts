import type { DesignCardData } from "@/components/studio/design-card"
import type { DesignCard } from "@/lib/studio/queries"
import { stageOf, type OrgSettings } from "@/lib/studio/settings"

/** A query row, resolved against the organization's workflow and labels, ready for a client card. */
export function toCard(
  row: DesignCard,
  settings: OrgSettings,
  labels: { id: string; name: string; color: string }[],
): DesignCardData {
  const stage = stageOf(settings, row.stage)
  return {
    id: row.id,
    name: row.name,
    componentId: row.componentId,
    currentVersionId: row.currentVersionId,
    versionNumber: row.versionNumber,
    hasThumbnail: !!row.hasThumbnail,
    pose: row.pose,
    published: !!row.publishedVersionId,
    archived: !!row.archivedAt,
    projectName: row.projectName,
    updatedAt: row.updatedAt,
    stage: { name: stage.name, color: stage.color },
    labels: labels.filter((label) => row.labelIds.includes(label.id)),
  }
}
