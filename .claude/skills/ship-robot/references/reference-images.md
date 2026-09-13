# Working from reference images

Most robots in this set started as a pasted image. The images are optional — a prompt with
none ("create robotic animals") goes straight to the design note — but when they are there
they are the spec, and they need reading properly before any geometry is written.

## First, triage what the image actually is

| The image shows | It means | Do |
|---|---|---|
| A robot, toy, render, concept art, photo | Subject to build | This document |
| Several angles of one subject | The view axis | Build one geometry, map the angles onto `plan` / `front` / `profile` / `iso` — `references/views.md` |
| Our own docs site, hero, or a component | Feedback, not a subject | Read it as a bug report: find what is wrong in the drawing, fix that component. Do not build a new one |
| A UI, a chart, a layout | Site work | `references/site.md` |
| A sketch with arrows or annotations | A change request | The arrows are the spec; the drawing under them may already exist |

A screenshot of the running app plus "create different profiles" means *this component, more
angles*. A photo of a machine plus the same words means *a new component*. When both readings
are live, say which you took in one line and carry on.

## Read the image for mechanism, not pixels

Do not trace. Extract, in this order, and write the answers into the design note:

1. **Silhouette.** The outline that survives at 150px: cone, barrel, dome, box on treads,
   four legs, head on a stalk. This is what makes it recognisable and it is the only thing
   that must match.
2. **Proportions.** Head to body, body to base, limb to limb, as ratios of the long axis —
   not pixel counts. Those ratios become the world units in the `viewBox`.
3. **Degrees of freedom.** Every joint, hinge, rail, dome seam and telescoping section
   visible in the image. Each becomes a prop, and each has to be *visibly* mechanical in the
   drawing — `references/craft.md`.
4. **Panel breakdown.** Which surfaces are painted body (`shell`), which are bare machined
   (`metal`), which are cast or recessed (`dark`), which glow (`accent`). Map the image's
   colours onto the four roles rather than copying them.
5. **Signature details.** The three or four marks that make the archetype read — a grille, an
   eyestalk, a skirt of hemispheres, a radar dish. Everything else is noise at `md` size.
6. **What it does.** The behaviours implied by the mechanism: what would it do on a bench,
   what would a person try to grab. That is the `behavior` union and the `interactive`
   handling.

## Colour is a role map, not a palette

Never hardcode colours sampled from an image, and never ship an image's exact paint scheme as
the default. Assign the image's colours to `shell` / `metal` / `dark` / `accent`, then let
`resolveRobotPalette()` supply the actual values from the theme. A demo may pass `color=` to
show the archetype's familiar tone; the component's default stays the theme's.

## The originality filter

Reference images are frequently of copyrighted characters. Ship the **archetype**, not the
character:

- no franchise character names, in the component name, docs, demo `label`, or `aria-label`;
- no logos, insignia, exact paint schemes, or character-specific markings;
- keep the generic silhouette of the genre; drop the identifying ornament.

Worked examples already in the repo: `casing-droid` (armoured conical casing unit),
`astromech-droid` (barrel repair unit), `attendant-droid` (gilded humanoid attendant),
`cyber-trooper` (converted armoured humanoid). Note the constraint in the design note, the way
`docs/sci-fi-icon-droids.md` does, so the next person does not undo it.

If the reference is the user's own product, brand or hardware, the constraint does not apply —
match it.

## Where the images live

Keep them in the session scratchpad. **Do not commit third-party reference images** to the
repo, `docs/`, or `public/` — the source is usually not ours to redistribute. The design note
records what was taken (silhouette, proportions, mechanisms) in words; it does not embed the
picture.

## Verify against the reference

Reference work adds one verification step to the normal list: render the finished component
at the reference's angle and compare.

- `pnpm dev`, open the docs page, screenshot the demo with the browser agent;
- put it beside the reference and check silhouette and proportions first, detail last;
- check it at 150px too — the catalogue card is where a bad silhouette shows up;
- check `outline` and `wire`, where a shape that only worked because of its fill collapses.

"Close enough at 300px" usually means the proportions are wrong. Fix the ratios in world
units, not the detail.
