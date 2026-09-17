import { headers } from "next/headers"

import { AccountAdmin } from "@/components/studio/admin/account"
import { auth } from "@/lib/auth"
import { getSession, requireUser } from "@/lib/studio/session"

export const metadata = { title: "Account" }
export const dynamic = "force-dynamic"

export default async function AccountPage() {
  const user = await requireUser("/studio/account")
  const [session, sessions] = await Promise.all([
    getSession(),
    auth.api.listSessions({ headers: await headers() }),
  ])

  return (
    <AccountAdmin
      user={{ name: user.name, email: user.email }}
      currentSessionId={session?.session.id ?? null}
      // The tokens are the user's own, and revoking a session is addressed by one.
      sessions={sessions
        .map(({ id, token, userAgent, ipAddress, createdAt }) => ({ id, token, userAgent, ipAddress, createdAt }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())}
    />
  )
}
