/**
 * Getting a file into the library and out again.
 *
 * `ingest` is the only writer: it measures, thumbnails, stores and records, in
 * that order, so a row never points at bytes that are not there. Callers have
 * already authorized; nothing here reads a session.
 */

import "server-only"

import { createHash } from "node:crypto"

import { and, eq, inArray, sql } from "drizzle-orm"
import sharp from "sharp"

import { db, schema } from "@/db"
import { cleanFileName, kindOf, MAX_ASSET_BYTES } from "@/lib/studio/asset-kinds"
import { newId } from "@/lib/studio/ids"
import { StudioError } from "@/lib/studio/session"
import { activeDriver, driverFor } from "@/lib/studio/storage"

const THUMBNAIL_EDGE = 480

interface Measured {
  width: number | null
  height: number | null
  thumbnail: Uint8Array | null
}

/** Dimensions and a WebP thumbnail, for anything sharp can read. A file it cannot is still a file. */
async function measure(bytes: Uint8Array, mime: string): Promise<Measured> {
  if (!mime.startsWith("image/")) return { width: null, height: null, thumbnail: null }
  try {
    const image = sharp(bytes, { limitInputPixels: 80_000_000, animated: false })
    const meta = await image.metadata()
    const thumbnail = await image
      .rotate()
      .resize(THUMBNAIL_EDGE, THUMBNAIL_EDGE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer()
    return {
      width: meta.width ?? null,
      height: meta.height ?? null,
      thumbnail: new Uint8Array(thumbnail),
    }
  } catch {
    return { width: null, height: null, thumbnail: null }
  }
}

export function assertUploadable(file: { size: number; name: string }) {
  if (file.size === 0) throw new StudioError(`${file.name} is empty.`, 400)
  if (file.size > MAX_ASSET_BYTES) {
    throw new StudioError(`${file.name} is over the 25 MB limit.`, 413)
  }
}

async function store(organizationId: string, bytes: Uint8Array, mime: string) {
  const driver = activeDriver()
  const measured = await measure(bytes, mime)
  const storageKey = `${organizationId}/${newId("obj")}`
  const thumbnailKey = measured.thumbnail ? `${storageKey}.thumb` : null
  await driver.put({ key: storageKey, organizationId, mime, bytes })
  if (measured.thumbnail && thumbnailKey) {
    await driver.put({
      key: thumbnailKey,
      organizationId,
      mime: "image/webp",
      bytes: measured.thumbnail,
    })
  }
  return {
    driver: driver.id,
    storageKey,
    thumbnailKey,
    width: measured.width,
    height: measured.height,
    checksum: createHash("sha256").update(bytes).digest("hex"),
  }
}

export async function ingest(input: {
  organizationId: string
  userId: string
  folderId: string | null
  name: string
  mime: string
  bytes: Uint8Array
}) {
  const mime = input.mime || "application/octet-stream"
  const stored = await store(input.organizationId, input.bytes, mime)
  const [row] = await db
    .insert(schema.asset)
    .values({
      id: newId("ast"),
      organizationId: input.organizationId,
      folderId: input.folderId,
      name: cleanFileName(input.name),
      kind: kindOf(mime),
      mime,
      size: input.bytes.byteLength,
      createdBy: input.userId,
      ...stored,
    })
    .returning()
  return row
}

/** New bytes under the same id, so every design that references the asset picks them up. */
export async function replaceBytes(
  existing: typeof schema.asset.$inferSelect,
  input: { mime: string; bytes: Uint8Array },
) {
  const mime = input.mime || existing.mime
  const stored = await store(existing.organizationId, input.bytes, mime)
  const [row] = await db
    .update(schema.asset)
    .set({ ...stored, mime, kind: kindOf(mime), size: input.bytes.byteLength })
    .where(eq(schema.asset.id, existing.id))
    .returning()
  await driverFor(existing.driver).delete(
    [existing.storageKey, existing.thumbnailKey].filter((key): key is string => !!key),
  )
  return row
}

/** Rows and bytes, gone. Grouped by driver because a library can straddle two. */
export async function purge(organizationId: string, ids: string[]) {
  if (!ids.length) return 0
  const rows = await db
    .delete(schema.asset)
    .where(and(eq(schema.asset.organizationId, organizationId), inArray(schema.asset.id, ids)))
    .returning({
      driver: schema.asset.driver,
      storageKey: schema.asset.storageKey,
      thumbnailKey: schema.asset.thumbnailKey,
    })
  const byDriver = new Map<string, string[]>()
  for (const row of rows) {
    const keys = byDriver.get(row.driver) ?? []
    keys.push(row.storageKey, ...(row.thumbnailKey ? [row.thumbnailKey] : []))
    byDriver.set(row.driver, keys)
  }
  await Promise.all([...byDriver].map(([driver, keys]) => driverFor(driver).delete(keys)))
  return rows.length
}

export async function storageUsed(organizationId: string) {
  const [row] = await db
    .select({
      bytes: sql<number>`coalesce(sum(${schema.asset.size}), 0)::float8`,
      files: sql<number>`count(*)::int`,
    })
    .from(schema.asset)
    .where(eq(schema.asset.organizationId, organizationId))
  return { bytes: Number(row?.bytes ?? 0), files: row?.files ?? 0 }
}
