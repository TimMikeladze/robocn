# The hero, in four

The hero was one arm. It made the page's claim — a machine that solves itself and answers to
your pointer — with a single machine, in a library of 225, and the first impression was
"robot arms".

Four quadrants instead, in the same frame:

```
arm    face
duck   cat
```

Each one is the real registry component at its own default behaviour, and each name under it
is a link to that machine's page. The four are chosen to span the set rather than to look
alike: an industrial arm on a solved chain, a head on a Stewart platform that watches the
pointer across the whole window, a walker on a gait, and a quadruped whose spine drives its
legs.

## No 3D in it

The hero had a 2D/3D switch that wiped the arm over to a `three` rig. It is gone: four SVG
machines and nothing else, so the landing page loads no WebGL context and no `three` chunk,
and the first thing a visitor touches cannot be the one thing on the site that needs a GPU.

The wipe itself is not deleted — `src/components/site/hero-stage.tsx` and
`docs/hero-2d-3d-transition.md` still describe it, and `robot-arm-3d` and `robot-stage` are
where the rig is shown. Putting it back is re-mounting `HeroStage` behind a switch.

## What each one answers to

| | behaviour | pointer |
| --- | --- | --- |
| Arm | `pointer` | follows it over its own cell, and drags |
| Face | `idle`, tracking | watches the pointer anywhere on the page |
| Duck | `walk` | press to drive it; it quacks |
| Cat | `prowl` | click to pounce |

Nothing is posed or pinned. Every quadrant is running the loop its component ships with, so
the hero is a screenshot of the library rather than an illustration of it.

## Notes

- `src/components/site/hero.tsx` — was `hero-arm.tsx`, and the export was `HeroArm`.
- The whole panel is still inside one `RobotExport`, so the record button takes all four.
- A reduced-motion preference parks all four on their own first pose, which is what each
  component already does on its own.
