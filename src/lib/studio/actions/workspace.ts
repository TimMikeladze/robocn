"use server"

/** Projects, palettes, labels and the organization's own settings. */

import { and, eq, sql } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db, schema } from "@/db"
import { auth } from "@/lib/auth"
import { run } from "@/lib/studio/action"
import { freeSlug, isValidSlug, newId, slugify } from "@/lib/studio/ids"
import { paletteRoles } from "@/lib/studio/pose"
import { record } from "@/lib/studio/record"
import { authorize, getSession, StudioError } from "@/lib/studio/session"
import { defaultSettings, hexColor, settingsSchema } from "@/lib/studio/settings"

const { project, palette, label, design, organization } = schema

const touch = (orgSlug: string) => revalidatePath(`/studio/${orgSlug}`, "layout")

/* ------------------------------------------------------------ organization */

const orgInput = z.object({
  name: z.string().trim().min(2, "Give the organization a name.").max(60),
  slug: z.string().trim().toLowerCase().max(48).optional(),
})

export async function createOrganization(input: z.input<typeof orgInput>) {
  return run(async () => {
    const session = await getSession()
    if (!session) throw new StudioError("Sign in to continue.", 401)
    const data = orgInput.parse(input)

    const taken = async (slug: string) => {
      const [row] = await db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.slug, slug))
      return !!row
    }
    let slug = data.slug ? slugify(data.slug) : ""
    if (slug) {
      if (!isValidSlug(slug)) throw new StudioError("That URL is reserved or not valid.", 400)
      if (await taken(slug)) throw new StudioError("That URL is taken.", 409)
    } else {
      slug = await freeSlug(data.name, taken)
    }

    const created = await auth.api.createOrganization({
      body: { name: data.name, slug, settings: JSON.stringify(defaultSettings()) },
      headers: await headers(),
    })
    if (!created) throw new StudioError("The organization could not be created.", 400)
    return { slug }
  })
}

export async function updateSettings(orgSlug: string, input: unknown) {
  return run(async () => {
    const m = await authorize(orgSlug, "settings:update")
    const next = settingsSchema.parse(input)

    // A logo has to be one of this organization's own images.
    if (next.profile.logoAssetId) {
      const [logo] = await db
        .select({ id: schema.asset.id })
        .from(schema.asset)
        .where(
          and(
            eq(schema.asset.organizationId, m.org.id),
            eq(schema.asset.id, next.profile.logoAssetId),
            eq(schema.asset.kind, "image"),
          ),
        )
      if (!logo) throw new StudioError("Pick a logo from this organization's images.", 400)
      // The public page has to be able to show it to people who are not signed in.
      if (next.profile.listed) {
        await db.update(schema.asset).set({ isPublic: true }).where(eq(schema.asset.id, logo.id))
      }
    }
    if (next.defaults.paletteId) {
      const [found] = await db
        .select({ id: palette.id })
        .from(palette)
        .where(and(eq(palette.organizationId, m.org.id), eq(palette.id, next.defaults.paletteId)))
      if (!found) next.defaults.paletteId = null
    }

    await db.transaction(async (tx) => {
      await tx
        .update(organization)
        .set({ settings: JSON.stringify(next) })
        .where(eq(organization.id, m.org.id))
      // Designs left in a stage that no longer exists fall back to the first one.
      const live = next.workflow.map((stage) => stage.id)
      await tx
        .update(design)
        .set({ stage: next.workflow[0].id })
        .where(
          and(
            eq(design.organizationId, m.org.id),
            sql`${design.stage} <> all(${sql.param(live)}::text[])`,
          ),
        )
    })
    await record(m, "settings.updated", { type: "organization", id: m.org.id, name: m.org.name })
    touch(orgSlug)
  })
}

/* ---------------------------------------------------------------- projects */

const projectInput = z.object({
  name: z.string().trim().min(1, "Give the project a name.").max(60),
  description: z.string().trim().max(500).default(""),
  color: hexColor.default("#f38b4a"),
})

export async function createProject(orgSlug: string, input: z.input<typeof projectInput>) {
  return run(async () => {
    const m = await authorize(orgSlug, "project:create")
    const data = projectInput.parse(input)
    const slug = await freeSlug(data.name, async (candidate) => {
      const [row] = await db
        .select({ id: project.id })
        .from(project)
        .where(and(eq(project.organizationId, m.org.id), eq(project.slug, candidate)))
      return !!row
    })
    const id = newId("prj")
    await db.insert(project).values({ id, organizationId: m.org.id, slug, createdBy: m.user.id, ...data })
    await record(m, "project.created", { type: "project", id, name: data.name })
    touch(orgSlug)
    return { id }
  })
}

export async function updateProject(
  orgSlug: string,
  projectId: string,
  input: Partial<z.input<typeof projectInput>> & { archived?: boolean },
) {
  return run(async () => {
    const m = await authorize(orgSlug, "project:update")
    const { archived, ...rest } = input
    const data = projectInput.partial().parse(rest)
    const [row] = await db
      .update(project)
      .set({ ...data, ...(archived === undefined ? null : { archivedAt: archived ? new Date() : null }) })
      .where(and(eq(project.organizationId, m.org.id), eq(project.id, projectId)))
      .returning({ name: project.name })
    if (!row) throw new StudioError("Project not found.", 404)
    await record(m, "project.updated", { type: "project", id: projectId, name: row.name })
    touch(orgSlug)
  })
}

/** Designs survive their project: the foreign key sets them loose. */
export async function deleteProject(orgSlug: string, projectId: string) {
  return run(async () => {
    const m = await authorize(orgSlug, "project:delete")
    const [row] = await db
      .delete(project)
      .where(and(eq(project.organizationId, m.org.id), eq(project.id, projectId)))
      .returning({ name: project.name })
    if (row) await record(m, "project.deleted", { type: "project", id: null, name: row.name })
    touch(orgSlug)
  })
}

/* ---------------------------------------------------------------- palettes */

const paletteInput = z.object({
  name: z.string().trim().min(1, "Give the palette a name.").max(40),
  colors: z
    .partialRecord(z.enum(paletteRoles), hexColor)
    .refine((colors) => Object.keys(colors).length > 0, "Set at least one colour."),
})

export async function savePalette(
  orgSlug: string,
  paletteId: string | null,
  input: z.input<typeof paletteInput>,
) {
  return run(async () => {
    const m = await authorize(orgSlug, paletteId ? "palette:update" : "palette:create")
    const data = paletteInput.parse(input)
    const colors = data.colors as Record<string, string>
    if (paletteId) {
      const [row] = await db
        .update(palette)
        .set({ name: data.name, colors })
        .where(and(eq(palette.organizationId, m.org.id), eq(palette.id, paletteId)))
        .returning({ id: palette.id })
      if (!row) throw new StudioError("Palette not found.", 404)
      await record(m, "palette.updated", { type: "palette", id: paletteId, name: data.name })
      touch(orgSlug)
      return { id: paletteId }
    }
    const id = newId("pal")
    await db
      .insert(palette)
      .values({ id, organizationId: m.org.id, name: data.name, colors, createdBy: m.user.id })
    await record(m, "palette.created", { type: "palette", id, name: data.name })
    touch(orgSlug)
    return { id }
  })
}

export async function deletePalette(orgSlug: string, paletteId: string) {
  return run(async () => {
    const m = await authorize(orgSlug, "palette:delete")
    const [row] = await db
      .delete(palette)
      .where(and(eq(palette.organizationId, m.org.id), eq(palette.id, paletteId)))
      .returning({ name: palette.name })
    if (row) await record(m, "palette.deleted", { type: "palette", id: null, name: row.name })
    touch(orgSlug)
  })
}

/* ------------------------------------------------------------------ labels */

const labelInput = z.object({
  name: z.string().trim().min(1, "Name the label.").max(24),
  color: hexColor,
})

export async function saveLabel(orgSlug: string, labelId: string | null, input: z.input<typeof labelInput>) {
  return run(async () => {
    const m = await authorize(orgSlug, "settings:update")
    const data = labelInput.parse(input)
    try {
      if (labelId) {
        await db
          .update(label)
          .set(data)
          .where(and(eq(label.organizationId, m.org.id), eq(label.id, labelId)))
        touch(orgSlug)
        return { id: labelId }
      }
      const id = newId("lbl")
      await db.insert(label).values({ id, organizationId: m.org.id, ...data })
      touch(orgSlug)
      return { id }
    } catch (error) {
      if ((error as { code?: string; cause?: { code?: string } }).cause?.code === "23505") {
        throw new StudioError("There is already a label with that name.", 409)
      }
      throw error
    }
  })
}

export async function deleteLabel(orgSlug: string, labelId: string) {
  return run(async () => {
    const m = await authorize(orgSlug, "settings:update")
    await db.transaction(async (tx) => {
      await tx.delete(label).where(and(eq(label.organizationId, m.org.id), eq(label.id, labelId)))
      await tx
        .update(design)
        .set({ labelIds: sql`array_remove(${design.labelIds}, ${labelId})` })
        .where(eq(design.organizationId, m.org.id))
    })
    touch(orgSlug)
  })
}
