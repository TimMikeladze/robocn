# Ball sports — five objects, one set of physics

`robot-football` is a shape: a prolate spheroid whose outline is its own central section. This
family is the other half of that idea — **the objects a game is played with, each carrying the
one equation that makes it behave unlike the others.**

| Item | Type | What it is |
|---|---|---|
| `sport-geometry` | lib | The sphere and its seams, the puck, and four dynamics: restitution bounce, Magnus curve, Coulomb slide, bat impact. |
| `robot-baseball` | ui | A sphere with the real figure-eight seam, pitched on a flight with a Magnus term. |
| `batting-rig` | ui | A bat on a solved swing arc, with the collision solved: effective mass falls away from the sweet spot. |
| `robot-basketball` | ui | Eight panels, bouncing down a closed-form restitution ladder. |
| `robot-soccer-ball` | ui | A truncated icosahedron inflated onto the sphere, rolled without slipping. |
| `robot-hockey-puck` | ui | A cylinder on ice: constant friction, boards that reflect, a track solved once. |

## What is actually new here

Three of these are the same sphere. What separates them is **which equation owns the frame**,
and each object gets exactly one:

| Object | The equation it lives by | What you see because of it |
|---|---|---|
| baseball | `a = g + (S/m)(ω × v)` | the break: a curveball leaves the straight line because the spin says so |
| bat | `v_out = ((e·M − m)v_p + M(1+e)v_s) / (M + m)` | the sweet spot, because `M` is *effective* mass and it collapses off the end |
| basketball | `h_n = h₀·e^(2n)` | every apex is the last one times `e²`, exactly, and the gaps shorten with them |
| soccer ball | `θ = s / r` | roll without slipping — the panels turn *because* it travelled |
| puck | `s = v²/2μg` | it stops where the maths says, and a board taking `e` of the speed takes `e²` of the distance |

None of these is a tween. Each is a **closed form sampled at the clock**, which is why the
bounce can be asked for its hundredth instant without having run the ninety-nine before it,
and why every behaviour is an exported pure function tested by sampling rather than by faking
frames.

## The geometry is solved too

A seam drawn on a ball is a lie the moment the ball turns. All five objects put their markings
**on the surface**, so a normal exists at every point of every mark and the far half is culled
rather than painted over the near one:

- **Baseball.** The seam is the closed curve
  `x = a·cos t + b·cos 3t`, `y = a·sin t − b·sin 3t`, `z = 2√(ab)·sin 2t`.
  Expand `x² + y² + z²`: the `cos 4t` terms cancel exactly when `c² = 4ab`, leaving `(a + b)²`.
  The curve lies on a sphere of radius `a + b` for every `t` at every shape ratio. That is a
  proof, not a tolerance, and it is the test.
- **Basketball.** Two orthogonal great circles cut four lunes; one wavy closed curve,
  `lat = A·sin(2·lon)`, enters each lune on one meridian and leaves on the other, splitting it.
  Four lunes, eight panels, three curves.
- **Soccer ball.** Built as a solid. Truncate a regular icosahedron at exactly one third of
  every edge and all sixty vertices land the same distance from the centre — the Archimedean
  solid, twelve pentagons and twenty hexagons. Push them onto the sphere, subdivide the edges
  along great circles, and the panels bulge the way an inflated one's do. A panel straddling
  the horizon is clipped onto the limb rather than folded across the front.
- **Puck.** A cylinder's silhouette from any angle is the convex hull of its two rims
  projected — exact face-on, exact edge-on, exact everywhere between, nothing special-cased.
  That is the whole reason the puck can take a `view` at all.

## The one mechanism that is pure geometry

`batting-rig` has no free choice of contact point. The bat pivots at the knob and the ball
arrives on a fixed line, so the bat can cross that line at **exactly one angle**:

```
r · cos θ = −stance
```

Where the rig stands is therefore the only thing that decides where on the barrel the ball
arrives. Stand close and it is jammed on the handle; stand off and it is on the end. Both cost
exit speed, and the collision says how much — which is the sweet spot arriving out of the
arithmetic instead of being painted on the bat. Move the swing rate and the sweet spot moves
with it, because `v_bat = ω·r` climbs toward the tip while `M` falls.

## What is not in here

**Air.** Nothing has drag, no spin decays, and the Magnus term is held at its release value,
which makes every flight one quadratic. **Contact** is a coefficient, not a deformation: the
squash at a bounce is impact speed against a reference, and the boards are a specular
reflection, so a puck never leaves one at an angle it did not arrive at. **No rules, no clock,
no opponent.** Each component's docs `notes` says which of its own parts are solved and which
are illustrated.

## The shared contract

Everything the set already promises, unchanged: `size`, `variant`, `view`, `behavior` with
`speed`/`phase`/`paused`/`animate`, a controlled prop that wins and stops the loop,
`interactive` drag and arrow keys, and a palette that resolves prop → CSS variable → built-in.

The controlled axis is the thing the loop drives, one per machine: `along` down a pitch,
`swing` through the zone, `height` off the floor, `travel` across the ground, `along` down a
track.

`data-*` hooks, which are API:

| Machine | Attributes |
|---|---|
| all | `data-view`, `data-behavior` (or `data-pitch` on the baseball) |
| `robot-baseball` | `data-ball`, `data-shell`, `data-seam`, `data-path`, `data-datum`, `data-plate`, `data-ground`, `data-shadow` |
| `batting-rig` | `data-bat`, `data-joint="pivot"`, `data-arc`, `data-sweet`, `data-contact`, `data-exit`, `data-ball`, `data-column`, `data-plate`, `data-line` |
| `robot-basketball` | `data-ball`, `data-shell`, `data-seam`, `data-paddle`, `data-ground`, `data-shadow` |
| `robot-soccer-ball` | `data-ball`, `data-shell`, `data-panel="pentagon｜hexagon"`, `data-path`, `data-datum`, `data-ground`, `data-shadow` |
| `robot-hockey-puck` | `data-puck`, `data-shell`, `data-knurl`, `data-face`, `data-rink`, `data-board`, `data-goal`, `data-track`, `data-stop`, `data-shadow` |
