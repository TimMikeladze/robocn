/**
 * A folder grant that survives a reload.
 *
 * The workbench is meant to sit open on a second screen while an agent works,
 * and a tool that forgets which folder it is holding every time the page
 * reloads is not that tool. `FileSystemDirectoryHandle` is structured-cloneable,
 * so IndexedDB can keep one — the *handle*, not the permission.
 *
 * The permission is the part browsers deliberately do not persist. After a
 * restart Chrome answers `prompt` rather than `granted`, and re-requesting it
 * needs a user gesture, so a restored handle is offered as **Reconnect** rather
 * than silently reused. Everything here fails soft: private browsing, a blocked
 * origin or a missing IndexedDB all read as "no stored handle".
 */

/**
 * The permission half of the File System Access API is still missing from
 * TypeScript's DOM lib. Declared locally rather than globally, so nothing else
 * in the app inherits types for an API its target may not have.
 */
type PermissionAwareHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>
}

const DATABASE = "robocn-fs"
const STORE = "handles"
const VERSION = 1

/** What a stored handle is for. One folder each, remembered separately. */
export type HandlePurpose = "checkout" | "install"

const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("No IndexedDB in this environment."))
      return
    }
    const request = indexedDB.open(DATABASE, VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("IndexedDB refused to open."))
  })

const transact = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const database = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(database.transaction(STORE, mode).objectStore(STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error("IndexedDB refused the request."))
    })
  } finally {
    database.close()
  }
}

/** Remember the folder behind `purpose`. Failures are not worth reporting. */
export async function rememberHandle(
  purpose: HandlePurpose,
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  try {
    await transact("readwrite", (store) => store.put(handle, purpose))
  } catch {
    /* A grant that cannot be remembered still works for this page load. */
  }
}

/** The folder behind `purpose`, or null. Says nothing about permission. */
export async function recallHandle(
  purpose: HandlePurpose,
): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await transact<FileSystemDirectoryHandle | undefined>("readonly", (store) =>
      store.get(purpose),
    )
    return handle ?? null
  } catch {
    return null
  }
}

export async function forgetHandle(purpose: HandlePurpose): Promise<void> {
  try {
    await transact("readwrite", (store) => store.delete(purpose))
  } catch {
    /* Nothing stored, or nowhere to store it. Either way there is nothing to do. */
  }
}

/**
 * Whether a handle can be used right now without asking.
 *
 * `granted` means go; `prompt` means a gesture is needed first, which is the
 * usual answer for a handle restored after a browser restart. A browser with no
 * permission API at all is treated as granted, since it cannot say otherwise.
 */
export async function handleState(
  handle: FileSystemDirectoryHandle,
  mode: "read" | "readwrite" = "readwrite",
): Promise<PermissionState> {
  const aware = handle as PermissionAwareHandle
  if (typeof aware.queryPermission !== "function") return "granted"
  try {
    return await aware.queryPermission({ mode })
  } catch {
    return "prompt"
  }
}
