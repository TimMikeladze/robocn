/**
 * An invitation link. better-auth only hands an invitation to the address it
 * was written for, and answers everything else — expired, cancelled, wrong
 * account — with the same refusal. The row is read again here so the page can
 * say which of those it was, and which account would work.
 */

import { eq } from "drizzle-orm"
import { headers } from "next/headers"

import {
  InvitationCard,
  InvitationProblem,
  type InvitationReason,
} from "@/components/studio/admin/invitation"
import { db, schema } from "@/db"
import { auth } from "@/lib/auth"
import { requireUser } from "@/lib/studio/session"

export const metadata = { title: "Invitation" }
export const dynamic = "force-dynamic"

/** Why better-auth refused, read off the row it would not show. */
function explain(
  row: { email: string; status: string; expiresAt: Date } | undefined,
  email: string,
): InvitationReason {
  if (!row) return "missing"
  if (row.status === "accepted") return "accepted"
  if (row.status !== "pending") return "closed"
  if (row.expiresAt.getTime() < Date.now()) return "expired"
  if (row.email.toLowerCase() !== email.toLowerCase()) return "wrong-account"
  return "unavailable"
}

export default async function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser(`/studio/invite/${id}`)

  const invitation = await auth.api
    .getInvitation({ query: { id }, headers: await headers() })
    .catch(() => null)

  const [row] = await db
    .select({
      email: schema.invitation.email,
      status: schema.invitation.status,
      expiresAt: schema.invitation.expiresAt,
      orgName: schema.organization.name,
      orgSlug: schema.organization.slug,
      inviterName: schema.user.name,
    })
    .from(schema.invitation)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.invitation.organizationId))
    .leftJoin(schema.user, eq(schema.user.id, schema.invitation.inviterId))
    .where(eq(schema.invitation.id, id))
    .limit(1)

  const reason = explain(row, user.email)

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-5 py-12">
      {invitation && row ? (
        <InvitationCard
          invitation={{
            id: invitation.id,
            role: invitation.role,
            organizationName: invitation.organizationName,
            organizationSlug: row.orgSlug,
            inviterName: row.inviterName,
            inviterEmail: invitation.inviterEmail,
            expiresAt: row.expiresAt,
          }}
          signedInAs={user.email}
        />
      ) : (
        <InvitationProblem
          reason={reason}
          invitedEmail={row?.email ?? null}
          orgName={row?.orgName ?? null}
          // Only someone the invitation was for learns where it led.
          orgSlug={reason === "accepted" && row?.email.toLowerCase() === user.email.toLowerCase() ? row.orgSlug : null}
          signedInAs={user.email}
          next={`/studio/invite/${id}`}
        />
      )}
    </div>
  )
}
