"use client"

/**
 * Source and handoff.
 *
 * The workbench has no agent in it. What it has is everything an agent needs on
 * the clipboard: the file to edit, the pose on screen written as JSX, and a
 * brief naming both. Paste that into Claude Code or Codex running in this same
 * checkout, let it edit the file, and the stage redraws through Fast Refresh.
 */

import * as React from "react"

import { CodeBlock } from "@/components/site/code-block"
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

function SourcePanel({ component, pose, search }: SourcePanelProps) {
  const [tab, setTab] = React.useState<Tab>("handoff")
  const [request, setRequest] = React.useState("")
  /** Keyed by component, so a stale read is never shown against a new machine. */
  const [read, setRead] = React.useState<{ id: string; source?: string; error?: string } | null>(
    null,
  )
  // The origin is browser state, not React state; the query string arrives as a
  // prop from the workbench, which is what writes it.
  const origin = React.useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  )

  React.useEffect(() => {
    if (tab !== "source") return
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
  }, [component.id, tab])

  const loaded = read?.id === component.id ? read : null

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
        <span className="ml-auto truncate font-mono text-[11px] text-muted-foreground">
          {component.file}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "handoff" ? (
          <div className="space-y-3">
            <p className="text-[12px] leading-snug text-muted-foreground">
              Paste this into Claude Code, Codex or opencode running in this checkout. It
              edits <code className="font-mono text-foreground">{component.file}</code>, and the
              stage redraws on save. <strong className="text-foreground">Setup</strong> in the
              toolbar has the clone-and-run steps.
            </p>
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                This pose
              </p>
              <CodeBlock code={explicit} caption="explicit props" scroll />
            </div>
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                With the component&rsquo;s own defaults filled in
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
                Prompt for Claude Code or Codex
              </p>
              <CodeBlock code={prompt} caption="paste into your agent" scroll />
            </div>
            {component.draft ? (
              <div>
                <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  This one is still a draft
                </p>
                <p className="mb-1.5 text-[12px] leading-snug text-muted-foreground">
                  It draws, but no registry item claims it — so it does not install, and it has
                  no docs page, demo or tests. When the shape is right, hand this over.
                </p>
                <CodeBlock code={shipDraftPrompt(component)} caption="ship it the rest of the way" scroll />
              </div>
            ) : null}
          </div>
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
