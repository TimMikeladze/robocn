import "server-only"

import { del, get, put } from "@vercel/blob"

import type { StorageDriver } from "./index"

const path = (key: string) => `studio/${key}`

/**
 * Private blobs: the store never hands out a URL. Reads still go through
 * `/api/studio/assets/<id>/file`, so access control stays in one place.
 */
export const vercelBlobDriver: StorageDriver = {
  id: "vercel-blob",
  async put({ key, mime, bytes }) {
    await put(path(key), Buffer.from(bytes), {
      access: "private",
      contentType: mime,
      addRandomSuffix: false,
      allowOverwrite: true,
    })
  },
  async get(key) {
    const result = await get(path(key), { access: "private" })
    if (!result || result.statusCode !== 200) return null
    const bytes = new Uint8Array(await new Response(result.stream).arrayBuffer())
    return { bytes, mime: result.blob.contentType ?? "application/octet-stream" }
  },
  async delete(keys) {
    if (keys.length) await del(keys.map(path))
  },
}
