import { MembersAdmin } from "@/components/studio/admin/members"
import { canManageMembers } from "@/lib/studio/permissions"
import { listInvitations, listMembers } from "@/lib/studio/queries"
import { requireMember } from "@/lib/studio/session"

export const metadata = { title: "Members" }

export default async function MembersPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const { org, member } = await requireMember(slug)
  // An invitation's id is its secret, so the list only leaves the server for those who could make one.
  const [members, invitations] = await Promise.all([
    listMembers(org.id),
    canManageMembers(member.role) ? listInvitations(org.id) : [],
  ])

  return (
    <MembersAdmin
      org={{ id: org.id, name: org.name, slug: org.slug }}
      me={{ memberId: member.id, role: member.role }}
      members={members}
      invitations={invitations.map(({ id, email, role, expiresAt }) => ({ id, email, role, expiresAt }))}
    />
  )
}
