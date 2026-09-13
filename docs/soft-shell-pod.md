# The soft-shell pod

One machine, `bellows-droid`, on one axis nothing else in the set has: the **shell itself is
the mechanism**. Everything else here is a rigid body with joints hung off it. This one has no
joints. A pleated pneumatic dome inflates and settles, and every other part of the machine —
where the optics sit, how far apart they are, how wide the vent opens, how hard the crown is
gathered — is carried by that one number.

## What it is

A tabletop soft-robotics pod: a gathered bellows dome on a machined collar, two lens pods
mounted through the shell, and a vent aperture between them. It sits on a bench and breathes.

## Distinctness

`orb-droid` is the other round companion, and the difference is the whole point:

| | `orb-droid` | `bellows-droid` |
|---|---|---|
| Body | rigid sphere, fixed radius | soft dome, volume-conserving |
| Motion | body and head rotate | body changes shape; nothing rotates |
| Axis | `bodyAngle`, `headAngle`, gaze | `inflation`, and only `inflation` |
| Grab | — | pull the crown up and down, `role="slider"` |

## Where the geometry comes from

The shell is a surface of revolution, modelled once in world units and pushed through
`robotCamera(view)` like everything else. Nothing is drawn per angle.

- The **profile** is a fixed dimensionless shape — `sectionRadius(t)`, `sectionHeight(t)` —
  scaled by a height and a radius that `bellowsProfile(inflation)` hands back.
- Those two are tied: `radius² × height` is held constant, so the pod is **volume-conserving**.
  Inflating makes it taller *and* narrower; letting it down makes it squat *and* wider. That is
  the honest half of the mechanism and it is what the solver test asserts.
- The **silhouette** is the convex hull of the projected surface samples. The profile is convex
  and monotone, so the hull is the exact outline, in all four views, with one path.
- The **pleats** are meridians on that same surface, with a twist that grows as the shell
  collapses — a gathered bellows rotates its crown as it comes down. A meridian is drawn only
  when it faces the camera, which is hidden-line removal rather than artwork.
- **Panels** (the lens faces, the vent, the intakes) are flat artwork laid onto a vertical plane
  at a given azimuth, and drawn only while that plane faces the camera. In plan you see the
  crown and the pleats, and no face at all, which is what looking down at it would give you.

Illustrated, and the docs say so: the crown gather and the pleat twist are shaped to read, not
solved from a fold pattern. There is no pressure model, no material, no fold count the geometry
has to respect.

No lib file. Volume conservation is two lines of algebra, not kinematics — inventing a solver
for it would be worse than keeping it in the component, per `references/kinematics.md`.

## The contract

- `inflation` 0..1 controlled, and it wins. Otherwise `behavior`:
  `breathe` a slow sine · `settle` fill slowly, dump quickly · `startle` sits full and flinches
  twice a cycle · `static`.
- `interactive` makes the crown a handle: drag it up and down, arrows step 5%, shift 15%,
  Home/End park it flat or full. `onInflationChange` throughout. Release eases back into the
  behaviour at the shell's own rate.
- Views: `plan` `front` `profile` `iso`, native `front`.
- `data-*`: `data-frame`, `data-view`, `data-collar`, `data-shell`, `data-pleat`, `data-crown`,
  `data-lamp`, `data-optic="left" | "right"`, `data-barrel="left" | "right"`, `data-aperture`,
  `data-vent`.
- Everything else is the usual: palette roles, `size`, four variants, `signal`, `showGround`,
  `label`, `px()` on every computed coordinate, non-finite input renders the half-inflated pose.

## What came from the reference

A reference image was given. What was taken from it, in words:

- **Silhouette**: a wide gathered dome, flat-based, a little wider than tall — about 1.15 : 1 at
  rest — with a small crown at the apex where the seams converge.
- **Proportions**: crown radius about 0.16 of body radius; optics about 0.5 of body width apart,
  set a little above mid-height; a centred aperture below and between them.
- **Mechanism**: the pleats, read as a real bellows rather than a decoration, which is where the
  `inflation` axis came from.

Not taken, deliberately: the colours, the face, the expression, the character. The image was a
brand mark. Colour comes from the palette roles like every other machine, the aperture is a vent
and not a mouth, and the patches beside it are louvred intakes. Name the machine for its job —
this one is named for the bellows. The reference image is not committed anywhere in the repo.
