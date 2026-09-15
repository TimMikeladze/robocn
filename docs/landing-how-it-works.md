# The landing page's "what to do with it" section

## What it replaced

A four-cell statistics strip sat between the hero and the catalogue:

```
207              0                          8              2D + 3D
registry items   dependencies in the solver end effectors  same kinematics
```

It was wrong on three counts.

**It was the wrong idiom.** A stat bar is a generic SaaS pattern on a site whose
entire visual language is engineering drawings — datum frames, corner ticks, mono
captions, a blueprint variant.

**The numbers did not hold up.** `0` reads as a hole rather than a boast. "8 end
effectors" is trivia, not a headline. `2D + 3D` is not a number at all, so the row
was not really a number row.

**It did no work.** A visitor arriving from the hero has one question — *what do I
do with this* — and four figures do not answer it.

## What is there now

Five numbered panels, in the order a reader actually needs them, with every panel
ending on a line they can type:

| | |
|---|---|
| 01 Install one | The registry model, and the `@robocn` short-name form the hero does not show |
| 02 Drive it | Target, value, or nothing; solved every frame; one solve behind SVG and WebGL |
| 03 Build a new one | The workbench: derived controls, matrix mode, `New` |
| 04 Or let an agent build it | The four skills, what each is for, and how to install them |
| 05 Everything here is readable as text | `.md` mirrors, `Accept: text/markdown`, `llms.txt`, *Copy page* |

The facts worth keeping from the old strip are folded into the prose: the item
count is in 01, "no dependencies at all" and "the same target puts the tip in the
same place in SVG and in WebGL" are in 02.

## Rules for editing it

**The item count is derived.** `docs.filter(entry => entry.item).length`, never a
literal — and it is described as *registry items*, not *machines*, because the
foundations are solvers and hooks.

**Every command has to work as written.** 01 prints the namespace form, which is
why the copy says to register `@robocn` first; an earlier draft printed
`shadcn@latest add robot-arm`, which would have resolved against shadcn's own
registry and failed. 03 says `pnpm dev` rather than `bun dev` because the
workbench runs from a checkout of *this* repository, whose toolchain is pnpm —
that is a different thing from the install line the site recommends to consumers
(`docs/install-line.md`).

**Code lines wrap, they do not scroll.** A command clipped at the panel edge reads
as broken. `whitespace-pre-wrap` with `break-words`, not `overflow-x-auto`.

**The skills list has to match `skills/`.** It is hardcoded in the component so the
purposes can be one line rather than the full `description` front matter, and a
test asserts the names are exactly the directories under `skills/`.
