"use server"

/**
 * Everything that changes a design. Each export is a public POST endpoint, so
 * each one authorizes first, validates second, and scopes every statement by
 * the organization it just resolved. `docs/studio.md` has the model.
 */

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import sharp from "sharp"
import { z } from "zod"

import { db, schema } from "@/db"
import { run } from "@/lib/studio/action"
import { record } from "@/lib/studio/record"
import { newId, newToken, uniqueSlug } from "@/lib/studio/ids"
import { can } from "@/lib/studio/permissions"
import { applyPalette, sanitizePose } from "@/lib/studio/pose"
import { getDesign, getPublished } from "@/lib/studio/queries"
import { authorize, StudioError, type Membership } from "@/lib/studio/session"
import { stageBackgroundIds, stageOf } from "@/lib/studio/settings"
import { activeDriver } from "@/lib/studio/storage"
import { workbenchComponent } from "@/lib/workbench/controls"

const { design, designVersion, comment, shareLink, designAsset } = schema

const name = z.string().trim().min(1, "Give it a name.").max(80)
const stageView = z.object({
  background: z.enum(stageBackgroundIds),
  zoom: z.number().min(0.25).max(4),
})

const touch = (orgSlug: string, designId?: string) => {
  revalidatePath(`/studio/${orgSlug}`, "layout")
  if (designId) revalidatePath(`/studio/${orgSlug}/designs/${designId}`)
}

async function owned(m: Membership, designId: string) {
  const row = await getDesign(m.org.id, designId)
  if (!row) throw new StudioError("Design not found.", 404)
  return row
}

function machine(componentId: string) {
  const component = workbenchComponent(componentId)
  if (!component || component.draft) throw new StudioError("That machine is not in the registry.", 400)
  return component
}

/** PNG data URL from the editor's stage, re-encoded so what is stored is provably an image. */
async function storeThumbnail(organizationId: string, dataUrl: string | undefined) {
  if (!dataUrl) return null
  const match = /^data:image\/(png|webp|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match || match[2].length > 1_400_000) return null
  try {
    const bytes = await sharp(Buffer.from(match[2], "base64"), { limitInputPixels: 16_000_000 })
      .resize(960, 960, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()
    const key = `${organizationId}/thumb/${newId("thm")}`
    await activeDriver().put({ key, organizationId, mime: "image/webp", bytes: new Uint8Array(bytes) })
    return key
  } catch {
    return null
  }
}

async function nextNumber(designId: string) {
  const [row] = await db
    .select({ n: sql<number>`coalesce(max(${designVersion.number}), 0)::int` })
    .from(designVersion)
    .where(eq(designVersion.designId, designId))
  return (row?.n ?? 0) + 1
}

/* ------------------------------------------------------------------ create */

const createInput = z.object({
  name,
  componentId: z.string().min(1).max(80),
  projectId: z.string().nullable().optional(),
  pose: z.record(z.string(), z.unknown()).optional(),
})

export async function createDesign(orgSlug: string, input: z.input<typeof createInput>) {
  return run(async () => {
    const m = await authorize(orgSlug, "design:create")
    const data = createInput.parse(input)
    const component = machine(data.componentId)

    let pose = sanitizePose(component, data.pose ?? {})
    const paletteId = m.org.settings.defaults.paletteId
    if (paletteId && !data.pose) {
      const [palette] = await db
        .select()
        .from(schema.palette)
        .where(and(eq(schema.palette.organizationId, m.org.id), eq(schema.palette.id, paletteId)))
      if (palette) pose = applyPalette(component, pose, palette.colors)
    }
    if (data.projectId) {
      const [found] = await db
        .select({ id: schema.project.id })
        .from(schema.project)
        .where(and(eq(schema.project.organizationId, m.org.id), eq(schema.project.id, data.projectId)))
      if (!found) throw new StudioError("Project not found.", 404)
    }

    const id = newId("dsn")
    const versionId = newId("ver")
    await db.transaction(async (tx) => {
      await tx.insert(design).values({
        id,
        organizationId: m.org.id,
        projectId: data.projectId ?? null,
        name: data.name,
        componentId: component.id,
        stage: m.org.settings.workflow[0].id,
        currentVersionId: versionId,
        createdBy: m.user.id,
      })
      await tx.insert(designVersion).values({
        id: versionId,
        organizationId: m.org.id,
        designId: id,
        number: 1,
        note: "Created",
        pose,
        stage: { background: m.org.settings.defaults.background, zoom: 1 },
        createdBy: m.user.id,
      })
    })
    await record(m, "design.created", { type: "design", id, name: data.name })
    touch(orgSlug)
    return { id }
  })
}

/** A published design, copied into this organization as version 1 of something new. */
export async function forkPublished(orgSlug: string, publicSlug: string) {
  return run(async () => {
    const m = await authorize(orgSlug, "design:create")
    const source = await getPublished(publicSlug)
    if (!source) throw new StudioError("That design is no longer published.", 404)
    const component = machine(source.componentId)

    const id = newId("dsn")
    const versionId = newId("ver")
    await db.transaction(async (tx) => {
      await tx.insert(design).values({
        id,
        organizationId: m.org.id,
        name: source.name,
        description: source.description,
        componentId: component.id,
        stage: m.org.settings.workflow[0].id,
        currentVersionId: versionId,
        // Only a same-organization fork keeps the pointer; a foreign id would be a leak.
        forkedFromId: source.orgId === m.org.id ? source.id : null,
        createdBy: m.user.id,
      })
      await tx.insert(designVersion).values({
        id: versionId,
        organizationId: m.org.id,
        designId: id,
        number: 1,
        note: `Forked from ${source.orgName} / ${source.name}`,
        pose: sanitizePose(component, source.pose),
        stage: source.stageView,
        createdBy: m.user.id,
      })
    })
    await record(m, "design.forked", { type: "design", id, name: source.name })
    touch(orgSlug)
    return { id }
  })
}

export async function duplicateDesign(orgSlug: string, designId: string) {
  return run(async () => {
    const m = await authorize(orgSlug, "design:create")
    const source = await owned(m, designId)
    const [current] = await db
      .select()
      .from(designVersion)
      .where(eq(designVersion.id, source.currentVersionId ?? ""))
    const id = newId("dsn")
    const versionId = newId("ver")
    const copyName = `${source.name} copy`.slice(0, 80)
    await db.transaction(async (tx) => {
      await tx.insert(design).values({
        id,
        organizationId: m.org.id,
        projectId: source.projectId,
        name: copyName,
        description: source.description,
        componentId: source.componentId,
        stage: m.org.settings.workflow[0].id,
        labelIds: source.labelIds,
        currentVersionId: versionId,
        forkedFromId: source.id,
        createdBy: m.user.id,
      })
      await tx.insert(designVersion).values({
        id: versionId,
        organizationId: m.org.id,
        designId: id,
        number: 1,
        note: `Duplicated from ${source.name}`,
        pose: current?.pose ?? {},
        stage: current?.stage ?? { background: "panel", zoom: 1 },
        thumbnailKey: null,
        createdBy: m.user.id,
      })
    })
    await record(m, "design.forked", { type: "design", id, name: copyName })
    touch(orgSlug)
    return { id }
  })
}

/* ---------------------------------------------------------------- versions */

const saveInput = z.object({
  pose: z.record(z.string(), z.unknown()),
  stage: stageView,
  note: z.string().trim().max(280).default(""),
  thumbnail: z.string().optional(),
})

export async function saveVersion(
  orgSlug: string,
  designId: string,
  input: z.input<typeof saveInput>,
) {
  return run(async () => {
    const m = await authorize(orgSlug, "design:update")
    const row = await owned(m, designId)
    const data = saveInput.parse(input)
    const pose = sanitizePose(machine(row.componentId), data.pose)
    const thumbnailKey = await storeThumbnail(m.org.id, data.thumbnail)

    const versionId = newId("ver")
    const number = await db.transaction(async (tx) => {
      // The design row is the lock: two people saving at once get consecutive numbers, not a collision.
      await tx.execute(sql`select 1 from ${design} where ${design.id} = ${designId} for update`)
      const [last] = await tx
        .select({ n: sql<number>`coalesce(max(${designVersion.number}), 0)::int` })
        .from(designVersion)
        .where(eq(designVersion.designId, designId))
      const next = (last?.n ?? 0) + 1
      await tx.insert(designVersion).values({
        id: versionId,
        organizationId: m.org.id,
        designId,
        number: next,
        note: data.note,
        pose,
        stage: data.stage,
        thumbnailKey,
        createdBy: m.user.id,
      })
      await tx
        .update(design)
        .set({ currentVersionId: versionId, updatedAt: new Date() })
        .where(eq(design.id, designId))
      return next
    })
    await record(m, "design.saved", { type: "design", id: designId, name: row.name }, { number })
    touch(orgSlug, designId)
    return { versionId, number }
  })
}

/** Restoring never rewrites history: it saves the old pose as the newest version. */
export async function restoreVersion(orgSlug: string, designId: string, versionId: string) {
  return run(async () => {
    const m = await authorize(orgSlug, "design:update")
    const row = await owned(m, designId)
    const [source] = await db
      .select()
      .from(designVersion)
      .where(and(eq(designVersion.id, versionId), eq(designVersion.designId, designId)))
    if (!source) throw new StudioError("Version not found.", 404)
    const id = newId("ver")
    const number = await nextNumber(designId)
    await db.transaction(async (tx) => {
      await tx.insert(designVersion).values({
        id,
        organizationId: m.org.id,
        designId,
        number,
        note: `Restored v${source.number}`,
        pose: source.pose,
        stage: source.stage,
        thumbnailKey: source.thumbnailKey,
        createdBy: m.user.id,
      })
      await tx
        .update(design)
        .set({ currentVersionId: id, updatedAt: new Date() })
        .where(eq(design.id, designId))
    })
    await record(
      m,
      "design.restored",
      { type: "design", id: designId, name: row.name },
      { from: source.number },
    )
    touch(orgSlug, designId)
    return { versionId: id, number }
  })
}

/* ---------------------------------------------------------------- metadata */

const updateInput = z.object({
  name: name.optional(),
  description: z.string().trim().max(2000).optional(),
  projectId: z.string().nullable().optional(),
  stage: z.string().optional(),
  labelIds: z.array(z.string()).max(12).optional(),
})

export async function updateDesign(
  orgSlug: string,
  designId: string,
  input: z.input<typeof updateInput>,
) {
  return run(async () => {
    const m = await authorize(orgSlug, "design:update")
    const row = await owned(m, designId)
    const data = updateInput.parse(input)

    if (data.stage && !m.org.settings.workflow.some((stage) => stage.id === data.stage)) {
      throw new StudioError("That stage is not in this organization's workflow.", 400)
    }
    if (data.projectId) {
      const [found] = await db
        .select({ id: schema.project.id })
        .from(schema.project)
        .where(and(eq(schema.project.organizationId, m.org.id), eq(schema.project.id, data.projectId)))
      if (!found) throw new StudioError("Project not found.", 404)
    }
    if (data.labelIds?.length) {
      const found = await db
        .select({ id: schema.label.id })
        .from(schema.label)
        .where(and(eq(schema.label.organizationId, m.org.id), inArray(schema.label.id, data.labelIds)))
      data.labelIds = found.map((label) => label.id)
    }

    await db
      .update(design)
      .set(data)
      .where(and(eq(design.organizationId, m.org.id), eq(design.id, designId)))

    if (data.name && data.name !== row.name) {
      await record(m, "design.renamed", { type: "design", id: designId, name: data.name })
    }
    if (data.stage && data.stage !== row.stage) {
      await record(
        m,
        "design.staged",
        { type: "design", id: designId, name: data.name ?? row.name },
        { to: stageOf(m.org.settings, data.stage).name },
      )
    }
    touch(orgSlug, designId)
  })
}

export async function setArchived(orgSlug: string, designId: string, archived: boolean) {
  return run(async () => {
    const m = await authorize(orgSlug, "design:update")
    const row = await owned(m, designId)
    await db
      .update(design)
      .set({ archivedAt: archived ? new Date() : null })
      .where(and(eq(design.organizationId, m.org.id), eq(design.id, designId)))
    await record(m, archived ? "design.archived" : "design.unarchived", {
      type: "design",
      id: designId,
      name: row.name,
    })
    touch(orgSlug, designId)
  })
}

export async function deleteDesign(orgSlug: string, designId: string) {
  return run(async () => {
    const m = await authorize(orgSlug, "design:delete")
    const row = await owned(m, designId)
    const thumbs = await db
      .select({ key: designVersion.thumbnailKey })
      .from(designVersion)
      .where(eq(designVersion.designId, designId))
    await db.delete(design).where(and(eq(design.organizationId, m.org.id), eq(design.id, designId)))
    await activeDriver().delete(thumbs.map((t) => t.key).filter((key): key is string => !!key))
    await record(m, "design.deleted", { type: "design", id: null, name: row.name })
    touch(orgSlug)
  })
}

/* ----------------------------------------------------------------- publish */

/** Freeze a version under the design's public URL. Republishing moves the pointer, not the URL. */
export async function publishDesign(orgSlug: string, designId: string, versionId?: string) {
  return run(async () => {
    const m = await authorize(orgSlug, "design:publish")
    const row = await owned(m, designId)
    const target = versionId ?? row.currentVersionId
    const [version] = await db
      .select({ id: designVersion.id, number: designVersion.number })
      .from(designVersion)
      .where(and(eq(designVersion.id, target ?? ""), eq(designVersion.designId, designId)))
    if (!version) throw new StudioError("Version not found.", 404)

    const publicSlug = row.publicSlug ?? uniqueSlug(row.name)
    await db
      .update(design)
      .set({ publishedVersionId: version.id, publicSlug, publishedAt: new Date() })
      .where(and(eq(design.organizationId, m.org.id), eq(design.id, designId)))
    await record(
      m,
      "design.published",
      { type: "design", id: designId, name: row.name },
      { number: version.number },
    )
    touch(orgSlug, designId)
    revalidatePath(`/d/${publicSlug}`)
    return { publicSlug, number: version.number }
  })
}

export async function unpublishDesign(orgSlug: string, designId: string) {
  return run(async () => {
    const m = await authorize(orgSlug, "design:publish")
    const row = await owned(m, designId)
    await db
      .update(design)
      .set({ publishedVersionId: null, publishedAt: null })
      .where(and(eq(design.organizationId, m.org.id), eq(design.id, designId)))
    await record(m, "design.unpublished", { type: "design", id: designId, name: row.name })
    touch(orgSlug, designId)
    if (row.publicSlug) revalidatePath(`/d/${row.publicSlug}`)
  })
}

/* ------------------------------------------------------------------- share */

const shareInput = z.object({
  /** Days until it stops working. Null never expires. */
  expiresInDays: z.number().int().min(1).max(365).nullable(),
  /** Pin to the version on screen rather than following the design. */
  versionId: z.string().nullable(),
})

export async function createShareLink(
  orgSlug: string,
  designId: string,
  input: z.input<typeof shareInput>,
) {
  return run(async () => {
    const m = await authorize(orgSlug, "design:share")
    const row = await owned(m, designId)
    const data = shareInput.parse(input)
    if (data.versionId) {
      const [found] = await db
        .select({ id: designVersion.id })
        .from(designVersion)
        .where(and(eq(designVersion.id, data.versionId), eq(designVersion.designId, designId)))
      if (!found) throw new StudioError("Version not found.", 404)
    }
    const token = newToken()
    await db.insert(shareLink).values({
      id: newId("shr"),
      organizationId: m.org.id,
      designId,
      token,
      versionId: data.versionId,
      expiresAt: data.expiresInDays ? new Date(Date.now() + data.expiresInDays * 86_400_000) : null,
      createdBy: m.user.id,
    })
    await record(m, "design.shared", { type: "design", id: designId, name: row.name })
    touch(orgSlug, designId)
    return { token }
  })
}

export async function revokeShareLink(orgSlug: string, linkId: string) {
  return run(async () => {
    const m = await authorize(orgSlug, "design:share")
    const [row] = await db
      .update(shareLink)
      .set({ revokedAt: new Date() })
      .where(and(eq(shareLink.organizationId, m.org.id), eq(shareLink.id, linkId)))
      .returning({ designId: shareLink.designId })
    if (row) touch(orgSlug, row.designId)
  })
}

/* ---------------------------------------------------------------- comments */

const commentInput = z.object({
  body: z.string().trim().min(1, "Write something first.").max(4000),
  parentId: z.string().nullable().default(null),
  versionId: z.string().nullable().default(null),
})

export async function addComment(
  orgSlug: string,
  designId: string,
  input: z.input<typeof commentInput>,
) {
  return run(async () => {
    const m = await authorize(orgSlug, "comment:create")
    const row = await owned(m, designId)
    const data = commentInput.parse(input)
    let parentId: string | null = null
    if (data.parentId) {
      const [parent] = await db
        .select({ id: comment.id, parentId: comment.parentId })
        .from(comment)
        .where(and(eq(comment.id, data.parentId), eq(comment.designId, designId)))
      if (!parent) throw new StudioError("That thread is gone.", 404)
      // One level deep: a reply to a reply joins the same thread.
      parentId = parent.parentId ?? parent.id
    }
    let versionId: string | null = null
    if (data.versionId) {
      const [version] = await db
        .select({ id: designVersion.id })
        .from(designVersion)
        .where(and(eq(designVersion.id, data.versionId), eq(designVersion.designId, designId)))
      versionId = version?.id ?? null
    }
    const id = newId("cmt")
    await db.insert(comment).values({
      id,
      organizationId: m.org.id,
      designId,
      versionId,
      parentId,
      body: data.body,
      authorId: m.user.id,
    })
    if (!parentId) await record(m, "comment.created", { type: "design", id: designId, name: row.name })
    touch(orgSlug, designId)
    return { id }
  })
}

export async function setCommentResolved(orgSlug: string, commentId: string, resolved: boolean) {
  return run(async () => {
    const m = await authorize(orgSlug, "comment:create")
    const [row] = await db
      .select()
      .from(comment)
      .where(and(eq(comment.organizationId, m.org.id), eq(comment.id, commentId), isNull(comment.parentId)))
    if (!row) throw new StudioError("Thread not found.", 404)
    // Whoever opened a thread may close it; otherwise it takes the permission.
    if (row.authorId !== m.user.id && !can(m.member.role, "comment:resolve")) {
      throw new StudioError("Your role does not allow that.", 403)
    }
    await db
      .update(comment)
      .set({ resolvedAt: resolved ? new Date() : null })
      .where(eq(comment.id, commentId))
    if (resolved) {
      const parent = await getDesign(m.org.id, row.designId)
      await record(m, "comment.resolved", { type: "design", id: row.designId, name: parent?.name ?? "" })
    }
    touch(orgSlug, row.designId)
  })
}

export async function deleteComment(orgSlug: string, commentId: string) {
  return run(async () => {
    const m = await authorize(orgSlug, "comment:create")
    const [row] = await db
      .select()
      .from(comment)
      .where(and(eq(comment.organizationId, m.org.id), eq(comment.id, commentId)))
    if (!row) return
    if (row.authorId !== m.user.id && !can(m.member.role, "settings:update")) {
      throw new StudioError("Only its author or an admin can delete a comment.", 403)
    }
    await db.delete(comment).where(eq(comment.id, commentId))
    touch(orgSlug, row.designId)
  })
}

/* ------------------------------------------------------------ attachments */

export async function attachAssets(orgSlug: string, designId: string, assetIds: string[]) {
  return run(async () => {
    const m = await authorize(orgSlug, "design:update")
    await owned(m, designId)
    const ids = z.array(z.string()).max(50).parse(assetIds)
    if (!ids.length) return
    const found = await db
      .select({ id: schema.asset.id })
      .from(schema.asset)
      .where(
        and(
          eq(schema.asset.organizationId, m.org.id),
          inArray(schema.asset.id, ids),
          isNull(schema.asset.deletedAt),
        ),
      )
    if (!found.length) return
    await db
      .insert(designAsset)
      .values(found.map((row) => ({ designId, assetId: row.id, organizationId: m.org.id })))
      .onConflictDoNothing()
    touch(orgSlug, designId)
  })
}

export async function detachAsset(orgSlug: string, designId: string, assetId: string) {
  return run(async () => {
    const m = await authorize(orgSlug, "design:update")
    await db
      .delete(designAsset)
      .where(
        and(
          eq(designAsset.organizationId, m.org.id),
          eq(designAsset.designId, designId),
          eq(designAsset.assetId, assetId),
        ),
      )
    touch(orgSlug, designId)
  })
}

/** For the version list's "latest" read after a save elsewhere: the newest version number. */
export async function latestVersion(orgSlug: string, designId: string) {
  return run(async () => {
    const m = await authorize(orgSlug)
    const [row] = await db
      .select({ id: designVersion.id, number: designVersion.number })
      .from(designVersion)
      .where(and(eq(designVersion.organizationId, m.org.id), eq(designVersion.designId, designId)))
      .orderBy(desc(designVersion.number))
      .limit(1)
    return row ?? null
  })
}
