import { Sidebar } from "@/components/studio/sidebar"
import { listMemberships, requireMember } from "@/lib/studio/session"

export const dynamic = "force-dynamic"

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ org: string }>
}) {
  const { org: slug } = await params
  const { org, member, user } = await requireMember(slug)
  const organizations = await listMemberships(user.id)

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col md:flex-row">
      <Sidebar
        org={{ name: org.name, slug: org.slug }}
        role={member.role}
        user={{ name: user.name, email: user.email }}
        organizations={organizations.map(({ name, slug }) => ({ name, slug }))}
        listed={org.settings.profile.listed}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
