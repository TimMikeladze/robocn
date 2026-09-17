/**
 * Upload. Multipart, because a server action's body limit is the wrong ceiling
 * for a 25 MB file: `files` (one or many), `folderId`, and optionally
 * `replace=<assetId>` to put new bytes under an existing asset.
 */

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db, schema } from "@/db"
import { assertUploadable, ingest, replaceBytes } from "@/lib/studio/assets"
import { getAsset } from "@/lib/studio/queries"
import { record } from "@/lib/studio/record"
import { errorResponse } from "@/lib/studio/serve"
import { authorize, StudioError } from "@/lib/studio/session"

const MAX_FILES = 40

export async function POST(request: Request, { params }: { params: Promise<{ org: string }> }) {
  try {
    const { org } = await params
    const form = await request.formData()
    const files = form.getAll("files").filter((entry): entry is File => entry instanceof File)
    if (!files.length) throw new StudioError("No files were sent.", 400)
    if (files.length > MAX_FILES) throw new StudioError(`Upload at most ${MAX_FILES} files at a time.`, 400)
    files.forEach(assertUploadable)

    const replace = form.get("replace")
    if (typeof replace === "string" && replace) {
      const m = await authorize(org, "asset:update")
      const existing = await getAsset(m.org.id, replace)
      if (!existing) throw new StudioError("File not found.", 404)
      const file = files[0]
      const row = await replaceBytes(existing, {
        mime: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })
      await record(m, "asset.replaced", { type: "asset", id: row.id, name: row.name })
      revalidatePath(`/studio/${org}/assets`)
      return Response.json({ assets: [{ id: row.id, name: row.name }] })
    }

    const m = await authorize(org, "asset:create")
    const folder = form.get("folderId")
    let folderId: string | null = null
    if (typeof folder === "string" && folder) {
      const [found] = await db
        .select({ id: schema.assetFolder.id })
        .from(schema.assetFolder)
        .where(and(eq(schema.assetFolder.organizationId, m.org.id), eq(schema.assetFolder.id, folder)))
      if (!found) throw new StudioError("Folder not found.", 404)
      folderId = found.id
    }

    const assets = []
    for (const file of files) {
      const row = await ingest({
        organizationId: m.org.id,
        userId: m.user.id,
        folderId,
        name: file.name,
        mime: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })
      assets.push({ id: row.id, name: row.name })
    }
    await record(
      m,
      "asset.uploaded",
      { type: "asset", id: assets.length === 1 ? assets[0].id : null, name: assets[0].name },
      { count: assets.length },
    )
    revalidatePath(`/studio/${org}/assets`)
    return Response.json({ assets })
  } catch (error) {
    return errorResponse(error)
  }
}
