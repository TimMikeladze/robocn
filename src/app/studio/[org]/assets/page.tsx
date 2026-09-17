/**
 * The asset library. Everything the view depends on is in the query string —
 * folder, search, kind, tag, sort, view, trash — so the server reads it here
 * and the client only ever changes the URL.
 */

import type { Metadata } from "next"

import { AssetLibrary } from "@/components/studio/assets/library"
import type { LibrarySort, LibraryState } from "@/components/studio/assets/shared"
import { assetKinds, type AssetKind } from "@/lib/studio/asset-kinds"
import { storageUsed } from "@/lib/studio/assets"
import { can } from "@/lib/studio/permissions"
import { listAssets, listFolders, listTags } from "@/lib/studio/queries"
import { requireMember } from "@/lib/studio/session"

export const metadata: Metadata = { title: "Assets" }

// Spelled out here: a value imported from a client module arrives as a reference, not an array.
const sorts: readonly LibrarySort[] = ["newest", "oldest", "name", "largest"]

type Query =Record<string, string | string[] | undefined>

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? ""

const among = <T extends string>(options: readonly T[], value: string): T | null =>
  (options as readonly string[]).includes(value) ? (value as T) : null

export default async function AssetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>
  searchParams: Promise<Query>
}) {
  const [{ org: orgSlug }, query] = await Promise.all([params, searchParams])
  const { org, member } = await requireMember(orgSlug)

  const folders = await listFolders(org.id)
  const folder = one(query.folder)
  const state: LibraryState = {
    trash: one(query.trash) === "1",
    // A folder that has gone — deleted, or a stale link — reads as the root rather than as an error.
    folderId: folders.some((entry) => entry.id === folder) ? folder : null,
    q: one(query.q).trim().slice(0, 200),
    kind: among<AssetKind>(assetKinds, one(query.kind)),
    tag: one(query.tag).trim().slice(0, 32) || null,
    sort: among(sorts, one(query.sort)) ?? "newest",
    view: one(query.view) === "list" ? "list" : "grid",
  }

  const filter = {
    query: state.q || undefined,
    kind: state.kind ?? undefined,
    tag: state.tag ?? undefined,
    sort: state.sort,
  }
  const [rows, trashed, tags, storage] = await Promise.all([
    listAssets(org.id, { ...filter, folderId: state.folderId, trashed: state.trash }),
    // The rail shows how much is in the trash wherever you are standing.
    listAssets(org.id, { trashed: true }),
    listTags(org.id),
    storageUsed(org.id),
  ])

  return (
    <AssetLibrary
      orgSlug={org.slug}
      state={state}
      assets={rows.map((row) => ({
        ...row,
        deletedAt: row.deletedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }))}
      folders={folders}
      tags={tags.map(({ tag, uses }) => ({ tag, uses }))}
      storage={storage}
      trashCount={trashed.length}
      permissions={{
        create: can(member.role, "asset:create"),
        update: can(member.role, "asset:update"),
        remove: can(member.role, "asset:delete"),
      }}
    />
  )
}
