"use client"

/**
 * Source and handoff. Two ways to change a component, for two sizes of change.
 *
 * **Handoff** is the large one. It puts everything an agent needs on the
 * clipboard: the file to edit, the pose on screen as JSX, and a brief naming
 * both. Paste it into an agent running in this checkout and the stage redraws
 * when the agent saves.
 *
 * **Source** is the small one. With a folder open (`docs/checkout.md`) the tab
 * is an editor over the real file: change a number, fix a path, delete a line,
 * ⌘S. Without a folder it reads the file through a route and stays read-only,
 * which is what Firefox and Safari get.
 */

import * as React from "react"
import { Loader2, Save } from "lucide-react"

import { CodeBlock } from "@/components/site/code-block"
import { useCheckout } from "@/components/workbench/checkout"
import {
  agentPrompt,
  jsxSnippet,
  resolvedPose,
  shipDraftPrompt,
  type Pose,
  type WorkbenchComponent,
} from "@/lib/workbench/controls"
import { cn } from "@/lib/utils"

type Tab = "handoff" | "source"

const tabs: { id: Tab; label: string }[] = [
  { id: "handoff", label: "Handoff" },
  { id: "source", label: "Source" },
]

export interface SourcePanelProps {
  component: WorkbenchComponent
  pose: Pose
  /** The workbench's own query string, so the brief can link back to this pose. */
  search: string
}

/**
 * An edit in progress.
 *
 * Null until someone types: with no edit the textarea simply shows what is on
 * disk, so an agent's save arrives by itself and there is no effect
 * synchronising two copies of the same string.
 */
interface Draft {
  id: string
  /** What is in the textarea. */
  text: string
  /** What was on disk when the first keystroke landed — the save's baseline. */
  baseline: string
}

function SourcePanel({ component, pose, search }: SourcePanelProps) {
  const [tab, setTab] = React.useState<Tab>("handoff")
  const [request, setRequest] = React.useState("")
  const checkout = useCheckout()
  /** Keyed by component, so a stale read is never shown against a new machine. */
  const [read, setRead] = React.useState<{ id: string; source?: string; error?: string } | null>(
    null,
  )
  const [draft, setDraft] = React.useState<Draft | null>(null)
  const [saving, setSaving] = React.useState(false)
  /** Carried with the component it belongs to, so it clears by being ignored. */
  const [failure, setFailure] = React.useState<{ id: string; message: string } | null>(null)

  // The origin is browser state, not React state; the query string arrives as a
  // prop from the workbench, which is what writes it.
  const origin = React.useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  )

  const held = Boolean(checkout.root)
  const onDisk = held ? checkout.files.get(component.file) : undefined

  // The route is the fallback path: only fetched when there is no folder open.
  React.useEffect(() => {
    if (tab !== "source" || held) return
    let live = true
    fetch(`/api/workbench/source?component=${encodeURIComponent(component.id)}`)
      .then(async (response) => {
        const body = (await response.json()) as { source?: string; error?: string }
        if (!response.ok || !body.source) throw new Error(body.error ?? "Could not read the file.")
        if (live) setRead({ id: component.id, source: body.source })
      })
      .catch((cause: unknown) => {
        if (live) {
          setRead({
            id: component.id,
            error: cause instanceof Error ? cause.message : "Could not read the file.",
          })
        }
      })
    return () => {
      live = false
    }
  }, [component.id, tab, held])

  const loaded = read?.id === component.id ? read : null
  const editing = draft?.id === component.id ? draft : null
  /** What the textarea shows: the edit if there is one, otherwise disk. */
  const text = editing ? editing.text : (onDisk ?? "")
  const dirty = Boolean(editing && editing.text !== editing.baseline)
  /** Someone else wrote the file while there were unsaved edits in this box. */
  const conflicted = Boolean(dirty && onDisk !== undefined && onDisk !== editing?.baseline)
  const saveError = failure?.id === component.id ? failure.message : null

  const save = async () => {
    if (!editing || editing.text === editing.baseline) return
    setSaving(true)
    setFailure(null)
    try {
      await checkout.write(component.file, editing.text)
      // Back to showing disk: the poll will hand back what was just written.
      setDraft(null)
    } catch (cause) {
      setFailure({
        id: component.id,
        message: cause instanceof Error ? cause.message : "The file could not be written.",
      })
    } finally {
      setSaving(false)
    }
  }

  const explicit = jsxSnippet(component, pose)
  const full = jsxSnippet(component, resolvedPose(component, pose))
  const prompt = agentPrompt(component, pose, {
    url: origin ? `${origin}/workbench?${search}` : "",
    request,
  })

  return (
    <div className="flex min-h-0 flex-col border-t border-border">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            aria-pressed={tab === entry.id}
            className={cn(
              "rounded-sm px-2 py-1 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors hover:bg-accent",
              tab === entry.id ? "bg-foreground text-background hover:bg-foreground" : "text-muted-foreground",
            )}
          >
            {entry.label}
          </button>
        ))}
        {tab === "source" && held && onDisk !== undefined ? (
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || saving}
            title="Write this file (⌘S)"
            className="ml-2 inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-1 font-mono text-[11px] transition-colors hover:bg-accent disabled:opacity-40"
          >
            {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
            {dirty ? "Save" : "Saved"}
          </button>
        ) : null}
        <span className="ml-auto truncate font-mono text-[11px] text-muted-foreground">
          {component.file}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "handoff" ? (
          <div className="space-y-3">
            <p className="text-[12px] leading-snug text-muted-foreground">
              Paste this into an agent running in this checkout. It edits{" "}
              <code className="font-mono text-foreground">{component.file}</code>, and the stage
              redraws when the agent saves.{" "}
              <strong className="text-foreground">Setup</strong> in the toolbar has the clone and
              run steps.
            </p>
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Current pose
              </p>
              <CodeBlock code={explicit} caption="explicit props" scroll />
            </div>
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Every prop, defaults included
              </p>
              <CodeBlock code={full} caption="every prop" scroll />
            </div>
            <div>
              <label
                htmlFor="handoff-request"
                className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
              >
                What you want changed
              </label>
              <textarea
                id="handoff-request"
                rows={3}
                value={request}
                placeholder="Give it a telescoping neck, and keep the iso view honest…"
                onChange={(event) => setRequest(event.target.value)}
                className="w-full rounded-sm border border-border bg-background p-2 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Prompt
              </p>
              <CodeBlock code={prompt} caption="paste into your agent" scroll />
            </div>
            {component.draft ? (
              <div>
                <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  This component is a draft
                </p>
                <p className="mb-1.5 text-[12px] leading-snug text-muted-foreground">
                  The file renders, but no registry item points at it. It cannot be installed and
                  has no docs page, demo or tests. Hand this prompt over once the shape is right.
                </p>
                <CodeBlock code={shipDraftPrompt(component)} caption="finish the component" scroll />
              </div>
            ) : null}
          </div>
        ) : held ? (
          onDisk !== undefined ? (
            <div className="flex h-full min-h-0 flex-col gap-2">
              {conflicted ? (
                <p className="rounded-sm border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-[12px] leading-snug text-foreground">
                  This file changed on disk while you were editing it. Saving replaces what is
                  there now. Copy anything you want to keep first.
                </p>
              ) : null}
              {saveError ? (
                <p className="text-[12px] text-destructive">{saveError}</p>
              ) : null}
              <textarea
                spellCheck={false}
                value={text}
                onChange={(event) =>
                  setDraft({
                    id: component.id,
                    text: event.target.value,
                    baseline: editing?.baseline ?? onDisk,
                  })
                }
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
                    event.preventDefault()
                    void save()
                  }
                }}
                aria-label={`Source of ${component.file}`}
                className="min-h-72 w-full flex-1 resize-none rounded-sm border border-border bg-panel p-2 font-mono text-[11.5px] leading-[1.55] outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="font-mono text-[10px] text-muted-foreground">
                {dirty ? "unsaved · ⌘S to save" : "matches disk"} · {checkout.root}/
                {component.file}
              </p>
            </div>
          ) : (
            <p className="text-[12px] leading-snug text-muted-foreground">
              <code className="font-mono text-foreground">{component.file}</code> is not in the
              folder you opened. Open the robocn checkout itself, the directory containing{" "}
              <code className="font-mono text-foreground">registry.json</code>.
            </p>
          )
        ) : loaded?.error ? (
          <p className="text-[12px] text-muted-foreground">{loaded.error}</p>
        ) : !loaded?.source ? (
          <p className="font-mono text-[11px] text-muted-foreground">Reading {component.file}…</p>
        ) : (
          <CodeBlock code={loaded.source} caption={component.file} scroll />
        )}
      </div>
    </div>
  )
}

export { SourcePanel }
