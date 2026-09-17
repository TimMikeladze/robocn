/**
 * Reads. Every function takes the organization id its caller already resolved
 * through `requireMember`/`authorize`, and every `where` starts with it.
 */

import "server-only"

import {
  and,
  arrayContains,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm"

import { db, schema } from "@/db"
import type { AssetKind } from "@/lib/studio/asset-kinds"

const { design, designVersion, project, asset, assetFolder, comment, user } = schema

/** `%` and `_` are wildcards to `ilike`; a search box is not a pattern language. */
const like = (text: string) => `%${text.replace(/[\\%_]/g, (match) => `\\${match}`)}%`

/**
 * A column of the *outer* query, for use inside a correlated subquery.
 *
 * drizzle leaves column names unqualified when a select has no join, so a bare
 * `${project.id}` inside `(select … from design …)` renders as `"id"` and binds
 * to `design.id` — a count that is silently always zero. This writes the table
 * name out.
 */
const outer = (column: { name: string }, table: string) => sql.raw(`"${table}"."${column.name}"`)

/* ------------------------------------------------------------------ designs */

export interface DesignFilter {
  query?: string
  stage?: string
  labelId?: string
  projectId?: string | null
  archived?: boolean
  published?: boolean
  limit?: number
}

const designCard = {
  id: design.id,
  name: design.name,
  description: design.description,
  componentId: design.componentId,
  stage: design.stage,
  labelIds: design.labelIds,
  projectId: design.projectId,
  projectName: project.name,
  publicSlug: design.publicSlug,
  publishedVersionId: design.publishedVersionId,
  currentVersionId: design.currentVersionId,
  archivedAt: design.archivedAt,
  updatedAt: design.updatedAt,
  versionNumber: designVersion.number,
  pose: designVersion.pose,
  stageView: designVersion.stage,
  hasThumbnail: sql<boolean>`${designVersion.thumbnailKey} is not null`,
  authorName: user.name,
}

export type DesignCard = Awaited<ReturnType<typeof listDesigns>>[number]

export async function listDesigns(organizationId: string, filter: DesignFilter = {}) {
  const where: (SQL | undefined)[] = [
    eq(design.organizationId, organizationId),
    filter.archived ? isNotNull(design.archivedAt) : isNull(design.archivedAt),
  ]
  if (filter.query?.trim()) {
    const text = like(filter.query.trim())
    where.push(
      or(ilike(design.name, text), ilike(design.description, text), ilike(design.componentId, text)),
    )
  }
  if (filter.stage) where.push(eq(design.stage, filter.stage))
  if (filter.labelId) where.push(arrayContains(design.labelIds, [filter.labelId]))
  if (filter.projectId !== undefined) {
    where.push(
      filter.projectId === null ? isNull(design.projectId) : eq(design.projectId, filter.projectId),
    )
  }
  if (filter.published) where.push(isNotNull(design.publishedVersionId))

  return db
    .select(designCard)
    .from(design)
    .leftJoin(designVersion, eq(designVersion.id, design.currentVersionId))
    .leftJoin(project, eq(project.id, design.projectId))
    .leftJoin(user, eq(user.id, design.createdBy))
    .where(and(...where))
    .orderBy(desc(design.updatedAt))
    .limit(filter.limit ?? 200)
}

export async function getDesign(organizationId: string, id: string) {
  const [row] = await db
    .select()
    .from(design)
    .where(and(eq(design.organizationId, organizationId), eq(design.id, id)))
    .limit(1)
  return row ?? null
}

export async function listVersions(organizationId: string, designId: string) {
  return db
    .select({
      id: designVersion.id,
      number: designVersion.number,
      note: designVersion.note,
      pose: designVersion.pose,
      stage: designVersion.stage,
      hasThumbnail: sql<boolean>`${designVersion.thumbnailKey} is not null`,
      createdAt: designVersion.createdAt,
      authorName: user.name,
    })
    .from(designVersion)
    .leftJoin(user, eq(user.id, designVersion.createdBy))
    .where(
      and(eq(designVersion.organizationId, organizationId), eq(designVersion.designId, designId)),
    )
    .orderBy(desc(designVersion.number))
}

export async function listComments(organizationId: string, designId: string) {
  return db
    .select({
      id: comment.id,
      parentId: comment.parentId,
      body: comment.body,
      resolvedAt: comment.resolvedAt,
      createdAt: comment.createdAt,
      authorId: comment.authorId,
      authorName: user.name,
      versionNumber: designVersion.number,
    })
    .from(comment)
    .leftJoin(user, eq(user.id, comment.authorId))
    .leftJoin(designVersion, eq(designVersion.id, comment.versionId))
    .where(and(eq(comment.organizationId, organizationId), eq(comment.designId, designId)))
    .orderBy(asc(comment.createdAt))
}

export async function listShareLinks(organizationId: string, designId: string) {
  return db
    .select()
    .from(schema.shareLink)
    .where(
      and(
        eq(schema.shareLink.organizationId, organizationId),
        eq(schema.shareLink.designId, designId),
        isNull(schema.shareLink.revokedAt),
      ),
    )
    .orderBy(desc(schema.shareLink.createdAt))
}

export async function listDesignAssets(organizationId: string, designId: string) {
  return db
    .select({
      id: asset.id,
      name: asset.name,
      kind: asset.kind,
      mime: asset.mime,
      size: asset.size,
      width: asset.width,
      height: asset.height,
      hasThumbnail: sql<boolean>`${asset.thumbnailKey} is not null`,
    })
    .from(schema.designAsset)
    .innerJoin(asset, eq(asset.id, schema.designAsset.assetId))
    .where(
      and(
        eq(schema.designAsset.organizationId, organizationId),
        eq(schema.designAsset.designId, designId),
        isNull(asset.deletedAt),
      ),
    )
    .orderBy(asc(schema.designAsset.createdAt))
}

/* ----------------------------------------------------------------- projects */

export async function listProjects(organizationId: string) {
  return db
    .select({
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      color: project.color,
      archivedAt: project.archivedAt,
      updatedAt: project.updatedAt,
      designs: sql<number>`(
        select count(*)::int from ${design}
        where ${design.projectId} = ${outer(project.id, "project")} and ${design.archivedAt} is null
      )`,
    })
    .from(project)
    .where(eq(project.organizationId, organizationId))
    .orderBy(asc(project.name))
}

export async function getProject(organizationId: string, id: string) {
  const [row] = await db
    .select()
    .from(project)
    .where(and(eq(project.organizationId, organizationId), eq(project.id, id)))
    .limit(1)
  return row ?? null
}

/* ------------------------------------------------------------------- assets */

export interface AssetFilter {
  /** `undefined` searches every folder; `null` is the root. */
  folderId?: string | null
  query?: string
  kind?: AssetKind
  tag?: string
  trashed?: boolean
  sort?: "newest" | "oldest" | "name" | "largest"
}

const assetRow = {
  id: asset.id,
  folderId: asset.folderId,
  name: asset.name,
  kind: asset.kind,
  mime: asset.mime,
  size: asset.size,
  width: asset.width,
  height: asset.height,
  tags: asset.tags,
  description: asset.description,
  isPublic: asset.isPublic,
  deletedAt: asset.deletedAt,
  createdAt: asset.createdAt,
  updatedAt: asset.updatedAt,
  hasThumbnail: sql<boolean>`${asset.thumbnailKey} is not null`,
  uploaderName: user.name,
  uses: sql<number>`(
    select count(*)::int from ${schema.designAsset}
    where ${schema.designAsset.assetId} = ${asset.id}
  )`,
}

export type AssetRow = Awaited<ReturnType<typeof listAssets>>[number]

export async function listAssets(organizationId: string, filter: AssetFilter = {}) {
  const where: (SQL | undefined)[] = [
    eq(asset.organizationId, organizationId),
    filter.trashed ? isNotNull(asset.deletedAt) : isNull(asset.deletedAt),
  ]
  // A search, a tag or the trash looks across the whole library; browsing looks in one folder.
  const everywhere = !!filter.query?.trim() || !!filter.tag || filter.trashed
  if (!everywhere && filter.folderId !== undefined) {
    where.push(filter.folderId === null ? isNull(asset.folderId) : eq(asset.folderId, filter.folderId))
  }
  if (filter.query?.trim()) {
    const text = like(filter.query.trim())
    where.push(
      or(
        ilike(asset.name, text),
        ilike(asset.description, text),
        sql`exists (select 1 from unnest(${asset.tags}) as tag where tag ilike ${text})`,
      ),
    )
  }
  if (filter.kind) where.push(eq(asset.kind, filter.kind))
  if (filter.tag) where.push(arrayContains(asset.tags, [filter.tag]))

  const order = {
    newest: desc(asset.createdAt),
    oldest: asc(asset.createdAt),
    name: asc(sql`lower(${asset.name})`),
    largest: desc(asset.size),
  }[filter.sort ?? "newest"]

  return db
    .select(assetRow)
    .from(asset)
    .leftJoin(user, eq(user.id, asset.createdBy))
    .where(and(...where))
    .orderBy(order)
    .limit(500)
}

export async function getAsset(organizationId: string, id: string) {
  const [row] = await db
    .select()
    .from(asset)
    .where(and(eq(asset.organizationId, organizationId), eq(asset.id, id)))
    .limit(1)
  return row ?? null
}

export async function listFolders(organizationId: string) {
  return db
    .select({
      id: assetFolder.id,
      parentId: assetFolder.parentId,
      name: assetFolder.name,
      files: sql<number>`(
        select count(*)::int from ${asset}
        where ${asset.folderId} = ${outer(assetFolder.id, "asset_folder")} and ${asset.deletedAt} is null
      )`,
    })
    .from(assetFolder)
    .where(eq(assetFolder.organizationId, organizationId))
    .orderBy(asc(sql`lower(${assetFolder.name})`))
}

/** Designs that reference an asset: what breaks if it goes. */
export async function assetUsage(organizationId: string, assetId: string) {
  return db
    .select({ id: design.id, name: design.name })
    .from(schema.designAsset)
    .innerJoin(design, eq(design.id, schema.designAsset.designId))
    .where(
      and(
        eq(schema.designAsset.organizationId, organizationId),
        eq(schema.designAsset.assetId, assetId),
      ),
    )
}

export async function listTags(organizationId: string) {
  const rows = await db.execute<{ tag: string; uses: number }>(sql`
    select tag, count(*)::int as uses
    from ${asset}, unnest(${asset.tags}) as tag
    where ${asset.organizationId} = ${organizationId} and ${asset.deletedAt} is null
    group by tag order by uses desc, tag asc limit 50
  `)
  return [...rows]
}

/* ---------------------------------------------------- palettes, labels, feed */

export const listPalettes = (organizationId: string) =>
  db
    .select()
    .from(schema.palette)
    .where(eq(schema.palette.organizationId, organizationId))
    .orderBy(asc(schema.palette.name))

export const listLabels = (organizationId: string) =>
  db
    .select()
    .from(schema.label)
    .where(eq(schema.label.organizationId, organizationId))
    .orderBy(asc(schema.label.name))

export async function listActivity(organizationId: string, limit = 30) {
  return db
    .select({
      id: schema.activity.id,
      verb: schema.activity.verb,
      targetType: schema.activity.targetType,
      targetId: schema.activity.targetId,
      targetName: schema.activity.targetName,
      meta: schema.activity.meta,
      createdAt: schema.activity.createdAt,
      actorName: user.name,
    })
    .from(schema.activity)
    .leftJoin(user, eq(user.id, schema.activity.actorId))
    .where(eq(schema.activity.organizationId, organizationId))
    .orderBy(desc(schema.activity.createdAt))
    .limit(limit)
}

export async function dashboardCounts(organizationId: string) {
  const [[designs], [published], [assets], [members]] = await Promise.all([
    db
      .select({ n: count() })
      .from(design)
      .where(and(eq(design.organizationId, organizationId), isNull(design.archivedAt))),
    db
      .select({ n: count() })
      .from(design)
      .where(and(eq(design.organizationId, organizationId), isNotNull(design.publishedVersionId))),
    db
      .select({ n: count() })
      .from(asset)
      .where(and(eq(asset.organizationId, organizationId), isNull(asset.deletedAt))),
    db.select({ n: count() }).from(schema.member).where(eq(schema.member.organizationId, organizationId)),
  ])
  return { designs: designs.n, published: published.n, assets: assets.n, members: members.n }
}

/* ------------------------------------------------------------------- people */

export async function listMembers(organizationId: string) {
  return db
    .select({
      id: schema.member.id,
      userId: schema.member.userId,
      role: schema.member.role,
      createdAt: schema.member.createdAt,
      name: user.name,
      email: user.email,
    })
    .from(schema.member)
    .innerJoin(user, eq(user.id, schema.member.userId))
    .where(eq(schema.member.organizationId, organizationId))
    .orderBy(asc(schema.member.createdAt))
}

export async function listInvitations(organizationId: string) {
  return db
    .select()
    .from(schema.invitation)
    .where(
      and(
        eq(schema.invitation.organizationId, organizationId),
        eq(schema.invitation.status, "pending"),
      ),
    )
    .orderBy(desc(schema.invitation.createdAt))
}

/* ------------------------------------------------------------------- public */

const publicCard = {
  slug: design.publicSlug,
  name: design.name,
  description: design.description,
  componentId: design.componentId,
  publishedAt: design.publishedAt,
  versionId: designVersion.id,
  pose: designVersion.pose,
  stageView: designVersion.stage,
  hasThumbnail: sql<boolean>`${designVersion.thumbnailKey} is not null`,
  orgName: schema.organization.name,
  orgSlug: schema.organization.slug,
  /** Raw settings JSON: a caller reads `profile.listed` to know whether `/o/<slug>` exists. */
  orgSettings: schema.organization.settings,
}

export type PublicCard = Awaited<ReturnType<typeof listPublished>>[number]

/** Everything published, or one organization's. Joined to the *published* version, never the current one. */
export async function listPublished(options: { orgSlug?: string; query?: string; limit?: number } = {}) {
  const where: (SQL | undefined)[] = [isNotNull(design.publishedVersionId), isNull(design.archivedAt)]
  if (options.orgSlug) where.push(eq(schema.organization.slug, options.orgSlug))
  if (options.query?.trim()) {
    const text = like(options.query.trim())
    where.push(or(ilike(design.name, text), ilike(design.componentId, text)))
  }
  return db
    .select(publicCard)
    .from(design)
    .innerJoin(designVersion, eq(designVersion.id, design.publishedVersionId))
    .innerJoin(schema.organization, eq(schema.organization.id, design.organizationId))
    .where(and(...where))
    .orderBy(desc(design.publishedAt))
    .limit(options.limit ?? 120)
}

export async function getPublished(slug: string) {
  const [row] = await db
    .select({
      id: design.id,
      slug: design.publicSlug,
      name: design.name,
      description: design.description,
      componentId: design.componentId,
      publishedAt: design.publishedAt,
      versionId: designVersion.id,
      versionNumber: designVersion.number,
      pose: designVersion.pose,
      stageView: designVersion.stage,
      thumbnailKey: designVersion.thumbnailKey,
      orgId: schema.organization.id,
      orgName: schema.organization.name,
      orgSlug: schema.organization.slug,
      orgSettings: schema.organization.settings,
    })
    .from(design)
    .innerJoin(designVersion, eq(designVersion.id, design.publishedVersionId))
    .innerJoin(schema.organization, eq(schema.organization.id, design.organizationId))
    .where(and(eq(design.publicSlug, slug), isNull(design.archivedAt)))
    .limit(1)
  return row ?? null
}

/** A live, unexpired, unrevoked share link and the version it shows. */
export async function getShared(token: string) {
  const [link] = await db
    .select()
    .from(schema.shareLink)
    .where(and(eq(schema.shareLink.token, token), isNull(schema.shareLink.revokedAt)))
    .limit(1)
  if (!link) return null
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return null
  const [row] = await db
    .select({
      name: design.name,
      description: design.description,
      componentId: design.componentId,
      versionNumber: designVersion.number,
      note: designVersion.note,
      pose: designVersion.pose,
      stageView: designVersion.stage,
      orgName: schema.organization.name,
    })
    .from(design)
    .innerJoin(
      designVersion,
      link.versionId
        ? eq(designVersion.id, link.versionId)
        : eq(designVersion.id, design.currentVersionId),
    )
    .innerJoin(schema.organization, eq(schema.organization.id, design.organizationId))
    .where(eq(design.id, link.designId))
    .limit(1)
  return row ? { ...row, expiresAt: link.expiresAt, pinned: !!link.versionId } : null
}

export async function getOrgBySlug(slug: string) {
  const [row] = await db
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.slug, slug))
    .limit(1)
  return row ?? null
}
