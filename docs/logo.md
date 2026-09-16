# The logo is a robot arm in a work cell

The mark in the header is not a drawing of an arm. It is an arm: a three-link chain
solved every frame by the same `solveChain2` / `useRobotArm` core that drives
`robot-arm`, `robot-arm-3d` and every other machine in the registry. The site's
one-line claim — *these are real kinematics, not clip art* — is made by the first
thing on the page, at 28 px, before the visitor has read a word.

`src/components/site/logo.tsx`. The redesign that produced the current geometry,
type and spacing is written up in [docs/header-lockup.md](header-lockup.md).

## The cell

The arm is drawn inside a rounded square, faintly tinted in the machines' orange
with a hairline edge. It earns its place three times over:

- a bare stick figure has no silhouette at 16 px. A tinted square with something
  angular inside it does, so the mark survives being a favicon
- a square is a box the wordmark can be optically centred against. Alignment in the
  header stops being a judgement call
- the orange reads as a machine lit inside a cell rather than as a scribble
  floating on the header ground

`cell={false}` draws the bare machine, for a ground that already supplies a frame.

## What it does

| state | behaviour |
| --- | --- |
| a click anywhere on the page | the arm swings to aim at it; reach grows with distance |
| after that click | it *stays there* — the cursor moving over it does nothing |
| never clicked | a slow drift around the parked pose, so a first visit sees a machine |
| pointer pressed on the header link | the welder fires — sparks at the tip |
| header link focused by keyboard | same, so the mark answers to a keyboard too |
| `prefers-reduced-motion` | no drift and no travel: a click snaps the arm to its new pose |
| `behavior="static"` | parked pose, deterministic — what the social card captures |

Aiming is window-wide and click-driven: the listener is `pointerdown` in the capture
phase, so a click anywhere — including on a control that stops propagation — re-aims
the arm, and nothing but a click does. The shoulder's screen position is computed
from the SVG's rect, so the aim is geometrically honest: the arm points *at* the
place that was clicked.

The bearing gives the side and the distance gives the reach, but vertical distance
is folded into *elevation* rather than taken literally: the arm works the half plane
above its own shoulder, because anything lower folds the chain over its own pedestal
and the mark goes to mush. A click below the shoulder therefore raises the arm on
that side, weighted to a third (`DOWNWEIGHT`) — without that weighting every click
in the body, which is nearly all of them, would flatten to one horizontal pose,
since almost the whole page sits below a header-height shoulder.

## The pose persists

The aim is written to `localStorage` under `robocn:logo-aim` and read through
`useSyncExternalStore`, so the arm holds its pose across a route change (the header
never unmounts) and across a reload (the store). Reading it as an external store
rather than as component state is what keeps hydration honest — the server snapshot
is "no aim", so the server renders the parked pose and React swaps in the stored one
on the client's own first pass — and it comes with the `storage` event for free: a
click in one tab re-aims the mark in every other tab. A blocked or full store is
caught on both the read and the write; the mark then simply parks.

## Why a purpose-drawn mark and not `<RobotArm size={28} />`

`robot-arm` is authored in a 132 × 118 world with a base plate, cable carrier, tool
changer and reach envelope. At 28 px all of that collapses into grey mush, and it
would pull the whole component — plus its palette and view machinery — into every
page's header bundle. The logo shares the *solver*, not the *geometry*: a 24 × 24
box, three links, round-capped strokes that taper from shoulder to wrist, one hot
orange tool tip, and a cell to stand it in.

## Colour

The mark is painted, not inked. The chrome's one accent colour is teal
(`--signal`); the mark ignores it, because the mark is a robot and the robots are
orange.

| part | colour |
| --- | --- |
| the cell: fill / ring | `--shell` at 8% / 38% |
| the three links, and the joint hubs | `--shell` |
| the bore through the shoulder and elbow | `--background` — the page's own ground |
| tool tip and its sparks | `--shell-hot` |
| foot and pedestal | `--shell` |

`--shell` is the machines' `--robot-shell` pulled a shade darker in the light
theme, so a 28 px mark holds against a near-white ground; the dark theme takes it
back up. Both are declared in `src/app/globals.css` and exposed to Tailwind as
`shell` / `shell-hot`, so the mark is `stroke-shell` / `fill-shell-hot` rather
than a hard-coded hex.

## Geometry

Everything lives in the 24 × 24 viewBox.

```
cell       (1, 1) 22 x 22, r 6.2
shoulder   (9.2, 14.2)      on a pedestal, on a foot bar at y 19.7
links      [6, 4, 2.9]      reach 12.9
parked tip (17.2, 6.8)      ~0.85 extension, up and to the right
bend       "down"           elbow up and over, not curled
```

Limb and joint are deliberately different weights, because at 28 px equal ones read
as one undifferentiated blob:

| | shoulder | elbow | wrist |
| --- | --- | --- | --- |
| link stroke | 2.1 | 1.7 | 1.15 |
| hub radius | 2.4 | 1.95 | 1.35 |
| bore radius | 1.15 | 0.85 | — solid |

The wrist has no bore: a ring around a 1.35 hub is under a pixel at 28 px, and
reads as dirt rather than as a bearing. The pedestal is narrower than the shoulder
hub, so it reads as a column the arm is bolted to rather than as more of the same
mass. The tool is 1.5, sized to clear the wrist hub instead of fusing with it.

The goal is clamped twice before it reaches the solver — to an annulus around the
shoulder (6.5 … 12) and to a box inset 3.6 from the viewBox — so no pose, however the
cursor is thrown about, puts an elbow outside the mark.

## Renders with no client runtime

The initial pose is solved during `useState`'s initialiser from a clock of zero,
which is the parked pose exactly. Server and client therefore agree, and the mark
is correct in the HTML before hydration — which is also what makes the social card
capture reproducible.

## Where it is used

| place | mode | size |
| --- | --- | --- |
| `src/components/site/site-header.tsx` | live (`pointer`), click-aimed | 36 px |
| `src/components/site/og-card.tsx` | `static`, so two captures of one commit are the same file | 56 px |

And, frozen, in the three files a browser reads before it has read the page —
`pnpm icons` lifts the parked pose off `/og` with its colours baked on and writes
`src/app/icon.svg`, `src/app/apple-icon.png` (180 px, flattened onto the light
ground because iOS composites a touch icon itself) and `src/app/favicon.ico`
(16, 32, 48, transparent corners kept, packed by `scripts/lib/ico.mjs` because
sharp has no `.ico` encoder). The tab strip, the bookmark bar and the app bar are
therefore the same machine in the same pose. Re-run `pnpm icons` whenever the mark
moves.
