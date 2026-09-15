"use client"

/**
 * The pose shelf.
 *
 * The URL is the pose — that is the right primitive, because a pose should be a
 * link you can send someone. But a *set* of poses, the six angles you keep
 * comparing while a machine is being built, wants somewhere to live that is not
 * thirty tabs.
 *
 * The origin private file system is that somewhere. No picker, no permission,
 * no user gesture, and Safari and Firefox both have it even though neither has
 * the directory picker — so this is the one file feature that works everywhere.
 * It is deliberately a separate `useFs` from the checkout: two roots in one
 * hook would make every path ambiguous, and the shelf wants a far slower poll.
 */

import * as React from "react"
import { Bookmark, Trash2 } from "lucide-react"
import { createFilter, useFs } from "use-fs"

import {
  addPose,
  parseShelf,
  poseId,
  removePose,
  serializeShelf,
  SHELF_FILE,
  SHELF_ROOT,
  type SavedPose,
} from "@/lib/fs/poses"
import { cn } from "@/lib/utils"

/** One file, and it is ours. Nothing else on the origin is worth walking. */
const shelfFilter = createFilter({
  shouldProcessDirectory: ({ relativePath }) => relativePath === "",
  shouldIncludeFile: ({ name }) => name === "poses.json",
})

export interface PoseShelf {
  supported: boolean
  poses: SavedPose[]
  error: string | null
  save: (pose: Omit<SavedPose, "id" | "savedAt">) => Promise<void>
  remove: (id: string) => Promise<void>
}

/** Read and write the shelf. Mounted once, whatever React does to the effect. */
export function usePoseShelf(): PoseShelf {
  const filters = React.useMemo(() => [shelfFilter], [])
  const mounted = React.useRef(false)
  const [failure, setFailure] = React.useState<string | null>(null)
  const { files, addOpfsDirectory, writeFile, isOpfsSupported } = useFs({
    filters,
    // Nearly every change to this file is one this page just made, so there is
    // nothing to be gained by watching it four times a second.
    pollInterval: 2000,
  })

  React.useEffect(() => {
    if (mounted.current || !isOpfsSupported) return
    mounted.current = true
    void addOpfsDirectory({ name: SHELF_ROOT }).catch((cause: unknown) => {
      mounted.current = false
      setFailure(cause instanceof Error ? cause.message : "Browser storage is unavailable.")
    })
  }, [addOpfsDirectory, isOpfsSupported])

  const poses = React.useMemo(() => parseShelf(files.get(SHELF_FILE)), [files])

  const commit = React.useCallback(
    async (next: SavedPose[]) => {
      try {
        await writeFile(SHELF_FILE, serializeShelf(next))
        setFailure(null)
      } catch (cause) {
        setFailure(cause instanceof Error ? cause.message : "The shelf could not be written.")
      }
    },
    [writeFile],
  )

  return {
    supported: isOpfsSupported,
    poses,
    error: failure,
    save: (pose) => commit(addPose(poses, { ...pose, id: poseId(), savedAt: Date.now() })),
    remove: (id) => commit(removePose(poses, id)),
  }
}

export interface PosePanelProps {
  /** The machine on the stage: what a new save is filed under. */
  component: string
  /** The workbench's whole query string — the pose being saved. */
  search: string
  onOpen: (search: string) => void
  onClose: () => void
}

/** The panel behind the toolbar's Poses button. */
function PosePanel({ component, search, onOpen, onClose }: PosePanelProps) {
  const shelf = usePoseShelf()
  const [name, setName] = React.useState("")
  const [mine, setMine] = React.useState(true)

  const listed = mine ? shelf.poses.filter((pose) => pose.component === component) : shelf.poses

  const save = async () => {
    const label = name.trim()
    if (!label) return
    await shelf.save({ name: label, component, search })
    setName("")
  }

  return (
    <div className="absolute right-0 top-8 z-40 flex w-80 flex-col gap-2 rounded-sm border border-border bg-background p-2 shadow-md">
      {shelf.supported ? (
        <>
          <form
            className="flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name this pose…"
              aria-label="Name this pose"
              className="h-7 min-w-0 flex-1 rounded-sm border border-border bg-background px-2 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="inline-flex h-7 items-center gap-1 rounded-sm border border-border px-2 font-mono text-[11px] transition-colors hover:bg-accent disabled:opacity-40"
            >
              <Bookmark className="size-3" /> Save
            </button>
          </form>

          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <button
              type="button"
              onClick={() => setMine(true)}
              aria-pressed={mine}
              className={cn("rounded-sm px-1.5 py-0.5", mine && "bg-foreground text-background")}
            >
              this machine
            </button>
            <button
              type="button"
              onClick={() => setMine(false)}
              aria-pressed={!mine}
              className={cn("rounded-sm px-1.5 py-0.5", !mine && "bg-foreground text-background")}
            >
              everything ({shelf.poses.length})
            </button>
          </div>

          <ul className="max-h-64 space-y-0.5 overflow-y-auto">
            {listed.map((pose) => (
              <li key={pose.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onOpen(pose.search)
                    onClose()
                  }}
                  className="min-w-0 flex-1 truncate rounded-sm px-1.5 py-1 text-left text-[12px] transition-colors hover:bg-accent"
                  title={pose.search}
                >
                  {pose.name}
                  {mine ? null : (
                    <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                      {pose.component}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  aria-label={`Forget ${pose.name}`}
                  onClick={() => void shelf.remove(pose.id)}
                  className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </button>
              </li>
            ))}
            {listed.length === 0 ? (
              <li className="px-1.5 py-2 text-[12px] leading-snug text-muted-foreground">
                Nothing saved yet. A pose kept here stays in this browser — it is not a link, and
                nothing is uploaded.
              </li>
            ) : null}
          </ul>
          {shelf.error ? <p className="text-[11px] text-destructive">{shelf.error}</p> : null}
        </>
      ) : (
        <p className="p-1 text-[12px] leading-snug text-muted-foreground">
          This browser has no origin private file system, so there is nowhere to keep a shelf.
          The URL is still the pose — bookmark it.
        </p>
      )}
    </div>
  )
}

export { PosePanel }
