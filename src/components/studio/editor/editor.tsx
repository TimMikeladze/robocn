"use client"

/**
 * The design editor: a machine on a stage, its props on knobs, and the record
 * of every decision made about it down the side.
 *
 * The stage and the knobs are the workbench's own — `Stage`, `RobotRender`,
 * `ControlsPanel` — so a prop added to a machine is a control here with no
 * second file to update. What Studio adds is everything around them: versions,
 * review, files, publishing. Nothing autosaves: a version is a decision and
 * carries a note. Notes: `docs/studio.md`.
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Copy,
  Download,
  Globe,
  ImageDown,
  Link2,
  MoreHorizontal,
  Save,
  Trash2,
  Undo2,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CommentsPanel, type CommentRow } from "@/components/studio/editor/comments-panel"
import { DetailsPanel } from "@/components/studio/editor/details-panel"
import { FilesPanel, type FileRow } from "@/components/studio/editor/files-panel"
import { PublishModal, ShareModal, type ShareLinkRow } from "@/components/studio/editor/publish"
import { VersionsPanel, type VersionRow } from "@/components/studio/editor/versions-panel"
import { ConfirmModal, Modal, Pill, eyebrow, fieldClass, useAction } from "@/components/studio/kit"
import { ControlsPanel } from "@/components/workbench/controls-panel"
import { RobotRender, Stage, stageBackgrounds, type ActionCall } from "@/components/workbench/stage"
import { backgroundBehind, captureFrame, exportNode, type ExportFormat } from "@/lib/robocn/capture"
import {
  deleteDesign,
  duplicateDesign,
  saveVersion,
  setArchived,
  updateDesign,
} from "@/lib/studio/actions/designs"
import { can } from "@/lib/studio/permissions"
import { applyPalette, diffPose } from "@/lib/studio/pose"
import type { WorkflowStage } from "@/lib/studio/settings"
import type { StageJson } from "@/db/schema/studio"
import { workbenchComponent, type Pose } from "@/lib/workbench/controls"
import { cn } from "@/lib/utils"

export interface EditorDesign {
  id: string
  name: string
  description: string
  componentId: string
  stage: string
  labelIds: string[]
  projectId: string | null
  publicSlug: string | null
  publishedVersionId: string | null
  currentVersionId: string | null
  archived: boolean
}

export interface EditorProps {
  orgSlug: string
  role: string
  userId: string
  design: EditorDesign
  versions: VersionRow[]
  comments: CommentRow[]
  shareLinks: ShareLinkRow[]
  files: FileRow[]
  projects: { id: string; name: string }[]
  labels: { id: string; name: string; color: string }[]
  palettes: { id: string; name: string; colors: Record<string, string> }[]
  workflow: WorkflowStage[]
}

type Tab = "props" | "versions" | "comments" | "files" | "details"

const tabs: { id: Tab; label: string }[] = [
  { id: "props", label: "Props" },
  { id: "versions", label: "Versions" },
  { id: "comments", label: "Review" },
  { id: "files", label: "Files" },
  { id: "details", label: "Details" },
]

const sameStage = (a: StageJson, b: StageJson) => a.background === b.background && a.zoom === b.zoom

/** A server action's body is capped near a megabyte; a snapshot past this is skipped, not failed. */
const MAX_THUMBNAIL_CHARS = 900_000

function Editor(props: EditorProps) {
  const { orgSlug, role, design, versions, workflow } = props
  const router = useRouter()
  const { pending, call } = useAction()
  const component = workbenchComponent(design.componentId)

  const current = versions.find((version) => version.id === design.currentVersionId) ?? versions[0]
  const baselinePose: Pose = current?.pose ?? {}
  const baselineStage: StageJson = current?.stage ?? { background: "panel", zoom: 1 }

  const [pose, setPose] = React.useState<Pose>(baselinePose)
  const [stageView, setStageView] = React.useState<StageJson>(baselineStage)
  const [tab, setTab] = React.useState<Tab>("props")
  const [actions, setActions] = React.useState<ActionCall[]>([])
  const [dialog, setDialog] = React.useState<"save" | "publish" | "share" | "delete" | null>(null)
  const [note, setNote] = React.useState("")
  const [name, setName] = React.useState(design.name)
  const machineRef = React.useRef<HTMLDivElement>(null)
  const actionId = React.useRef(0)

  const canEdit = can(role, "design:update") && !design.archived
  const changes = diffPose(baselinePose, pose)
  const dirty = changes.length > 0 || !sameStage(baselineStage, stageView)
  const stage = workflow.find((entry) => entry.id === design.stage) ?? workflow[0]
  const openThreads = props.comments.filter((row) => !row.parentId && !row.resolvedAt).length

  // Leaving with unsaved knobs is the one way to lose work here.
  React.useEffect(() => {
    if (!dirty || !canEdit) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty, canEdit])

  /** The drawing itself when the machine is an SVG; the wrapper when it is a canvas. */
  const captureTarget = () => {
    const root = machineRef.current
    if (!root) return null
    return (root.querySelector("svg") as SVGElement | null) ?? root
  }

  async function snapshotStage() {
    const target = captureTarget()
    if (!target) return undefined
    try {
      const canvas = await captureFrame(target, { scale: 2, background: backgroundBehind(target) })
      const url = canvas.toDataURL("image/webp", 0.85)
      return url.startsWith("data:image/webp") && url.length < MAX_THUMBNAIL_CHARS ? url : undefined
    } catch {
      // A version without a picture is still a version.
      return undefined
    }
  }

  async function save() {
    const thumbnail = await snapshotStage()
    const saved = await call(() => saveVersion(orgSlug, design.id, { pose, stage: stageView, note, thumbnail }))
    if (!saved) return
    toast.success(`Saved v${saved.number}`)
    setNote("")
    setDialog(null)
    router.refresh()
  }

  async function exportStage(format: ExportFormat, toAssets: boolean) {
    const target = captureTarget()
    if (!target) return
    const working = toast.loading(format === "png" ? "Capturing…" : "Recording 3 seconds…")
    try {
      await exportNode(target, {
        format,
        name: design.name,
        duration: 3,
        fps: 15,
        scale: 2,
        background: backgroundBehind(target),
        save: toAssets
          ? async (blob, filename) => {
              const form = new FormData()
              form.append("files", new File([blob], filename, { type: blob.type }))
              const response = await fetch(`/api/studio/${orgSlug}/assets`, { method: "POST", body: form })
              if (!response.ok) throw new Error((await response.json()).error ?? "Upload failed.")
            }
          : undefined,
      })
      toast.success(toAssets ? "Saved to the asset library." : "Exported.", { id: working })
      if (toAssets) router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The export failed.", { id: working })
    }
  }

  if (!component) {
    return (
      <div className="p-8">
        <p className="text-[14px] font-medium">{design.componentId} is no longer in the registry.</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          The design&apos;s data is intact, but there is no machine to draw it with.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-[560px] flex-col">
      {/* ------------------------------------------------------------ toolbar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-panel px-3 py-2">
        <Link
          href={`/studio/${orgSlug}/designs`}
          aria-label="Back to designs"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <input
            aria-label="Design name"
            value={name}
            disabled={!canEdit}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur()
              if (event.key === "Escape") setName(design.name)
            }}
            onBlur={async () => {
              const next = name.trim()
              if (!next || next === design.name) return setName(design.name)
              const ok = await call(() => updateDesign(orgSlug, design.id, { name: next }))
              if (ok === null) setName(design.name)
              else router.refresh()
            }}
            className="w-full max-w-md truncate rounded-sm bg-transparent px-1 text-[15px] font-medium outline-none hover:bg-accent focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring disabled:hover:bg-transparent"
          />
          <p className={cn(eyebrow, "px-1")}>
            {component.title} · v{current?.number ?? 1}
            {dirty ? <span className="text-amber-600 dark:text-amber-400"> · unsaved</span> : null}
            {design.archived ? " · archived" : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`Stage: ${stage.name}. Change stage`}
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Pill color={stage.color} className="h-6 cursor-pointer hover:bg-accent">
                  {stage.name}
                </Pill>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {workflow.map((entry) => (
                  <DropdownMenuItem
                    key={entry.id}
                    onClick={async () => {
                      if (entry.id === design.stage) return
                      const ok = await call(() => updateDesign(orgSlug, design.id, { stage: entry.id }), {
                        success: `Moved to ${entry.name}`,
                      })
                      if (ok !== null) router.refresh()
                    }}
                  >
                    <span aria-hidden className="size-2 rounded-full" style={{ background: entry.color }} />
                    {entry.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Pill color={stage.color} className="h-6">
              {stage.name}
            </Pill>
          )}

          {design.publishedVersionId ? (
            <Link href={`/d/${design.publicSlug}`} target="_blank" className="rounded-full">
              <Pill color="#16a34a" className="h-6 hover:bg-accent">
                Live
              </Pill>
            </Link>
          ) : null}

          {dirty && canEdit ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPose(baselinePose)
                setStageView(baselineStage)
              }}
            >
              <Undo2 /> Discard
            </Button>
          ) : null}
          {canEdit ? (
            <Button size="sm" disabled={!dirty || pending} onClick={() => setDialog("save")}>
              <Save /> Save version
            </Button>
          ) : null}
          {can(role, "design:share") ? (
            <Button variant="outline" size="sm" onClick={() => setDialog("share")}>
              <Link2 /> Share
            </Button>
          ) : null}
          {can(role, "design:publish") && !design.archived ? (
            <Button variant="outline" size="sm" onClick={() => setDialog("publish")}>
              <Globe /> {design.publishedVersionId ? "Published" : "Publish"}
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="More actions"
              className="inline-flex size-7 items-center justify-center rounded-md border border-border outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => exportStage("png", false)}>
                <Download /> Download PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportStage("webp", false)}>
                <Download /> Download animated WebP
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportStage("gif", false)}>
                <Download /> Download GIF
              </DropdownMenuItem>
              {can(role, "asset:create") ? (
                <>
                  <DropdownMenuItem onClick={() => exportStage("png", true)}>
                    <ImageDown /> Save PNG to assets
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportStage("webp", true)}>
                    <ImageDown /> Save animation to assets
                  </DropdownMenuItem>
                </>
              ) : null}
              {can(role, "design:create") ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      const copy = await call(() => duplicateDesign(orgSlug, design.id), {
                        success: "Duplicated",
                      })
                      if (copy) router.push(`/studio/${orgSlug}/designs/${copy.id}`)
                    }}
                  >
                    <Copy /> Duplicate
                  </DropdownMenuItem>
                </>
              ) : null}
              {can(role, "design:update") ? (
                <DropdownMenuItem
                  onClick={async () => {
                    const ok = await call(() => setArchived(orgSlug, design.id, !design.archived), {
                      success: design.archived ? "Restored" : "Archived",
                    })
                    if (ok !== null) router.refresh()
                  }}
                >
                  {design.archived ? <ArchiveRestore /> : <Archive />}
                  {design.archived ? "Restore from archive" : "Archive"}
                </DropdownMenuItem>
              ) : null}
              {can(role, "design:delete") ? (
                <DropdownMenuItem variant="destructive" onClick={() => setDialog("delete")}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* --------------------------------------------------------------- body */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-[320px] min-w-0 flex-1 flex-col">
          <Stage background={stageView.background} zoom={stageView.zoom} outline={false}>
            <div ref={machineRef}>
              <RobotRender
                component={component}
                pose={pose}
                onAction={(entry) =>
                  setActions((log) => [{ ...entry, id: ++actionId.current }, ...log].slice(0, 30))
                }
              />
            </div>
          </Stage>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border bg-panel px-3 py-1.5">
            <label className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
              Ground
              <select
                value={stageView.background}
                onChange={(event) =>
                  setStageView((view) => ({
                    ...view,
                    background: event.target.value as StageJson["background"],
                  }))
                }
                className={cn(fieldClass, "h-6 w-28 px-1.5 font-mono text-[11px]")}
              >
                {stageBackgrounds.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
              Zoom
              <input
                type="range"
                min={0.5}
                max={2.5}
                step={0.05}
                value={stageView.zoom}
                onChange={(event) => setStageView((view) => ({ ...view, zoom: Number(event.target.value) }))}
                className="h-4 w-28 accent-foreground"
              />
              <span className="w-9 tabular-nums">{Math.round(stageView.zoom * 100)}%</span>
            </label>
            {changes.length ? (
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                {changes.length} prop{changes.length === 1 ? "" : "s"} changed since v{current?.number ?? 1}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 w-full shrink-0 flex-col border-t border-border bg-panel lg:w-[340px] lg:border-l lg:border-t-0">
          <div role="tablist" aria-label="Design panels" className="flex shrink-0 border-b border-border">
            {tabs.map((entry) => (
              <button
                key={entry.id}
                role="tab"
                type="button"
                aria-selected={tab === entry.id}
                onClick={() => setTab(entry.id)}
                className="relative flex-1 px-1 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:bg-accent aria-selected:text-foreground aria-selected:shadow-[inset_0_-2px_0_var(--foreground)]"
              >
                {entry.label}
                {entry.id === "comments" && openThreads ? (
                  <span className="ml-1 rounded-full bg-foreground px-1 text-[9px] text-background">
                    {openThreads}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div role="tabpanel" className="flex min-h-0 flex-1 flex-col overflow-hidden max-lg:max-h-[60dvh]">
            {tab === "props" ? (
              <>
                {props.palettes.length ? (
                  <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
                    <span className={eyebrow}>Palette</span>
                    <div className="flex flex-1 flex-wrap gap-1">
                      {props.palettes.map((palette) => (
                        <button
                          key={palette.id}
                          type="button"
                          title={`Apply ${palette.name}`}
                          aria-label={`Apply palette ${palette.name}`}
                          onClick={() => setPose((now) => applyPalette(component, now, palette.colors))}
                          className="flex h-6 items-center gap-1 rounded-full border border-border px-1.5 transition-colors hover:bg-accent"
                        >
                          {Object.values(palette.colors)
                            .slice(0, 4)
                            .map((color, index) => (
                              <span
                                key={index}
                                aria-hidden
                                className="size-2.5 rounded-full border border-border/60"
                                style={{ background: color }}
                              />
                            ))}
                          <span className="max-w-20 truncate font-mono text-[10px]">{palette.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <ControlsPanel
                  component={component}
                  pose={pose}
                  onChange={setPose}
                  actions={actions}
                  onClearActions={() => setActions([])}
                />
              </>
            ) : null}
            {tab === "versions" ? (
              <VersionsPanel
                orgSlug={orgSlug}
                role={role}
                design={design}
                versions={versions}
                workingPose={pose}
                onLoad={(version) => {
                  setPose(version.pose)
                  setStageView(version.stage)
                  setTab("props")
                  toast(`Loaded v${version.number} onto the stage. Save to keep it.`)
                }}
              />
            ) : null}
            {tab === "comments" ? (
              <CommentsPanel
                orgSlug={orgSlug}
                role={role}
                userId={props.userId}
                designId={design.id}
                versionId={current?.id ?? null}
                comments={props.comments}
              />
            ) : null}
            {tab === "files" ? (
              <FilesPanel orgSlug={orgSlug} role={role} designId={design.id} files={props.files} />
            ) : null}
            {tab === "details" ? (
              <DetailsPanel
                orgSlug={orgSlug}
                canEdit={canEdit}
                design={design}
                component={component}
                pose={pose}
                projects={props.projects}
                labels={props.labels}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ dialogs */}
      <Modal
        open={dialog === "save"}
        onClose={() => setDialog(null)}
        eyebrow={`v${(versions[0]?.number ?? 0) + 1}`}
        title="Save a version"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button size="sm" disabled={pending} onClick={save}>
              {pending ? "Saving…" : "Save version"}
            </Button>
          </>
        }
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium">What changed?</span>
            <textarea
              autoFocus
              value={note}
              maxLength={280}
              rows={3}
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void save()
              }}
              placeholder="Warmer shell, slower sweep"
              className={cn(fieldClass, "h-auto py-2")}
            />
          </label>
          {changes.length ? (
            <ul className="max-h-40 space-y-0.5 overflow-y-auto font-mono text-[11px] text-muted-foreground">
              {changes.map((change) => (
                <li key={change.name} className="truncate">
                  <span className="text-foreground">{change.name}</span>{" "}
                  {String(change.from ?? "default")} → {String(change.to ?? "default")}
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-mono text-[11px] text-muted-foreground">Only the stage changed.</p>
          )}
        </form>
      </Modal>

      <PublishModal
        open={dialog === "publish"}
        onClose={() => setDialog(null)}
        orgSlug={orgSlug}
        design={design}
        versions={versions}
        dirty={dirty}
      />
      <ShareModal
        open={dialog === "share"}
        onClose={() => setDialog(null)}
        orgSlug={orgSlug}
        designId={design.id}
        currentVersion={current ? { id: current.id, number: current.number } : null}
        links={props.shareLinks}
      />
      <ConfirmModal
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        title={`Delete ${design.name}?`}
        pending={pending}
        onConfirm={async () => {
          const ok = await call(() => deleteDesign(orgSlug, design.id), { success: "Deleted" })
          if (ok !== null) router.push(`/studio/${orgSlug}/designs`)
        }}
      >
        Every version, comment and share link goes with it
        {design.publishedVersionId ? ", and its public page stops working" : ""}. Files in the asset
        library are kept. This cannot be undone — archive it instead if you might want it back.
      </ConfirmModal>
    </div>
  )
}

export { Editor }
