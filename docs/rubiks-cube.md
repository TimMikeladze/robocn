# The Rubik's cube — a permutation state machine, not a pose table

One machine and one solver, on an axis nothing in the set has: **the mechanism's whole state
is a permutation**, and there is no target to reach for. Every other item solves a continuous
pose from a continuous input. This one holds a discrete configuration, and motion happens only
while it is travelling between two of them.

| Item | Type | What it is |
|---|---|---|
| `cube-geometry` | lib | An N×N×N twisty cube as cubies on an integer lattice, each carrying an integer orientation matrix. Moves, algebra, scramble, drag geometry, sticker lookup, and a layer-by-layer solver. |
| `rubiks-cube` | ui | The cube as a game: grab a face and the layer turns with your hand, type moves, scramble, hint, solve, undo. |
| `puzzle-cube` | ui | The flat sibling: the same solver drawn in SVG. Notes: `docs/puzzle-cube.md`. |

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
cube whose faces are all `shell` is not a cube. So `rubiks-cube` resolves each face as
**prop → `--robot-cube-<face>` → the standard scheme** (white, yellow, green, blue, red, orange),
the same three-step resolution every palette role uses. The plastic body, the core and the
highlight still come from `resolveRobotPalette()`, so the cube sits in a themed page rather than
on top of it. `faces={{ U: "var(--chart-1)" }}` retints one face; `--robot-cube-u` retints it for
a whole site.

## Solving it — the search that is a method

`solveCube(state)` returns the moves that take *this* cube home, or `null`. It is the
beginner's layer-by-layer method, and the thing worth reading is how it is written: not as a
hundred hand-cased positions, but as **staged iterative deepening over an alphabet of macros**.

Before any of it, a short exhaustive search over the eighteen face turns, five
deep: a cube five turns from home costs five moves back rather than the hundred
and thirty a layer-by-layer method would happily spend. Only when that finds
nothing does the method run.

| Stage | Alphabet | Goal |
|---|---|---|
| Cross | the 18 face turns | the four D edges home, earlier ones preserved |
| First-layer corners | `U U' U2` + six short inserts at each of four slots, then `R U R' U'` deep | the four D corners home |
| Middle edges | `U U' U2` + the right- and left-hand inserts at four slots | the four E-slice edges home |
| Last-layer cross | `U U' U2` + `F R U R' U' F'` at four slots | four U edges oriented |
| Last-layer corners, twist | `U U' U2` + sune and anti-sune at four slots | four U corners oriented |
| Last-layer corners, place | `U U' U2` + the A-perm at four slots | corners home |
| Last-layer edges, place | `U U' U2` + the U-perm both ways at four slots | solved |

Each stage's goal *carries every earlier stage's*, so a search cannot buy one piece by spending
another — which is what replaces the case analysis. Each is a search a few symbols deep over
big steps rather than a deep search over small ones, and the corner stage shows the shape of
it: a first pass over many short inserts finds the tidy answer nearly every time, and the
fallback is one four-move algorithm searched deep, which always has an answer and spends moves
to get it.

Three rules keep it honest:

- **It runs on a packed encoding** — where each piece sits (0 … 26) and which of the 24
  rotations it carries, two `Uint8Array`s — so a turn is 27 table lookups and no allocation. A
  scrambled 3×3 solves in single-digit milliseconds.
- **The line is replayed and checked.** `solveCube` cancels the line down with `simplifyMoves`,
  applies it to the state it was given, and returns `null` unless that comes home. It never
  hands back a solution it has not watched work.
- **The centres come first.** A middle-slice turn moves them, and the face names mean nothing
  until they are home — so the solver finds the one of the 24 ways the cube can sit that puts
  them back, turns the cube in its head, solves it there, and writes each move back out on the
  face that was standing where that one is now.
- **3×3 only.** A 4×4 has parities this method knows nothing about, so every other order is
  `null` — the one case where saying nothing is the honest answer.

It is not optimal and does not pretend to be: past the short search, a beginner method spends
about 120 moves where God's number is 20. `solveStep` is the same line truncated to its first move, which is what a
hint is.

## What is solved and what is illustrated

Solved: the state, every turn, the scramble, the drag geometry, the sticker colours, `isSolved`
and the solve. Illustrated: the eased travel of a turn (a real cube's wrist is not a cosine),
the rounded cubie shell, the plinth glow and the swell when it comes home.

## Solved means what a person means by it

`isSolved` is "every sticker shows its own face", not "every orientation matrix is the
identity". Those are the same thing for edges and corners — no two pieces carry the same set of
colours, so matching stickers implies pieces at home — and they differ in exactly one place: a
**centre spun about its own normal** shows the same square either way. A cube nobody would call
unsolved is not called unsolved here. It is still exact: integer comparisons, never a tolerance.
The alternative costs you a solver, because no layer-by-layer method restores centre spin.

## Drag that follows the hand

The press picks the face and the cubie. The first few pixels of travel decide the layer, through
`grabFromDrag`, which returns the turn **and the tangent** — the direction the hand has to keep
pulling to keep winding it. After that the layer is held: a drag cannot wander into another one
half way through. The layer then winds with the pointer, half the cube's edge to a quarter turn,
and the release snaps to the quarter turn it is *nearest* — so letting go half way back snaps
back rather than through, and a fling past 180° takes both turns. The turn enters the state only
when the settle lands.

The drag listens on the window, not on the cubie: a hand that flings a layer leaves the face it
grabbed long before it lets go, and a cube that stopped turning at the silhouette would be a
cube that fights you. Pixels become world units through the camera's own right and up, scaled by
the world a pixel covers at the cube's distance, then rotated into the rig's frame — so a cube
inside a turned group still turns the layer the hand is pulling on.

## Hooks

`data-cube` on the rig, `data-cube-order`, `data-cube-solved`, `data-cube-turning` (the axis
in motion, or absent), `data-cube-dragging` and `data-cube-moves` (the move count) — enough for
a test or a readout to follow the state without reaching into three.js.

## The game

A turn carries **where it came from** — `user`, `solver`, `scramble`, `loop`, `undo`, `redo` —
which is the whole reason a stopwatch on this cube can be honest. The demo bench starts its
clock on the person's first turn of a scrambled cube, stops it the moment the cube comes home,
counts only their moves, and says *solved (assisted)* if they took a hint. `behavior="solve"`
is the idle state worth leaving on a page: the cube scrambles itself, solves itself with the
real method, and starts again.
