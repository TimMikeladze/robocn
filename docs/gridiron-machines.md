# Gridiron machines

Seven machines and one solver: four players in the postures the game actually asks for, the
ball they throw, and the two pieces of training equipment that make them do it again.

Nothing here is a team, a franchise, a helmet livery or a person. The players are named for
the job — the one who blocks, the one who throws, the one who runs the route, the one who
kicks — and wear plain plated armour in the palette every other machine in the set wears.
There are no logos, no wordmarks, no stripes borrowed from anyone, and the jersey number is a
prop the caller types.

## What ships

| Item | Type | What is actually solved |
|---|---|---|
| `gridiron-geometry` | lib | The ball as a real prolate spheroid, drag-free ballistics, counter-rotating wheel exit conditions, a route tree sampled by arc length, a sprung pad arm at static equilibrium, and the pad/helmet outlines the four players share. |
| `robot-football` | ui | The ball. Its silhouette is the ellipsoid's own, so nose-on it is a circle; the laces are on the surface and go round the back. |
| `gridiron-lineman` | ui | The three-point stance: a hand on the turf is a fourth contact, and the solver puts weight on it. |
| `gridiron-quarterback` | ui | A drop-back and a throw with the arm solved to a release point, and the ball leaves on that release's own velocity. |
| `gridiron-receiver` | ui | The route tree as geometry: the runner is a point at an arc length along a polyline, and the lean is the turn rate. |
| `gridiron-kicker` | ui | A swing leg that meets a ball, and a parabola that starts where the ball was when it did. |
| `blocking-sled` | ui | A pivoted pad arm against a return spring, solved to equilibrium, on a frame that skids only once the drive beats the friction under it. |
| `ball-launcher` | ui | Two wheels: the mean of the surface speeds is the exit speed and the difference is the spin. Both numbers are on the readout. |

## The ball is the reason for the lib

Every other machine here holds, throws, kicks or launches the same object, so the object is
modelled once.

A football is a **prolate spheroid**: semi-axis `long` down its own axis, `waist` across. Two
facts fall out of that and both are visible:

- **Its silhouette is exact.** Under orthographic projection the outline of an ellipsoid is an
  ellipse — a *central* section, not the ball's equator. Written as `p = R M q` for a unit `q`,
  the surface normal is `R M⁻¹ q`, so the outline is the great circle of the unit sphere whose
  pole is `M⁻¹ Rᵀ d`, pushed back out through `R M`. `ballSilhouette` samples that circle. End
  on, it degenerates to a circle of radius `waist`, which is what an American football looks
  like coming at you, and nothing special-cases it.
- **The laces are on the surface.** They are stitches straddling one meridian, each with a real
  normal, so `facing` says whether the camera can see it. Spin the ball and they go round the
  back and come out the other side instead of sliding across the front.

`flightAttitude` is the pure function of the clock behind every behaviour: a spiral is a fast
roll about the long axis with the nose precessing on a narrow cone; a wobble is the same
mechanism with the spin down and the cone open; a tumble is end over end with the roll off.
That is one mechanism with three sets of numbers rather than three animations.

## What is solved and what is drawn

Said plainly, because half the value of this set is that it says:

- **Solved.** The ball's silhouette, seam and laces. The parabola and its hang time. The exit
  speed and spin of the launcher. Position and heading along a route. The sled's pad angle and
  its slide threshold. Every player's legs, spine, arms and feet, which are `solveSkeleton` from
  `skeleton-kinematics` — the same solver `robot-skeleton` ships — with the arms taken out of
  the swing and solved to their own targets.
- **Illustrated.** Armour. The helmet shell, the facemask, the shoulder yoke, the thigh and
  knee plates, the cleats. They are outlines carried in the lib so all four players wear the
  same kit, but no part of them is load-bearing.
- **Not modelled at all.** Air. Every trajectory here is drag-free, so a punt goes further than
  a real one. No defenders, no contact resolution, no rules, no clock. The docs `notes` on each
  item say so.

## The shared contract

Every item takes the set's usual axes — `size`, `variant`, `view`, the palette roles, a
behaviour union that includes `"static"`, `speed`/`phase`/`paused`/`animate`, and a controlled
prop that wins and stops the loop. Beyond that, the family's own conventions:

- **World axes are the skeleton's**: `x` the machine's right, `y` up, `z` behind it. The player
  faces `-z`, the floor is `y = 0`. Downfield is `-z`, which is why the route tree's second
  coordinate is negated into the world and the receiver's plan view has the line of scrimmage
  at the bottom.
- **Yards are the unit that leaves the lib.** `routePath` and `kickFlight` work in yards and
  seconds; every component scales them into its own viewBox once, at one named constant.
- **The native view is the one the mechanism reads in.** `profile` for the lineman, the
  quarterback, the kicker, the sled, the launcher and the ball; `plan` for the receiver,
  because a route is a plan-view object.
- **`number` is a caller's string**, never a real player's. Two characters, drawn on the chest
  plate. Default is empty.

## `data-*` hooks

API, and the tests assert on them.

| Hook | On |
|---|---|
| `data-ball`, `data-seam`, `data-lace`, `data-stripe`, `data-nose`, `data-tail` | `robot-football`, and the ball wherever another machine carries one |
| `data-helmet`, `data-facemask`, `data-shoulder-pad="left\|right"`, `data-chest` | all four players |
| `data-leg="left\|right"`, `data-arm="left\|right"`, `data-foot`, `data-spine` | all four players |
| `data-down-hand`, `data-stance` | `gridiron-lineman` |
| `data-throw-arm`, `data-release`, `data-pocket` | `gridiron-quarterback` |
| `data-route`, `data-runner`, `data-break`, `data-catch` | `gridiron-receiver` |
| `data-kick-leg`, `data-plant-leg`, `data-trajectory`, `data-uprights` | `gridiron-kicker` |
| `data-pad`, `data-spring`, `data-frame`, `data-skid` | `blocking-sled` |
| `data-wheel="top\|bottom"`, `data-head`, `data-chute`, `data-muzzle` | `ball-launcher` |

## Integration

Each item gets: a `registry.json` entry declaring `robot-style`, `robot-kinematics`,
`skeleton-kinematics` (the players), `gridiron-geometry` and `use-robot-motion` as it actually
imports them; a `docs.ts` entry in group `Robots` (players, ball) or `Machines` (sled,
launcher) with `Foundations` for the lib; a demo reaching every behaviour, variant and view; a
posed catalogue card; a README row; and a behaviour test. `gridironCollection` /
`gridironSlugs` go in `scripts/__tests__/registry.test.ts` and
`src/components/site/__tests__/docs-catalogue.test.tsx`.

## Originality

Archetypes only. The four players are postures, not people; the armour is generic plated kit
in the set's own palette; the ball is a prolate spheroid with stitches. No team, league,
franchise, character, logo, wordmark, colourway or real number appears anywhere, including in
demo labels and catalogue lines.
