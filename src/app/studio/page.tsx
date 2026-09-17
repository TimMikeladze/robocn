import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { StudioLanding } from "@/components/studio/landing"
import { getSession, listMemberships } from "@/lib/studio/session"

export const dynamic = "force-dynamic"

/** The one Studio URL that is for everyone, so the one that may be indexed. */
export const metadata: Metadata = {
  title: { absolute: "robocn Studio — design robot components as a team" },
  alternates: { canonical: "/studio" },
  robots: { index: true, follow: true },
}

/** The front door: the pitch when signed out, otherwise the organization you were last in. */
export default async function StudioIndex() {
  const session = await getSession()
  if (!session) return <StudioLanding />
  const memberships = await listMemberships(session.user.id)
  if (!memberships.length) redirect("/studio/onboarding")
  const active = memberships.find((org) => org.id === session.session.activeOrganizationId)
  redirect(`/studio/${(active ?? memberships[0]).slug}`)
}
