/**
 * An asset's bytes. `?thumb=1` for the WebP thumbnail, `?download=1` to force a
 * save. Readable by members of the owning organization, or by anyone when the
 * asset has been made public.
 */

import { and, eq } from "drizzle-orm"

import { db, schema } from "@/db"
import { errorResponse, fileResponse } from "@/lib/studio/serve"
import { getSession, StudioError } from "@/lib/studio/session"
import { driverFor } from "@/lib/studio/storage"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const [asset] = await db.select().from(schema.asset).where(eq(schema.asset.id, id)).limit(1)
    // The same answer for "missing" and "not yours": an id is not an oracle.
    const missing = new StudioError("File not found.", 404)
    if (!asset) throw missing

    const open = asset.isPublic && !asset.deletedAt
    if (!open) {
      const session = await getSession()
      if (!session) throw missing
      const [member] = await db
        .select({ id: schema.member.id })
        .from(schema.member)
        .where(
          and(
            eq(schema.member.organizationId, asset.organizationId),
            eq(schema.member.userId, session.user.id),
          ),
        )
      if (!member) throw missing
    }

    const thumb = url.searchParams.get("thumb") === "1" && asset.thumbnailKey
    const stored = await driverFor(asset.driver).get(thumb ? asset.thumbnailKey! : asset.storageKey)
    if (!stored) throw missing
    return fileResponse(
      {
        bytes: stored.bytes,
        mime: thumb ? "image/webp" : asset.mime,
        name: thumb ? `${asset.name}.webp` : asset.name,
      },
      { download: url.searchParams.get("download") === "1", cache: open ? "public" : "private" },
    )
  } catch (error) {
    return errorResponse(error)
  }
}
