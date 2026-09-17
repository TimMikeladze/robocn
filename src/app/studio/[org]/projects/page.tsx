import { ProjectsAdmin } from "@/components/studio/admin/projects"
import { listProjects } from "@/lib/studio/queries"
import { requireMember } from "@/lib/studio/session"

export const metadata = { title: "Projects" }

export default async function ProjectsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const { org, member } = await requireMember(slug)
  const projects = await listProjects(org.id)

  return (
    <ProjectsAdmin
      org={{ name: org.name, slug: org.slug }}
      role={member.role}
      projects={projects.map(({ id, name, description, color, archivedAt, updatedAt, designs }) => ({
        id,
        name,
        description,
        color,
        archived: !!archivedAt,
        updatedAt,
        designs,
      }))}
    />
  )
}
