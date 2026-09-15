/**
 * The pose shelf.
 *
 * The URL is the pose, and that is right — a pose should be a link you can send
 * someone. But a *set* of poses, the six angles you keep comparing while a
 * machine is being built, wants somewhere to live that is not thirty tabs.
 *
 * The origin private file system is that somewhere: a per-origin directory that
 * needs no picker, no permission and no user gesture, and that Safari and
 * Firefox both implement even though neither has the disk picker. One JSON file
 * holds the shelf; `use-fs` watches it like any other directory.
 *
 * Everything in this module is pure so the parsing can be tested without a
 * browser. The reading and writing is `src/components/workbench/poses.tsx`.
 */

/** The OPFS directory the shelf is mounted at, and the file inside it. */
export const SHELF_ROOT = "robocn"
export const SHELF_FILE = `${SHELF_ROOT}/poses.json`

export interface SavedPose {
  id: string
  /** What the person called it. */
  name: string
  /** Which machine it poses, so the shelf can be filtered to one. */
  component: string
  /** The workbench's whole query string — component, mode, stage and props. */
  search: string
  /** Epoch milliseconds, for newest-first ordering. */
  savedAt: number
}

const isPose = (value: unknown): value is SavedPose => {
  if (!value || typeof value !== "object") return false
  const pose = value as Partial<SavedPose>
  return (
    typeof pose.id === "string" &&
    typeof pose.name === "string" &&
    typeof pose.component === "string" &&
    typeof pose.search === "string" &&
    typeof pose.savedAt === "number"
  )
}

/**
 * Read the shelf.
 *
 * A shelf that will not parse reads as empty rather than throwing: the file is
 * in browser storage where nobody can see it to fix it, so the recoverable
 * behaviour is to start again, not to break the panel.
 */
export function parseShelf(contents: string | undefined): SavedPose[] {
  if (!contents) return []
  try {
    const parsed = JSON.parse(contents) as unknown
    const list = Array.isArray(parsed)
      ? parsed
      : ((parsed as { poses?: unknown })?.poses ?? [])
    return (Array.isArray(list) ? list : []).filter(isPose).sort((a, b) => b.savedAt - a.savedAt)
  } catch {
    return []
  }
}

/** Written with a version key, so a later shape has something to switch on. */
export const serializeShelf = (poses: SavedPose[]) =>
  `${JSON.stringify({ version: 1, poses: [...poses].sort((a, b) => b.savedAt - a.savedAt) }, null, 2)}\n`

/**
 * Add a pose, replacing one that already carries the same name for the same
 * machine. Saving "three quarters" twice should update the shelf, not grow it.
 */
export function addPose(poses: SavedPose[], pose: SavedPose): SavedPose[] {
  const clash = (entry: SavedPose) =>
    entry.id === pose.id ||
    (entry.component === pose.component &&
      entry.name.trim().toLowerCase() === pose.name.trim().toLowerCase())
  return [pose, ...poses.filter((entry) => !clash(entry))]
}

export const removePose = (poses: SavedPose[], id: string) =>
  poses.filter((pose) => pose.id !== id)

/** Sortable, collision-proof enough for a list one person writes by hand. */
export const poseId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
