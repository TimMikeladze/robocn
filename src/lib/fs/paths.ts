/**
 * Two vocabularies for the same file.
 *
 * `use-fs` keys every watched file by the **root directory's own name**: pick
 * `~/code/robocn` and the arm is `robocn/src/components/ui/robot-arm.tsx`.
 * Everywhere else — the control manifest, the registry, an agent brief — a file
 * is repository-relative: `src/components/ui/robot-arm.tsx`.
 *
 * The conversion lives here and nowhere else, so nothing downstream has to know
 * what the folder on someone's disk happens to be called.
 */

/** Strip a trailing slash and collapse `./`, so joins stay predictable. */
const tidy = (path: string) => path.replace(/^\.\//, "").replace(/\/+$/, "")

/** `robocn/src/x.tsx` under root `robocn` → `src/x.tsx`. Null when outside. */
export function repoPath(root: string, filePath: string): string | null {
  const clean = tidy(filePath)
  if (clean === root) return ""
  return clean.startsWith(`${root}/`) ? clean.slice(root.length + 1) : null
}

/** `src/x.tsx` under root `robocn` → `robocn/src/x.tsx`. */
export function checkoutPath(root: string, path: string): string {
  const clean = tidy(path).replace(/^\/+/, "")
  return clean ? `${root}/${clean}` : root
}

/**
 * The watched files re-keyed repository-relative.
 *
 * `use-fs` can watch several roots at once; the workbench only ever holds one,
 * so anything outside `root` is dropped rather than merged.
 */
export function repoFiles(root: string, files: Map<string, string>) {
  const out = new Map<string, string>()
  for (const [path, contents] of files) {
    const relative = repoPath(root, path)
    if (relative) out.set(relative, contents)
  }
  return out
}

/** Every path directly inside `directory`, repository-relative, sorted. */
export function entriesIn(files: Map<string, string>, directory: string) {
  const prefix = `${tidy(directory)}/`
  return [...files.keys()]
    .filter((path) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
    .sort()
}

/** `src/components/ui/robot-arm.tsx` → `robot-arm`. */
export const stemOf = (path: string) => path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? ""
