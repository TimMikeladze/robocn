---
name: refine-robot
description: Change a machine that already ships in robocn — fix a drawing, add an axis or a view, tune proportions, add a behaviour, or act on a screenshot of the running site. Use when the request names an existing component, pastes a picture of one of our own machines, or asks for a landing-page or docs-site change rather than a new machine.
---

# Refine a robot

Changing a machine that already ships is a different job from building one. The contract is
already kept, the tests already exist, and the thing that will bite you is not a missing file —
it is a snapshot you moved without meaning to, or an axis you added that broke a caller.

For a **new** machine, use `build-robot`. This is for everything else.

## First: what is the request actually about?

| The prompt has | It means | Go to |
|---|---|---|
| A component name and a complaint | Fix that drawing | *Fixing a drawing*, below |
| A screenshot of our own docs page, hero or a card | Feedback, not a subject | Read it as a bug report. Find what is wrong in that component and fix it — do not build a new one |
| A sketch with arrows over an existing machine | A change request | The arrows are the spec |
| "Different profiles", "from the side", "from above" | The `view` axis | `build-robot/references/views.md` |
| A layout, a chart, the landing page, the catalogue | Site work | `references/site.md` |
| A photo of a machine we do not have | A new component | `build-robot` |

When two readings are live, say which you took in one line and carry on.

## The loop

```bash
pnpm robot:check <name>          # before you touch anything — know what was already red
# make the change
pnpm robot:check <name>          # ~10 s
git diff -- src/components/ui/__tests__/__snapshots__/views
```

That last line is the one people skip. Every machine with a `view` axis has file snapshots
under `src/components/ui/__tests__/__snapshots__/views/`. A change to shared geometry helpers,
to `robotCamera`, or to `robot-style` moves snapshots for machines you never opened. Read the
diff and decide, per file, whether the move was intended. `-u` to accept them deliberately;
never `-u` to make a red suite green.

## Changing a drawing

The contract in `build-robot/SKILL.md` still holds — you are not allowed to quietly drop a
piece of it while fixing something else. In particular:

- **Never branch geometry on `variant`.** Only paint changes. If a shape only reads because of
  its fill, give the part a real outline rather than special-casing `outline`.
- **Check all four variants and all four views** after any geometry change. A silhouette tuned
  in one view collapses in another when parts have no modelled height — that is the signal that
  the geometry is flat, not that the camera is wrong.
- **`px()` anything new that came out of `Math.*`**, or the server and the browser disagree.
- **Every degree of freedom stays visibly mechanical.** A prop that only nudges pixels is the
  thing reviewers notice first.

`build-robot/references/craft.md` is the reference for proportion, silhouette and the machined
detail that separates a machine from a cartoon.

## Adding an axis to a machine that ships

An existing caller must see **no change**. That is the whole constraint, and it is what the
view snapshots are for.

1. The new prop's default is the current behaviour. A `view` default is the view it was drawn
   in; a new `behavior` member is not the default; a new geometry option defaults to what is
   drawn today.
2. Add it to the prop interface, the `aria-label` where it is part of what the machine *is*,
   and a `data-*` hook if it moves a mechanism.
3. Run `pnpm robot:check <name>` and confirm the machine's own snapshot did **not** move. If it
   did, the default is wrong.
4. Extend the test file: the new axis moves its mechanism, and rubbish input for it still
   renders neutral.
5. Optional but usually right: a control for it in the demo bench, a row in the docs props
   table. `build-robot/references/polish.md`.

Adding the `view` axis specifically has its own procedure — including the rule that the native
view must come out byte-identical — at the end of `build-robot/references/views.md`.

## Changing a solver

A solver is shared. Changing `walker.ts` changes the scout walker and the siege walker; changing
`style.ts` changes everything.

- Write the new assertion in the solver's own test first, in
  `src/lib/robocn/__tests__/`, and watch it fail.
- Then `pnpm robot:check <name>` for **each** machine on that solver, plus the snapshot diff.
- When the test and the solver disagree, work out which is right before changing either. The
  correction worth remembering: a test here once asserted a trot rolls *zero* and the
  arithmetic said 0.16. The arithmetic was right — a trot's diagonal puts a forehand against a
  hind end rather than two equal sides — and the documented claim changed to match the solver,
  not the other way round.

## Renaming or removing an item

The registry name is a published install URL. Renaming one breaks
`pnpm dlx shadcn add https://robocn.dev/r/<old>.json` for everyone who has it in a script.
Don't, unless the user asks for exactly that. If they do: the name appears in `registry.json`,
`src/lib/docs.ts`, the demos map, the catalogue `art` map, `views.test.tsx`, the snapshot
filenames, the README row, and any family allow-list. `pnpm robot:check` will not find a
renamed item at all, which is the signal that one of them was missed.

## Verify

```bash
pnpm robot:check <name>
pnpm robot:check <name> --full     # whole suite and next build, before shipping
```

Then drive it (`pnpm dev`; if the port is taken use another — don't kill what is running).
Confirm the thing that was wrong is right, and that the machine still reads at 150px and at
390px. A change made from a screenshot gets checked against that screenshot, in a browser, with
the browser agent — not from the diff.

Report what actually ran, including any snapshot you accepted and why.
