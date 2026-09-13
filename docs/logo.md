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
| pointer moving anywhere on the page | the arm aims at the cursor; reach grows with distance |
| pointer still for 2.4 s, or never moved | falls back to a slow drift around the parked pose |
| pointer pressed on the header link | the welder fires — sparks at the tip |
| header link focused by keyboard | same, so the mark answers to a keyboard too |
| `prefers-reduced-motion` | parked pose, no loop, no listeners doing any work |
| `behavior="static"` | parked pose, deterministic — what the social card captures |

Tracking is window-wide, so the arm follows the cursor across the whole page rather
than only over its own 28 px box. The shoulder's screen position is computed from
the SVG's rect, so the aim is geometrically honest: the arm points *at* the cursor.

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
| `src/components/site/site-header.tsx` | live (`pointer`) | 28 px (the default) |
| `src/components/site/og-card.tsx` | `static`, so two captures of one commit are the same file | 56 px |
