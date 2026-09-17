"use server"

/**
 * The asset library's writes, minus the upload itself — files arrive as
 * multipart at `/api/studio/[org]/assets`, because a server action's body
 * limit is the wrong ceiling for a 25 MB file.
 */

import { and, eq, inArray, isNotNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db, schema } from "@/db"
import { run } from "@/lib/studio/action"
import { cleanFileName, cleanTags } from "@/lib/studio/asset-kinds"
import { purge } from "@/lib/studio/assets"
import { newId } from "@/lib/studio/ids"
import { assetUsage } from "@/lib/studio/queries"
import { record } from "@/lib/studio/record"
import { authorize, StudioError, type Membership } from "@/lib/studio/session"

const { asset, assetFolder } = schema

const ids = z.array(z.string()).min(1).max(500)
const touch = (orgSlug: string) => revalidatePath(`/studio/${orgSlug}/assets`)

async function folderIn(m: Membership, folderId: string | null) {
  if (!folderId) return null
  const [row] = await db
    .select()
    .from(assetFolder)
    .where(and(eq(assetFolder.organizationId, m.org.id), eq(assetFolder.id, folderId)))
  if (!row) throw new StudioError("Folder not found.", 404)
  return row
}

/* ------------------------------------------------------------------ assets */

const updateInput = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  tags: z.array(z.string()).max(40).optional(),
  isPublic: z.boolean().optional(),
})

export async function updateAsset(orgSlug: string, assetId: string, input: z.input<typeof updateInput>) {
  return run(async () => {
    const m = await authorize(orgSlug, "asset:update")
    const data = updateInput.parse(input)
    const [row] = await db
      .update(asset)
      .set({
        ...(data.name ? { name: cleanFileName(data.name) } : null),
        ...(data.description !== undefined ? { description: data.description } : null),
        ...(data.tags ? { tags: cleanTags(data.tags) } : null),
        ...(data.isPublic !== undefined ? { isPublic: data.isPublic } : null),
      })
      .where(and(eq(asset.organizationId, m.org.id), eq(asset.id, assetId)))
      .returning({ id: asset.id })
    if (!row) throw new StudioError("File not found.", 404)
    touch(orgSlug)
  })
}

export async function moveAssets(orgSlug: string, assetIds: string[], folderId: string | null) {
  return run(async () => {
    const m = await authorize(orgSlug, "asset:update")
    await folderIn(m, folderId)
    await db
      .update(asset)
      .set({ folderId })
      .where(and(eq(asset.organizationId, m.org.id), inArray(asset.id, ids.parse(assetIds))))
    touch(orgSlug)
  })
}

/** Add and remove tags across a selection without disturbing the rest of each file's tags. */
export async function tagAssets(
  orgSlug: string,
  assetIds: string[],
  change: { add?: string[]; remove?: string[] },
) {
  return run(async () => {
    const m = await authorize(orgSlug, "asset:update")
    const add = cleanTags(change.add ?? [])
    const remove = new Set(cleanTags(change.remove ?? []))
    const rows = await db
      .select({ id: asset.id, tags: asset.tags })
      .from(asset)
      .where(and(eq(asset.organizationId, m.org.id), inArray(asset.id, ids.parse(assetIds))))
    await db.transaction(async (tx) => {
      for (const row of rows) {
        const tags = cleanTags([...row.tags.filter((tag) => !remove.has(tag)), ...add])
        await tx.update(asset).set({ tags }).where(eq(asset.id, row.id))
      }
    })
    touch(orgSlug)
  })
}

export async function trashAssets(orgSlug: string, assetIds: string[]) {
  return run(async () => {
    const m = await authorize(orgSlug, "asset:delete")
    const rows = await db
      .update(asset)
      .set({ deletedAt: new Date() })
      .where(and(eq(asset.organizationId, m.org.id), inArray(asset.id, ids.parse(assetIds))))
      .returning({ name: asset.name })
    if (rows.length) {
      await record(
        m,
        "asset.trashed",
        { type: "asset", id: null, name: rows.length === 1 ? rows[0].name : `${rows.length} files` },
      )
    }
    touch(orgSlug)
    return { count: rows.length }
  })
}

export async function restoreAssets(orgSlug: string, assetIds: string[]) {
  return run(async () => {
    const m = await authorize(orgSlug, "asset:delete")
    const rows = await db
      .update(asset)
      .set({ deletedAt: null })
      .where(and(eq(asset.organizationId, m.org.id), inArray(asset.id, ids.parse(assetIds))))
      .returning({ name: asset.name })
    if (rows.length) {
      await record(
        m,
        "asset.restored",
        { type: "asset", id: null, name: rows.length === 1 ? rows[0].name : `${rows.length} files` },
      )
    }
    touch(orgSlug)
  })
}

/** Permanent. Only ever from the trash: a file has to be thrown away before it can be destroyed. */
export async function purgeAssets(orgSlug: string, assetIds: string[] | "all") {
  return run(async () => {
    const m = await authorize(orgSlug, "asset:delete")
    const trashed = await db
      .select({ id: asset.id })
      .from(asset)
      .where(
        and(
          eq(asset.organizationId, m.org.id),
          isNotNull(asset.deletedAt),
          assetIds === "all" ? undefined : inArray(asset.id, ids.parse(assetIds)),
        ),
      )
    const count = await purge(
      m.org.id,
      trashed.map((row) => row.id),
    )
    if (count) {
      await record(m, "asset.purged", { type: "asset", id: null, name: `${count} file${count === 1 ? "" : "s"}` })
    }
    touch(orgSlug)
    return { count }
  })
}

export async function getAssetUsage(orgSlug: string, assetId: string) {
  return run(async () => {
    const m = await authorize(orgSlug)
    return assetUsage(m.org.id, assetId)
  })
}

/* ----------------------------------------------------------------- folders */

const folderName = z.string().trim().min(1, "Name the folder.").max(60)

export async function createFolder(orgSlug: string, name: string, parentId: string | null) {
  return run(async () => {
    const m = await authorize(orgSlug, "asset:create")
    await folderIn(m, parentId)
    const id = newId("fld")
    await db.insert(assetFolder).values({
      id,
      organizationId: m.org.id,
      parentId,
      name: folderName.parse(name),
      createdBy: m.user.id,
    })
    touch(orgSlug)
    return { id }
  })
}

export async function renameFolder(orgSlug: string, folderId: string, name: string) {
  return run(async () => {
    const m = await authorize(orgSlug, "asset:update")
    await db
      .update(assetFolder)
      .set({ name: folderName.parse(name) })
      .where(and(eq(assetFolder.organizationId, m.org.id), eq(assetFolder.id, folderId)))
    touch(orgSlug)
  })
}

/** A folder cannot move into itself or anything beneath it. */
export async function moveFolder(orgSlug: string, folderId: string, parentId: string | null) {
  return run(async () => {
    const m = await authorize(orgSlug, "asset:update")
    await folderIn(m, folderId)
    const all = await db
      .select({ id: assetFolder.id, parentId: assetFolder.parentId })
      .from(assetFolder)
      .where(eq(assetFolder.organizationId, m.org.id))
    const parents = new Map(all.map((row) => [row.id, row.parentId]))
    if (parentId && !parents.has(parentId)) throw new StudioError("Folder not found.", 404)
    for (let at: string | null = parentId, hops = 0; at && hops < 64; at = parents.get(at) ?? null, hops++) {
      if (at === folderId) throw new StudioError("A folder cannot be moved inside itself.", 409)
    }
    await db.update(assetFolder).set({ parentId }).where(eq(assetFolder.id, folderId))
    touch(orgSlug)
  })
}

/**
 * Deleting a folder deletes the folders inside it (the foreign key cascades)
 * and drops every file in the tree to the root — `on delete set null` — rather
 * than destroying anything. Files are only ever destroyed from the trash.
 */
export async function deleteFolder(orgSlug: string, folderId: string) {
  return run(async () => {
    const m = await authorize(orgSlug, "asset:delete")
    await db
      .delete(assetFolder)
      .where(and(eq(assetFolder.organizationId, m.org.id), eq(assetFolder.id, folderId)))
    touch(orgSlug)
  })
}
