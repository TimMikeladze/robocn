# The puzzle cube — a permutation state machine, not a pose table

One machine and one solver, on an axis nothing in the set has: **the mechanism's whole state
is a permutation**, and there is no target to reach for. Every other item solves a continuous
pose from a continuous input. This one holds a discrete configuration, and motion happens only
while it is travelling between two of them.

| Item | Type | What it is |
|---|---|---|
| `cube-geometry` | lib | An N×N×N twisty cube as cubies on an integer lattice, each carrying an integer orientation matrix. Moves, algebra, scramble, drag-to-move, sticker lookup. |
| `puzzle-cube` | ui | The cube as a real react-three-fiber rig: orbit it, drag a face to turn that layer, type moves, scramble and reset. |

## Why a matrix per cubie, and not 54 facelets

The usual model is a 54-entry facelet string with six hard-coded permutation tables. It is
compact and it is exactly wrong for a 3D rig, for two reasons:

- It only exists for 3×3. Every other order needs new tables.
- It does not say **where a piece is or which way it points**, which is precisely what the
  renderer has to place every frame.

So a cubie is `{ i, j, k }` on an integer lattice plus a 3×3 **integer** orientation matrix
mapping its own axes onto the world's. A quarter turn is one matrix multiply and one
coordinate rotation, both exact — no floating point enters the state, so a cube turned ten
thousand times is bit-identical to one turned none, and `isSolved` is "every matrix is the
identity" rather than a string compare.

A sticker's colour follows from the same matrix. The sticker facing world face `f` shows the
colour of face `Rᵀf` — transpose, because orientation maps local to world and the question runs
the other way. In the solved state the matrix is the identity and every sticker shows its own
face, which is the definition of solved.

## Turns, moves, and which way is clockwise

Two vocabularies, because the two callers want different things:

- **`CubeMove`** — `{ face, layer, turns }`, what a human types: `R`, `U'`, `F2`, `2R`.
  `turns` is quarter turns **clockwise looking at that face from outside**.
- **`CubeTurn`** — `{ axis, slice, quarterTurns }`, what the renderer animates: quarter turns
  **right-handed about the positive axis**, and a slice index along it.

`moveToTurn` / `turnToMove` convert. The sign flip lives in exactly one place: for `U`, `R`, `F`
the outward normal is the positive axis and clockwise-from-outside is a **negative** right-handed
turn; for `D`, `L`, `B` it is positive. Getting that wrong is the classic bug where three faces
of a cube turn the wrong way and the puzzle becomes unsolvable, so it is a test.

## Drag is solved, not guessed

`moveFromDrag` is pure and is what makes the thing usable by a human: given the face you
grabbed, the cubie you grabbed it by, and a drag direction in world units, it projects the drag
onto the two in-plane axes, takes the dominant one, and crosses it with the face normal. That
cross product **is** the rotation axis, and its sign is the direction — so a drag up the right
face turns that column up, the way a hand expects, from any camera angle. The component hands it
raw pointer deltas and does no geometry of its own.

## Colours

Six face colours are the one place in the set where the four palette roles are not enough: a
cube whose faces are all `shell` is not a cube. So `puzzle-cube` resolves each face as
**prop → `--robot-cube-<face>` → the standard scheme** (white, yellow, green, blue, red, orange),
the same three-step resolution every palette role uses. The plastic body, the core and the
highlight still come from `resolveRobotPalette()`, so the cube sits in a themed page rather than
on top of it. `faces={{ U: "var(--chart-1)" }}` retints one face; `--robot-cube-u` retints it for
a whole site.

## What is solved and what is illustrated

Solved: the state, every turn, the scramble, the drag-to-move, the sticker colours, `isSolved`.
Illustrated: the eased travel of a turn (a real cube's wrist is not a cosine), and the rounded
cubie shell.

**Not** included: a solver in the other sense — nothing here works out how to *unscramble* a
cube. `reset()` restores the identity state; it does not find a solution. A component that
claimed to solve a cube and only reset it would be the illustrated-as-solved trap.

## Hooks

`data-cube` on the rig, `data-cube-order`, `data-cube-solved`, `data-cube-turning` (the axis
in motion, or absent), and `data-cube-moves` (the move count) — enough for a test or a readout
to follow the state without reaching into three.js.
