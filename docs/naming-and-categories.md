# Names and categories

225 items had two problems. Titles echoed the library ("Robot cat" in a library of robots),
and the taxonomy was four buckets — Arms, Machines, Robots, Foundations — with 87 items in
one of them. `robotics` was on all 225 registry items, which is a tag that says nothing.

## Names

A title is the thing itself. The prefixes that only repeated the library or the group come
off:

| was | is |
| --- | --- |
| Robot cat | Cat |
| Robot arm 3D | Arm 3D |
| Celestial planet | Planet |
| Rail locomotive | Locomotive |
| Gridiron quarterback | Quarterback |

A suffix that is part of the name stays: a *protocol droid* is not a *protocol*, and a
solver called `duck-kinematics` is `Duck kinematics`, because "Duck" is the machine.

Slugs are untouched. `robot-cat` is the install line, the registry URL and the page URL, and
those are someone else's `components.json`.

## Categories

One group per item, named in one word, with the group carried in the registry item's own
`categories` — `["robotics", "<group>", ...tags]`. The umbrella tag stays first for anyone
filtering a shadcn registry; the group is the second, which is the slot the workbench index
already read.

```
Arms  Droids  Animals  Garden  Body  Actuators  Drives  Tools  Sensors  Fabrication
Devices  Controls  Vehicles  Rail  Space  Energy  Sport  Gym  Home  Music  Foundations
```

Nothing hand-maintains that twice. `src/lib/groups.ts` holds the list and the
category→group map; `src/lib/docs.ts` reads an item's group out of the registry, and the
title too. The 200-odd authored doc entries lost their `title:` and `group:` lines — a
rename is now one edit in `registry.json`.

## What reads it

```
registry.json                       titles, and categories[1] as the group
src/lib/groups.ts                   the group list, in sidebar order
src/lib/docs.ts                     joins the registry onto the written pages
src/lib/workbench/controls.ts       the workbench index groups by the same category
src/app/docs/layout.tsx             the sidebar; page.tsx, about, pager, llms.txt follow
```

## Notes

- The OG cards carry a title in the image. They are a build step (`pnpm og`) and are
  regenerated separately; the fallback card covers anything not yet re-shot.
- `scripts/new-robot.mjs` defaults a new machine to `robotics,droids` and validates the
  group against the list, so a new item cannot invent a twenty-second bucket by typo.
