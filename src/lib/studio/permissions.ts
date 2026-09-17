/**
 * Who may do what in a Studio organization.
 *
 * One pure table, read by two things: better-auth's access control (so the
 * roles exist and an invitation can name them) and `can()`, which every server
 * action and route handler calls before it touches a row. Notes:
 * `docs/studio.md`.
 */

export const roles = ["owner", "admin", "editor", "viewer"] as const
export type Role = (typeof roles)[number]

/** Resources and the verbs that exist on them. The shape better-auth's `createAccessControl` wants. */
export const statements = {
  design: ["create", "update", "delete", "publish", "share"],
  project: ["create", "update", "delete"],
  asset: ["create", "update", "delete"],
  palette: ["create", "update", "delete"],
  comment: ["create", "resolve"],
  settings: ["update"],
} as const

type Statements = typeof statements
export type Permission = {
  [Resource in keyof Statements]: `${Resource}:${Statements[Resource][number]}`
}[keyof Statements]

type Grants = { [Resource in keyof Statements]?: readonly Statements[Resource][number][] }

const everything: Grants = statements

/**
 * Editors make things and publish them; they do not run the organization.
 * Viewers read and talk. Admins differ from owners only in what better-auth
 * itself guards: deleting the organization and moving ownership.
 */
export const grants: Record<Role, Grants> = {
  owner: everything,
  admin: everything,
  editor: {
    design: ["create", "update", "delete", "publish", "share"],
    project: ["create", "update", "delete"],
    asset: ["create", "update", "delete"],
    palette: ["create", "update", "delete"],
    comment: ["create", "resolve"],
  },
  viewer: { comment: ["create"] },
}

export const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (roles as readonly string[]).includes(value)

/**
 * better-auth stores a member's roles as one comma-joined string, and stock
 * installs call the editor role `member`. Both are read here so nothing else
 * has to know.
 */
export function parseRoles(raw: string | null | undefined): Role[] {
  return (raw ?? "")
    .split(",")
    .map((part) => part.trim())
    .map((part) => (part === "member" ? "editor" : part))
    .filter(isRole)
}

export function can(role: string | null | undefined, permission: Permission): boolean {
  const [resource, verb] = permission.split(":") as [keyof Statements, string]
  return parseRoles(role).some((held) =>
    (grants[held][resource] as readonly string[] | undefined)?.includes(verb),
  )
}

/** Managing people is better-auth's own business; this mirrors its rule for the UI. */
export const canManageMembers = (role: string | null | undefined) =>
  parseRoles(role).some((held) => held === "owner" || held === "admin")

export const isOwner = (role: string | null | undefined) => parseRoles(role).includes("owner")

/** The roles someone holding `role` may hand out: never one above their own. */
export function assignableRoles(role: string | null | undefined): Role[] {
  if (isOwner(role)) return [...roles]
  if (canManageMembers(role)) return ["admin", "editor", "viewer"]
  return []
}

export const roleLabels: Record<Role, { label: string; description: string }> = {
  owner: { label: "Owner", description: "Everything, including deleting the organization." },
  admin: { label: "Admin", description: "Everything except deleting the organization." },
  editor: { label: "Editor", description: "Creates, edits and publishes designs and assets." },
  viewer: { label: "Viewer", description: "Reads everything and comments." },
}
