"use client"

/**
 * Installing without a CLI.
 *
 * `public/r/<item>.json` already carries every file's contents inline and a
 * shadcn `target` alias, so everything `shadcn@latest add` does with that
 * file, this page can do: follow `registryDependencies` to a closure, read the
 * receiving project's `components.json` for its aliases, and write.
 *
 * Nothing is watched. A docs page has no business polling a stranger's
 * repository — it reads two small files through the handle, probes the targets
 * it is about to write, and forgets the folder. Notes: `docs/checkout.md`.
 *
 * The plan is always shown before anything is written. Writing into someone
 * else's source tree from a web page is only reasonable if they can see exactly
 * which paths it touches first.
 */

import * as React from "react"
import { Check, FolderOpen, Loader2, PackagePlus } from "lucide-react"
import { ensurePermission, getDirectoryPicker } from "use-fs"

import { Button } from "@/components/ui/button"
import {
  collectItems,
  planInstall,
  primitiveCommand,
  readAliases,
  readSourceRoot,
  type InstallPlan,
  type RegistryItem,
} from "@/lib/fs/install"
import { fileExists, readTextFile, writeTextFile } from "@/lib/fs/probe"
import { cn } from "@/lib/utils"

export interface InstallToFolderProps {
  /** Registry item name, e.g. `robot-arm`. */
  item: string
  className?: string
}

interface Chosen {
  handle: FileSystemDirectoryHandle
  plan: InstallPlan
}

function InstallToFolder({ item, className }: InstallToFolderProps) {
  const [busy, setBusy] = React.useState(false)
  const [chosen, setChosen] = React.useState<Chosen | null>(null)
  const [written, setWritten] = React.useState<number | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // Browser state, read the way React wants browser state read: the picker only
  // exists on the client, and only in some browsers, so the server render and
  // the first client paint have to agree that it does not.
  const supported = React.useSyncExternalStore(
    () => () => {},
    () => Boolean(getDirectoryPicker()),
    () => false,
  )

  const choose = async () => {
    const picker = getDirectoryPicker()
    if (!picker) return
    setError(null)
    setWritten(null)
    let handle: FileSystemDirectoryHandle
    try {
      handle = await picker({ id: "robocn-install", mode: "readwrite" })
    } catch {
      return // The picker was dismissed. Not a failure.
    }
    setBusy(true)
    try {
      if (!(await ensurePermission(handle, "readwrite"))) {
        throw new Error("Write access was declined, so nothing was installed.")
      }
      // Dependencies are refetched by name from this origin, whatever host was
      // baked into the JSON at build time.
      const closure = await collectItems(item, async (name) => {
        const response = await fetch(`/r/${name}.json`)
        if (!response.ok) throw new Error(`${name} is not in this registry.`)
        return (await response.json()) as RegistryItem
      })
      const componentsJson = await readTextFile(handle, "components.json")
      const tsconfig = await readTextFile(handle, "tsconfig.json")
      const aliases = readAliases(componentsJson)
      const sourceRoot = readSourceRoot(tsconfig, componentsJson)
      const dry = planInstall(closure, { aliases, sourceRoot, exists: () => false })
      // Probing is what makes `new` and `overwrite` true rather than guessed.
      const present = new Set<string>()
      await Promise.all(
        dry.writes.map(async (write) => {
          if (await fileExists(handle, write.path)) present.add(write.path)
        }),
      )
      const plan = planInstall(closure, {
        aliases,
        sourceRoot,
        exists: (path) => present.has(path),
      })
      setChosen({ handle, plan })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That folder could not be read.")
    } finally {
      setBusy(false)
    }
  }

  const write = async () => {
    if (!chosen) return
    setBusy(true)
    setError(null)
    try {
      for (const entry of chosen.plan.writes) {
        await writeTextFile(chosen.handle, entry.path, entry.contents)
      }
      setWritten(chosen.plan.writes.length)
      setChosen(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The files could not be written.")
    } finally {
      setBusy(false)
    }
  }

  if (!supported) return null

  const overwrites = chosen?.plan.writes.filter((entry) => entry.overwrite).length ?? 0

  return (
    <div className={cn("border border-border bg-panel", className)}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <span className="flex-1 text-[12.5px] leading-snug text-muted-foreground">
          Or write the files straight into a project — no CLI, no node.
        </span>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void choose()}>
          {busy && !chosen ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <FolderOpen className="size-3.5" />
          )}
          Choose a folder
        </Button>
      </div>

      {error ? (
        <p className="border-t border-border px-3 py-2 text-[12px] text-destructive">{error}</p>
      ) : null}

      {written !== null ? (
        <p className="flex items-center gap-1.5 border-t border-border px-3 py-2 font-mono text-[11px]">
          <Check className="size-3.5 text-emerald-500" />
          wrote {written} file{written === 1 ? "" : "s"}
        </p>
      ) : null}

      {chosen ? (
        <div className="space-y-2 border-t border-border px-3 py-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Into {chosen.handle.name} · {chosen.plan.writes.length} file
            {chosen.plan.writes.length === 1 ? "" : "s"}
            {overwrites ? ` · ${overwrites} replaced` : ""}
          </p>
          <ul className="max-h-56 space-y-0.5 overflow-y-auto font-mono text-[11px]">
            {chosen.plan.writes.map((entry) => (
              <li key={entry.path} className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "w-16 shrink-0 text-[10px] uppercase tracking-[0.12em]",
                    entry.overwrite ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {entry.overwrite ? "replace" : "new"}
                </span>
                <span className="break-all">{entry.path}</span>
              </li>
            ))}
          </ul>

          {chosen.plan.primitives.length ? (
            <div className="space-y-1 border-t border-border pt-2">
              <p className="text-[12px] leading-snug text-muted-foreground">
                These come from ui.shadcn.com, so they are not ours to write. Add them with:
              </p>
              <code className="block break-all rounded-sm bg-muted px-2 py-1.5 font-mono text-[11.5px]">
                {primitiveCommand(chosen.plan.primitives)}
              </code>
            </div>
          ) : null}

          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" disabled={busy} onClick={() => void write()}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <PackagePlus className="size-3.5" />}
              Write {chosen.plan.writes.length} file{chosen.plan.writes.length === 1 ? "" : "s"}
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setChosen(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export { InstallToFolder }
