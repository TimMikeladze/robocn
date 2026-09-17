import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ProjectDetail } from "@/components/studio/admin/projects"
import { toCard } from "@/lib/studio/cards"
import { getProject, listDesigns, listLabels } from "@/lib/studio/queries"
import { requireMember } from "@/lib/studio/session"

type Params = Promise<{ org: string; id: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { org: slug, id } = await params
  const { org } = await requireMember(slug)
  const project = await getProject(org.id, id)
  return { title: project?.name ?? "Project" }
}

export default async function ProjectPage({ params }: { params: Params }) {
  const { org: slug, id } = await params
  const { org, member } = await requireMember(slug)
  const project = await getProject(org.id, id)
  if (!project) notFound()
  const [designs, labels] = await Promise.all([
    listDesigns(org.id, { projectId: project.id }),
    listLabels(org.id),
  ])

  return (
    <ProjectDetail
      org={{ name: org.name, slug: org.slug }}
      role={member.role}
      project={{
        id: project.id,
        name: project.name,
        description: project.description,
        color: project.color,
        archived: !!project.archivedAt,
        updatedAt: project.updatedAt,
        designs: designs.length,
      }}
      designs={designs.map((design) => toCard(design, org.settings, labels))}
    />
  )
}
