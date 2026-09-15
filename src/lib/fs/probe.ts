/**
 * Reading and writing a folder directly, without watching it.
 *
 * The workbench holds its checkout through `use-fs`, because it wants to *see*
 * an agent's edits land. Installing into someone else's project wants the
 * opposite: read two small files, probe a dozen paths, write, and never think
 * about that folder again. A 300ms poll over a stranger's repository would be
 * all cost and no benefit.
 *
 * So this is the other half — plain handle walking, no state, no polling.
 */

/** Walk to the directory holding `path`, creating it when asked. */
async function directoryFor(
  root: FileSystemDirectoryHandle,
  path: string,
  create: boolean,
): Promise<{ directory: FileSystemDirectoryHandle; name: string } | null> {
  const segments = path.split("/").filter((segment) => segment && segment !== ".")
  const name = segments.pop()
  if (!name || segments.includes("..")) return null
  let directory = root
  for (const segment of segments) {
    try {
      directory = await directory.getDirectoryHandle(segment, { create })
    } catch {
      return null
    }
  }
  return { directory, name }
}

/** The file's contents, or undefined when it is not there. */
export async function readTextFile(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<string | undefined> {
  const entry = await directoryFor(root, path, false)
  if (!entry) return undefined
  try {
    const handle = await entry.directory.getFileHandle(entry.name)
    return await (await handle.getFile()).text()
  } catch {
    return undefined
  }
}

/** Whether a file is already there — the difference between `new` and `overwrite`. */
export async function fileExists(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<boolean> {
  const entry = await directoryFor(root, path, false)
  if (!entry) return false
  try {
    await entry.directory.getFileHandle(entry.name)
    return true
  } catch {
    return false
  }
}

/** Write `contents` to `path`, creating every missing directory on the way. */
export async function writeTextFile(
  root: FileSystemDirectoryHandle,
  path: string,
  contents: string,
): Promise<void> {
  const entry = await directoryFor(root, path, true)
  if (!entry) throw new Error(`Cannot write ${path}.`)
  const handle = await entry.directory.getFileHandle(entry.name, { create: true })
  const writable = await handle.createWritable()
  try {
    await writable.write(contents)
    await writable.close()
  } catch (cause) {
    await writable.abort().catch(() => undefined)
    throw cause
  }
}
