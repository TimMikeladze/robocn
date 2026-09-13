# Backfilling the `view` axis

`robot-drone` was the only machine that could be looked at from more than one side. Every other
machine in the registry is a body in space drawn from exactly one camera, which means "show me
the rover from the front" has no answer. This pass gives all thirty of them
`view: "plan" | "front" | "profile" | "iso"`, projected out of one model through
`robotCamera(view)`.

The rule stays the one in `docs/drone-views.md`: **one geometry, four cameras.** Nothing is
redrawn per angle. What each machine gains is the parts that were never drawn because they
only exist off its native axis — the side of a chassis, the can of a motor, the depth of a base
plate, the thickness of a torso.

## The default is the view it is drawn in today

Adding the axis changes nothing for anyone already using these components: the native view is
the default, and it renders byte-identical. Each component's test asserts that before the
geometry is touched.

| component | native | why |
|---|---|---|
| `robot-arm` | `profile` | side elevation; the reach envelope reads off it |
| `scara-arm` | `plan` | the swept annulus is the whole point |
| `delta-arm` | `iso` | already modelled in 3D and projected (see below) |
| `gantry-arm` | `front` | two columns and a beam, straight on |
| `robot-gripper` | `front` | jaws opening across the frame |
| `conveyor-belt` | `profile` | the belt loop only reads from the side |
| `linear-actuator` | `profile` | stroke along the frame |
| `servo-motor` | `front` | the horn faces the reader |
| `rotary-table` | `plan` | indexing stations round a circle |
| `robot-rover` | `plan` | heading and steering read from above |
| `courier-droid` | `plan` | four-wheel chassis, steered, seen from above |
| `orb-droid` | `front` | a ball with a head on it |
| `probe-droid` | `front` | hovering body, mast up, arms down |
| `robot-quadruped` | `profile` | sagittal gait |
| `micro-duck` | `profile` | sagittal gait |
| `robot-spider` | `plan` | radial gait solver is plan-view |
| `robot-crab` | `plan` | same solver, turned across the body |
| `robot-bird` | `profile` | wing chain is drawn in the sagittal plane |
| `robot-fish` | `profile` | body wave in the sagittal plane |
| `robot-snake` | `plan` | travelling wave across the ground |
| `protocol-droid` | `front` | standing humanoid |
| `security-droid` | `front` | standing humanoid |
| `medical-droid` | `front` | standing humanoid |
| `infantry-droid` | `front` | standing humanoid |
| `attendant-droid` | `front` | standing humanoid |
| `cyber-trooper` | `front` | standing humanoid |
| `utility-droid` | `front` | standing barrel |
| `astromech-droid` | `front` | standing barrel |
| `casing-droid` | `front` | standing cone |
| `reachy-mini` | `iso` | already modelled in 3D and projected (see below) |

## Exempt — no `view` prop

These are not objects in space, so there is no second angle to have. Stated here once so the
absence is a decision rather than an omission:

- **`lidar-scan`** — a polar range display. Its rings are a coordinate system, not a disc lying
  on the floor. Tipping it over would be tipping over a chart.
- **`robot-loader`** — an indicator. It has a front and no back.
- **`arm-controls`** — a control panel. Same.
- **`robot-face`** — drawn as a face, not as a head: the features are a graphic in a plane, and
  there is no skull behind them to see from the side.
- **`robot-arm-3d`** and **`robot-stage`** — already real 3D, with an orbiting camera. A four-way
  enum would be a worse camera than the one they have.

## Two changes to the shared camera

Both live in `src/lib/robocn/style.ts` and are what make the backfill possible at all.

### 1. Heights are drawn true in the elevations

The camera foreshortens height by `cos(elevation)`. At the elevation views' 10° that is a 1.5%
vertical squash — invisible, but it means an elevation drawing pushed through the `front` camera
is *not* the drawing. Since byte-identity at the native view is the whole contract, height now
carries a constant unit scale of `1 / cos(10°)`, applied in every view:

```
ce = cos(elevation) / cos(robotViews.front.elevation)
```

This is a change of units for the vertical axis, uniform across all four cameras, so no geometry
disagrees with any other geometry. What it buys: `ce` is exactly `1` in `front` and `profile`, so
an elevation drawing is untouched there, and still exactly `0` in `plan`, so a plan drawing is
untouched there. `robot-drone` renders 1.5% taller in its three non-native views; `docs/drone-views.md`
records it.

### 2. `camera.wall(offset, spin)`

`plane(height, spin)` was the helper for artwork drawn flat in the *horizontal* plane. Twenty of
the thirty machines here are drawn in a *vertical* plane instead, and needed the same treatment:

```ts
camera.wall(offset, spin)   // SVG transform for elevation artwork in a vertical plane
```

The plane stands `offset` world units toward the viewer and is turned `spin` degrees about the
vertical, in the same sense as `plane()`. Drawing coordinates are the elevation's own — x right,
y down — so existing artwork goes straight through it.

- `spin = 0` is the plane facing the `front` camera. **Front-native machines use `wall()`.**
- `spin = 90` is the plane containing the fore-aft axis, nose to the right. **Profile-native
  machines use `wall(offset, 90)`.**

In its own view the transform is the identity and is emitted as no transform at all. In the
perpendicular elevation it is singular and the artwork collapses to a line, which is what a wall
seen edge-on is — so anything that has to survive that angle has to be a solid, not a drawing.
That is the forcing function for the modelling below.

`circleFootprint(x, z, r, steps)` joins `roundedFootprint` as the other footprint primitive, since
most of what got extruded here is round.

## What had to be modelled rather than projected

Projection is free for the flat artwork. These are the parts that did not exist in the model at
all and had to be built, per family:

- **Arms** (`robot-arm`, `scara-arm`, `gantry-arm`) — the base plate is a disc with real depth,
  the shoulder and elbow castings are cylinders, and the gantry's two columns and beam are boxes
  with a section. Drawn in one plane, all of these were outlines with no thickness.
- **Cell** (`robot-gripper`, `conveyor-belt`, `linear-actuator`, `servo-motor`, `rotary-table`) —
  the expensive batch. A conveyor is a *bed*: its width across the line is invented here, along
  with the roller cylinders and the side frames. The actuator gains a barrel and a rod that are
  round in section. The servo gains its can, its mounting tabs' depth and the horn's disc. The
  rotary table already had a platter footprint but no body under it.
- **Mobile** (`robot-rover`, `courier-droid`, `orb-droid`, `probe-droid`) — chassis sides and
  wheel cylinders for the two ground machines; the orb is a sphere, so it only needed its head
  and drive band to become solids; the probe gains a body of revolution and its arms became
  swept tubes.
- **Legged** — the gait solvers already work in three dimensions: `solveHexapod` reports feet in
  plan with knee *height* alongside, and `solveSpine` reports a plan-view wave with lift. Those
  machines therefore project honestly with no new maths, and only the body shells needed
  thickness. The two sagittal walkers (`robot-quadruped`, `micro-duck`) needed a track width
  invented — left and right legs were one drawing before.
- **Humanoids and service droids** — torso, head, pelvis and limbs each gained a plan footprint
  and a height pair, which is most of the work in batches 5 and 6. Arms and legs stay solved in
  the sagittal plane and are placed at ±half the shoulder or hip width.

## `delta-arm` and `reachy-mini` keep their own camera at `iso`

Both were already modelled in world units and projected through `isometric(v, { spin, tilt })`,
which is an axonometric with a free azimuth and a free tilt — a *better* camera than a four-way
enum, and both expose it as props. It is not the same projection as `robotCamera("iso")`
(145° / 26°), so forcing them onto it would break their default rendering and take away two axes
of control.

They therefore take `view` with `iso` as the default, and `iso` means "the free camera on `spin`
and `tilt`". The other three views are the shared orthographic cameras. It is still one geometry
— both project the same `Vec3` model — with two projection families, and the docs `notes` say so.

## Two things the backfill does not do

- **Ground decoration does not follow the camera.** The dashed horizon lines, perspective
  hatching and contact shadows each machine draws under itself are still authored for its
  native view. The machine above them is projected; they are not. The drone does adapt its
  ground line, and the rest should follow the same way, but that is a separate pass.
- **The frame is fixed per component, so the camera has a zoom.** A machine drawn in a
  letterbox frame for its side elevation stands up the frame when seen from above. Rather than
  clip it, those components carry a `fits` table — a per-view scale, one in the view the frame
  was drawn for — and two of them (`robot-fish`, `robot-snake`) also move the camera along the
  frame so a mirrored long axis does not swing out of it. Camera moves; machine does not.

## Per component

Every machine in the table gets, in one commit per batch:

- `view?: RobotView` defaulting to its native view;
- `data-view` on the drawing group and the view named in the `aria-label`;
- the `view` control in its demo, the props row in `src/lib/docs.ts`, and a registry description
  that mentions the four angles;
- a test asserting the native view is byte-identical to the pre-change render and that a tipped
  view moves the geometry.
