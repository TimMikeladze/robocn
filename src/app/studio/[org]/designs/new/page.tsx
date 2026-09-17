import Link from "next/link"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/studio/kit"
import { NewDesign } from "@/components/studio/new-design"
import { can } from "@/lib/studio/permissions"
import { listProjects } from "@/lib/studio/queries"
import { requireMember } from "@/lib/studio/session"

export const metadata = { title: "New design" }

export default async function NewDesignPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>
  searchParams: Promise<{ project?: string; machine?: string }>
}) {
  const { org, member } = await requireMember((await params).org)
  if (!can(member.role, "design:create")) notFound()
  const query = await searchParams
  const projects = (await listProjects(org.id)).filter((project) => !project.archivedAt)

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-[600px] flex-col max-lg:h-auto">
      <PageHeader
        eyebrow={org.name}
        title="New design"
        description={
          <>
            Start from any machine in the registry, or fork one that someone has published on{" "}
            <Link href="/explore" className="underline underline-offset-2">
              Explore
            </Link>
            .
          </>
        }
      />
      <NewDesign
        orgSlug={org.slug}
        projects={projects.map(({ id, name }) => ({ id, name }))}
        initialProject={projects.some((project) => project.id === query.project) ? query.project! : null}
        initialMachine={query.machine ?? null}
      />
    </div>
  )
}
