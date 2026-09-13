# Celestial bodies

Four bodies and the machine that carries them, on one new solver. The set draws machinery;
this family draws the things machinery is pointed at — and draws them the same way, which
means solved rather than illustrated, projected rather than redrawn, and grabbable.

`celestial-geometry`, `celestial-planet`, `celestial-moon`, `celestial-star`,
`celestial-asteroid`, `orrery`.

## Why these five

| Machine | The mechanism nothing else here has |
|---|---|
| `celestial-planet` | **A part occluded by the body it belongs to.** The ring system is one annulus in the body's equatorial plane, and the globe stands in front of half of it. The component splits the ring at the two points where it crosses the globe's silhouette and paints the far arc, the globe, then the near arc. Everything else in the set culls a part or draws it in front; nothing else cuts one part in two on another part's outline. |
| `celestial-moon` | **The terminator as a projected great circle.** The day–night line is the circle where the light grazes the sphere, seen from the camera — an ellipse whose eccentricity is the phase and whose sense flips at quarter. That flip is what hand-drawn moons get wrong, and here it is not drawn at all: it falls out of projecting the circle. Libration then rocks the body so the limb craters come round, which is why the near side is a range and not a picture. |
| `celestial-star` | **A surface brightness law, drawn as geometry.** Limb darkening is `I/I₀ = 1 − u(1 − μ)` sampled into concentric bands, so the falloff is the law at the radius rather than a gradient someone tuned. Prominences are arcs anchored at two footpoints on the limb and rise out of the disc plane; spots sit at a latitude belt and go round the back. |
| `celestial-asteroid` | **A body whose silhouette changes as it turns.** The radius is a sum of deterministic lobes over direction, so it is a genuine three-dimensional shape, and it tumbles about an axis that is not the one it spins about. Every other body in the family is a sphere and hides its rotation; this one cannot. |
| `orrery` | **Kepler's second law, visible.** Bodies are carried on radial arms whose length is the orbital radius, so a body really does run at periapsis and loiter at apoapsis, and the arm shortens and lengthens as it goes. The orbit paths are the ellipses those elements describe, with the hub at a focus and not at the centre. |

## The solver: `celestial-geometry`

`src/lib/robocn/celestial.ts`. Pure functions over plain `{x,y,z}` in the set's world axes —
**x** starboard, **y** up, **z** toward the tail — no React, no camera.

| Export | What it gives, and the invariant the tests hold it to |
|---|---|
| `solveKepler(meanAnomaly, eccentricity)` | The eccentric anomaly, by Newton from a good seed with a bisection fallback. `E − e·sin E` returns the mean anomaly to 1e-9 for eccentricities up to 0.97, including right at periapsis and apoapsis. |
| `orbitalState(elements, time)` | Position, radius and true anomaly. The **hub is at a focus**: the radius is `a(1 − e·cos E)`, minimum at periapsis and maximum at apoapsis, and one period returns the body to where it started. Equal areas in equal times is checked by sampling the swept area over equal intervals. |
| `orbitPath(elements, steps)` | The ellipse, stepped in eccentric anomaly so the curve is smooth rather than bunched. Closed, and every point satisfies the orbit. |
| `terminator(radius, sun, steps)` | The great circle where the light grazes: every point is at `radius` from the centre and perpendicular to the sun direction. |
| `phaseFraction(sun, viewer)` | The lit fraction of the disc a viewer sees, `(1 + cos elongation)/2`. One at opposition, zero at conjunction, a half at quadrature. |
| `illumination(point, sun)` | How lit one surface point is, `−1` to `1`. Zero exactly on the terminator, which is what lets the craters and the bands agree with the day–night line. |
| `spinAxis(tilt, precession)` | The body's rotation axis as a unit vector; `tilt` 0 is straight up. |
| `surfacePoint(radius, latitude, longitude, axis, spin)` | A point on the turning body. Always at `radius`; a 360° spin is the identity; latitude 90 is the pole whatever the spin. |
| `latitudeBand(radius, latitude, axis, spin, steps)` | A parallel on that body — an atmospheric band, a spot belt. |
| `limbDarkening(mu, coefficient)` | `1 − u(1 − μ)`. One at disc centre, `1 − u` at the limb, monotone between. |
| `lumpyRadius(direction, options)` | The irregular body: a fixed set of cosine lobes summed over direction. Deterministic for a seed, bounded in `1 ± depth`, and **continuous across every seam** — the test walks a closed loop over the sphere and holds the step size down. |
| `tumbleFrame(spin, precession, axis)` | The rotation of a body turning about one axis while that axis itself turns. Orthonormal at every time, and the identity at zero. |

## Shared contract

- `size`, `variant`, the four palette roles, `px()` on every coordinate, finite-clamped inputs,
  `role="img"` / `role="slider"`, `label`, `showGround` where a body has a mount.
- `view`: all five carry it. A sphere alone would look the same from every camera — its **axis
  does not**, so the tilt, the bands, the ring plane, the spot belt and the orbit planes all
  turn with the camera. Native views: `front` for the four bodies, `plan` for the orrery, whose
  ellipses read true from above.
- One number per machine is the mechanism and a drag or the arrow keys can take it: `spin`
  (planet), `phase` (moon — the lunation, not the clock offset), `activity` (star), `tumble`
  (asteroid), `epoch` (orrery). `on…Change` throughout.
- `behavior` always includes `static`; `speed`, `phase`, `paused`, `animate` and reduced motion
  behave as everywhere else. Samplers are exported pure functions of the clock: `planetGoal`,
  `moonGoal`, `starGoal`, `asteroidGoal`, `orreryGoal`.

### `data-*` hooks — these are API

`data-frame` and `data-view` on all five. Then:

- planet: `data-globe`, `data-band="<i>"`, `data-terminator`, `data-cap="north"|"south"`,
  `data-ring="far"|"near"`, `data-axis`, `data-moon="<i>"`.
- moon: `data-globe`, `data-terminator`, `data-crater="<i>"`, `data-mare="<i>"`, `data-axis`,
  `data-limb`.
- star: `data-disc`, `data-shell="<i>"`, `data-granule="<i>"`, `data-spot="<i>"`,
  `data-prominence="<i>"`, `data-corona`.
- asteroid: `data-body`, `data-crater="<i>"`, `data-axis`, `data-moonlet`.
- orrery: `data-column`, `data-hub`, `data-orbit="<i>"`, `data-arm="<i>"`, `data-body="<i>"`,
  `data-gear="<i>"`, `data-epoch`.

## What is solved and what is illustrated

**Solved:** Kepler's equation and everything downstream of it, the orbit ellipses and their
foci, the terminator circle and its projection, the phase fraction, the per-point illumination,
the spin axis and the points on it, the latitude bands, the limb-darkening law, the irregular
radius field, the tumble frame, the ring/globe occlusion split, and the projection of all of it.

**Illustrated:** the corona's falloff, the granulation cell shapes, the prominence arc profile,
the crater rim relief, and the atmospheric band colours. There is no radiative transfer, no
n-body gravity, no perturbation theory, no real ephemeris and no scale: the bodies do not pull
on each other, the orrery's elements are the caller's, and nothing here is a position for a
date. Each docs page's `notes` say so.

## Originality

Generic body **types**, not named worlds: `terrestrial | banded | ice | molten`,
`dwarf | main-sequence | giant`, `rubble | monolith | contact`. No real or fictional planet,
moon, star or mission is named, in the components, the demo labels or the docs, and no body
reproduces a recognisable real-world paint scheme.

## Integration

`registry.json` (five `registry:ui`, one `registry:lib`), `src/lib/docs.ts`,
`src/components/demos/demos.tsx` (+ the `demos` map), `src/components/site/catalogue.tsx`,
`README.md`, `scripts/lib/gallery.mjs` (`exercises`), the allow-list arrays in
`scripts/__tests__/registry.test.ts` and
`src/components/site/__tests__/docs-catalogue.test.tsx`, and
`src/components/ui/__tests__/views.test.tsx`.
