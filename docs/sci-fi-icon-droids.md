# Four icon-archetype droids

**Goal:** four more registry droids drawn from the best-known science-fiction robot silhouettes — the armoured casing unit, the barrel astromech, the gilded attendant, and the converted cyber trooper.

**Constraint (inherited from `docs/superpowers/plans/2026-09-12-droid-collection.md`):** original archetypes only. No franchise character names, logos, exact paint schemes, or character-specific markings. The shapes are generic to the genre; the names, props and palettes are ours.

## What ships

| Component | Archetype | What makes it distinct |
| --- | --- | --- |
| `casing-droid` | Armoured conical casing unit | Flared hemisphere skirt, caged neck, rotating dome, eyestalk with elevation, swappable manipulator + emitter |
| `astromech-droid` | Barrel repair unit | Tripod/bipod chassis that changes ride height, rotating dome with radar eye, opening service panel, rising periscope, holographic projection cone |
| `attendant-droid` | Gilded humanoid attendant | Fixed faceplate with vocoder grille, stiff etiquette poses, `plating` levels that strip panels back to the exposed midriff loom |
| `cyber-trooper` | Converted armoured humanoid | Blank slab head with optional side handles, chest unit with a bounded power meter, heavy marching frame |

## Shared contract

Every component keeps the collection's existing contract: `size`, `variant`, palette props, `showGround`, `label`, `signal`, plus ordinary SVG props; `role="img"` with an overridable name; every numeric input finite-checked and clamped; no timers or internal animation — all motion is prop-controlled so the parent owns the clock.

## Distinctness from what already exists

`utility-droid` is the generic cylindrical service unit; `astromech-droid` is the specific barrel-and-dome repair unit, and earns its place with ride-height modes, the periscope and the holo cone — none of which `utility-droid` has. `protocol-droid` is the slim jointed translator; `attendant-droid` is heavier, plated, and has a fixed face plus a `plating` teardown axis. `security-droid` tracks a pointer; `cyber-trooper` does not track anything — it is a fully controlled marching frame with a power budget.

## Data hooks

- `casing-droid`: `data-skirt`, `data-dome`, `data-eyestalk`, `data-manipulator`, `data-emitter`, `data-lamp`
- `astromech-droid`: `data-body`, `data-dome`, `data-eye`, `data-leg`, `data-panel`, `data-tool`, `data-holo`
- `attendant-droid`: `data-frame`, `data-head`, `data-arm`, `data-plating`, `data-vocoder`, `data-joint`
- `cyber-trooper`: `data-frame`, `data-head`, `data-handle`, `data-chest`, `data-power`, `data-arm`, `data-leg`

## Integration

Registry entries (`registry:ui`, one file each, depending on `robot-style` and `robot-kinematics`), docs records in `src/lib/docs.ts`, interactive demos in `src/components/demos/demos.tsx`, catalogue cards, README rows, and behaviour tests in `src/components/ui/__tests__/icon-droids.test.tsx`.

## Motion

These four also follow `docs/motion-and-interaction.md`: supply a value prop and it renders exactly as given; leave it out and `behavior` runs it off the shared `useRobotClock`. `casing-droid` and `astromech-droid` turn their dome to the pointer; `attendant-droid` steps to its next pose on click (`onPoseChange`); `cyber-trooper` cuts and restores power on click (`onPowerChange`). Each exports its behaviour as a pure function of the clock — `casingDroidPose`, `astromechDroidPose`, `attendantDroidPose`, `cyberTrooperPose` — so tests sample it directly.

## Customisation axes

Each machine carries a set of shape props on top of the shared contract, so one component
covers a family rather than a single silhouette. Shape never changes the pose contract: every
joint keeps its position, and `build` widens a frame across only.

| Component | Axes |
| --- | --- |
| `casing-droid` | `skirt`, `dome`, `collar`, `lamps`, `emitter`, `manipulator`, `hemisphereRows`, `hemisphereColumns`, `neckRings`, `stalkLength` |
| `astromech-droid` | `legMode`, `dome`, `livery`, `feet`, `antenna`, `ports`, `tool` |
| `attendant-droid` | `plating`, `build`, `face`, `hands`, `collar` |
| `cyber-trooper` | `helmet`, `build`, `visor`, `shoulders`, `jaw`, `handles`, `chestUnit` |

Counted axes (`hemisphereColumns`, `neckRings`, `ports`, …) are clamped and redistributed
across a fixed envelope, so a larger count means finer hardware rather than a machine that
outgrows its `viewBox`.
