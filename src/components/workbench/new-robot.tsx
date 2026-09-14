"use client"

/**
 * Starting a machine that does not exist yet.
 *
 * The workbench cannot write files — it is a page. What it can do is write the
 * brief precisely: the file path, the export name, the item name, and the
 * nearest machine in the set to follow. The agent in the other terminal does
 * the building, guided by the `ship-robot` skill already in the repo, and the
 * moment the component file exists the workbench picks it up as a draft.
 */

import * as React from "react"
import { Loader2, RefreshCw } from "lucide-react"

import { Command, WorkbenchDialog } from "@/components/workbench/dialog"
import {
  exportName,
  newRobotPrompt,
  slugify,
  workbenchComponent,
  workbenchComponentList,
  type WorkbenchComponent,
} from "@/lib/workbench/controls"

export interface NewRobotProps {
  onClose: () => void
  /** The machine on the stage, offered as the thing to follow. */
  current: WorkbenchComponent
  /** Re-reads the library from disk; null where that cannot work. */
  onScan: (() => void) | null
  scanning: boolean
  scanMessage: string
}

const field =
  "h-8 w-full rounded-sm border border-border bg-background px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"

function NewRobot({ onClose, current, onScan, scanning, scanMessage }: NewRobotProps) {
  const [name, setName] = React.useState("")
  const [subject, setSubject] = React.useState("")
  const [reference, setReference] = React.useState(current.draft ? "" : current.id)
  const slug = slugify(name)
  const taken = Boolean(slug) && Boolean(workbenchComponent(slug))
  const prompt = newRobotPrompt({
    name,
    subject,
    reference: workbenchComponent(reference),
  })

  return (
    <WorkbenchDialog
      eyebrow="New machine"
      title="Name it, then hand the build to your agent."
      onClose={onClose}
    >
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        This page cannot write files, and it does not need to. Your agent builds the component
        in this checkout; the workbench picks it up{" "}
        <strong className="text-foreground">as soon as the file exists</strong> — registry entry
        or not — so you can pose it while the rest of the work is still going on.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            What is it called
          </span>
          <input
            autoFocus
            className={field}
            value={name}
            placeholder="Harbour crane"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Nearest machine to follow
          </span>
          <select
            className={field}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          >
            <option value="">none</option>
            {workbenchComponentList
              .filter((component) => !component.draft)
              .map((component) => (
                <option key={component.id} value={component.id}>
                  {component.title}
                </option>
              ))}
          </select>
        </label>
      </div>

      <p className="font-mono text-[11px] text-muted-foreground">
        {slug ? (
          <>
            src/components/ui/<span className="text-foreground">{slug}</span>.tsx ·{" "}
            <span className="text-foreground">{exportName(slug)}</span>
            {taken ? (
              <span className="ml-2 text-destructive">that name is already taken</span>
            ) : null}
          </>
        ) : (
          "src/components/ui/<name>.tsx"
        )}
      </p>

      <label className="block space-y-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          What it is
        </span>
        <textarea
          rows={3}
          className="w-full rounded-sm border border-border bg-background p-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={subject}
          placeholder="A quayside container crane: a portal on rails, a trolley that runs the boom, a spreader on cables. Profile and iso views, a load cycle it runs on its own."
          onChange={(event) => setSubject(event.target.value)}
        />
      </label>

      <Command code={prompt} label="paste into Claude Code, Codex or opencode" />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <span className="font-mono text-[11px] text-muted-foreground">
          {scanMessage || "Drafts appear in the index under “drafts”."}
        </span>
        <div className="flex items-center gap-2">
          {onScan ? (
            <button
              type="button"
              onClick={onScan}
              disabled={scanning}
              className="inline-flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] transition-colors hover:bg-accent disabled:opacity-50"
            >
              {scanning ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Rescan the library
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-border bg-foreground px-3 py-1.5 font-mono text-[11px] text-background transition-opacity hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </WorkbenchDialog>
  )
}

export { NewRobot }
