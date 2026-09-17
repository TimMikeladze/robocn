import { notFound } from "next/navigation"

import { Editor } from "@/components/studio/editor/editor"
import {
  getDesign,
  listComments,
  listDesignAssets,
  listLabels,
  listPalettes,
  listProjects,
  listShareLinks,
  listVersions,
} from "@/lib/studio/queries"
import { can } from "@/lib/studio/permissions"
import { requireMember } from "@/lib/studio/session"

type Params = Promise<{ org: string; id: string }>

export async function generateMetadata({ params }: { params: Params }) {
  const { org: slug, id } = await params
  const { org } = await requireMember(slug)
  return { title: (await getDesign(org.id, id))?.name ?? "Design" }
}

export default async function DesignPage({ params }: { params: Params }) {
  const { org: slug, id } = await params
  const { org, member, user } = await requireMember(slug)
  const design = await getDesign(org.id, id)
  if (!design) notFound()

  const [versions, comments, shareLinks, files, projects, labels, palettes] = await Promise.all([
    listVersions(org.id, id),
    listComments(org.id, id),
    // Tokens are credentials: only people who could mint one get to read them.
    can(member.role, "design:share") ? listShareLinks(org.id, id) : [],
    listDesignAssets(org.id, id),
    listProjects(org.id),
    listLabels(org.id),
    listPalettes(org.id),
  ])

  return (
    <Editor
      // A different design is a different editor: no state carries over.
      key={design.id}
      orgSlug={org.slug}
      role={member.role}
      userId={user.id}
      design={{
        id: design.id,
        name: design.name,
        description: design.description,
        componentId: design.componentId,
        stage: design.stage,
        labelIds: design.labelIds,
        projectId: design.projectId,
        publicSlug: design.publicSlug,
        publishedVersionId: design.publishedVersionId,
        currentVersionId: design.currentVersionId,
        archived: !!design.archivedAt,
      }}
      versions={versions.map((version) => ({ ...version, hasThumbnail: !!version.hasThumbnail }))}
      comments={comments}
      shareLinks={shareLinks.map(({ id, token, versionId, expiresAt, createdAt }) => ({
        id,
        token,
        versionId,
        expiresAt,
        createdAt,
      }))}
      files={files.map((file) => ({ ...file, hasThumbnail: !!file.hasThumbnail }))}
      projects={projects.filter((project) => !project.archivedAt).map(({ id, name }) => ({ id, name }))}
      labels={labels.map(({ id, name, color }) => ({ id, name, color }))}
      palettes={palettes.map(({ id, name, colors }) => ({ id, name, colors }))}
      workflow={org.settings.workflow}
    />
  )
}
