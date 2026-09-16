# animatronic-robot — the whole animatronic

The set already has the pieces of a humanoid: `robot-skeleton` walks a biped, `robot-torso`
breathes a ribcage, `animatronic-face` drives an expressive head as servo channels, `robot-hand`
grips. Each is honest about being a part. This is the machine those parts belong to — one body
whose face, chest, arms, hands and legs are solved together, and which runs itself when nobody
is driving it.

Two things here are new to the set, and they are why this gets its own solver
(`src/lib/robocn/animatronic.ts`) rather than being a bigger component:

## 1. Self control — one intent for the whole body

Every other machine's `behavior` drives one quantity: a gait phase, a servo angle, a gaze. A
humanoid does not work that way. Looking at something is a *posture*: the eyes go first, the
neck follows what the eyes could not cover, and the waist takes what is left. Talking moves the
jaw *and* the head *and* the hands. Reaching shifts the weight before the arm moves.

So the controller does not return a number. `routineIntent(routine, clock)` returns an
**`AnimatronicIntent`** — the whole body's demand at that instant: gait and cycle, stance,
lean, twist, reach, gaze, expression channels, blink, speech, breath, grasp, grip, and the
balance effort. It is a pure function of the clock, so it is tested by sampling.

`blendIntent(a, b, t)` crossfades two of them, which is how a routine change eases rather than
snaps, and how a released drag returns to what the routine has moved on to.

One field needed a solver change to be honest. `solveSkeleton` takes a *single* reach target that
both arms share — right for carrying something, wrong for everything else, and a wave built on it
comes out with the machine's hands clasped in front of it. So the intent carries `reachLeft` and
`reachRight` as well, and `reachArm` re-solves one arm against the pose the skeleton returned,
starting from the same shoulder with the same bone lengths. Per-side reach lands **before** the
balance, not after: a raised arm moves the centre of mass, and a machine that balanced without it
would be balancing the wrong body.

A reach also cannot be crossfaded the way a number can — a chain either solves to a point or it
swings, and there is nothing halfway. So what eases is the *point*: it travels out from wherever
the routine already had the hands, or from where they hang, and the chain solves to it every
frame. Without that the arms snap out the instant a pointer appears.

**`solveAttention(target, effort)`** is the cascade: a demand in −1..1 on both axes is split
across the eyes (±30°), the neck (±34° yaw, ±22° pitch) and the waist (±22° twist, ±10° lean),
each taking only what the one before it could not reach. That is the mechanism that makes the
machine read as *looking at you* rather than as three sliders moving at once.

Every channel of the intent is also a prop. Supply one and it wins over the routine, which is
what "posable" means here: `expression`, `blink`, `speech`, `look`, `reach`, `grip`, `grasp`,
`lean`, `twist`, `stance`, `breath`, `gaitPhase`, plus `channels` straight through to the face
rig. Nothing branches on a routine name below the controller.

## 2. Balance — the first machine in the set that stands over its own foot

`robot-skeleton` says plainly that its hip height is a number someone typed and that nothing
there could fall over. That is still true of the leg solve. What is new is that this machine
**measures** the consequence and then does the one thing a real animatronic does about it.

- `centreOfMass(pose)` sums the segment masses — Winter's fractions, head 0.081, trunk 0.497,
  thigh 0.100, and so on, summing to 1 — each at its own segment's centre of mass, not at the
  joint.
- `supportPolygon(pose)` is the convex hull of the footprints of the feet that are actually on
  the floor, in the ground plane. A foot in swing contributes nothing.
- `balanceOf(pose)` projects the COM down and reports the **signed margin** to that polygon:
  positive inside, negative outside, in world units. `stable` is `margin > 0`.
- `balanceRoll(pose)` is the roll about the support centroid that puts the plumb line over the
  polygon, clamped to what an animatronic's waist actually has.

`solveAnimatronic({ balance })` applies that roll to the whole machine as a rigid rotation about
the support centroid on the floor. Rigid is the point: every bone is the same length before and
after, and the planted foot stays where it was, so the body swings over it the way a walking
biped's does. The test holds it to both.

What is still *not* here: dynamics. There is no mass–spring, no ground reaction, no fall. The
machine corrects its posture toward its support polygon; it does not compute whether it could.
The readout says `margin` and `stable` because those are measured — it never claims more.

## The parts are the parts

The legs, feet and hands are not redrawn here. `robot-leg`, `robot-foot` and `robot-hand` already
sit on `skeleton.ts` and `hand.ts`, and what they add over a bare chain is chassis: two strut
actuators per leg drawn between solved points, so their stroke is a consequence of the pose; a
sole outline turned about the ankle with a toe plate hinged at the ball, so rolling forward lifts
the heel instead of driving the toe through the floor; a contact pad per part of the sole, shaded
by `footRoll`'s own `heelLoad` / `ballLoad` / `toeLoad`; a palm slab with a thenar plate, a
knuckle per finger and a pad on every fingertip.

All of that is carried over here on the same numbers — `soleChassis` and `toePlate` are measured
from `animatronicProportions`, `footHalfWidth` is the same half-width the support polygon is built
from — so the four machines cannot drift apart. The one thing that needed care is the balance
roll: it turns the whole machine about a point on the floor, so a flat outline like a sole would
otherwise become a special case of the correction. `solveAnimatronic` reports the `pivot` it used,
and each limb undoes the roll, draws in its own upright sagittal chart, and puts the roll back.

The loads are geometry — which parts of the sole are still on the floor — and not forces. Nothing
weighs anything, which is why they are shown with `showBalance` rather than by default.

## What is solved and what is illustrated

| Part | |
|---|---|
| Legs, knees, ankles, feet | solved — `solveSkeleton`, two-link sagittal chains to the stride's ankle |
| Spine, ribs, shoulders | solved — equal vertebrae, hoops hung off the thoracic ones, `breath` opening them in depth more than in width |
| Arms | solved — swing from the gait, or `solveChain3` to `reach` / `reachLeft` / `reachRight` |
| Hands | solved — `solveHand`, fixed phalanges, only angles change |
| Head silhouette | solved — exact ellipsoid outline through the camera |
| Face features | solved as channels on the skull chart; each is pushed onto the ellipsoid surface |
| Centre of mass, support polygon, margin | solved |
| Shell panels, chest core, vents, the hip and shoulder cans | illustrated — they are drawn on the solved frame, they do not drive anything |

## The camera

One geometry, four projections through `robotCamera`; the native view is `front`. The head is
the same ellipsoid-and-chart construction as `animatronic-face`, so the far eye turns away on
its own and the brow wraps the temple, at every angle.

## `data-*` hooks

`data-view`, `data-animatronic`, `data-leg`, `data-foot`, `data-arm`, `data-hand`, `data-digit`,
`data-pelvis`, `data-spine`, `data-vertebra`, `data-ribcage`, `data-rib`, `data-chest`,
`data-neck`, `data-head`, `data-skull`, `data-eye`, `data-lid`, `data-brow`, `data-mouth`,
`data-jaw`, `data-balance` (`"support"` on the floor, `"weight"` over the machine), `data-support`,
`data-com`, `data-plumb`, `data-ground`, and from the borrowed chassis: `data-actuator`,
`data-femur`, `data-tibia`, `data-shin`, `data-sole`, `data-toe`, `data-heel`, `data-pad`,
`data-palm`, `data-knuckle`, `data-phalanx`, `data-joint`, `data-servo`.

## Draw order

Sorted by the camera, not by a fixed list. Every piece reports the depth of its *nearest* point —
an arm takes whichever of its shoulder and its wrist is closer, the head adds its own radii to its
centre — and ties keep their original order, so a pure elevation, where left and right sit at
exactly the same depth, draws as it always did. That is what puts a reaching hand in front of the
chest rather than inside the rib cage, and what floats the head above the shoulders in plan view,
where depth *is* height. Two things sit outside the sort: the pelvis, drawn before both legs
because a femur head is on the outside of it, and the balance layer, which is split — the support
polygon lies on the floor under the feet that hold it, the weight and its plumb line read over the
whole machine.

Two things about drawing on an ellipsoid that cost time here, written down so the next machine
does not pay for them again. `onFace` clamps a chart point that has run off the surface onto the
equator, so an outline with two of those in it folds over itself and draws as a tangle rather than
a plate — every point of the jaw, the brows and the visor band is kept inside the domain, and a
test holds them there. And a feature's visibility has to come from *its own* normal: the ear
servos were a disc at mid-depth inside the skull, which is why nothing could ever turn them away,
and they now sit on the surface at the side of the head where a sideways normal fades the far one
out by itself.

The face is clipped to the skull's projected silhouette. Every feature is a curve pushed off the
surface by its own outset, and near the limb that outset lands outside the outline — a brow
crossing the crown, a lip escaping as a detached bead. Clipping makes that impossible at every
angle instead of tuning each feature until it stops.

## Interaction

`interactive` (on by default) makes the pointer a thing in the world. The machine looks at it
through the attention cascade, and with `follow` it reaches for it with both hands. Release and
it eases back into the routine, rate-limited. Arrow keys move the point of interest; `Home`
centres it, `End` hands it back to the routine. Reduced motion parks the routine clock and
leaves the pointer and the keys working.
