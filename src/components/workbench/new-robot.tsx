"use client"

/**
 * Starting a machine that does not exist yet.
 *
 * Two ways out of this dialog, and which one you get depends on whether the
 * workbench is holding a folder.
 *
 * **With a folder** it writes `src/components/ui/<slug>.tsx` itself, seeded
 * from a real robocn skeleton — props destructured with defaults, palette,
 * camera, a clock. The draft appears in the index, and the agent is handed a
 * file to change rather than a blank page.
 *
 * **Without one** it does what it always did: write the brief precisely — file
 * path, export name, item name, the nearest machine to follow — and let the
 * agent in the other terminal create the file. The workbench picks it up the
 * moment it exists.
 *
 * Either way the brief is produced, because the template is a starting point
 * and `build-robot` is the rest of the way.
 */

import * as React from "react"
import { Check, FilePlus2, Loader2, RefreshCw } from "lucide-react"

import { Command, WorkbenchDialog } from "@/components/workbench/dialog"
import { useCheckout } from "@/components/workbench/checkout"
import { draftFile, draftSource } from "@/lib/workbench/draft"
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
  const [writing, setWriting] = React.useState(false)
  const [written, setWritten] = React.useState<string | null>(null)
  const [failure, setFailure] = React.useState<string | null>(null)
  const checkout = useCheckout()

  const slug = slugify(name)
  const file = slug ? draftFile(slug) : ""
  const taken = Boolean(slug) && Boolean(workbenchComponent(slug))
  /** Already on disk, registry entry or not — writing would overwrite it. */
  const onDisk = Boolean(file && checkout.files.has(file))
  const prompt = newRobotPrompt({
    name,
    subject,
    reference: workbenchComponent(reference),
    // Either the workbench just wrote it, or it was already there.
    drafted: Boolean(written) || onDisk,
  })

  const create = async () => {
    if (!slug || taken || onDisk) return
    setWriting(true)
    setFailure(null)
    try {
      await checkout.write(file, draftSource({ slug, subject, reference: reference || undefined }))
      setWritten(file)
      // The control manifest is a build step, so the draft is a file before it
      // is a component. Where the generator can run, run it.
      onScan?.()
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "The file could not be written.")
    } finally {
      setWriting(false)
    }
  }

  const canWrite = Boolean(checkout.root)

  return (
    <WorkbenchDialog
      eyebrow="New machine"
      title={canWrite ? "Name it, and the workbench writes the file." : "Name it, then hand the build to your agent."}
      onClose={onClose}
    >
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {canWrite ? (
          <>
            A skeleton that already draws — props, palette, camera, clock — written into{" "}
            <strong className="text-foreground">{checkout.root}</strong>. Your agent replaces the
            body; it does not have to work out the house idiom first.
          </>
        ) : (
          <>
            No folder is open, so this writes the brief rather than the file. Your agent builds
            the component in this checkout; the workbench picks it up{" "}
            <strong className="text-foreground">as soon as the file exists</strong> — registry
            entry or not — so you can pose it while the rest of the work is still going on.
          </>
        )}
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
            ) : onDisk ? (
              <span className="ml-2 text-destructive">that file is already on disk</span>
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

      {failure ? <p className="text-[12px] text-destructive">{failure}</p> : null}
      {written ? (
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] text-foreground">
          <Check className="size-3.5 text-emerald-500" />
          wrote {written} — it is in the index under drafts
        </p>
      ) : null}

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
          {canWrite ? (
            <button
              type="button"
              onClick={() => void create()}
              disabled={!slug || taken || onDisk || writing || Boolean(written)}
              className="inline-flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] transition-colors hover:bg-accent disabled:opacity-40"
            >
              {writing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FilePlus2 className="size-3.5" />
              )}
              Write the file
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
