/**
 * The maths behind the hero's 2D → 3D wipe. Kept away from the components so
 * the seam, the masks and the camera dolly can be tested without a canvas.
 *
 * `t` is "3D-ness": 0 is the flat SVG drawing, 1 is the solid rig. Every
 * function here is a pure read of it, which is what makes the reverse
 * transition the same code running backwards.
 */

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const clamp01 = (value: number) =>
  value < 0 ? 0 : value > 1 ? 1 : value

/** Slow at both ends: the seam accelerates off the top edge and settles. */
export function easeInOutCubic(t: number): number {
  const x = clamp01(t)
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2
}

/**
 * Where the wipe seam sits, in percent of the stage height. It starts above
 * the stage and ends below it, so both layers are fully clear at rest.
 */
export const seamPercent = (t: number) => -10 + clamp01(t) * 120

/** Soft band either side of the seam, in percent. The layers overlap in it. */
const BAND = 5

/** The SVG lives below the seam. */
export const flatMask = (seam: number) =>
  `linear-gradient(to bottom, transparent ${(seam - BAND).toFixed(2)}%, #000 ${(seam + BAND).toFixed(2)}%)`

/** The rig lives above it. */
export const solidMask = (seam: number) =>
  `linear-gradient(to bottom, #000 ${(seam - BAND).toFixed(2)}%, transparent ${(seam + BAND).toFixed(2)}%)`

/** The scan line is only interesting while something is actually moving. */
export const seamOpacity = (t: number) => {
  const x = clamp01(t)
  return Math.sin(Math.PI * x) ** 0.6
}

/** Surfaces appear once the wire cage has been read. */
export const WIREFRAME_UNTIL = 0.55

export interface HeroCamera {
  position: [number, number, number]
  fov: number
  /** Where the camera looks; the arm's mass sits above the floor. */
  target: [number, number, number]
}

/** Dead-on and nearly orthographic: a perspective camera imitating a drawing. */
export const FLAT_CAMERA: HeroCamera = {
  position: [0, 1.25, 8.6],
  fov: 20,
  target: [0, 1.15, 0],
}

/** The three-quarter view that shows the rig is a solid object. */
export const SOLID_CAMERA: HeroCamera = {
  position: [3.5, 2.5, 4.4],
  fov: 40,
  target: [0, 0.95, 0],
}

export function lerpCamera(t: number): HeroCamera {
  const e = easeInOutCubic(t)
  return {
    position: [
      lerp(FLAT_CAMERA.position[0], SOLID_CAMERA.position[0], e),
      lerp(FLAT_CAMERA.position[1], SOLID_CAMERA.position[1], e),
      lerp(FLAT_CAMERA.position[2], SOLID_CAMERA.position[2], e),
    ],
    fov: lerp(FLAT_CAMERA.fov, SOLID_CAMERA.fov, e),
    target: [
      lerp(FLAT_CAMERA.target[0], SOLID_CAMERA.target[0], e),
      lerp(FLAT_CAMERA.target[1], SOLID_CAMERA.target[1], e),
      lerp(FLAT_CAMERA.target[2], SOLID_CAMERA.target[2], e),
    ],
  }
}

/**
 * The one pointer position both renderers answer to, mapped into 3D world
 * units. `unit` is 0..1 across the stage box, y down — the same rectangle the
 * SVG maps into its own world, which is why the arm does not jump at the swap.
 */
export function pointerToWorld3D(
  unit: { x: number; y: number },
  reach: number,
): { x: number; y: number; z: number } {
  const ndcX = unit.x * 2 - 1
  const ndcY = 1 - unit.y * 2
  const baseHeight = reach * 0.16
  return {
    x: ndcX * reach * 0.95,
    y: baseHeight + reach * (0.34 + ndcY * 0.46),
    z: reach * 0.26,
  }
}
