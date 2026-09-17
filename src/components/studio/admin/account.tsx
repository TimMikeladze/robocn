"use client"

/**
 * The account, which belongs to the person and not to any organization — hence
 * no sidebar and no org in the URL. Everything here is better-auth's own API.
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, LogOut, MonitorSmartphone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuthCall } from "@/components/studio/admin/auth-call"
import { Field, Modal, PageBody, PageHeader, Pill, Section, TimeAgo, fieldClass } from "@/components/studio/kit"
import { authClient } from "@/lib/auth-client"

interface SessionRow {
  id: string
  token: string
  userAgent?: string | null
  ipAddress?: string | null
  createdAt: Date
}

/** "Chrome on macOS" out of a user-agent string. Rough on purpose: it labels a row, nothing more. */
export function describeAgent(agent: string | null | undefined) {
  if (!agent) return "Unknown device"
  const browser =
    [
      ["Edg/", "Edge"],
      ["OPR/", "Opera"],
      ["Firefox/", "Firefox"],
      ["Chrome/", "Chrome"],
      ["Safari/", "Safari"],
      ["curl/", "curl"],
    ].find(([needle]) => agent.includes(needle))?.[1] ?? "A browser"
  const system =
    [
      ["iPhone", "iPhone"],
      ["iPad", "iPad"],
      ["Android", "Android"],
      ["Mac OS X", "macOS"],
      ["Windows", "Windows"],
      ["Linux", "Linux"],
    ].find(([needle]) => agent.includes(needle))?.[1] ?? null
  return system ? `${browser} on ${system}` : browser
}

function ProfileSection({ user }: { user: { name: string; email: string } }) {
  const router = useRouter()
  const { pending, call } = useAuthCall()
  const [name, setName] = React.useState(user.name)

  return (
    <Section title="Profile" description="Your name is what teammates see on versions and comments.">
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault()
          const done = await call(() => authClient.updateUser({ name: name.trim() }), { success: "Name saved." })
          if (done) router.refresh()
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="account-name">
            <input
              id="account-name"
              required
              maxLength={80}
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={fieldClass}
            />
          </Field>
          <Field label="Email" htmlFor="account-email" hint="Invitations are tied to this address.">
            <input id="account-email" value={user.email} readOnly disabled className={fieldClass} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={pending || !name.trim() || name.trim() === user.name}>
            Save
          </Button>
        </div>
      </form>
    </Section>
  )
}

function PasswordSection({ onChanged }: { onChanged: () => void }) {
  const { pending, call } = useAuthCall()
  const [error, setError] = React.useState<string | null>(null)

  return (
    <Section title="Password">
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault()
          const form = event.currentTarget
          const data = new FormData(form)
          const newPassword = String(data.get("new") ?? "")
          if (newPassword !== String(data.get("confirm") ?? "")) {
            setError("The two new passwords do not match.")
            return
          }
          setError(null)
          const done = await call(
            () =>
              authClient.changePassword({
                currentPassword: String(data.get("current") ?? ""),
                newPassword,
                revokeOtherSessions: data.get("revoke") === "on",
              }),
            { success: "Password changed." },
          )
          if (!done) return
          form.reset()
          onChanged()
        }}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Current password" htmlFor="password-current">
            <input
              id="password-current"
              name="current"
              type="password"
              required
              autoComplete="current-password"
              className={fieldClass}
            />
          </Field>
          <Field label="New password" htmlFor="password-new" hint="At least 8 characters.">
            <input
              id="password-new"
              name="new"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className={fieldClass}
            />
          </Field>
          <Field label="New password, again" htmlFor="password-confirm" error={error}>
            <input
              id="password-confirm"
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className={fieldClass}
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" name="revoke" defaultChecked className="size-3.5 accent-foreground" />
            Sign out everywhere else
          </label>
          <Button type="submit" size="sm" disabled={pending}>
            Change password
          </Button>
        </div>
      </form>
    </Section>
  )
}

function SessionsSection({
  sessions,
  currentSessionId,
  onRevoked,
}: {
  sessions: SessionRow[]
  currentSessionId: string | null
  onRevoked: () => void
}) {
  const { pending, call } = useAuthCall()

  return (
    <Section title="Sessions" description="Everywhere this account is signed in.">
      <ul className="-m-4 divide-y divide-border">
        {sessions.map((session) => {
          const current = session.id === currentSessionId
          return (
            <li key={session.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
              <MonitorSmartphone aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-[13px] font-medium">{describeAgent(session.userAgent)}</p>
                <p className="truncate text-[12px] text-muted-foreground">
                  Signed in <TimeAgo date={session.createdAt} />
                  {session.ipAddress ? ` · ${session.ipAddress}` : ""}
                </p>
              </div>
              {current ? (
                <Pill color="#16a34a">This device</Pill>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={async () => {
                    const done = await call(() => authClient.revokeSession({ token: session.token }), {
                      success: "Session revoked.",
                    })
                    if (done) onRevoked()
                  }}
                >
                  Revoke
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

function DeleteAccount({ email }: { email: string }) {
  const router = useRouter()
  const { pending, call } = useAuthCall()
  const [open, setOpen] = React.useState(false)
  const [password, setPassword] = React.useState("")
  const close = () => {
    setOpen(false)
    setPassword("")
  }

  return (
    <Section title="Danger zone" className="border-destructive/40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium">Delete this account</p>
          <p className="text-[12px] text-muted-foreground">
            You leave every organization. Organizations and the designs in them stay with their other members.
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
          Delete account
        </Button>
      </div>

      <Modal
        open={open}
        onClose={close}
        title="Delete your account?"
        eyebrow="This cannot be undone"
        size="sm"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" form="delete-account" variant="destructive" size="sm" disabled={pending || !password}>
              Delete forever
            </Button>
          </>
        }
      >
        <form
          id="delete-account"
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault()
            const done = await call(() => authClient.deleteUser({ password }), { success: "Account deleted." })
            if (!done) return
            router.push("/studio/sign-in")
            router.refresh()
          }}
        >
          <p className="text-[13px] text-muted-foreground">
            This deletes <span className="font-medium text-foreground">{email}</span>. If you are the only owner
            of an organization, hand it over or delete it first.
          </p>
          <Field label="Password" htmlFor="delete-password">
            <input
              id="delete-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={fieldClass}
            />
          </Field>
        </form>
      </Modal>
    </Section>
  )
}

function AccountAdmin({
  user,
  currentSessionId,
  sessions,
}: {
  user: { name: string; email: string }
  currentSessionId: string | null
  sessions: SessionRow[]
}) {
  const router = useRouter()
  // The list is the server's; changing it is a matter of asking again.
  const reload = () => router.refresh()

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="px-5 pt-4 sm:px-8">
        <Link
          href="/studio"
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to Studio
        </Link>
      </div>
      <PageHeader eyebrow="robocn Studio" title="Account" description={user.email}>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await authClient.signOut()
            router.push("/studio/sign-in")
            router.refresh()
          }}
        >
          <LogOut /> Sign out
        </Button>
      </PageHeader>
      <PageBody className="space-y-6">
        <ProfileSection key={user.name} user={user} />
        <PasswordSection onChanged={reload} />
        <SessionsSection sessions={sessions} currentSessionId={currentSessionId} onRevoked={reload} />
        <DeleteAccount email={user.email} />
      </PageBody>
    </div>
  )
}

export { AccountAdmin }
