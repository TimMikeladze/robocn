/**
 * What a scan is allowed to walk.
 *
 * A checkout is a repository, and a repository contains `node_modules`. The
 * File System Access API will happily enumerate all of it, four times a second,
 * for as long as the page is open — so the first thing a filter has to do is
 * say no.
 *
 * `shouldProcessDirectory` prunes an entire subtree, so pruning by *prefix* is
 * the whole trick: a directory is entered only when it is an ancestor of, or
 * inside, something the workbench actually reads. `src` is entered because
 * `src/components/ui` lives under it; `src/app` never is.
 */

import { createFilter, type FilterFn } from "use-fs"

/** The directories the workbench reads out of a robocn checkout. */
export const CHECKOUT_DIRECTORIES = [
  "src/components/ui",
  "src/lib/robocn",
  "src/hooks",
] as const

/** Single files worth having in the map, none of them in a watched directory. */
export const CHECKOUT_FILES = ["registry.json", "components.json", "package.json"] as const

/** Only text the workbench can do something with; never a recorded WebP. */
const READABLE = [".ts", ".tsx", ".json"]

/**
 * True when `directory` is on the path to `target` — either an ancestor of it
 * or inside it. Both arguments are relative to the watched root.
 */
export const onPath = (directory: string, target: string) =>
  directory === "" ||
  directory === target ||
  target.startsWith(`${directory}/`) ||
  directory.startsWith(`${target}/`)

export interface CheckoutFilterOptions {
  directories?: readonly string[]
  files?: readonly string[]
  /** Extensions worth reading. Defaults to `.ts`, `.tsx`, `.json`. */
  extensions?: readonly string[]
}

/**
 * A filter that walks only what it was told to.
 *
 * Nothing here excludes `node_modules` by name: it is excluded because it is
 * not on the path to anything, which is the same reason `.next`, `.git` and
 * `public` are. One rule, no list to keep up to date.
 */
export function checkoutFilter({
  directories = CHECKOUT_DIRECTORIES,
  files = CHECKOUT_FILES,
  extensions = READABLE,
}: CheckoutFilterOptions = {}): FilterFn {
  const inside = (path: string) =>
    directories.some((allowed) => path === allowed || path.startsWith(`${allowed}/`))

  return createFilter({
    shouldProcessDirectory: ({ relativePath }) =>
      directories.some((allowed) => onPath(relativePath, allowed)),
    shouldIncludeFile: ({ relativePath, name }) =>
      (files.includes(relativePath) || inside(relativePath)) &&
      extensions.some((extension) => name.endsWith(extension)),
  })
}
