import "server-only"

import { eq, inArray } from "drizzle-orm"

import { db, schema } from "@/db"

import type { StorageDriver } from "./index"

/** Bytes in a `bytea` column. Fine to tens of megabytes a file, and nothing to set up. */
export const postgresDriver: StorageDriver = {
  id: "postgres",
  async put({ key, organizationId, mime, bytes }) {
    const row = { key, organizationId, mime, bytes: Buffer.from(bytes) }
    await db
      .insert(schema.assetBlob)
      .values(row)
      .onConflictDoUpdate({ target: schema.assetBlob.key, set: { mime, bytes: row.bytes } })
  },
  async get(key) {
    const [row] = await db
      .select({ bytes: schema.assetBlob.bytes, mime: schema.assetBlob.mime })
      .from(schema.assetBlob)
      .where(eq(schema.assetBlob.key, key))
      .limit(1)
    return row ? { bytes: new Uint8Array(row.bytes), mime: row.mime } : null
  },
  async delete(keys) {
    if (keys.length) await db.delete(schema.assetBlob).where(inArray(schema.assetBlob.key, keys))
  },
}
