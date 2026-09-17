import Link from "next/link"
import { Plus } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { DesignCard } from "@/components/studio/design-card"
import { DesignFilters } from "@/components/studio/design-filters"
import { EmptyState, PageBody, PageHeader } from "@/components/studio/kit"
import { toCard } from "@/lib/studio/cards"
import { can } from "@/lib/studio/permissions"
import { listDesigns, listLabels, listProjects } from "@/lib/studio/queries"
import { requireMember } from "@/lib/studio/session"

export const metadata = { title: "Designs" }

type Query = Partial<Record<"q" | "stage" | "label" | "project" | "archived" | "published", string>>

export default async function DesignsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>
  searchParams: Promise<Query>
}) {
  const { org, member } = await requireMember((await params).org)
  const query = await searchParams
  const [designs, labels, projects] = await Promise.all([
    listDesigns(org.id, {
      query: query.q,
      stage: query.stage,
      labelId: query.label,
      projectId: query.project === "none" ? null : query.project || undefined,
      archived: query.archived === "1",
      published: query.published === "1",
    }),
    listLabels(org.id),
    listProjects(org.id),
  ])
  const filtered = Object.values(query).some(Boolean)
  const canCreate = can(member.role, "design:create")

  return (
    <>
      <PageHeader
        eyebrow={org.name}
        title="Designs"
        description="Every machine this organization has posed, with its history."
      >
        {canCreate ? (
          <Link href={`/studio/${org.slug}/designs/new`} className={buttonVariants({ size: "sm" })}>
            <Plus /> New design
          </Link>
        ) : null}
      </PageHeader>
      <PageBody className="space-y-4">
        <DesignFilters
          workflow={org.settings.workflow.map(({ id, name }) => ({ id, name }))}
          labels={labels.map(({ id, name }) => ({ id, name }))}
          projects={projects.map(({ id, name }) => ({ id, name }))}
        />
        {designs.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {designs.map((design) => (
              <DesignCard key={design.id} orgSlug={org.slug} design={toCard(design, org.settings, labels)} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={filtered ? "Nothing matches those filters" : "No designs yet"}
            action={
              !filtered && canCreate ? (
                <Link href={`/studio/${org.slug}/designs/new`} className={buttonVariants({ size: "sm" })}>
                  <Plus /> New design
                </Link>
              ) : null
            }
          >
            {filtered
              ? "Clear a filter or search for something else."
              : "Pick a machine from the registry, pose it, and save the first version."}
          </EmptyState>
        )}
      </PageBody>
    </>
  )
}
