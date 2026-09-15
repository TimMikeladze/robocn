/**
 * A registry item, resolved into a list of files to write.
 *
 * This is what `shadcn@latest add` does, minus the CLI. `public/r/<item>.json`
 * already carries every file's contents inline and a shadcn `target` alias; the
 * work is following `registryDependencies` to a closure, reading the receiving
 * project's `components.json` to learn what its aliases mean, and turning
 * `@ui/robot-arm.tsx` into a path on their disk.
 *
 * Everything here is pure — a fetcher and a couple of file contents go in, a
 * plan comes out. The writing, the picker and the confirmation live in
 * `src/components/site/install-to-folder.tsx`.
 */

import { defaultManager, shadcnRunner } from "@/lib/site"

export interface RegistryFile {
  path: string
  /** Alias-prefixed destination, e.g. `@ui/robot-arm.tsx`. */
  target?: string
  type?: string
  content?: string
}

export interface RegistryItem {
  name: string
  title?: string
  type?: string
  registryDependencies?: string[]
  files?: RegistryFile[]
}

/**
 * The item a dependency names, or null when it belongs to someone else.
 *
 * Dependencies are written as `{REGISTRY_URL}/r/robot-style.json` and baked at
 * build time against whatever host built them — often `localhost:3000`. Taking
 * the basename and refetching from the current origin is what makes a preview
 * deploy install from the preview deploy, and a dev server from itself.
 *
 * A bare name like `button` is a ui.shadcn.com primitive: not ours to fetch,
 * and not ours to write.
 */
export function registryItemName(dependency: string): string | null {
  if (!dependency.includes("/")) return null
  const file = dependency.split("?")[0].split("#")[0].split("/").pop() ?? ""
  return file.endsWith(".json") ? file.slice(0, -5) : null
}

/** The shadcn primitives a set of dependencies asks for, deduped and sorted. */
export const primitivesIn = (dependencies: Iterable<string>) =>
  [...new Set([...dependencies].filter((dependency) => !dependency.includes("/")))].sort()

export interface Closure {
  /** Every robocn item needed, the requested one first. */
  items: RegistryItem[]
  /** ui.shadcn.com primitives, which the visitor installs with the CLI. */
  primitives: string[]
}

/**
 * Walk `registryDependencies` breadth-first from `name`.
 *
 * Breadth-first rather than depth-first so the requested item stays at the head
 * of the list, which is the one the confirmation names. Items are fetched once
 * each; a cycle in the graph terminates because `seen` is checked before the
 * fetch, not after.
 */
export async function collectItems(
  name: string,
  fetchItem: (name: string) => Promise<RegistryItem>,
): Promise<Closure> {
  const items: RegistryItem[] = []
  const primitives = new Set<string>()
  const seen = new Set<string>([name])
  const queue = [name]

  while (queue.length) {
    const next = queue.shift()!
    const item = await fetchItem(next)
    items.push(item)
    for (const dependency of item.registryDependencies ?? []) {
      const dependent = registryItemName(dependency)
      if (!dependent) {
        primitives.add(dependency)
        continue
      }
      if (seen.has(dependent)) continue
      seen.add(dependent)
      queue.push(dependent)
    }
  }

  return { items, primitives: [...primitives].sort() }
}

/** The alias block of a `components.json`, with shadcn's own defaults filled in. */
export interface Aliases {
  ui: string
  lib: string
  hooks: string
  components: string
}

const DEFAULT_ALIASES: Aliases = {
  ui: "@/components/ui",
  lib: "@/lib",
  hooks: "@/hooks",
  components: "@/components",
}

/**
 * Read a project's aliases.
 *
 * shadcn lets `ui` be omitted, in which case it is `<components>/ui`. Anything
 * unparseable falls back to the defaults rather than throwing: a project with a
 * broken `components.json` should get a plan it can look at, not a stack trace.
 */
export function readAliases(componentsJson: string | undefined): Aliases {
  if (!componentsJson) return DEFAULT_ALIASES
  try {
    const parsed = JSON.parse(componentsJson) as { aliases?: Partial<Aliases> }
    const aliases = parsed.aliases ?? {}
    const components = aliases.components ?? DEFAULT_ALIASES.components
    return {
      components,
      ui: aliases.ui ?? `${components}/ui`,
      lib: aliases.lib ?? DEFAULT_ALIASES.lib,
      hooks: aliases.hooks ?? DEFAULT_ALIASES.hooks,
    }
  } catch {
    return DEFAULT_ALIASES
  }
}

/**
 * Where `@/` lands on disk.
 *
 * `tsconfig.json` is the authority — `"@/*": ["./src/*"]` is the common shape —
 * and `components.json`'s own `tailwind.css` path is the tiebreaker for a
 * project with no path mapping at all. Comments are stripped before parsing,
 * because `tsconfig.json` is JSONC and very often has them.
 */
export function readSourceRoot(
  tsconfig: string | undefined,
  componentsJson: string | undefined,
): string {
  const mapped = pathMapping(tsconfig)
  if (mapped !== null) return mapped
  try {
    const parsed = JSON.parse(componentsJson ?? "") as { tailwind?: { css?: string } }
    if (parsed.tailwind?.css?.startsWith("src/")) return "src"
  } catch {
    /* No usable hint; fall through to the root. */
  }
  return ""
}

function pathMapping(tsconfig: string | undefined): string | null {
  if (!tsconfig) return null
  try {
    // JSONC: drop line comments and block comments before parsing. Strings can
    // contain `//` (a URL in `$schema`), so only unquoted slashes are cut.
    const json = tsconfig
      .replace(/"(?:[^"\\]|\\.)*"|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (match) =>
        match.startsWith('"') ? match : "",
      )
      .replace(/,(\s*[}\]])/g, "$1")
    const parsed = JSON.parse(json) as {
      compilerOptions?: { paths?: Record<string, string[]> }
    }
    const target = parsed.compilerOptions?.paths?.["@/*"]?.[0]
    if (!target) return null
    // `./src/*` → `src`; `./*` → ``.
    return target.replace(/^\.\//, "").replace(/\/?\*$/, "")
  } catch {
    return null
  }
}

/**
 * Turn `@ui/robot-arm.tsx` into a path inside the receiving project.
 *
 * A target without a known alias prefix is taken as already relative to the
 * project root, which is how shadcn treats `registry:file` entries.
 */
export function resolveTarget(target: string, aliases: Aliases, sourceRoot: string): string {
  const prefixes: [string, string][] = [
    ["@ui/", aliases.ui],
    ["@hooks/", aliases.hooks],
    ["@lib/", aliases.lib],
    ["@components/", aliases.components],
  ]
  const match = prefixes.find(([prefix]) => target.startsWith(prefix))
  if (!match) return join(sourceRoot, target.replace(/^\.?\//, ""))
  const [prefix, alias] = match
  const rest = target.slice(prefix.length)
  // `@/components/ui` → `components/ui`, then under the project's source root.
  const directory = alias.startsWith("@/") ? alias.slice(2) : alias.replace(/^\.?\//, "")
  return join(sourceRoot, join(directory, rest))
}

const join = (left: string, right: string) => (left ? `${left}/${right}` : right)

export interface PlannedWrite {
  /** Path relative to the chosen project root. */
  path: string
  contents: string
  /** The item it came from, for a plan that groups by item. */
  item: string
  /** True when a file is already there and this write replaces it. */
  overwrite: boolean
}

export interface InstallPlan {
  writes: PlannedWrite[]
  primitives: string[]
  /** Files an item declared with no contents — nothing we can write. */
  skipped: string[]
}

/**
 * The closure, plus a project's conventions, as a list of writes.
 *
 * `exists` answers whether a path is already on disk; the caller passes a
 * predicate rather than a set because the only honest way to know is to ask the
 * directory handle, which is async at the call site and not this module's job.
 */
export function planInstall(
  closure: Closure,
  { aliases, sourceRoot, exists }: {
    aliases: Aliases
    sourceRoot: string
    exists: (path: string) => boolean
  },
): InstallPlan {
  const writes: PlannedWrite[] = []
  const skipped: string[] = []
  const claimed = new Set<string>()

  for (const item of closure.items) {
    for (const file of item.files ?? []) {
      const target = file.target ?? file.path
      const path = resolveTarget(target, aliases, sourceRoot)
      if (typeof file.content !== "string" || !file.content) {
        skipped.push(path)
        continue
      }
      // Two items can ship the same lib file; the first one wins, as it would
      // through the CLI.
      if (claimed.has(path)) continue
      claimed.add(path)
      writes.push({ path, contents: file.content, item: item.name, overwrite: exists(path) })
    }
  }

  return { writes, primitives: closure.primitives, skipped }
}

/** The one line that adds the primitives a plan cannot write itself. */
export const primitiveCommand = (primitives: string[], manager: string = defaultManager) =>
  `${shadcnRunner(manager)} shadcn@latest add ${primitives.join(" ")}`
