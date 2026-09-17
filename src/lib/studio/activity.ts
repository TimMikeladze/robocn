/** The organization's feed: a row per thing that happened, written by the actions that did it. */

export const verbs = {
  "design.created": "created",
  "design.forked": "forked",
  "design.renamed": "renamed",
  "design.saved": "saved a version of",
  "design.restored": "restored a version of",
  "design.staged": "moved",
  "design.published": "published",
  "design.unpublished": "unpublished",
  "design.archived": "archived",
  "design.unarchived": "restored",
  "design.deleted": "deleted",
  "design.shared": "created a share link for",
  "comment.created": "commented on",
  "comment.resolved": "resolved a thread on",
  "project.created": "created project",
  "project.updated": "updated project",
  "project.deleted": "deleted project",
  "asset.uploaded": "uploaded",
  "asset.replaced": "replaced",
  "asset.trashed": "moved to trash",
  "asset.restored": "restored",
  "asset.purged": "permanently deleted",
  "palette.created": "created palette",
  "palette.updated": "updated palette",
  "palette.deleted": "deleted palette",
  "settings.updated": "updated",
} as const

export type Verb = keyof typeof verbs

export interface ActivityLine {
  verb: string
  targetName: string
  meta: Record<string, unknown>
}

/** `moved Loader arm to In review` — the sentence after the actor's name. */
export function describeActivity({ verb, targetName, meta }: ActivityLine): string {
  const phrase = verbs[verb as Verb] ?? verb
  const name = targetName || "something"
  if (verb === "design.staged" && typeof meta.to === "string") return `${phrase} ${name} to ${meta.to}`
  if (verb === "design.saved" && typeof meta.number === "number") return `saved v${meta.number} of ${name}`
  if (verb === "design.restored" && typeof meta.from === "number")
    return `restored v${meta.from} of ${name}`
  if (verb === "asset.uploaded" && typeof meta.count === "number" && meta.count > 1)
    return `${phrase} ${meta.count} files`
  if (verb === "settings.updated") return `${phrase} ${name} settings`
  return `${phrase} ${name}`
}
