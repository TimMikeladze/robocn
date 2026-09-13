# Putting machines on the site

The landing page is the showroom: the hero arm, the variant strip and the catalogue — which
carries **every registry item**, grouped in `docGroups` order, not a curated subset. Design
notes: `docs/hero-2d-3d-transition.md`, `docs/landing-catalogue.md`.

There is deliberately **no perimeter decoration** — no machine that follows the cursor around
the page. It was tried twice (an arm-and-duck chase along the foot of the window, then an orb
droid on a rail round all four edges) and removed both times: it competes with the hero for
attention and reads as a gimmick next to components that are meant to be installed.

Site pieces live in `src/components/site/` and are **not** registry items. The maths they need
goes in `src/lib/*.ts` (not `lib/robocn/`) with its own unit tests: `src/lib/transition.ts`.

## The rule that governs all of it

**Nothing re-renders per frame.** A page animation writes transforms straight to the DOM, or a
CSS custom property on a container, or a ref that a component's own loop reads. React state is
only for things that change a handful of times a second at most.

- Hero: a rAF-driven `t` (0 = flat, 1 = solid) is written to the stage element as `--edge`, a
  percentage. The layers animate off that variable; React renders once per `dimension` change.
- Demos and the catalogue: each machine owns its own loop, so a card animating never renders
  the page around it.

## Behaviour that reads as alive

Reusable wherever a machine drives itself:

- **Hysteresis on every state flip.** Thresholds have a gap between on and off, or a machine
  hovering at the boundary stutters.
- **Commit to a decision.** Hold a chosen direction or state for a fixed spell. Re-deciding
  every frame is not responsiveness, it is vibration.
- **Aim at the real thing.** Target the actual point in the machine's own world units — not a
  general direction.

## Gating

Any pointer-driven page motion is gated on

```
(min-width: 1024px) and (pointer: fine)
```

and `prefers-reduced-motion` places the machine once at its starting station and never starts
the loop.

## The 2D ↔ 3D wipe

A crossfade between an SVG and a WebGL canvas reads as a glitch. The transition that works:

- a horizontal seam sweeps the panel — 3D above it, SVG below — with an 8% soft band so they
  overlap;
- an `accent` 1px line with a glow rides the seam, fading out at `t` 0 and 1;
- the SVG lifts slightly (`scale` + `blur`) so it reads as being replaced from underneath;
- the 3D camera starts near-orthographic (fov 20, straight down −z) and lerps to the 3/4 view
  (fov 40) — that is what turns "two pictures" into one machine rotating into depth;
- the rig renders `wireframe` until `t > 0.55`, so the drawing becomes a wire cage and only
  then gains surfaces.

One pointer position feeds both layers (the SVG's own `behavior="pointer"` and a ref-supplied
controlled `target` on the rig), so the arm never jumps at the swap — it is the same target
solved twice.

## WebGL cost and traps

- `three` and the stage load through `next/dynamic({ ssr: false })`, prefetched on first
  pointer intent, so the flat hero ships without them.
- A mounted-but-idle canvas uses `frameloop="demand"`; it then costs nothing per frame.
- The canvas sets its own `pointer-events`, so clear it on the canvas itself
  (`[&_canvas]:pointer-events-none`) or the SVG underneath never sees another pointer move.
- three.js cannot read a CSS variable, and Chrome serialises a computed `var()` colour as
  `lab()`. Colours go through `resolveCssColor` in `src/lib/robocn/color.ts`, which normalises
  via a 1px canvas. Skipping it silently keeps the built-in fallback — the bug looks like "the
  theme colour is ignored" or "the floor is white".
- **React Compiler is on** (`reactCompiler: true`). In r3f code: hoist per-frame scratch
  objects to module scope instead of `useRef(new THREE.Vector3())`, take the camera from
  `useFrame((state) => …)` rather than a `useThree` selector, and don't hand-wrap a
  ref-reading getter in `useCallback`.
