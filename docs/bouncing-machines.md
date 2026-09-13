# Bouncing machines

Two machines that leave the ground, and the contact solver under them:
`hopper-dynamics`, `spring-hopper`, `ball-hopper`.

## Why the set needs them

Nothing here bounces. `robot-frog` jumps, and its own docs say what it is: *"No ballistics:
the arc is a scripted trajectory."* The arc is a shaped number, the landing is a pose, and
there is no moment of contact anywhere in the file. `robot-quadruped`, `robot-skeleton` and
the gait solvers never leave the floor at all — a foot is either planted or swinging, and the
body height is a control.

A bounce is the one motion where **the ground is part of the mechanism**. Two regimes, and
the boundary between them is where all the information is:

- **Flight** — no contact, so the machine is a projectile. A parabola, exactly.
- **Stance** — the compliance is loaded, so the machine is a mass on a spring. Simple
  harmonic motion about its static sag, exactly.

The interesting claim is that *how long each lasts is not a knob*. Given a drop height and a
spring rate, the flight time and the contact time both fall out of the physics, and the duty
factor — the fraction of the cycle spent touching the ground — is their ratio. Stiffen the
spring and the contact gets shorter and harder without the hop changing; soften it and the
machine spends longer squatting than flying. That is a mechanism, and it is the one thing a
duty-factor knob cannot express.

## `hopper-dynamics` — the solver

`src/lib/robocn/hopper.ts`. No React, no dependencies beyond `Vec2`. Mass 1, gravity 1, so a
"hop unit" is whatever the drawing decides and a `load` of 1 is the machine's own weight.

**Flight.** Released at speed `v` upward, `y = v t − t²/2`. Apex `v²/2`, flight time `2v`.

**Stance.** Touchdown at the compliance's free length with speed `v` downward. With the
downward displacement `y`, `ÿ = g − k y`, which is SHM about the static sag `x₀ = g/k`:

```
y(t)  = x₀(1 − cos ωt) + (v/ω) sin ωt        ω = √k
```

Contact ends when the spring force returns to zero — `y = 0` again, not half a period, because
gravity biases the oscillation. Solving gives a closed form:

```
T_contact = (2/ω)(π − atan(vω/g))          peak depth = x₀ + √(x₀² + v²/ω²)
```

Both exact. A soft spring (`k = 12`) and a stiff one (`k = 120`) at the same drop height give
duty factors of 0.46 and 0.15 — you can see the difference across the room, and neither number
was typed.

**Restitution.** `solveDrop` runs a *sequence*: each contact returns `e ×` the landing speed,
so apexes decay by `e²` and the flight times geometrically. Contact time does **not** go to
zero as the speed does — it tends to `2π/ω` — so an ideal Zeno bounce would take forever. The
solver ends the sequence when the rebound can no longer lift the machine past `restHeight`
(default 0.004 hop units) and reports `resting`, with the machine sat at its static sag. That
is the honest version of "it comes to rest", and `dropTimings` returns the bounce count and
the settle time so a behaviour can loop on it.

**Geometry.** Two helpers that are only geometry but are the two things a bouncing drawing
gets wrong:

- `springCoils` — a helix seen side-on is a sinusoid, so the coil is sampled rather than
  drawn as a zig-zag, and the **turn count and coil radius never change**: a real spring
  compresses by twisting its wire, not by losing coils. It cannot compress past its own solid
  height (`turns × wire`), which is reported as `bottomedOut` and clamped, so the coils never
  pass through each other.
- `squashRadii` — an oblate spheroid at constant volume: `rx² ry = r³`. A ball flattened on
  impact has to get wider, and by exactly that much.

## What is not modelled

No damping inside the stance (the loss is taken at take-off as a restitution coefficient, the
way a bounce is normally measured), no horizontal travel — both machines bounce on the spot —
no friction, no spin-up from contact, no material, no motor and no energy budget. The spring
hopper's steady hop is the ideal `e = 1` case: a real one would have to inject the loss back,
and nothing here draws that. Said on both docs pages.

## The two machines

Same solver, two kinds of compliance, and they look nothing alike at 150px.

| | `spring-hopper` | `ball-hopper` |
|---|---|---|
| Compliance | An external helical spring leg, drawn coil by coil | The shell itself, deforming |
| Reads its state from | Coil pitch, exposed shaft, foot pad | Squash, contact patch, shadow |
| Extra freedom | Hip swing — the leg is slung under a gimbal and swings fore-and-aft in flight for the next landing | Yaw — a bouncing ball turns, so the sensor band and the optic carry a bearing |
| Native view | `profile` — a hopper leans to steer, and lean reads from the side | `front` — a sphere reads the same from everywhere, so the elevation the squash shows in is the one to default to |
| Distinct because | It is the only machine in the set whose spring is drawn as a real spring, with a solid height it can hit | It is the only one that changes shape under load, and the only one that can be dropped and left to settle |

`orb-droid` is already a ball with a drive inside it, so the comparison matters:
`orb-droid` **rolls** — it never leaves the ground and its shell is rigid; its mechanism is a
stabilised head on a turning shell. `ball-hopper` leaves the ground on a solved arc, deforms
under contact, and its interesting number is restitution, which `orb-droid` has no use for.

## Shared contract

Both keep the set's contract: palette roles, `size`, the four `variant`s, the four `view`s
through `robotCamera` (each is written once in its own elevation with `elevationDraft` and
`fitTransform`), controlled-wins motion, `interactive` drag with keyboard and slider
semantics, `px()` on every computed coordinate, finite-clamped numeric input.

Behaviours, all pure functions of the clock and exported:

| | Behaviours |
|---|---|
| `spring-hopper` | `hop` the steady bounce · `bound` a harder, faster hop with the leg swung forward for the landing · `pump` compressing on the spot without ever leaving the ground · `static` |
| `ball-hopper` | `bounce` the steady bounce · `settle` dropped and left to come to rest, then dropped again · `skitter` fast low bounces with the yaw running · `static` |

Interaction on both is the same gesture — drag down to load the compliance, release and it
goes — because it is the gesture a person actually tries on a spring. `role="slider"` over
0–100% compression (hopper) and 0–100% of the drop height (ball); arrows 5%, shift 15%,
Home/End at the ends. `onCompressionChange` / `onAltitudeChange`.

### `data-*` hooks — API

`spring-hopper`: `data-hopper`, `data-view`, `data-body`, `data-hip`, `data-spring`,
`data-shaft`, `data-foot`, `data-gyro`, `data-mast`, `data-ground`, plus `data-contact` on
the frame (`"stance"` / `"flight"`).

`ball-hopper`: `data-ball`, `data-view`, `data-shell`, `data-band`, `data-optic`, `data-lug`,
`data-ground`, plus `data-contact` on the frame.

## Integration

`registry.json` ×3 · `src/lib/docs.ts` ×3 · `demos.tsx` ×3 + map entries ·
`catalogue.tsx` ×3 cards · `README.md` ×3 rows · tests:
`src/lib/robocn/__tests__/hopper.test.ts` and
`src/components/ui/__tests__/bouncing-machines.test.tsx`. Neither machine is a droid, so the
`droidCollection` / `droidSlugs` allow-lists are not theirs.

## Originality

Both are generic archetypes — a single-legged hopping test rig and a throwable bounding
sensor ball are laboratory machines, not characters. No franchise name, paint scheme or
marking appears in the components, the demos, the labels or the docs.
