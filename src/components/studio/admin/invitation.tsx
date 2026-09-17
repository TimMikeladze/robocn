"use client"

/**
 * The two ends of an invitation link: the offer, and the explanation when the
 * offer cannot be made. The second matters more than it looks — an invitation
 * is tied to an address, and "signed in as the wrong one" is the usual failure.
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useAuthCall } from "@/components/studio/admin/auth-call"
import { Avatar, Pill, TimeAgo, eyebrow } from "@/components/studio/kit"
import { authClient } from "@/lib/auth-client"
import { parseRoles, roleLabels } from "@/lib/studio/permissions"

export type InvitationReason = "missing" | "accepted" | "closed" | "expired" | "wrong-account" | "unavailable"

function InvitationCard({
  invitation,
  signedInAs,
}: {
  invitation: {
    id: string
    role: string | null
    organizationName: string
    organizationSlug: string
    inviterName: string | null
    inviterEmail: string
    expiresAt: Date
  }
  signedInAs: string
}) {
  const router = useRouter()
  const { pending, call } = useAuthCall()
  const role = parseRoles(invitation.role)[0] ?? "editor"

  return (
    <div className="w-full max-w-md space-y-5">
      <div>
        <p className={eyebrow}>Invitation</p>
        <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.02em]">
          Join {invitation.organizationName}
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {invitation.inviterName ?? invitation.inviterEmail} invited you to work with them in robocn
          Studio.
        </p>
      </div>

      <dl className="divide-y divide-border border border-border bg-panel text-[13px]">
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <dt className="text-muted-foreground">Organization</dt>
          <dd className="flex min-w-0 items-center gap-2 font-medium">
            <Avatar name={invitation.organizationName} className="rounded-md" />
            <span className="truncate">{invitation.organizationName}</span>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <dt className="text-muted-foreground">Invited by</dt>
          <dd className="min-w-0 truncate">{invitation.inviterEmail}</dd>
        </div>
        <div className="flex items-start justify-between gap-4 px-4 py-2.5">
          <dt className="text-muted-foreground">Your role</dt>
          <dd className="text-right">
            <Pill>{roleLabels[role].label}</Pill>
            <p className="mt-1 text-[12px] text-muted-foreground">{roleLabels[role].description}</p>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <dt className="text-muted-foreground">Expires</dt>
          <dd>
            <TimeAgo date={invitation.expiresAt} />
          </dd>
        </div>
      </dl>

      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={pending}
          onClick={async () => {
            const done = await call(
              () => authClient.organization.acceptInvitation({ invitationId: invitation.id }),
              { success: `Welcome to ${invitation.organizationName}.` },
            )
            if (!done) return
            router.push(`/studio/${invitation.organizationSlug}`)
            router.refresh()
          }}
        >
          Accept invitation
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={async () => {
            const done = await call(
              () => authClient.organization.rejectInvitation({ invitationId: invitation.id }),
              { success: "Invitation declined." },
            )
            if (!done) return
            router.push("/studio")
            router.refresh()
          }}
        >
          Decline
        </Button>
      </div>
      <p className="text-center text-[12px] text-muted-foreground">Signed in as {signedInAs}</p>
    </div>
  )
}

const explanations: Record<InvitationReason, { title: string; body: string }> = {
  missing: {
    title: "This invitation does not exist",
    body: "The link may be incomplete, or the invitation was withdrawn. Ask whoever sent it for a new one.",
  },
  accepted: {
    title: "This invitation was already accepted",
    body: "An invitation works once. If it was yours, the organization is already in your Studio.",
  },
  closed: {
    title: "This invitation is no longer open",
    body: "It was declined or cancelled. Ask whoever sent it for a new one.",
  },
  expired: {
    title: "This invitation has expired",
    body: "Invitations last seven days. Ask whoever sent it for a new one.",
  },
  "wrong-account": {
    title: "This invitation is for a different account",
    body: "An invitation can only be accepted by the address it was sent to. Sign out, then sign in or sign up with that address.",
  },
  unavailable: {
    title: "This invitation cannot be opened",
    body: "Whoever sent it may have left the organization. Ask for a new one.",
  },
}

function InvitationProblem({
  reason,
  invitedEmail,
  orgName,
  orgSlug,
  signedInAs,
  next,
}: {
  reason: InvitationReason
  invitedEmail: string | null
  orgName: string | null
  orgSlug: string | null
  signedInAs: string
  next: string
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const { title, body } = explanations[reason]

  return (
    <div className="w-full max-w-md space-y-5">
      <div>
        <p className={eyebrow}>Invitation{orgName ? ` · ${orgName}` : ""}</p>
        <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.02em]">{title}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">{body}</p>
      </div>

      <dl className="divide-y divide-border border border-border bg-panel text-[13px]">
        {invitedEmail ? (
          <div className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="shrink-0 text-muted-foreground">Invitation for</dt>
            <dd className="min-w-0 truncate font-medium">{invitedEmail}</dd>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <dt className="shrink-0 text-muted-foreground">Signed in as</dt>
          <dd className="min-w-0 truncate font-medium">{signedInAs}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={reason === "wrong-account" ? "default" : "outline"}
          disabled={pending}
          onClick={async () => {
            setPending(true)
            await authClient.signOut()
            // Back to this link afterwards, as whoever signs in next.
            router.push(`/studio/sign-in?next=${encodeURIComponent(next)}`)
            router.refresh()
          }}
        >
          Sign out and switch account
        </Button>
        <Button variant="ghost" nativeButton={false} render={<Link href={orgSlug ? `/studio/${orgSlug}` : "/studio"} />}>
          {orgSlug ? `Open ${orgName}` : "Go to Studio"}
        </Button>
      </div>
    </div>
  )
}

export { InvitationCard, InvitationProblem }
