"use server"

/**
 * The library, read from the client. The asset page gets its rows from its
 * server component; the picker opens inside other surfaces — the editor,
 * settings — that never loaded them, so it asks here. Any member may browse.
 */

import { z } from "zod"

import { run } from "@/lib/studio/action"
import { assetKinds } from "@/lib/studio/asset-kinds"
import { listAssets, listFolders } from "@/lib/studio/queries"
import { authorize } from "@/lib/studio/session"

const filterInput = z.object({
  /** `null` is the root; absent looks in every folder. */
  folderId: z.string().max(64).nullish(),
  query: z.string().max(200).optional(),
  kind: z.enum(assetKinds).optional(),
})

export type BrowseFilter = z.input<typeof filterInput>

export async function browseAssets(orgSlug: string, filter: BrowseFilter = {}) {
  return run(async () => {
    const m = await authorize(orgSlug)
    const { folderId, query, kind } = filterInput.parse(filter)
    const [assets, folders] = await Promise.all([
      listAssets(m.org.id, { folderId, query, kind, sort: "newest" }),
      listFolders(m.org.id),
    ])
    return { assets, folders }
  })
}
