"use client"

/**
 * Projects: folders for designs, with a colour. Deleting one is deliberately
 * cheap — the designs are set loose, not deleted — so the confirm says so
 * rather than shouting.
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Archive, ArchiveRestore, ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ColorField } from "@/components/studio/admin/color-field"
import {
  ConfirmModal,
  EmptyState,
  Field,
  Modal,
  PageBody,
  PageHeader,
  Pill,
  TimeAgo,
  fieldClass,
  useAction,
} from "@/components/studio/kit"
import { DesignCard, type DesignCardData } from "@/components/studio/design-card"
import { createProject, deleteProject, updateProject } from "@/lib/studio/actions/workspace"
import { can } from "@/lib/studio/permissions"
import { cn } from "@/lib/utils"

export interface ProjectRow {
  id: string
  name: string
  description: string
  color: string
  archived: boolean
  updatedAt: Date
  designs: number
}

type ProjectDraft = Pick<ProjectRow, "id" | "name" | "description" | "color">

function ProjectModal({
  orgSlug,
  project,
  onClose,
  onSaved,
}: {
  orgSlug: string
  /** `null` makes a new one. */
  project: ProjectDraft | null
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const { pending, call } = useAction()
  const [name, setName] = React.useState(project?.name ?? "")
  const [description, setDescription] = React.useState(project?.description ?? "")
  const [color, setColor] = React.useState(project?.color ?? "#f38b4a")

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Project"
      title={project ? `Edit ${project.name}` : "New project"}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="project-form" size="sm" disabled={pending || !name.trim()}>
            {project ? "Save project" : "Create project"}
          </Button>
        </>
      }
    >
      <form
        id="project-form"
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault()
          const input = { name, description, color }
          if (project) {
            const done = await call(() => updateProject(orgSlug, project.id, input), {
              success: "Project saved.",
            })
            if (done !== null) onSaved(project.id)
            return
          }
          const created = await call(() => createProject(orgSlug, input), { success: "Project created." })
          if (created) onSaved(created.id)
        }}
      >
        <Field label="Name" htmlFor="project-name">
          <input
            id="project-name"
            required
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Warehouse line"
            className={fieldClass}
          />
        </Field>
        <Field label="Description" htmlFor="project-description" hint={`${description.length}/500`}>
          <textarea
            id="project-description"
            rows={3}
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={cn(fieldClass, "h-auto resize-y py-1.5")}
          />
        </Field>
        <Field label="Colour">
          <ColorField label="Project" value={color} onChange={setColor} />
        </Field>
      </form>
    </Modal>
  )
}

function DeleteProject({
  orgSlug,
  project,
  onClose,
  onDeleted,
}: {
  orgSlug: string
  project: Pick<ProjectRow, "id" | "name" | "designs"> | null
  onClose: () => void
  onDeleted: () => void
}) {
  const { pending, call } = useAction()
  return (
    <ConfirmModal
      open={!!project}
      onClose={onClose}
      title={`Delete ${project?.name ?? "project"}?`}
      pending={pending}
      onConfirm={async () => {
        if (!project) return
        const done = await call(() => deleteProject(orgSlug, project.id), { success: "Project deleted." })
        onClose()
        if (done !== null) onDeleted()
      }}
    >
      {project?.designs
        ? `Its ${project.designs === 1 ? "design is" : `${project.designs} designs are`} kept. They leave the project and stay in the organization, versions and all.`
        : "Only the project goes. Designs are never deleted with a project."}
    </ConfirmModal>
  )
}

function ProjectsAdmin({
  org,
  role,
  projects,
}: {
  org: { name: string; slug: string }
  role: string
  projects: ProjectRow[]
}) {
  const router = useRouter()
  const { pending, call } = useAction()
  // `undefined` closed, `null` new, a row to edit it.
  const [editing, setEditing] = React.useState<ProjectRow | null | undefined>(undefined)
  const [deleting, setDeleting] = React.useState<ProjectRow | null>(null)
  const update = can(role, "project:update")

  const newButton = can(role, "project:create") ? (
    <Button size="sm" onClick={() => setEditing(null)}>
      <Plus /> New project
    </Button>
  ) : null

  // Live work first; the archive is for looking things up.
  const ordered = [...projects].sort((a, b) => Number(a.archived) - Number(b.archived))

  return (
    <>
      <PageHeader
        eyebrow={org.name}
        title="Projects"
        description="Group designs by whatever they are for: a client, a product, a show."
      >
        {newButton}
      </PageHeader>

      <PageBody>
        {projects.length === 0 ? (
          <EmptyState title="No projects yet" action={newButton}>
            Designs do not need one, but a project keeps the ones that belong together in one place.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border border border-border bg-panel">
            {ordered.map((project) => (
              <li
                key={project.id}
                className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3", project.archived && "opacity-70")}
              >
                <Link
                  href={`/studio/${org.slug}/projects/${project.id}`}
                  className="group flex min-w-0 flex-1 basis-56 items-start gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 size-2.5 shrink-0 rounded-full"
                    style={{ background: project.color }}
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-medium underline-offset-4 group-hover:underline">
                        {project.name}
                      </span>
                      {project.archived ? <Pill>Archived</Pill> : null}
                    </span>
                    {project.description ? (
                      <span className="line-clamp-2 text-[12px] text-muted-foreground">{project.description}</span>
                    ) : null}
                  </span>
                </Link>
                <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                  {project.designs} {project.designs === 1 ? "design" : "designs"} ·{" "}
                  <TimeAgo date={project.updatedAt} />
                </span>
                {update || can(role, "project:delete") ? (
                  <div className="flex items-center">
                    {update ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${project.name}`}
                          onClick={() => setEditing(project)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={pending}
                          aria-label={`${project.archived ? "Unarchive" : "Archive"} ${project.name}`}
                          title={project.archived ? "Unarchive" : "Archive"}
                          onClick={async () => {
                            await call(
                              () => updateProject(org.slug, project.id, { archived: !project.archived }),
                              { success: project.archived ? "Project restored." : "Project archived." },
                            )
                            router.refresh()
                          }}
                        >
                          {project.archived ? <ArchiveRestore /> : <Archive />}
                        </Button>
                      </>
                    ) : null}
                    {can(role, "project:delete") ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${project.name}`}
                        onClick={() => setDeleting(project)}
                      >
                        <Trash2 />
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </PageBody>

      {editing !== undefined ? (
        <ProjectModal
          key={editing?.id ?? "new"}
          orgSlug={org.slug}
          project={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined)
            router.refresh()
          }}
        />
      ) : null}
      <DeleteProject
        orgSlug={org.slug}
        project={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => router.refresh()}
      />
    </>
  )
}

function ProjectDetail({
  org,
  role,
  project,
  designs,
}: {
  org: { name: string; slug: string }
  role: string
  project: ProjectRow
  designs: DesignCardData[]
}) {
  const router = useRouter()
  const { pending, call } = useAction()
  const [editing, setEditing] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const update = can(role, "project:update")

  const newDesign = can(role, "design:create") ? (
    <Button
      size="sm"
      nativeButton={false}
      render={<Link href={`/studio/${org.slug}/designs/new?project=${project.id}`} />}
    >
      <Plus /> New design
    </Button>
  ) : null

  return (
    <>
      <div className="border-b border-border px-5 py-2 sm:px-8">
        <Link
          href={`/studio/${org.slug}/projects`}
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> All projects
        </Link>
      </div>
      <PageHeader
        eyebrow={project.archived ? "Project · archived" : "Project"}
        title={project.name}
        description={
          <span className="flex items-start gap-2">
            <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: project.color }} />
            <span>
              {project.description || "No description."}{" "}
              <span className="whitespace-nowrap font-mono text-[11px]">
                {designs.length} {designs.length === 1 ? "design" : "designs"}
              </span>
            </span>
          </span>
        }
      >
        {update ? (
          <>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={async () => {
                await call(() => updateProject(org.slug, project.id, { archived: !project.archived }), {
                  success: project.archived ? "Project restored." : "Project archived.",
                })
                router.refresh()
              }}
            >
              {project.archived ? <ArchiveRestore /> : <Archive />}
              {project.archived ? "Unarchive" : "Archive"}
            </Button>
          </>
        ) : null}
        {can(role, "project:delete") ? (
          <Button variant="outline" size="icon-sm" aria-label={`Delete ${project.name}`} onClick={() => setDeleting(true)}>
            <Trash2 />
          </Button>
        ) : null}
        {newDesign}
      </PageHeader>

      <PageBody>
        {designs.length === 0 ? (
          <EmptyState title="Nothing in this project yet" action={newDesign}>
            Start a design here, or move one in from its own page.
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {designs.map((design) => (
              <DesignCard key={design.id} orgSlug={org.slug} design={design} />
            ))}
          </div>
        )}
      </PageBody>

      {editing ? (
        <ProjectModal
          orgSlug={org.slug}
          project={project}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            router.refresh()
          }}
        />
      ) : null}
      <DeleteProject
        orgSlug={org.slug}
        project={deleting ? { ...project, designs: designs.length } : null}
        onClose={() => setDeleting(false)}
        onDeleted={() => {
          router.push(`/studio/${org.slug}/projects`)
          router.refresh()
        }}
      />
    </>
  )
}

export { ProjectDetail, ProjectsAdmin }
