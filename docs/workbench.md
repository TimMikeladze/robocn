# The workbench

`/workbench` is robocn's component workbench: a Storybook for robots that runs from this
repository's own source. It has no agent, no API key, no sandbox compiler and no chat. The
components on the stage are the real modules imported from `src/components/ui`, so an edit
by you — or by Claude or Codex working in the same checkout — lands on the stage through
Next's Fast Refresh without a reload, without a rebuild, and without losing the pose.

That is the whole loop: **run it locally, keep it open on a second screen, and let the
agent edit the file.**

## Why it replaced the builder

The old `/builder` asked an LLM for a brand new component, compiled the reply with esbuild
in a route handler, and rendered it inside a sandboxed iframe. Everything that made it work
— the bundled runtime, the virtual module map, the CSP'd preview document, the CLI
spawning, the key handling — existed to run code that was *not* in the repository.

When the agent is already editing the repository, none of it is needed. Deleting it removes
an OpenAI dependency, a process-spawning route handler, an esbuild dependency, a generated
browser runtime and about 1,300 lines. What replaces it is a better tool for the thing
people actually do here: look hard at a machine while changing it.

## What it does

**Every registry component, one keystroke away.** The sidebar lists all `registry:ui`
items, grouped by their registry category, filtered by a search box on `/`.

**Controls it derives, not controls anyone wrote.** No stories, no `argTypes`. A build step
parses each component's props interface with the TypeScript AST and emits a control per
prop: string-literal unions become segmented pickers, booleans toggles, numbers sliders with
a range inferred from the prop's name, doc comment and default, palette props colour wells.
Defaults come from the component's own parameter destructuring, so the stage opens on
exactly what the component does when you write `<RobotArm />`. Adding a prop to a component
adds a knob; no second file to update.

**Matrix mode.** Pick a prop for the columns and a prop for the rows and the stage draws the
whole cross product — all four variants against all four camera views, every `behavior`
against every `tool`. This is the view that finds the pose that is broken from the back. The
grid sizes its cells to fit the pane, so the whole cross product is on screen without
scrolling; zoom multiplies that fit rather than replacing it. Every cell is the live module,
so the pointer drives the machine in place — the corner button is what sends one to the
stage.

**A stage that is a drawing board.** Backgrounds (panel, grid, blueprint, dark, checker),
zoom, a size control, motion pause, a phase scrubber for components that take one, and an
outline overlay that draws the SVG's own bounding box.

**A new robot starts here too.** `New` in the toolbar (or `n`) names the machine, picks the
nearest existing one to follow, and writes the brief — file path, export name, item name,
what it is — pointing the agent at the `build-robot` skill, which scaffolds the rest with
`pnpm robot:new`. The agent builds it in this checkout; **the workbench picks the component up
the moment the file exists**, registry entry or not, so you can pose it while the rest of the
work is still going on.

**Drafts.** A machine under `src/components/ui` that no registry item claims is a draft: it
gets its own drawer at the top of the index, a `draft` badge on the status bar, and a second
brief in Handoff for shipping it the rest of the way. Shadcn primitives share that folder and
are not machines — what tells them apart is the robocn vocabulary, `@/lib/robocn` or a robot
hook. `rescan` on the status bar re-runs the generator so a file created since the page
loaded appears without restarting anything; it is a dev-server, same-machine convenience and
refuses anywhere else.

**It tells you how to run it.** A setup panel opens on a first visit and comes back from
the toolbar, the `?` key, or `?setup=1` in the URL. Five steps: clone and `pnpm dev`; open
`claude`, `codex` or `opencode` in the same checkout, which is the entire integration; pose a
component and copy the handoff; watch the edit land; and, optionally, open a folder. On
robocn.dev it says so plainly: every control works, but nothing hosted can rebuild your
components. The wording of every dialog is set by `docs/workbench-copy.md`.

**Export what is on the stage.** The toolbar's `Export` menu (`e`) records the stage — the
machine, the background, the zoom, and the whole grid in matrix mode — as an animated WebP,
an animated GIF or a still. It runs in the page and uploads nothing: `docs/export.md`.

**It can hold a folder.** `Folder` in the toolbar opens a directory picker; point it at this
checkout and the page has read and write access to it. The Source tab becomes an editor over
the real file with ⌘S to save, `New` writes the skeleton itself instead of only a brief, a
recording can land in `docs/screenshots` instead of your downloads, and a machine that is on
disk but not in the control manifest is noticed and rescanned without anyone pressing
anything. None of it changes what is *on* the stage — that is still a module Fast Refresh
swapped, which is why the local loop is still the loop. Chrome, Edge and Opera on a desktop;
elsewhere the button does not appear and everything falls back to what it did before. Notes:
`docs/checkout.md`.

**Handoff, not integration.** The workbench does not talk to an agent. It gives you the
things an agent needs, on the clipboard: the component's file path, a JSX snippet of the
pose currently on screen, the props as JSON, the rendered SVG, and a prepared prompt naming
the file, the export and the current pose. Paste it into Claude Code or Codex in the same
repository, let the agent edit `src/components/ui/<item>.tsx`, and watch the stage update.
The panel is open on arrival — `s` closes it, and a closed one says `panel=none` in the URL.

**The URL is the pose.** Component, mode, matrix axes, stage settings and every non-default
prop live in the query string, so a pose can be reloaded, bookmarked, or pasted to someone
else. `/workbench?c=robot-arm&p.variant=blueprint&p.view=iso` opens that drawing.

## How it is wired

```
scripts/build-workbench.mjs        reads registry.json + drafts on disk, parses each
  └── scripts/lib/workbench.mjs    the parsing: props, defaults, control kinds
        ├── src/lib/workbench/generated.json          control manifest (gitignored)
        └── src/components/workbench/registry.generated.tsx
                                   lazy import per component (gitignored)
```

`pnpm generate` runs it, and `pnpm dev`, `pnpm build`, `pnpm test` and `pnpm typecheck` all
run `pnpm generate` first, so a clean checkout is never missing it. Re-run it after adding a
component or changing a props interface — the manifest is a build artefact, the component
itself is live.

The generated registry file holds one `React.lazy` per component, so the workbench ships the
machine you are looking at rather than all 159. Fast Refresh still swaps the module
underneath a lazy boundary, which is what makes the loop work.

Two components need a WebGL context: `robot-arm-3d` is wrapped in `RobotStage`, and
`robot-stage` is given a `RobotArm3D` to hold. The manifest records that as a `wrap` field;
everything else mounts bare.

`GET /api/workbench/source?component=<id>` returns a component's current source for the
source panel. It resolves the path from the manifest and never from the request, so the
parameter can only name a component that ships. It is the fallback path now: with a folder
open the panel reads and writes the file directly and never calls it, which is also what
makes the Source tab work on robocn.dev.

`POST /api/workbench/scan` re-runs `scripts/build-workbench.mjs`, which is how a robot
created after the page loaded shows up without a restart. With a folder open it fires by
itself, because the page can see the new file before the manifest does — deriving controls
still means the TypeScript AST, and shipping the compiler to the browser to save a `POST`
would be a bad trade. It takes no parameters — there is
nothing in the request for the command to read — and refuses on a production build or a
request that did not come from this machine.

## Running it

```bash
git clone https://github.com/TimMikeladze/robocn.git
cd robocn
pnpm install
pnpm dev          # http://localhost:3000/workbench
```

Then open a coding agent in the same directory — `claude`, `codex`, `opencode`, or an editor.
Nothing to connect and no key to paste: the agent edits `src/components/ui/<item>.tsx` and
Fast Refresh puts it on the stage. `AGENTS.md` and the robot-building skills are already in the
repo, so an agent opened here knows the house rules.

It works when deployed too — it is an ordinary Next page — but the point of it is local,
where the file you are reading on the stage is the file the agent is editing. The same
instructions live in the page itself: `src/components/workbench/setup-guide.tsx`, written to
the voice in `docs/workbench-copy.md`.

## Verification

`scripts/__tests__/workbench.test.ts` checks the control extraction against real component
sources: union props become enums with the right options, defaults are read out of the
destructuring, palette props become colour controls, unsupported types are marked rather
than guessed. `src/lib/workbench/__tests__` covers the URL codec and the JSX/prompt
formatting. `src/components/workbench/__tests__` mounts the workbench and drives it, including the
setup panel: it opens once, names every agent CLI with its command, and comes back from
the toolbar after it has been dismissed. The creation path is covered at both ends — that a
file speaking robocn counts as a draft and a shadcn primitive does not, and that the brief
names the file, the export, the item and the machine to follow.
