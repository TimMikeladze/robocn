# The solver core

`src/lib/robocn/kinematics.ts` — no React, no three.js, no dependencies, pure functions over
plain `{x,y}` / `{x,y,z}`. The SVG components and the r3f rig call the same code, which is the
whole reason the set can claim "2D + 3D — same kinematics". Never fork it per renderer.

## Pick the cheapest solver that is honest — yourself

This is your call, not a question for the user. Read the mechanism, pick from the table, say
in one line what you picked and why, and build. The cost of guessing wrong is small; the cost
of stopping to ask is the whole turn.

## The table

| Mechanism | Use | Why |
|---|---|---|
| 1 link | `solveChain2` (it short-circuits) | direction × length |
| 2 links | `solveElbow2` / `solveElbow3` via `solveChain2/3` | law of cosines: cheap, stable, and the pose people expect from an industrial arm |
| 3+ links | `solveChain2/3` → FABRIK | seed it, or it snaps between valid solutions |
| Delta | `solveDelta(target, geometry)` | closed form, per-arm YZ formulation rotated 0/120/240° |
| Gantry / cartesian | nothing — position directly | `useEasedPoint(..., { perAxis: true })` gives the dog-leg path a cartesian machine actually makes |
| Stewart / hexapod | `solveStewart(pose, geometry)` in `stewart.ts` | rotate each anchor, measure to its base anchor; nothing to iterate |
| Legs, 4–10, radial | `hexapod.ts` | tripod, wave and ripple gaits, knees solved per leg |
| Legs, mass above the hips | `walker.ts` | a footfall schedule, the support polygon it leaves, and the hull roll and pitch that are the only way such a machine moves its mass over a foot |
| Three legs | `tripod.ts` | a load schedule per foot, the body position that schedule demands, and the polygon it has to stay inside |
| Legs, planar, simple | `quadruped.ts`, `duck.ts` | planar two-link legs plus a footfall cycle |
| Gaits with a named beat | `gait.ts` | six gaits as touchdown sequences: the beat counted, the support pattern, the lead, the share on every grounded foot |
| A closed loop — four-bar, slider-crank | `linkage.ts` | `solveFourBar`, `rigidPoint`; the stroke is what the loop produces, not a tween |
| A travelling body wave | `spine.ts` | serpenoid spine with taper, steady turn and ground clearance |

If the mechanism has none of these, it is a pose table, not kinematics — keep it in the
component (see `component.md`).

## API

```ts
chainReach(links)                       // sum
chainMinReach(links)                    // dead zone around the shoulder when one link dominates
clampToReach2(root, target, links)      // pull a target onto the reachable annulus
solveElbow2(root, target, a, b, bend)   // "up" | "down"
solveChain2(root, target, links, { seed, bend, iterations = 12, tolerance = 0.01 })
                                        // → joints, shoulder → tip, one more than there are links
solveChain3(root, target, links, { seed, up, iterations, tolerance })
forwardChain2(root, angles, links)      // FK: degrees, each relative to the previous segment
chainAngles2(joints)                    // the inverse of forwardChain2
chainLinks2(joints)                     // link lengths implied by a hand-authored pose
solveDelta(target, { base, platform, upper, lower })   // → { arms, center, reachable }
isometric(v, { spin = 35, tilt = 0.5 }) // flatten a Vec3 for SVG; y up in world, down on screen
isometricDepth(v, options)              // sort parts back-to-front under the same projection
convexHull2(points)                     // silhouette of a projected solid
```

Rules that keep poses stable:

- **Seed every frame with the previous pose.** `solveChain2(root, target, links, { seed: previous })`.
  Unseeded FABRIK is temporally incoherent — the arm flips between equally valid solutions.
- **Out of reach clamps, never fails.** `clampToReach2` pulls the target onto the annulus, so a
  pointer dragged off-canvas stretches the arm instead of producing `NaN`. Keep that property
  in anything new.
- **Angles are degrees** everywhere in the public surface; radians stay inside the maths.
- **`isometric` returns y-down screen coordinates**, so it drops straight into a y-up drawing
  group. `robotCamera` (see `views.md`) is the newer, more general projection —
  prefer it for anything that needs more than one angle.

## The arm hooks

`useRobotArm` owns the rAF loop, the seeding and the easing. Don't stack `useRobotScalar` on
an arm.

```ts
const pose = useRobotArm({
  links,              // world units, shoulder outward
  root,               // defaults to the origin
  target,             // Vec2 | ((clock) => Vec2) | null — wins over behavior
  behavior,           // "pointer" | "orbit" | "sweep" | "idle" | "static"
  bend,               // "up" | "down"
  speed,              // tip travel, world units/second
  animate, paused, phase,
})
// → { joints, tip, angles, moving }
```

`moving` drives tool effects (sparks, spray, a lit tip) — read it instead of inventing a
second "active" flag. `robotRestTarget(root, links)` is where an arm parks with nothing to
chase. The loop settles to zero renders when the tip arrives.

`useEasedPoint(target, start, { speed, perAxis, animate, paused, phase })` is the easing half
on its own, for machines with no chain: gantries, spindles, anything positioned directly.

## The pointer hook

```ts
const pointer = usePointerTarget(svgRef, {
  toWorld: React.useCallback((unit, rect) => ({ x: (unit.x - 0.5) * 2, y: (unit.y - 0.5) * 2 }), []),
  within: "element",   // or "window" for something that tracks across the page
  persist: false,      // hold the last position after the pointer leaves
  enabled,
})
// → { target: Vec2 | null, active }
```

`target` is **null while the pointer is away**, which is the point: the machine falls back to
its behaviour instead of freezing mid-reach. `toWorld` must be wrapped in `useCallback` or the
listener rebinds every render. Each machine supplies its own mapping — that is what "in the
component's own world units" means.

## Testing a solver

Every solver gets its own file under `src/lib/robocn/__tests__/`, tested directly — no React:

- link lengths preserved by the returned pose (`chainLinks2` against the input);
- an out-of-reach target clamps onto the reachable sphere, and stays a valid pose;
- FK/IK round trip: `chainAngles2(solveChain2(...))` back through `forwardChain2` lands on the
  same joints;
- the elbow breaks to the requested side;
- delta solutions land on their forearm spheres, and `reachable` is false outside the
  workspace while the pose still clamps;
- a seeded pose stays close to its seed frame to frame.
