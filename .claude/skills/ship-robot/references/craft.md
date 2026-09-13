# Drawing a machine that reads as machinery

The maths is the easy half. What makes the set coherent is that every machine is drawn in one
vocabulary and every mechanism is visible.

## Silhouette first

A new machine has to be recognisable as a 150px catalogue card, in one colour, before any
detail goes on it. Working from a reference image, the silhouette and the proportions are the
part that must match — see `references/reference-images.md`. Block out the silhouette — skirt, barrel, dome, gantry, four legs — and
check it against the cards already in `catalogue.tsx`. If it reads as one of them, either the
proportions are wrong or the machine does not earn its place (see *Distinctness*).

Work in a fixed `viewBox` sized to the machine, typically 150–260 units on the long side, with
the drawing occupying most of it and ~8 units of margin for the ground shadow and label. Pick
the numbers once; every coordinate in the file is in those units, and `size` only scales.

## The vocabulary

| Part | Drawn as | Role |
|---|---|---|
| Limb between two joints | `capsulePath(a, b, r)` | `shell` / `metal`, alternating down a chain via `linkRole(i)` |
| Joint | circle, no stroke | `dark` — the cast-iron look, and it reads as a pivot |
| Collar, bolt, bracket, tool body | small rects and circles | `metal` |
| Painted body panel | the big shapes | `shell` — the colour people call "its colour" |
| Status: lamp, live tool, readout | small, few | `accent` (+ `glow`) |
| Grid, dimension lines, blueprint annotation | thin dashed | `grid` |

Machined detail is what separates a machine from a cartoon: a seam line across a panel, three
grille slots, a bolt at each corner of a mounting plate, a cable run with two or three
coloured strands, a service panel that opens. Two or three marks per part. More than that at
`md` size turns to noise.

Proportion cues that read as "built": mounting plates wider than what they carry, a base
heavier than the head, joints slightly larger than the limbs they join, cables entering from
behind rather than nowhere.

## Every degree of freedom must be visible

If a prop moves something, the drawing has to show *how*. A head that turns gets a visible
neck collar; an extending tool gets a rail or a boom it slides along; a ride-height mode gets
legs that actually change length. A prop that only nudges pixels is a lie, and it is the thing
reviewers notice first.

Corollary: draw what is solved and say what is not. `reachy-mini` solves six rods and
illustrates the head shell, and its docs `notes` say so. An illustrated part is fine. An
illustrated part presented as solved is not.

## Check all four variants

- `solid` — filled, `dark` outline. The default; tune here.
- `outline` — line art, no fills. Shapes that only read because of their fill disappear;
  overlapping parts merge. Fix by giving the part a real outline, not by special-casing.
- `blueprint` — washed fill under a technical outline, plus your own grid group and dimension
  or angle annotations drawn only in this variant.
- `wire` — skeleton: everything drops to `grid` except `accent`. Useful check that the
  mechanism is legible from its structure alone.

Then check all four *views*. A silhouette tuned in plan often collapses in front elevation —
that is the signal that parts have no modelled height, not that the camera is wrong.

Never branch geometry on `variant`. Only paint changes — that is why `robotSurface` exists.
The one exception is blueprint's extra annotation layer, which is additive.

## The standard furniture

```tsx
{variant === "blueprint" && <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>…</g>}
{showGround && <ellipse cx={…} cy={…} rx={…} ry={5.5} fill={palette.dark} opacity={0.14} />}
{label && <text … fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
```

`signal` maps `"warning" → shell`, `"ready" → accent`, `"idle" → metal`; use it for lamps and
readouts, and document what each means for that machine. Ground shadows flatten by
`camera.flatten` and slide out from under a machine that rises (see `references/views.md`).

## Effects and keyframes

CSS keyframes live in the `robot-style` registry item's `css` block, prefixed `robocn-`:
`robocn-spin`, `robocn-spray`, `robocn-spark`, `robocn-pulse`, `robocn-scan`, `robocn-blink`.
Each ships with a matching `.robocn-*` utility class, and one
`@media (prefers-reduced-motion: reduce)` rule sets `animation: none` on all of them — add a
new class to that list too. A new tool effect goes there, never in a `<style>` tag inside a
component, or a consumer's install gets the markup without the animation.

Use a keyframe only for decoration that runs at a constant rate — a spinning rotor, a spark,
a blink. Anything that reacts to state or has to stay in step with the pose belongs in the rAF
loop.

## Distinctness

Before adding a machine, name what it does that nothing in the set already does, and write it
in the design note. Real examples from this repo:

- `utility-droid` is the generic cylindrical service unit; `astromech-droid` earns its place
  with ride-height modes, a periscope and a holo cone.
- `protocol-droid` is the slim jointed translator; `attendant-droid` is heavier, plated, and
  adds a `plating` teardown axis.
- `security-droid` tracks a pointer; `cyber-trooper` tracks nothing and has a power budget.

"It looks different" is not distinctness. A new mechanism, a new axis, or a new view is.

## Originality constraint

Science-fiction archetypes only. **No franchise character names, logos, exact paint schemes,
or character-specific markings** — in the component name, the docs, the demo `label`, or the
palette defaults. Name the machine for its job (`casing-droid`, `astromech-droid`,
`attendant-droid`, `cyber-trooper`), describe the archetype ("armoured conical casing unit",
"barrel repair unit"), and keep the silhouette generic to the genre. When a request names
characters, ship the archetypes and say plainly that is what shipped.

## Responsiveness and reduced motion

`max-w-full select-none` on every root `<svg>`; the drawing scales with `width`, so a 390px
viewport just gets a smaller machine. Check the docs page and the catalogue at 390px. Reduced
motion parks every loop at `phase` and never disables interaction.
