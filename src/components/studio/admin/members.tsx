"use client"

/**
 * Who is in the organization and who has been asked.
 *
 * People are better-auth's business, so this talks to its client rather than
 * to a server action — always naming the organization, never trusting the
 * session's "active" one, which is whatever tab was touched last. There is no
 * mailer: an invitation is a link, and this page is where it is copied from.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { LogOut, Trash2, UserPlus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuthCall } from "@/components/studio/admin/auth-call"
import {
  Avatar,
  ConfirmModal,
  CopyButton,
  EmptyState,
  Field,
  PageBody,
  PageHeader,
  Pill,
  Section,
  TimeAgo,
  fieldClass,
} from "@/components/studio/kit"
import { authClient } from "@/lib/auth-client"
import {
  assignableRoles,
  canManageMembers,
  isOwner,
  parseRoles,
  roleLabels,
  type Role,
} from "@/lib/studio/permissions"
import { cn } from "@/lib/utils"

export interface MemberRow {
  id: string
  userId: string
  role: string
  createdAt: Date
  name: string
  email: string
}

export interface InvitationRow {
  id: string
  email: string
  role: string | null
  expiresAt: Date
}

const noop = () => () => {}
/** The page's own origin, which is the only right one on an arbitrary dev port. Empty on the server. */
const useOrigin = () =>
  React.useSyncExternalStore(noop, () => window.location.origin, () => "")

const roleName = (raw: string | null) => {
  const held = parseRoles(raw)
  return held.length ? held.map((role) => roleLabels[role].label).join(", ") : "Member"
}

function MembersAdmin({
  org,
  me,
  members,
  invitations,
}: {
  org: { id: string; name: string; slug: string }
  me: { memberId: string; role: string }
  members: MemberRow[]
  invitations: InvitationRow[]
}) {
  const router = useRouter()
  const origin = useOrigin()
  const { pending, call } = useAuthCall()
  const manage = canManageMembers(me.role)
  const assignable = assignableRoles(me.role)
  const owners = members.filter((member) => isOwner(member.role)).length

  const [removing, setRemoving] = React.useState<MemberRow | null>(null)
  const [leaving, setLeaving] = React.useState(false)
  const [invited, setInvited] = React.useState<{ id: string; email: string } | null>(null)
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState<Role>("editor")

  const linkFor = (id: string) => `${origin}/studio/invite/${id}`

  /** An admin may not touch an owner, and nobody edits their own row here. */
  const editable = (member: MemberRow) =>
    manage && member.id !== me.memberId && (isOwner(me.role) || !isOwner(member.role))

  async function changeRole(member: MemberRow, next: Role) {
    const done = await call(
      () =>
        authClient.organization.updateMemberRole({
          memberId: member.id,
          role: next,
          organizationId: org.id,
        }),
      { success: `${member.name} is now ${roleLabels[next].label.toLowerCase()}.` },
    )
    if (done) router.refresh()
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault()
    const address = email.trim().toLowerCase()
    const created = await call(
      () =>
        authClient.organization.inviteMember({
          email: address,
          role,
          organizationId: org.id,
        }),
      { success: "Invitation created. Copy the link and send it." },
    )
    if (!created) return
    setInvited({ id: created.id, email: address })
    setEmail("")
    router.refresh()
  }

  return (
    <>
      <PageHeader
        eyebrow={org.name}
        title="Members"
        description="Owners and admins run the organization, editors make and publish designs, viewers read and comment."
      >
        <Button variant="outline" size="sm" onClick={() => setLeaving(true)}>
          <LogOut /> Leave organization
        </Button>
      </PageHeader>

      <PageBody className="space-y-6">
        <Section
          title={`${members.length} ${members.length === 1 ? "member" : "members"}`}
          description={manage ? "Change a role or remove someone." : "Only owners and admins can change this list."}
        >
          {/* `relative`, so the screen-reader-only header cell is clipped with the rest and cannot widen the page. */}
          <div className="relative -m-4 overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th scope="col" className="px-4 py-2 font-normal">Member</th>
                  <th scope="col" className="px-2 py-2 font-normal sm:px-4">Role</th>
                  <th scope="col" className="hidden px-4 py-2 font-normal sm:table-cell">Joined</th>
                  {manage ? (
                    <th scope="col" className="w-10 py-2 pr-3 sm:px-4">
                      <span className="sr-only">Remove</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const held = parseRoles(member.role)[0] ?? "editor"
                  return (
                    <tr key={member.id} className="border-b border-border last:border-b-0">
                      {/* `w-full max-w-0` lets the cell shrink, so long emails truncate instead of pushing the role off a phone. */}
                      <td className="w-full max-w-0 px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar name={member.name} className="hidden size-7 text-[10px] sm:inline-flex" />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate font-medium">
                              <span className="truncate">{member.name}</span>
                              {member.id === me.memberId ? (
                                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                                  You
                                </span>
                              ) : null}
                            </p>
                            <p className="truncate text-[12px] text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 sm:px-4">
                        {editable(member) ? (
                          <select
                            // Controlled by the saved role, so a refused change falls back to it.
                            aria-label={`Role for ${member.name}`}
                            value={held}
                            disabled={pending}
                            onChange={(event) => changeRole(member, event.target.value as Role)}
                            className={cn(fieldClass, "w-28")}
                          >
                            {/* A role this viewer cannot grant still has to show as the current value. */}
                            {(assignable.includes(held) ? assignable : [held, ...assignable]).map((option) => (
                              <option key={option} value={option} disabled={!assignable.includes(option)}>
                                {roleLabels[option].label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Pill>{roleName(member.role)}</Pill>
                        )}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-2.5 text-muted-foreground sm:table-cell">
                        <TimeAgo date={member.createdAt} />
                      </td>
                      {manage ? (
                        <td className="py-2.5 pr-3 text-right sm:px-4">
                          {editable(member) ? (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remove ${member.name}`}
                              onClick={() => setRemoving(member)}
                            >
                              <Trash2 />
                            </Button>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {manage ? (
          <Section
            title="Invite someone"
            description="Studio sends no email. Creating an invitation gives you a link to pass on; it works once, for that address, for seven days."
          >
            <form onSubmit={invite} className="flex flex-wrap items-end gap-3">
              <Field label="Email" htmlFor="invite-email" className="min-w-0 flex-1 basis-56">
                <input
                  id="invite-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="teammate@example.com"
                  autoComplete="off"
                  className={fieldClass}
                />
              </Field>
              <Field label="Role" htmlFor="invite-role" className="w-32">
                <select
                  id="invite-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as Role)}
                  className={fieldClass}
                >
                  {assignable.map((option) => (
                    <option key={option} value={option}>
                      {roleLabels[option].label}
                    </option>
                  ))}
                </select>
              </Field>
              <Button type="submit" size="sm" className="h-8" disabled={pending}>
                <UserPlus /> Create invitation
              </Button>
            </form>
            <p className="mt-2 text-[12px] text-muted-foreground">{roleLabels[role].description}</p>

            {invited ? (
              <div role="status" className="mt-4 border border-border bg-background p-3">
                <p className="text-[13px]">
                  Send this link to <span className="font-medium">{invited.email}</span>. They sign in or
                  sign up with that address, then accept.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 basis-56 truncate rounded-md border border-border bg-panel px-2 py-1.5 font-mono text-[12px]">
                    {linkFor(invited.id)}
                  </code>
                  <CopyButton value={() => linkFor(invited.id)} label="Copy link" />
                  <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={() => setInvited(null)}>
                    <X />
                  </Button>
                </div>
              </div>
            ) : null}
          </Section>
        ) : null}

        {manage ? (
          <Section title="Pending invitations" description="Links that have not been used yet.">
            {invitations.length === 0 ? (
              <EmptyState title="Nobody is waiting">Invitations you create show up here until they are accepted, declined or expire.</EmptyState>
            ) : (
              <ul className="-m-4 divide-y divide-border">
                {invitations.map((invitation) => (
                  <li key={invitation.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="truncate text-[13px] font-medium">{invitation.email}</p>
                      <p className="text-[12px] text-muted-foreground">
                        Expires <TimeAgo date={invitation.expiresAt} />
                      </p>
                    </div>
                    <Pill>{roleName(invitation.role)}</Pill>
                    <CopyButton value={() => linkFor(invitation.id)} label="Copy link" />
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={async () => {
                        const done = await call(
                          () => authClient.organization.cancelInvitation({ invitationId: invitation.id }),
                          { success: "Invitation cancelled." },
                        )
                        if (!done) return
                        if (invited?.id === invitation.id) setInvited(null)
                        router.refresh()
                      }}
                    >
                      Cancel
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ) : null}
      </PageBody>

      <ConfirmModal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name ?? "member"}?`}
        confirmLabel="Remove"
        pending={pending}
        onConfirm={async () => {
          if (!removing) return
          const done = await call(
            () =>
              authClient.organization.removeMember({
                memberIdOrEmail: removing.id,
                organizationId: org.id,
              }),
            { success: `${removing.name} was removed.` },
          )
          setRemoving(null)
          if (done) router.refresh()
        }}
      >
        They lose access to {org.name} straight away. Designs, versions and comments they made stay.
      </ConfirmModal>

      <ConfirmModal
        open={leaving}
        onClose={() => setLeaving(false)}
        title={`Leave ${org.name}?`}
        confirmLabel="Leave"
        pending={pending}
        onConfirm={async () => {
          const done = await call(() => authClient.organization.leave({ organizationId: org.id }), {
            success: `You left ${org.name}.`,
          })
          setLeaving(false)
          if (!done) return
          router.push("/studio")
          router.refresh()
        }}
      >
        {isOwner(me.role) && owners <= 1
          ? "You are the only owner. Make someone else an owner first, or delete the organization from its settings."
          : "You will need a new invitation to come back."}
      </ConfirmModal>
    </>
  )
}

export { MembersAdmin }
