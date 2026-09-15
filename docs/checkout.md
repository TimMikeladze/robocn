# Holding a folder

The workbench has one wall in it, and every file feature is built against that wall: **a web
page cannot touch your disk.** Reading a component's source needs a route handler reading
`process.cwd()`. Creating a machine means writing a *brief* and pasting it into a terminal.
Rescanning means a route that spawns `node`. And robocn.dev — the hosted site, the one
almost everyone actually visits — says so out loud: *every control works, but nothing hosted
can edit your files.*

That wall has a door in it now. `showDirectoryPicker` hands a page a real directory, and
[`use-fs`](https://use-fs.com) turns that directory into React state that stays in sync with
disk. Point it at your checkout and the page can read `src/components/ui/robot-arm.tsx`,
watch it change under an agent's edits, and write it back.

This is **the checkout**: a folder the workbench is holding.

## What it is not

It is not a compiler. The stage renders *imported modules* — that is the whole reason
`/builder` and its esbuild route were deleted. A checkout gives the page the **text** of a
file, not a component. So:

| | with `pnpm dev` | on robocn.dev |
|---|---|---|
| Read a component's source | yes | **yes, with a checkout** |
| Edit and save it | **yes, with a checkout** | **yes, with a checkout** |
| Create a new machine's file | **yes, with a checkout** | **yes, with a checkout** |
| Install an item into another project | **yes, with a checkout** | **yes, with a checkout** |
| **See an edit on the stage** | yes — Fast Refresh | no |

The last row is the honest one. Editing `robot-arm.tsx` from robocn.dev writes the file
correctly and changes nothing on screen, because the browser has no way to rebuild the
module. Run `pnpm dev` and the same save lands on the stage in about a second. The checkout
does not replace the local loop; it makes every *other* part of the loop work without one.

## The seven things it buys

### 1. Installing without a CLI

`public/r/<item>.json` already carries the file contents inline and a shadcn `target`:

```json
{ "name": "robot-arm",
  "registryDependencies": ["https://robocn.dev/r/robot-style.json", "button"],
  "files": [{ "target": "@ui/robot-arm.tsx", "content": "…" }] }
```

Everything `npx shadcn@latest add` does with that file, a page can do: resolve
`registryDependencies` recursively, read the target project's `components.json` for its
aliases, and write. **Point the picker at any project and the item lands in it** — no node,
no network beyond the same-origin JSON, no CLI.

Two rules make this safe to ship:

- **Dependencies resolve by name against the current origin.** The URLs baked into
  `public/r/*.json` name whatever host built them (often `localhost:3000`). Taking only the
  basename and refetching from `location.origin` means a preview deploy installs from the
  preview deploy and a dev server installs from itself.
- **shadcn primitives are not ours to install.** `"button"`, `"card"`, `"slider"` come from
  ui.shadcn.com. The planner collects them and prints the one command that adds them, rather
  than guessing at a third party's registry across origins.

Every install shows its plan first — every path, marked `new` or `replace` — and writes
nothing until it is confirmed.

### 2. The source panel becomes an editor

With a checkout the Source tab stops being a `fetch` of a route and becomes a textarea over
`files.get(path)`, with ⌘S to save. There is no effect synchronising the two copies: with
nothing typed the box simply *is* what is on disk, so an agent's save arrives by itself. If
one lands while you have unsaved edits, the panel says so rather than letting one of you
silently win.

Handoff — copy a prompt, paste it in a terminal — stays exactly as it was. It is still the
right move for *build me a telescoping neck*. The editor is for the other half: nudging a
number, fixing a path, deleting a line you can see is wrong.

### 3. New writes the file

`New` used to produce a brief and wait for an agent to turn it into a file. With a
checkout it writes `src/components/ui/<slug>.tsx` itself, seeded from a real robocn skeleton
— props interface, palette, camera, size, a placeholder body that draws. The draft appears
in the index immediately, and the agent gets a file to edit rather than a blank prompt.

The brief is still produced, and still points at `ship-robot`. The template is a starting
point, not a machine.

### 4. Drafts come from disk

`src/lib/workbench/generated.json` is a build artefact — a component written a minute ago is
not in it. With a checkout the workbench compares the `.tsx` files on disk against the
manifest and reports the difference: *3 files on disk that the manifest has not seen.* On a
dev server it then triggers the existing rescan automatically, so the new draft arrives
without anyone pressing anything.

Control derivation still runs in node. Parsing a props interface means the TypeScript AST,
and shipping the compiler to the browser to save a `POST` is a bad trade. The checkout makes
the *detection* instant; the generator stays where it is.

### 5. Exports land in the repo

`docs/export.md` records a machine to a WebP, GIF or PNG and hands it to the browser's
download folder. With a checkout the same blob can be written to
`docs/screenshots/<name>.webp` instead — which is where it was going anyway.

### 6. A pose shelf in browser storage

The URL is the pose, and that is right: a pose should be a link. But a *set* of poses — the
six angles you keep comparing, the matrix you keep re-deriving — wants a shelf. OPFS is that
shelf: a private per-origin directory that needs no permission and no user gesture, and
works in Safari and Firefox where the disk picker does not.

### 7. Fewer routes in the way

`GET /api/workbench/source` and `POST /api/workbench/scan` both stay, because Firefox and
Safari have no picker and the local loop must work with no grant at all. But neither is on
the critical path any more: with a checkout the source panel never calls the route, and the
scan fires by itself.

## How it is wired

```
src/lib/fs/filters.ts       what a scan is allowed to walk
src/lib/fs/paths.ts         use-fs keys files by root name; the repo speaks repo-relative paths
src/lib/fs/handles.ts       IndexedDB, so a grant survives a reload
src/lib/fs/probe.ts         reading and writing a folder without watching it
src/lib/fs/install.ts       a registry item -> the files to write, and the primitives we cannot
src/lib/fs/poses.ts         the OPFS shelf
src/lib/workbench/draft.ts  the skeleton `New` writes

src/components/workbench/checkout.tsx         one useFs for the page, as context
src/components/workbench/checkout-button.tsx  the toolbar's four states
src/components/workbench/poses.tsx            the shelf, and its own useFs over OPFS
src/components/site/install-to-folder.tsx     the installer, under the install command
```

Two different shapes of file access, deliberately:

- **The workbench watches.** It wants to *see* an agent's edit land, so the checkout is a
  `use-fs` hook polling a filtered tree, held in context so the source panel, the
  new-machine dialog and the export menu share one scan.
- **The installer does not.** It reads two small files through the handle, probes the paths
  it is about to write, writes, and forgets the folder. A docs page has no business polling
  a stranger's repository.

### Paths

`use-fs` keys every file by the **watched root's own name** — pick `~/code/robocn` and the
arm is `robocn/src/components/ui/robot-arm.tsx`. robocn code speaks repository-relative
paths everywhere else. One conversion each way, in `paths.ts`, and nothing else in the app
has to know.

### Filters

A checkout is a repository; a scan that walks it all is a scan that walks `node_modules`.
`shouldProcessDirectory` prunes by prefix, so only a directory that is an ancestor of
something we care about is ever enumerated:

```
src/components/ui     the machines
src/lib/robocn        the solvers
src/hooks             the motion hooks
docs/screenshots      where exports land
registry.json  components.json
```

That is a little over 300 files. Steady state costs one `stat` each — contents are only
re-read when size or mtime moves — so the poll is cheap enough to leave running. It is set
to 600ms rather than the library's 300: a repository is bigger than the default assumption,
and an agent's save does not need to be seen in a third of a second.

A target project being installed into is not filtered, because it is not scanned:
`src/lib/fs/probe.ts` walks the handle directly for the two files it needs and for each path
it is about to write. That is also what makes the plan's `new` and `replace` labels true
rather than guessed.

### Permission

The picker is asked for `readwrite` up front, so there is one prompt rather than one per
write. The handle is stored in IndexedDB and re-queried on load; Chrome usually returns
`prompt` after a restart, which needs a gesture, so the toolbar shows **Reconnect** rather
than pretending to still hold the folder.

## Browser support

| | Chrome / Edge / Opera | Safari | Firefox |
|---|---|---|---|
| Disk checkout | desktop only | no | no |
| OPFS pose shelf | yes | 17+ | 111+ |

Everything degrades to what the workbench already did: no picker means no Folder button, the
source panel falls back to the route, and `New` writes a brief.
