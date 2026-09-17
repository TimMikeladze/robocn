import Link from "next/link"
import { Plus } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { DesignCard } from "@/components/studio/design-card"
import { Avatar, EmptyState, PageBody, PageHeader, Section, TimeAgo } from "@/components/studio/kit"
import { eyebrow } from "@/components/studio/styles"
import { describeActivity } from "@/lib/studio/activity"
import { toCard } from "@/lib/studio/cards"
import { can } from "@/lib/studio/permissions"
import { dashboardCounts, listActivity, listDesigns, listLabels } from "@/lib/studio/queries"
import { requireMember } from "@/lib/studio/session"

export async function generateMetadata({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await requireMember((await params).org)
  return { title: org.name }
}

export default async function Dashboard({ params }: { params: Promise<{ org: string }> }) {
  const { org, member, user } = await requireMember((await params).org)
  const [counts, all, labels, activity] = await Promise.all([
    dashboardCounts(org.id),
    listDesigns(org.id),
    listLabels(org.id),
    listActivity(org.id, 14),
  ])
  const designs = all.slice(0, 8)
  const canCreate = can(member.role, "design:create")
  const tiles = [
    { label: "Designs", value: counts.designs, href: "designs" },
    { label: "Published", value: counts.published, href: "designs?published=1" },
    { label: "Files", value: counts.assets, href: "assets" },
    { label: "Members", value: counts.members, href: "members" },
  ]

  return (
    <>
      <PageHeader eyebrow="Overview" title={org.name} description={`Signed in as ${user.name}.`}>
        {canCreate ? (
          <Link href={`/studio/${org.slug}/designs/new`} className={buttonVariants({ size: "sm" })}>
            <Plus /> New design
          </Link>
        ) : null}
      </PageHeader>
      <PageBody className="space-y-6">
        <div className="grid grid-cols-2 gap-px border border-border bg-border lg:grid-cols-4">
          {tiles.map((tile) => (
            <Link
              key={tile.label}
              href={`/studio/${org.slug}/${tile.href}`}
              className="bg-panel px-4 py-3 transition-colors hover:bg-accent"
            >
              <p className={eyebrow}>{tile.label}</p>
              <p className="mt-1 text-[26px] font-semibold tabular-nums tracking-[-0.02em]">{tile.value}</p>
            </Link>
          ))}
        </div>

        <Section title="Where things stand" description="Every design, by review stage.">
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            {org.settings.workflow.map((stage) => {
              const n = all.filter((design) => design.stage === stage.id).length
              return n ? (
                <span
                  key={stage.id}
                  title={`${stage.name}: ${n}`}
                  style={{ background: stage.color, flexGrow: n }}
                />
              ) : null
            })}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {org.settings.workflow.map((stage) => (
              <li key={stage.id}>
                <Link
                  href={`/studio/${org.slug}/designs?stage=${stage.id}`}
                  className="flex items-center gap-1.5 text-[12px] hover:underline"
                >
                  <span aria-hidden className="size-2 rounded-full" style={{ background: stage.color }} />
                  {stage.name}
                  <span className="font-mono text-muted-foreground">
                    {all.filter((design) => design.stage === stage.id).length}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[14px] font-medium">Recently changed</h2>
              <Link href={`/studio/${org.slug}/designs`} className="text-[12px] text-muted-foreground hover:text-foreground">
                All designs →
              </Link>
            </div>
            {designs.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {designs.map((design) => (
                  <DesignCard key={design.id} orgSlug={org.slug} design={toCard(design, org.settings, labels)} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No designs yet"
                action={
                  canCreate ? (
                    <Link href={`/studio/${org.slug}/designs/new`} className={buttonVariants({ size: "sm" })}>
                      <Plus /> New design
                    </Link>
                  ) : null
                }
              >
                Pick a machine from the registry, pose it, and save the first version.
              </EmptyState>
            )}
          </div>

          <Section title="Activity" className="h-fit">
            {activity.length ? (
              <ul className="space-y-3">
                {activity.map((entry) => (
                  <li key={entry.id} className="flex gap-2 text-[12px]">
                    <Avatar name={entry.actorName ?? "?"} className="mt-0.5 size-5 text-[8px]" />
                    <p className="min-w-0">
                      <span className="font-medium">{entry.actorName ?? "Someone"}</span>{" "}
                      {entry.targetType === "design" && entry.targetId ? (
                        <Link href={`/studio/${org.slug}/designs/${entry.targetId}`} className="hover:underline">
                          {describeActivity(entry)}
                        </Link>
                      ) : (
                        describeActivity(entry)
                      )}
                      <span className="block text-[11px] text-muted-foreground">
                        <TimeAgo date={entry.createdAt} />
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-muted-foreground">Nothing has happened yet.</p>
            )}
          </Section>
        </div>
      </PageBody>
    </>
  )
}
