# Bore construct — a machine of solid light that takes the wall with it

One machine and one solver, on an axis nothing in the set has: **the machine excavates, and
the thing it excavates is drawn from what was removed.** Everything else in the set moves in
front of a static background. This one changes its background, and the change is conserved —
the spoil heaped at the collar is the volume the bit took out of the wall.

| Item | Type | What it is |
|---|---|---|
| `bore-geometry` | lib | Excavation mechanics: specific energy, the penetration rate an energy balance allows, the cavity that rate cuts in a slab, the volume conserved into a spoil heap at its own angle of repose, ballistic spall off the kerf, and a rolling-element cage ratio. |
| `bore-construct` | ui | A tunnelling head forged out of light: a stepped rotary bit with a cowl of plough blades forward, a pair of treaded drive wheels on one transverse axle aft, and a right-angle gear train, four thrust rams, gripper shoes, a slider-crank flushing pump and a main bearing between them. It rolls itself through a wall that cracks, spalls and heaps its own spoil. |

## The reference, and what shipped

Reference images: a translucent luminous construct lying on a field — a barrel-bodied boring
machine, conical toothed bit at one end under a cowl of curved blades, a heavy banded wheel at
the other, ribbed staves down the body, and a lit core glowing through the shell.

**Taken:** the silhouette (a clawed bit cone, a ribbed waist, a heavy wheeled mass at the tail —
three masses, not one tube), the proportions (the aft mass larger than the bit and both much
larger than the waist; the machine about three wheel-diameters long), the degrees of
freedom the shape implies (a spinning bit, a rolling drive wheel, thrust down the axis), the
panel roles (body `shell` washed translucent, machined internals `metal`, recesses and the bore
mouth `dark`, the core and the cutting edges `accent`/`glow`), and the reading that the thing is
*made of light* — a shell you can see the machinery through.

**Changed on purpose:** the reference's aft mass is a drum on the machine's own axis. Here it is
a *wheel* — a pair on one transverse axle behind the body, rolling on the floor — because that is
what the aft mass is doing in the scene, and a drum co-axial with the body cannot do it.

The bit is the largest diameter on the machine, so everything behind it passes through the hole
it cuts. The wheels are the exception: they are wider than the bore and stay outside the wall,
which the travel guarantees.

**Not taken:** the character. The reference's construct belongs to a franchise; the green is
that character's signature colour, and neither the name nor the paint scheme ships. The
component's default palette is the theme's, like every other machine here. The demo and the
catalogue card pass a `color`, which is what a demo is for. Do not name the character
anywhere — component, docs, `aria-label`, demo `label`.

## What is actually new here

### The background is an output

`showWall` is not decoration. The wall is drawn from the cut: `boreCavity` returns the wall's
outline **and** the hole as a second subpath, so one `fill-rule="evenodd"` path is a slab with a
bore through it, and the void is filled behind the machine so it reads as a tunnel. The hole is the real intersection of the bit's swept envelope —
full-gauge cylinder plus the nose cone — with the slab, clipped at both faces. So a
half-driven bit leaves a cone-bottomed hole, and a bit that is most of the way through leaves
a hole that opens at the far face with the truncated diameter it has actually reached.

### The spoil is the wall

`spoilHeap(volume, repose)` inverts the cone volume: `V = ⅓πR²·R·tan α`, so
`R = (3V / π tan α)^⅓`. The heap at the collar is the volume the bit removed, at the material's
own angle of repose. Excavate more and it grows as a cube root, which is why it looks slow —
that is what conservation looks like. Only `SPOIL_SHARE` of the muck reaches the collar; the
rest packs the bore behind the machine, which is what a real head leaves behind it.

### The wheel is a constraint, not an animation

`rollAngle(distance, radius)` is `θ = s / r`, and it is the only thing that turns the drive
wheel. There is no wheel speed to set: the wheel turns exactly as far as the machine has moved,
one revolution per `2πr` of travel, and stands still while `depth` is held. So watching the
wheel turn *is* watching the machine move, and a reader can check it with a ruler. The wheels'
radius is their ride height, so the hub sits on the machine's axis and the tyres meet the floor.

### Penetration is an energy balance, not a tween

`boreDuty` is Teale's specific energy read the useful way round. Power at the bit is
`2π·rev·torque`; the material costs `Es` work per unit volume removed; the bit sweeps `πr²`
per unit of advance. So

```
rate = efficiency · 2π · rev · torque · RATED / (π r² · Es)
```

and everything the readout shows falls out of it: advance per revolution is `rate / rev`, the
chip each cutter takes is that over the cutter count, the muck flow is `πr² · rate`. Below the
stall torque the face wins and the rate is zero — a drill that is pushed too hard into rock
too hard does not advance slowly, it stops. Spin the hardness up in the demo and watch the
advance-per-revolution collapse before the bit stalls.

`RATED` is a scale constant, stated as one in the source: the set draws in picture units, so
it is chosen to make a nominal head advance a few units a second. Nothing here claims to be a
real machine's numbers.

## Solved, and illustrated

**Solved.** The duty (above). The cavity geometry and its clipping at both faces. The
excavated volume and the heap that conserves it. The spall trajectories — each fragment is
`p₀ + v t + ½ g t²` from a deterministic launch on the kerf rim, so the debris is ballistic
rather than jittered. The reduction: a fixed-ring planetary set from `transmission.ts`, whose
`ratio = 1 + ring/sun` works out at **3.75:1**, which is why the bit turns three and three
quarter times slower than the drive that feeds it, with the tooth counts that actually assemble.
The drive wheel is on its own path: it rolls (above), it is not geared to the cutterhead — which
is how a real machine separates thrust from cutting. The transfer
pair meshes through `meshAngle`, so the crown wheel and the layshaft gear genuinely sit in each
other's spaces at every frame. The flushing pump is `solveSliderCrank` — the piston's
asymmetric stroke is the linkage's, not a sine. The main bearing's rollers orbit at the real
cage ratio `(1 − d/D)/2`.

Everything that rides a ring about the machine axis — the cutters, the gauge buttons, the
plough blades, the planets and the bearing rollers — is placed by its angle in three dimensions
and sorted by camera depth, so a turn is a real orbit in every view rather than artwork sliding
about. The wheels are the other case: they are drawn in the elevation plane, so they read as
wheels here and foreshorten to their own width seen from the front.

**Illustrated.** The fracture pattern radiating from the bore: deterministic, growing with
depth and hardness, but no fracture mechanics — cracks are a drawing. The bit's helical
flights, the plough blades, the wheel's tread pattern, the body's rib cage, the cooling fins,
the hose runs and the glow. The construct's translucency is paint: in `solid` every panel
washes out and every edge takes the `glow` colour, which is the whole of the "solid light"
treatment — the other three variants are the set's own, untouched. Nothing collides; the
machine is not stopped by the wall, it is driven through it by `depth`.

## The axes

| Prop | What moves |
|---|---|
| `depth` | 0 crown at the near face, 1 crown clear of the far one. The whole machine translates; the cavity, the cracks, the spall and the heap all follow. |
| `thrust` | Stroke on the four rams, the reach of the gripper shoes, and the torque the drive puts on the face. |
| `hardness` | The material. Drives specific energy, so it drives the rate, the chip and the stall. |
| `rev` | Spindle speed. Turns the bit, the bevel branch and the pump, all in step. The wheel is not on it — the wheel rolls. |
| `forge` | How solidly the construct stands: the bloom and the shell's translucency. Paint only — no geometry moves. |

`behavior` is `"bore" | "surge" | "idle" | "static"`. `bore` drives the head through at the
solved rate and re-enters; `surge` is the same rate taken in bites, with the rams re-setting
between them; `idle` spins at the face without advancing.

**A controlled `depth` pins the advance and leaves the spindle turning.** The set's rule is
that a controlled prop wins, and it does — the advance is exactly what was given. But a drill
held at depth is still a drill that is turning, so the clock runs on under the pin, which is
what `hold` in `useRobotScalar` is for. `behavior="static"`, `animate={false}` and reduced
motion park everything, as everywhere else.

## The `data-*` hooks

`data-machine` (+ `data-advance`), `data-wall`, `data-cavity` (+ `data-progress`), `data-void`,
`data-breakthrough`, `data-fracture`, `data-spoil` (+ `data-volume`), `data-spall`,
`data-wheel` (+ `data-angle`), `data-side="port|starboard"`, `data-spoke`, `data-tread`, `data-core`, `data-bay`, `data-rib`,
`data-fins`, `data-thrust`, `data-ram`, `data-gripper` (+ `data-reach`), `data-shoe`,
`data-gearbox` (+ `data-ratio`), `data-gear="crown|layshaft|pinion"`, `data-pump`,
`data-wiring`, `data-reduction` (+ `data-carrier`), `data-planet`, `data-bearing`
(+ `data-cage`), `data-roller`, `data-cowl`, `data-blade`, `data-bit` (+ `data-angle`),
`data-flights`, `data-cutter`, `data-kerf`, `data-ground`, `data-diagnostic`, `data-view`.

## Distinctness

`drilling-derrick` hoists pipe and `mud-pump` moves fluid; neither cuts anything. `rotary-table`
turns a string. `construct-ring` forges solid light but nothing it forges has a mechanism. This is the first machine in the set whose output is a change to the world
around it, and the first to conserve a quantity across two drawings — the hole and the heap are
the same cubic units.
