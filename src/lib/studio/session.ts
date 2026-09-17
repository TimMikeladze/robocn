/**
 * Who is asking, and for which organization.
 *
 * Everything that reads or writes a tenant's rows comes through
 * `requireMember`. It resolves the organization from the *URL's* slug and the
 * member row from the database — never from the client's idea of an "active"
 * organization — so a request can only ever reach an organization its user
 * belongs to.
 */

import "server-only"

import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { cache } from "react"

import { db, schema } from "@/db"
import { auth } from "@/lib/auth"
import { can, type Permission } from "@/lib/studio/permissions"
import { parseSettings, type OrgSettings } from "@/lib/studio/settings"

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }))

export async function requireUser(next?: string) {
  const session = await getSession()
  if (!session) {
    redirect(next ? `/studio/sign-in?next=${encodeURIComponent(next)}` : "/studio/sign-in")
  }
  return session.user
}

export interface Membership {
  user: { id: string; name: string; email: string; image?: string | null }
  org: { id: string; name: string; slug: string; logo: string | null; settings: OrgSettings }
  member: { id: string; role: string }
}

const findMembership = cache(async (userId: string, orgSlug: string) => {
  const [row] = await db
    .select({ org: schema.organization, member: schema.member })
    .from(schema.member)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.member.organizationId))
    .where(and(eq(schema.member.userId, userId), eq(schema.organization.slug, orgSlug)))
    .limit(1)
  return row ?? null
})

/** For pages: signed out goes to sign-in, a stranger gets a 404 — not a hint that the org exists. */
export async function requireMember(orgSlug: string): Promise<Membership> {
  const user = await requireUser(`/studio/${orgSlug}`)
  const row = await findMembership(user.id, orgSlug)
  if (!row) notFound()
  return {
    user,
    org: {
      id: row.org.id,
      name: row.org.name,
      slug: row.org.slug,
      logo: row.org.logo,
      settings: parseSettings(row.org.settings),
    },
    member: { id: row.member.id, role: row.member.role },
  }
}

export class StudioError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 = 400,
  ) {
    super(message)
  }
}

/** For actions and route handlers: throws instead of redirecting, and checks a permission. */
export async function authorize(orgSlug: string, permission?: Permission): Promise<Membership> {
  const session = await getSession()
  if (!session) throw new StudioError("Sign in to continue.", 401)
  const row = await findMembership(session.user.id, orgSlug)
  if (!row) throw new StudioError("Organization not found.", 404)
  if (permission && !can(row.member.role, permission)) {
    throw new StudioError("Your role does not allow that.", 403)
  }
  return {
    user: session.user,
    org: {
      id: row.org.id,
      name: row.org.name,
      slug: row.org.slug,
      logo: row.org.logo,
      settings: parseSettings(row.org.settings),
    },
    member: { id: row.member.id, role: row.member.role },
  }
}

/** Every organization the user belongs to, for the switcher and the `/studio` redirect. */
export const listMemberships = cache(async (userId: string) =>
  db
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      slug: schema.organization.slug,
      role: schema.member.role,
    })
    .from(schema.member)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.member.organizationId))
    .where(eq(schema.member.userId, userId))
    .orderBy(schema.organization.name),
)
