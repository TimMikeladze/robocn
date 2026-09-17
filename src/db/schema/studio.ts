/**
 * Studio's own tables. Every one carries `organization_id` and every query is
 * scoped by it — tenancy is a column, not a convention. Shape and reasoning:
 * `docs/studio.md`.
 */

import { sql } from "drizzle-orm"
import {
  type AnyPgColumn,
  bigint,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { organization, user } from "./auth"

const bytea = customType<{ data: Buffer; default: false }>({
  dataType: () => "bytea",
})

const id = () => text("id").primaryKey()
const org = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" })
const actor = (name: string) => text(name).references(() => user.id, { onDelete: "set null" })
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
const updated = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())

/** What a machine was handed: only the props that were *set*. */
export type PoseJson = Record<string, string | number | boolean>
/** What it was shown on. */
export interface StageJson {
  background: "panel" | "grid" | "blueprint" | "dark" | "checker"
  zoom: number
}

export const project = pgTable(
  "project",
  {
    id: id(),
    organizationId: org(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    color: text("color").notNull().default("#f38b4a"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: actor("created_by"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (table) => [uniqueIndex("project_org_slug_idx").on(table.organizationId, table.slug)],
)

export const design = pgTable(
  "design",
  {
    id: id(),
    organizationId: org(),
    projectId: text("project_id").references(() => project.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** The registry item this design poses: `robot-arm`. */
    componentId: text("component_id").notNull(),
    /** A workflow stage id from the organization's settings. */
    stage: text("stage").notNull().default("draft"),
    labelIds: text("label_ids").array().notNull().default(sql`'{}'::text[]`),
    currentVersionId: text("current_version_id"),
    publishedVersionId: text("published_version_id"),
    /** Globally unique: it is the public URL. Null until first published, kept after. */
    publicSlug: text("public_slug"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** Where this was forked from, when it was. */
    forkedFromId: text("forked_from_id").references((): AnyPgColumn => design.id, {
      onDelete: "set null",
    }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: actor("created_by"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (table) => [
    index("design_org_idx").on(table.organizationId, table.updatedAt),
    index("design_project_idx").on(table.projectId),
    uniqueIndex("design_public_slug_idx").on(table.publicSlug),
  ],
)

export const designVersion = pgTable(
  "design_version",
  {
    id: id(),
    organizationId: org(),
    designId: text("design_id")
      .notNull()
      .references(() => design.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    note: text("note").notNull().default(""),
    pose: jsonb("pose").$type<PoseJson>().notNull().default({}),
    stage: jsonb("stage").$type<StageJson>().notNull().default({ background: "panel", zoom: 1 }),
    /** PNG of the stage at save time, in the organization's storage. */
    thumbnailKey: text("thumbnail_key"),
    createdBy: actor("created_by"),
    createdAt: created(),
  },
  (table) => [uniqueIndex("design_version_number_idx").on(table.designId, table.number)],
)

export const comment = pgTable(
  "comment",
  {
    id: id(),
    organizationId: org(),
    designId: text("design_id")
      .notNull()
      .references(() => design.id, { onDelete: "cascade" }),
    /** The version on the stage when it was written. */
    versionId: text("version_id").references(() => designVersion.id, { onDelete: "set null" }),
    parentId: text("parent_id").references((): AnyPgColumn => comment.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    authorId: actor("author_id"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (table) => [index("comment_design_idx").on(table.designId, table.createdAt)],
)

export const shareLink = pgTable(
  "share_link",
  {
    id: id(),
    organizationId: org(),
    designId: text("design_id")
      .notNull()
      .references(() => design.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    /** Null follows the design's current version; set pins the link to one. */
    versionId: text("version_id").references(() => designVersion.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdBy: actor("created_by"),
    createdAt: created(),
  },
  (table) => [uniqueIndex("share_link_token_idx").on(table.token)],
)

export const assetFolder = pgTable(
  "asset_folder",
  {
    id: id(),
    organizationId: org(),
    parentId: text("parent_id").references((): AnyPgColumn => assetFolder.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    createdBy: actor("created_by"),
    createdAt: created(),
  },
  (table) => [index("asset_folder_org_idx").on(table.organizationId, table.parentId)],
)

export const asset = pgTable(
  "asset",
  {
    id: id(),
    organizationId: org(),
    folderId: text("folder_id").references(() => assetFolder.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    /** image · video · audio · font · document · other — derived from the mime type. */
    kind: text("kind").notNull(),
    mime: text("mime").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    width: integer("width"),
    height: integer("height"),
    checksum: text("checksum").notNull(),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    description: text("description").notNull().default(""),
    /** `postgres` or `vercel-blob`: a row outlives a change of driver. */
    driver: text("driver").notNull(),
    storageKey: text("storage_key").notNull(),
    thumbnailKey: text("thumbnail_key"),
    /** Readable by anyone holding the URL. Off until someone turns it on. */
    isPublic: boolean("is_public").notNull().default(false),
    /** In the trash. Restorable until it is purged. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdBy: actor("created_by"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (table) => [
    index("asset_org_idx").on(table.organizationId, table.folderId),
    index("asset_checksum_idx").on(table.organizationId, table.checksum),
  ],
)

/** Bytes, for the `postgres` storage driver. Keyed by storage key, not asset id: thumbnails live here too. */
export const assetBlob = pgTable("asset_blob", {
  key: text("key").primaryKey(),
  organizationId: org(),
  mime: text("mime").notNull(),
  bytes: bytea("bytes").notNull(),
  createdAt: created(),
})

export const designAsset = pgTable(
  "design_asset",
  {
    designId: text("design_id")
      .notNull()
      .references(() => design.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => asset.id, { onDelete: "cascade" }),
    organizationId: org(),
    createdAt: created(),
  },
  (table) => [primaryKey({ columns: [table.designId, table.assetId] })],
)

export const palette = pgTable(
  "palette",
  {
    id: id(),
    organizationId: org(),
    name: text("name").notNull(),
    /** A subset of the six robocn palette roles: color, accent, metal, dark, glow, grid. */
    colors: jsonb("colors").$type<Record<string, string>>().notNull().default({}),
    createdBy: actor("created_by"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (table) => [index("palette_org_idx").on(table.organizationId)],
)

export const label = pgTable(
  "label",
  {
    id: id(),
    organizationId: org(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#64748b"),
    createdAt: created(),
  },
  (table) => [uniqueIndex("label_org_name_idx").on(table.organizationId, table.name)],
)

export const activity = pgTable(
  "activity",
  {
    id: id(),
    organizationId: org(),
    actorId: actor("actor_id"),
    /** `design.published`, `asset.uploaded` — `src/lib/studio/activity.ts` has the list. */
    verb: text("verb").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    /** What the target was called at the time, so the feed survives a delete. */
    targetName: text("target_name").notNull().default(""),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: created(),
  },
  (table) => [index("activity_org_idx").on(table.organizationId, table.createdAt)],
)
