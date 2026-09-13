# Companion robots — micro duck and Reachy Mini

Two desk-scale companion robots for the registry, drawn from the same visual language as the
rest of the set. Each ships as a pure pose solver plus an SVG component that renders it.

| Item | Type | What it is |
|---|---|---|
| `duck-kinematics` | lib | Biped duck pose solver: two two-link legs, footfall cycle, S-curve neck chain, beak. |
| `micro-duck` | ui | The duck: solved legs, controlled gait phase, gaze, beak. |
| `stewart-kinematics` | lib | Closed-form 6-DOF Stewart platform inverse kinematics with leg stroke limits. |
| `reachy-mini` | ui | Head-on-a-hexapod companion: solved linkage, pointer-tracking eyes, antennas. |

## micro-duck

A two-legged duck robot: servo-stack neck, single camera eye, hinged beak, flat shoes.

**Solver** — `solveDuck({ gait, phase, height, stride, lift, gaze, beak })` in
`src/lib/robocn/duck.ts`.

- Legs are planar two-link chains, thigh 30 and shank 32 world units, knees breaking
  rearward like a bird's. Ankles target a fixed plate height; the pelvis rides at
  `26 + 28 * height`.
- The footfall cycle mirrors the quadruped's: `duty` fraction in stance, cosine swing arc,
  legs a half-cycle apart. Walk holds 0.62 duty (a double-support window), strut 0.52.
  At most one foot ever leaves the ground.
- The neck is a three-link FABRIK chain from the shoulder to an anchor swung on a constant
  radius by `gaze` — from a forward peck to an upright alert pose — plus a fore/aft head bob
  while walking. The head's angle follows the last link, so the beak stays level.
- `beak` opens the lower mandible in degrees; the component also lifts the skull a little,
  which is what a quacking duck actually looks like.

**Component** — `<MicroDuck />` in `src/components/ui/micro-duck.tsx`. Controlled: no internal
timer, same as the quadruped. Far leg draws behind the body at reduced opacity for depth.

## reachy-mini

A head on a six-rod parallel platform over a speaker-grille body, with two sprung antennas.

**Solver** — `solveStewart(pose, geometry)` in `src/lib/robocn/stewart.ts`.

- Real closed-form Stewart IK: rotate each platform anchor by yaw·pitch·roll, translate by
  surge/sway/heave, measure to its base anchor. Leg length is the answer; there is nothing
  to iterate.
- Anchors sit in three pairs 120° apart on each ring, the platform pairs straddling the gaps,
  which is what gives the linkage its crossed silhouette.
- Each leg reports `stroke` (change from the home length) and `withinLimits`; the solution
  reports `reachable`. Out-of-range poses still return geometry so a UI can draw the fault.

**Component** — `<ReachyMini />` in `src/components/ui/reachy-mini.tsx`.

- Six rods and both rings are projected with the shared `isometric()` helper, depth-sorted so
  back rods sit behind the platform.
- The head shell is illustrated, not solved: it takes roll from the pose and shifts its
  features with yaw and pitch. Docs say so — the linkage is the honest part.
- Eyes track the pointer through `usePointerTarget`, the same way `robot-face` does, with a
  controlled `look` override. Antennas are controlled angles in degrees.

## Delivery checklist

Component, registry entry, docs entry, demo, catalogue card, README row, tests — the same
path every other item took. The registry test enforces that each item declares the robocn
files it imports.
