/**
 * What the public pages need from a published row, made safe to draw.
 *
 * A version's pose and stage are user data: written by a member, read by
 * strangers. The pose goes through `sanitizePose`; this is the same rule for
 * the stage, plus the plain, serializable card the galleries hand to the client.
 */

import { sanitizePose } from "@/lib/studio/pose"
import type { PublicCard } from "@/lib/studio/queries"
import { workbenchComponent, type Pose } from "@/lib/workbench/controls"

export const stageGrounds = ["panel", "grid", "blueprint", "checker", "dark"] as const
export type StageGround = (typeof stageGrounds)[number]

export interface StageView {
  background: StageGround
  zoom: number
}

/** A ground the stage knows and a zoom that keeps the machine on it. */
export function safeStage(input: unknown): StageView {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {}
  const background = stageGrounds.find((ground) => ground === raw.background) ?? "panel"
  const zoom =
    typeof raw.zoom === "number" && Number.isFinite(raw.zoom) ? Math.min(3, Math.max(0.25, raw.zoom)) : 1
  return { background, zoom }
}

/** `17 Sep 2026`, the same on the server and in every time zone. */
export const publishedOn = (date: Date | string | null | undefined) =>
  date
    ? new Date(date).toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: "UTC" })
    : null

export interface GalleryCard {
  slug: string
  name: string
  description: string
  componentId: string
  machine: string
  pose: Pose
  versionId: string
  hasThumbnail: boolean
  /** Already formatted: dates are the server's to print. */
  published: string | null
  orgName: string
  orgSlug: string
}

/** Rows whose machine has left the registry are dropped: there is nothing to draw. */
export function galleryCards(rows: PublicCard[]): GalleryCard[] {
  return rows.flatMap((row) => {
    const component = workbenchComponent(row.componentId)
    if (!component || !row.slug) return []
    return [
      {
        slug: row.slug,
        name: row.name,
        description: row.description,
        componentId: component.id,
        machine: component.title,
        pose: sanitizePose(component, row.pose),
        versionId: row.versionId,
        hasThumbnail: !!row.hasThumbnail,
        published: publishedOn(row.publishedAt),
        orgName: row.orgName,
        orgSlug: row.orgSlug,
      },
    ]
  })
}
