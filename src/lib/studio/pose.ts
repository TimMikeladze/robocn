/**
 * Poses as data: checked against the machine's own controls on the way in,
 * compared on the way out. The workbench trusts its URL the same way —
 * `readPose` — and this is that rule for a JSON body.
 */

import {
  drivable,
  type Control,
  type Pose,
  type PropValue,
  type WorkbenchComponent,
} from "@/lib/workbench/controls"

function accepts(control: Control, value: unknown): value is PropValue {
  switch (control.kind) {
    case "boolean":
      return typeof value === "boolean"
    case "number":
      return typeof value === "number" && Number.isFinite(value)
    case "size":
      return (
        (typeof value === "string" && !!control.options?.includes(value)) ||
        (typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 4096)
      )
    case "enum":
      return (
        (typeof value === "string" || typeof value === "number") &&
        !!control.options?.includes(value)
      )
    case "color":
    case "text":
      return typeof value === "string" && value.length <= 120
    default:
      return false
  }
}

/** Keep what the machine can be handed; drop everything else without complaint. */
export function sanitizePose(component: WorkbenchComponent, input: unknown): Pose {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {}
  const pose: Pose = {}
  for (const control of component.controls) {
    if (!drivable(control)) continue
    const value = (input as Record<string, unknown>)[control.name]
    if (value === undefined) continue
    if (accepts(control, value)) pose[control.name] = value
  }
  return pose
}

export interface PoseChange {
  name: string
  from: PropValue | undefined
  to: PropValue | undefined
}

/** What moved between two versions, in a stable order. Unset means "the machine's default". */
export function diffPose(from: Pose, to: Pose): PoseChange[] {
  const names = [...new Set([...Object.keys(from), ...Object.keys(to)])].sort()
  return names
    .filter((name) => from[name] !== to[name])
    .map((name) => ({ name, from: from[name], to: to[name] }))
}

export const samePose = (a: Pose, b: Pose) => diffPose(a, b).length === 0

/** The six palette roles a brand palette may set. They are ordinary props on every machine. */
export const paletteRoles = ["color", "accent", "metal", "dark", "glow", "grid"] as const
export type PaletteRole = (typeof paletteRoles)[number]

/** Lay a palette over a pose: only the roles the machine actually has. */
export function applyPalette(
  component: WorkbenchComponent,
  pose: Pose,
  colors: Record<string, string>,
): Pose {
  const next = { ...pose }
  for (const role of paletteRoles) {
    const has = component.controls.some((control) => control.name === role && drivable(control))
    if (has && colors[role]) next[role] = colors[role]
  }
  return next
}
