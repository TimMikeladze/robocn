/**
 * Studio's roles in better-auth's own terms. Shared by the server config and
 * the browser client, so `inviteMember({ role: "viewer" })` type-checks on one
 * side and is accepted on the other. The grants themselves live in
 * `./permissions`; this only hands them to better-auth.
 */

import { createAccessControl } from "better-auth/plugins/access"
import { adminAc, defaultStatements, memberAc, ownerAc } from "better-auth/plugins/organization/access"

import { grants, statements } from "@/lib/studio/permissions"

export const ac = createAccessControl({ ...defaultStatements, ...statements })

/** Studio's grants on top of better-auth's own for members and invitations. */
export const studioRoles = {
  owner: ac.newRole({ ...ownerAc.statements, ...grants.owner } as never),
  admin: ac.newRole({ ...adminAc.statements, ...grants.admin } as never),
  editor: ac.newRole({ ...memberAc.statements, ...grants.editor } as never),
  viewer: ac.newRole({ ...memberAc.statements, ...grants.viewer } as never),
}
