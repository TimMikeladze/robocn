// @vitest-environment node

/**
 * The data layer against a real Postgres: `DATABASE_URL_TEST`, migrated here.
 * Skipped when that is unset, so a checkout without a database still goes green.
 *
 * What it guards is the part a unit test cannot: that a query handed one
 * organization's id never returns another's rows, and that a file's bytes
 * follow its row into and out of storage.
 */

import fs from "node:fs"
import path from "node:path"

import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

/** Next's env loader skips `.env.local` under `NODE_ENV=test` on purpose, so read the one key by hand. */
function testDatabaseUrl() {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST
  try {
    const file = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8")
    return /^DATABASE_URL_TEST=(.+)$/m.exec(file)?.[1].trim().replace(/^["']|["']$/g, "")
  } catch {
    return undefined
  }
}

const url = testDatabaseUrl()
if (url) process.env.DATABASE_URL = url
// The storage driver under test is the Postgres one, whatever the machine has configured.
delete process.env.BLOB_READ_WRITE_TOKEN

const suite = url ? describe : describe.skip

suite("studio data layer", () => {
  const run = Math.random().toString(36).slice(2, 8)
  const orgA = `org_a_${run}`
  const orgB = `org_b_${run}`
  const userId = `usr_${run}`

  let db: typeof import("@/db").db
  let schema: typeof import("@/db").schema

  beforeAll(async () => {
    const client = postgres(url!, { max: 1, onnotice: () => {} })
    await migrate(drizzle(client), { migrationsFolder: path.resolve(process.cwd(), "drizzle") })
    await client.end()
    ;({ db, schema } = await import("@/db"))

    await db.insert(schema.user).values({ id: userId, name: "Tester", email: `${run}@example.test` })
    await db.insert(schema.organization).values([
      { id: orgA, name: "A", slug: `a-${run}`, createdAt: new Date() },
      { id: orgB, name: "B", slug: `b-${run}`, createdAt: new Date() },
    ])
    for (const [org, name] of [
      [orgA, "Arm for A"],
      [orgB, "Arm for B"],
    ] as const) {
      const id = `dsn_${org}`
      const versionId = `ver_${org}`
      await db.insert(schema.design).values({
        id,
        organizationId: org,
        name,
        componentId: "robot-arm",
        currentVersionId: versionId,
        createdBy: userId,
      })
      await db.insert(schema.designVersion).values({
        id: versionId,
        organizationId: org,
        designId: id,
        number: 1,
        pose: { variant: "blueprint" },
      })
    }
  }, 60_000)

  afterAll(async () => {
    if (!db) return
    // Everything hangs off the organization and the user; the cascades do the rest.
    await db.delete(schema.organization).where(eq(schema.organization.id, orgA))
    await db.delete(schema.organization).where(eq(schema.organization.id, orgB))
    await db.delete(schema.user).where(eq(schema.user.id, userId))
  })

  it("scopes designs to the organization it is asked about", async () => {
    const { listDesigns, getDesign } = await import("@/lib/studio/queries")
    const rows = await listDesigns(orgA)
    expect(rows.map((row) => row.name)).toEqual(["Arm for A"])
    expect(rows[0].pose).toEqual({ variant: "blueprint" })
    // The right id under the wrong organization is not found, not forbidden.
    expect(await getDesign(orgA, `dsn_${orgB}`)).toBeNull()
  })

  it("treats search text as text, not as a pattern", async () => {
    const { listDesigns } = await import("@/lib/studio/queries")
    expect(await listDesigns(orgA, { query: "%" })).toHaveLength(0)
    expect(await listDesigns(orgA, { query: "arm" })).toHaveLength(1)
  })

  it("stores a file, thumbnails an image, and takes both away on purge", async () => {
    const sharp = (await import("sharp")).default
    const { ingest, purge, storageUsed } = await import("@/lib/studio/assets")
    const { listAssets, getAsset } = await import("@/lib/studio/queries")
    const { driverFor } = await import("@/lib/studio/storage")

    const png = await sharp({
      create: { width: 40, height: 20, channels: 3, background: "#f38b4a" },
    })
      .png()
      .toBuffer()
    const row = await ingest({
      organizationId: orgA,
      userId,
      folderId: null,
      name: 'bad/na:me".png',
      mime: "image/png",
      bytes: new Uint8Array(png),
    })

    expect(row).toMatchObject({ kind: "image", width: 40, height: 20, driver: "postgres" })
    expect(row.name).toBe("bad na me .png")
    expect(row.thumbnailKey).toBeTruthy()
    expect((await driverFor(row.driver).get(row.storageKey))?.bytes.byteLength).toBe(png.byteLength)
    expect((await storageUsed(orgA)).files).toBe(1)

    // Another organization can neither list it nor fetch it by id.
    expect(await listAssets(orgB)).toHaveLength(0)
    expect(await getAsset(orgB, row.id)).toBeNull()
    // ...nor purge it.
    expect(await purge(orgB, [row.id])).toBe(0)

    expect(await purge(orgA, [row.id])).toBe(1)
    expect(await driverFor(row.driver).get(row.storageKey)).toBeNull()
    expect(await driverFor(row.driver).get(row.thumbnailKey!)).toBeNull()
  })

  it("counts what is inside a folder and a project, not zero", async () => {
    // Regression: an unqualified outer column in the correlated subquery bound to
    // the inner table, and every count came back 0.
    const { listFolders, listProjects } = await import("@/lib/studio/queries")
    const { ingest, purge } = await import("@/lib/studio/assets")
    await db.insert(schema.assetFolder).values({ id: `fld_${run}`, organizationId: orgA, name: "Refs" })
    const file = await ingest({
      organizationId: orgA,
      userId,
      folderId: `fld_${run}`,
      name: "brief.txt",
      mime: "text/plain",
      bytes: new TextEncoder().encode("brief"),
    })
    await db.insert(schema.project).values({ id: `prj_${run}`, organizationId: orgA, name: "P", slug: "p" })
    await db
      .update(schema.design)
      .set({ projectId: `prj_${run}` })
      .where(eq(schema.design.id, `dsn_${orgA}`))

    expect((await listFolders(orgA)).map((folder) => folder.files)).toEqual([1])
    expect((await listProjects(orgA)).map((project) => project.designs)).toEqual([1])
    await purge(orgA, [file.id])
  })

  it("only lists what is published, joined to the published version", async () => {
    const { listPublished, getPublished } = await import("@/lib/studio/queries")
    const slug = `arm-${run}`
    expect(await getPublished(slug)).toBeNull()
    await db
      .update(schema.design)
      .set({ publicSlug: slug, publishedVersionId: `ver_${orgA}`, publishedAt: new Date() })
      .where(eq(schema.design.id, `dsn_${orgA}`))
    expect((await getPublished(slug))?.pose).toEqual({ variant: "blueprint" })
    const listed = await listPublished({ orgSlug: `a-${run}` })
    expect(listed.map((row) => row.slug)).toEqual([slug])
    expect(await listPublished({ orgSlug: `b-${run}` })).toHaveLength(0)
  })
})
