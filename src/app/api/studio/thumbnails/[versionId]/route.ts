/**
 * A version's stage snapshot. Public when the version is the published one,
 * readable with `?t=<share token>` for that link's design, otherwise members
 * only. Version ids never change their picture, so it caches forever.
 */

import { and, eq, isNull } from "drizzle-orm"

import { db, schema } from "@/db"
import { errorResponse, fileResponse } from "@/lib/studio/serve"
import { getSession, StudioError } from "@/lib/studio/session"
import { activeDriver, driverFor } from "@/lib/studio/storage"

export async function GET(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const { versionId } = await params
    const missing = new StudioError("Not found.", 404)
    const [row] = await db
      .select({
        key: schema.designVersion.thumbnailKey,
        organizationId: schema.designVersion.organizationId,
        designId: schema.designVersion.designId,
        publishedVersionId: schema.design.publishedVersionId,
      })
      .from(schema.designVersion)
      .innerJoin(schema.design, eq(schema.design.id, schema.designVersion.designId))
      .where(eq(schema.designVersion.id, versionId))
      .limit(1)
    if (!row?.key) throw missing

    let allowed = row.publishedVersionId === versionId
    const token = new URL(request.url).searchParams.get("t")
    if (!allowed && token) {
      const [link] = await db
        .select({ expiresAt: schema.shareLink.expiresAt })
        .from(schema.shareLink)
        .where(
          and(
            eq(schema.shareLink.token, token),
            eq(schema.shareLink.designId, row.designId),
            isNull(schema.shareLink.revokedAt),
          ),
        )
      allowed = !!link && (!link.expiresAt || link.expiresAt.getTime() > Date.now())
    }
    if (!allowed) {
      const session = await getSession()
      if (!session) throw missing
      const [member] = await db
        .select({ id: schema.member.id })
        .from(schema.member)
        .where(
          and(
            eq(schema.member.organizationId, row.organizationId),
            eq(schema.member.userId, session.user.id),
          ),
        )
      if (!member) throw missing
    }

    // Thumbnails carry no driver column; try the active one, then the other.
    const stored =
      (await activeDriver().get(row.key)) ??
      (await driverFor(activeDriver().id === "postgres" ? "vercel-blob" : "postgres")
        .get(row.key)
        .catch(() => null))
    if (!stored) throw missing
    return fileResponse(
      { bytes: stored.bytes, mime: "image/webp", name: `${versionId}.webp` },
      { cache: "immutable" },
    )
  } catch (error) {
    return errorResponse(error)
  }
}
