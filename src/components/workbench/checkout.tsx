"use client"

/**
 * The folder the workbench is holding.
 *
 * One `useFs` for the whole page: the source panel, the new-machine dialog, the
 * export menu and the draft counter all read the same scan rather than each
 * opening their own picker. Notes: `docs/checkout.md`.
 *
 * Nothing here renders a machine. A checkout gives the page the *text* of a
 * file, not a module — the stage still redraws through Fast Refresh, which is
 * why this is an addition to the local loop and not a replacement for it.
 */

import * as React from "react"
import { ensurePermission, getDirectoryPicker, useFs } from "use-fs"

import { checkoutFilter } from "@/lib/fs/filters"
import { forgetHandle, handleState, recallHandle, rememberHandle } from "@/lib/fs/handles"
import { checkoutPath, repoFiles } from "@/lib/fs/paths"

export interface CheckoutValue {
  /** Whether this browser has a directory picker at all. */
  supported: boolean
  /** The folder's own name, or null when none is held. */
  root: string | null
  /** Watched files, keyed repository-relative. */
  files: Map<string, string>
  /** A folder remembered from last time that needs a gesture to reuse. */
  pending: string | null
  /** True once the held folder looks like a robocn checkout. */
  isRobocn: boolean
  busy: boolean
  error: string | null
  connect: () => Promise<void>
  reconnect: () => Promise<void>
  disconnect: () => Promise<void>
  read: (path: string) => string | undefined
  write: (path: string, data: string | Blob) => Promise<void>
}

const CheckoutContext = React.createContext<CheckoutValue | null>(null)

/** The workbench's checkout. Null-safe: a page with no provider gets nothing held. */
export function useCheckout(): CheckoutValue {
  return React.useContext(CheckoutContext) ?? EMPTY
}

const EMPTY: CheckoutValue = {
  supported: false,
  root: null,
  files: new Map(),
  pending: null,
  isRobocn: false,
  busy: false,
  error: null,
  connect: async () => {},
  reconnect: async () => {},
  disconnect: async () => {},
  read: () => undefined,
  write: async () => {},
}

/** A robocn checkout, not merely a folder that happens to contain `src`. */
const looksLikeRobocn = (files: Map<string, string>) => {
  const manifest = files.get("package.json")
  if (manifest) {
    try {
      if ((JSON.parse(manifest) as { name?: string }).name === "robocn") return true
    } catch {
      /* Unreadable `package.json`; fall through to the shape of the tree. */
    }
  }
  return [...files.keys()].some((path) => path.startsWith("src/lib/robocn/"))
}

export function CheckoutProvider({ children }: { children: React.ReactNode }) {
  // Built once: `useFs` rebuilds a filter per scan, so the array only has to be
  // stable, not the filter.
  const filters = React.useMemo(() => [checkoutFilter()], [])
  const [busy, setBusy] = React.useState(false)
  const [failure, setFailure] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState<string | null>(null)

  const {
    files: watched,
    directories,
    isBrowserSupported,
    error,
    addDirectory,
    onClear,
    writeFile,
  } = useFs({
    filters,
    mode: "readwrite",
    // A repository is bigger than the library's default assumption, and an
    // agent's save does not need to be seen in a third of a second.
    pollInterval: 600,
  })

  const root = directories[0] ?? null
  const files = React.useMemo(() => (root ? repoFiles(root, watched) : new Map()), [root, watched])

  // A folder remembered from last time. Chrome answers `prompt` after a
  // restart, and re-requesting needs a gesture — so a handle that is not
  // already granted is offered as Reconnect rather than quietly reused.
  // A ref rather than state: under StrictMode the effect runs twice, and a
  // second `addDirectory` would watch the same folder again under a ` (2)`
  // path, which makes every repository-relative path ambiguous.
  const restored = React.useRef(false)
  React.useEffect(() => {
    if (restored.current) return
    restored.current = true
    let live = true
    void (async () => {
      const handle = await recallHandle("checkout")
      if (!handle || !live) return
      if ((await handleState(handle)) === "granted") {
        if (live) await addDirectory(handle)
      } else if (live) {
        setPending(handle.name)
      }
    })()
    return () => {
      live = false
    }
  }, [addDirectory])

  const hold = React.useCallback(
    async (handle: FileSystemDirectoryHandle) => {
      if (!(await ensurePermission(handle, "readwrite"))) {
        throw new Error("Write access was declined, so the folder was not opened.")
      }
      await rememberHandle("checkout", handle)
      // One folder at a time: a second `addDirectory` would watch both, and
      // every repository-relative path would then be ambiguous.
      await onClear()
      await addDirectory(handle)
      setPending(null)
    },
    [addDirectory, onClear],
  )

  const guard = React.useCallback(async (run: () => Promise<void>) => {
    setBusy(true)
    setFailure(null)
    try {
      await run()
    } catch (cause) {
      // An abandoned picker is not a failure worth reporting.
      const message = cause instanceof Error ? cause.message : "That did not work."
      if (!(cause instanceof DOMException && cause.name === "AbortError")) setFailure(message)
    } finally {
      setBusy(false)
    }
  }, [])

  const connect = React.useCallback(
    () =>
      guard(async () => {
        const picker = getDirectoryPicker()
        if (!picker) throw new Error("This browser has no directory picker.")
        // `id` groups the prompt, so the browser reopens where it was last.
        await hold(await picker({ id: "robocn-checkout", mode: "readwrite" }))
      }),
    [guard, hold],
  )

  const reconnect = React.useCallback(
    () =>
      guard(async () => {
        const handle = await recallHandle("checkout")
        if (!handle) {
          setPending(null)
          throw new Error("That folder is no longer remembered. Open it again.")
        }
        await hold(handle)
      }),
    [guard, hold],
  )

  const disconnect = React.useCallback(
    () =>
      guard(async () => {
        await onClear()
        await forgetHandle("checkout")
        setPending(null)
      }),
    [guard, onClear],
  )

  const write = React.useCallback(
    async (path: string, data: string | Blob) => {
      if (!root) throw new Error("No folder is open.")
      await writeFile(checkoutPath(root, path), data)
    },
    [root, writeFile],
  )

  const value = React.useMemo<CheckoutValue>(
    () => ({
      supported: isBrowserSupported,
      root,
      files,
      pending,
      isRobocn: root ? looksLikeRobocn(files) : false,
      busy,
      error: failure ?? error?.message ?? null,
      connect,
      reconnect,
      disconnect,
      read: (path: string) => files.get(path),
      write,
    }),
    [isBrowserSupported, root, files, pending, busy, failure, error, connect, reconnect, disconnect, write],
  )

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>
}
