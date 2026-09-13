# Fabricators — building out of voxels

A family and one new solver. Everything already in the set *moves*: an arm reaches, a rover
drives, a drone flies. Nothing in the set *makes* anything. A fabricator is the machine that
does — and the workpiece is not artwork but a sampled solid that materialises voxel by voxel
while you watch.

## What ships

| Item | Type | What it is |
|---|---|---|
| `voxel-geometry` | lib | Continuous occupancy fields, sampled to a grid, ordered into a deposition sequence, reduced to a visible surface, and projected into drawable paths. |
| `voxel-form` | ui | The workpiece on its own. No machine, no plate required — just the solid. |
| `fabricator` | ui | The gantry build cell: enclosure, bridge, carriage, quill, nozzle, plate. |
| `arm-fabricator` | ui | An articulated arm that has to reach: yawing turret, solved shoulder and elbow. |
| `drone-fabricator` | ui | A repulsor platform with no envelope at all: it flies to each cell. |

### One build, four bodies

The family shares everything that makes the build a build — the field, the deposition order,
the build line, the `behavior` vocabulary, the drag-to-scrub interaction, the readout. What
differs is only what is carrying the nozzle, and each body has a reason to exist:

| | How it reaches the cell | What that costs it |
|---|---|---|
| `fabricator` | Three axes already lined up with the volume | A frame it can never build outside of |
| `arm-fabricator` | Yaw, shoulder and elbow solved for the cell | A reachable sphere, and a pose that has to be solved every frame |
| `drone-fabricator` | Flies there | Nothing holding it up, so nothing is solved but the flight target |
| `voxel-form` | Nothing does — the object with the machine taken away | No machine to read the build from |

That table is the design: picking one is picking a constraint, not a skin. `voxel-form`
exists because most of the time what a page wants is the object, not the cell around it.

## Why it earns its place

- `gantry-arm` is a plotter head on X-Y rails drawing a **path**. The fabricator's head is on
  X-Y-Z rails depositing a **volume**, and the volume is the thing on screen.
- No other component has a workpiece that changes shape. The conveyor carries parts; the
  gripper holds one. Here the part *is* the output of a solver.
- New axis: `resolution`. Every other machine's geometry is fixed and `size` only scales it.
  The fabricator's geometry is a sample of a continuous field — turn `resolution` up and the
  same object is built out of smaller cells, converging on the field. That is a knob nothing
  else in the set has, and it is the whole point of the machine.

## "Infinitely small scalable vectorized voxels", honestly

Three claims, and what each actually means here:

- **Vectorized.** Every voxel is an SVG path built from projected world coordinates — the
  cell's plan-view square extruded between two heights through `robotCamera`. There is no
  raster anywhere, so a 96px catalogue card and a 2000px hero are the same geometry at a
  different `size`.
- **Infinitely small.** The shape is a *continuous* field — `voxelOccupies(shape, u, v, w)`
  over the unit cube — not a stored grid. Sampling it at any resolution is well defined, and
  the sampled volume converges on the field as resolution rises without bound. The test
  asserts exactly that: the error against the analytic volume of a sphere shrinks as
  resolution grows.
- **Scalable, within a draw budget.** `resolution` is clamped to 2–14 cells along an edge,
  because the cell count is cubic and the surface count is quadratic — at 14 a sphere is
  already ~900 paths. The clamp is a rendering limit, not a limit of the field, and the docs
  `notes` say so. Raising the clamp is a one-line change in `voxel.ts`.

## The solver — `src/lib/robocn/voxel.ts`

Pure, no React, no dependencies beyond `clamp` from `kinematics.ts`.

```
voxelOccupies(shape, u, v, w)   the field itself; u,v,w in [-1,1], v up
voxelResolution(value)          round and clamp a requested resolution
voxelSolid({shape, resolution}) sample the field -> every occupied cell, in deposition order
voxelLaid(solid, progress)      how many cells a 0..1 build progress has laid
voxelBuild(solid, laid)         the visible surface of that prefix, plus layer and cursor
voxelCenter(cell, resolution)   a cell's centre in [-1,1] world-normalised coordinates
```

Three decisions worth stating:

**Deposition order is the cursor.** Cells are ordered layer by layer, and serpentine across
each layer — `z` ascending, `x` alternating direction — which is how a real deposition head
rasters. That makes progress a pure index into one array: `laid = round(progress × count)`,
and the cell at `laid` is the one under the nozzle. Bridge Z, carriage X and quill Y all come
off that one cell, so the three axes always point at the work, in controlled mode as well as
under a behaviour.

**Surface extraction, not every cell.** A laid cell is drawn only when one of its six
neighbours (inside the laid prefix) is empty. Interior cells are invisible under a painter's
algorithm anyway, and dropping them turns a cubic path count into a quadratic one. The top
face is tracked separately, because that is the face that reads as lit.

**Shapes are fields, not meshes.** Six of them, chosen so low resolutions stay legible and
each one stresses the sampler differently: `sphere` (curvature), `block` (chamfer),
`pyramid` (the stepping voxels are famous for), `gear` (angular teeth and a bore),
`vessel` (a hollow interior, so the surface extractor has to find an inside), `lattice`
(an open-cell frame — the hollow structure additive manufacturing exists for and machining
cannot cut).

`lattice` was a periodic strut lattice first, and it was wrong. A thin repeating feature
aliases against the sample grid: at resolution 6 no sample landed within a strut width of a
node and the field came back empty — the machine built nothing. The browser caught it, not
the tests, because the tests sampled at resolutions that happened to hit. It is now a band on
each axis, which every resolution samples honestly, and the solid falls back to one central
cell rather than an empty plate when a shape cannot be resolved at all (resolution 2).

## The machines

All four are modelled once in world units — x starboard, y up, z toward the tail — and pushed
through `robotCamera(view)`. Native view is `iso` for every one of them, because a voxel solid
is a volume and three-quarter is where a volume reads; `plan` collapses it to a top-down
footprint, which is truthful and occasionally what you want.

Every degree of freedom is a visible mechanism. For the gantry cell:

| Axis | Mechanism | `data-*` |
|---|---|---|
| Z | The bridge beam traverses the enclosure | `data-bridge` |
| X | The carriage traverses the bridge | `data-carriage` |
| Y | The quill telescopes down from the carriage | `data-head` |
| — | The nozzle, and the beam from it to the active cell | `data-nozzle`, `data-beam` |
| — | The workpiece and its cells | `data-workpiece`, `data-voxel` |
| — | Plate, enclosure, progress readout | `data-plate`, `data-enclosure`, `data-readout` |

For the arm, the yaw is a turret that visibly faces the work (`data-turret`, carrying
`data-yaw`), and the shoulder, elbow and wrist are `data-joint`. The goal is clamped onto the
reachable sphere *before* the elbow is solved, so both links always hold the lengths they
claim; an unreachable cell shows as a longer beam, never as a stretched forearm. The link
lengths and the pedestal position are chosen together so that no cell in the volume is
actually out of reach — an arm that spends the whole build clamped to its own limit is a
badly placed arm, and the plan-view test is what keeps that honest.

For the flyer, the platform (`data-craft`) rides a fixed standoff above the cell and banks
toward the *next* cell in the deposition order, so the lean reads as intent rather than
decoration. Its pods (`data-pod`) tilt with the deck, and it carries its own contact shadow
across the plate. Nothing about lift is modelled and the docs say so.

## Motion and interaction

| `behavior` | What it does |
|---|---|
| `build` | Lay the whole object, hold it finished, clear the plate, start again. |
| `layer` | Hold near the top of the object and work one layer across, over and over — the head motion on its own. |
| `refine` | Hold the object complete and walk `resolution` from coarse to fine and back. The signature behaviour, and what makes the voxel axis legible. |
| `idle` | Finished object, head parked clear of it. |
| `static` | Complete, everything still. |

`interactive` makes the build line a scrubber: drag up and down anywhere in the frame to lay
or strip material, arrow keys step one layer, Home empties the plate and End completes it.
`onProgressChange` fires throughout. Released, the build eases back into the behaviour at the
rate-limited pace of `useRobotScalar`, which reads as the machine catching up rather than
snapping.

`refine` is the one behaviour that drives `resolution` rather than `progress`; a supplied
`resolution` prop wins over it the same way a supplied `progress` wins over the build line.

## Cost

A frame only redraws the workpiece when the laid cell count changes, so a build at the default
speed re-renders the voxels a few times a second rather than sixty. `resolution` above ~10
with `refine` running is the expensive corner; the docs say so and the demo defaults to 6.

## Originality

A fabrication cell, named for its job. No franchise references anywhere — in the component,
the demo labels, or the shape names.
