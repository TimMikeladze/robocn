# The component file

One file under `src/components/ui/<name>.tsx`, one default export-free named export, no
imports outside `@/lib/robocn/*`, `@/hooks/*`, `@/lib/utils` and React. Anything else has to
be added to the registry entry as a dependency, and usually means the drawing is doing too
much.

`"use client"` only when the file uses a hook (motion, pointer, state). A purely posed
machine — every mechanism driven by a prop — stays a server component; `medical-droid.tsx`
is the reference for that shape.

## Skeleton

```tsx
import type * as React from "react"

import { clamp } from "@/lib/robocn/kinematics"
import {
  px, resolveRobotPalette, resolveRobotSize, robotCamera, robotSurface,
  type RobotPaletteProps, type RobotSize, type RobotVariant, type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type CasingDroidPose = "idle" | "alert" | "extend"

export interface CasingDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,   // `color` is ours, not the DOM's
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. Default is the view the machine was designed in. */
  view?: RobotView
  pose?: CasingDroidPose
  domeAngle?: number
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view", front: "front elevation", profile: "side elevation", iso: "isometric view",
}

const poses: Record<CasingDroidPose, { lean: number; skirt: number }> = {
  idle:   { lean: 0, skirt: 0 },
  alert:  { lean: -3, skirt: 6 },
  extend: { lean: 4, skirt: 12 },
}

function CasingDroid({
  size = "md", variant = "solid", view = "front", pose = "idle", domeAngle = 0,
  signal = "ready", showGround = true, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride,
  className, style, ...props
}: CasingDroidProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const camera = robotCamera(view)                    // see references/views.md
  const turn = finiteClamp(domeAngle, -180, 180)
  const stance = poses[pose] ?? poses.idle            // unknown union value never throws
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor = signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

  return (
    <svg
      role="img"
      aria-label={`Casing droid, ${pose} pose, ${viewNames[view] ?? viewNames.front}`}
      viewBox="0 0 170 230"
      width={width}
      height={px(width * 230 / 170)}
      className={cn("max-w-full select-none", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d="M 12 209 H 158 M 85 8 V 216" strokeDasharray="2 3" />
        </g>
      )}
      {showGround && <ellipse cx={85} cy={207} rx={44} ry={5.5} fill={palette.dark} opacity={0.14} />}

      <g data-frame data-view={view} transform={`translate(85 199) rotate(${stance.lean})`}>
        <g data-dome transform={`rotate(${px(turn)})`}>{/* … */}</g>
      </g>

      {label && (
        <text x={85} y={224} textAnchor="middle" fontFamily="ui-monospace, monospace"
              fontSize={6} fill={palette.foreground}>{label}</text>
      )}
    </svg>
  )
}

const finiteClamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : 0

export { CasingDroid }
```

## Rules that are easy to get wrong

- **`Omit<…, "color">`.** `color` is the shell shorthand. Forgetting the omit is a type error
  that only shows up at `pnpm typecheck`.
- **Spread `...props` onto the `<svg>`**, and pull `className`/`style` out first so `cn()` and
  `color: palette.foreground` survive. Interactive machines also pull `role`, `tabIndex`,
  `onKeyDown`, `onBlur` out and call the caller's handler before their own.
- **`px()` every computed coordinate.** Literals in the drawing are fine; anything through
  `Math.*` is not.
- **Clamp and finite-check every number** (`finiteClamp` above, or `clamp` on an already
  finite value). `NaN` in a transform silently kills a whole subtree.
- **`poses[pose] ?? poses.idle`** for every union lookup — a stale prop from a consumer
  should degrade, not crash.
- **`view` defaults to the machine's native view**, so adding the axis changes nothing for
  existing callers. Name it in the `aria-label` and put `data-view` on the drawing group.
- **Aspect ratio** comes from the viewBox, e.g. `height={px(width * 230 / 170)}`. Never a
  second size prop.

## Drawing vocabulary

Shared so a gantry rail and an elbow read as the same kit:

| Helper | From | Use |
|---|---|---|
| `robotSurface(role, variant, palette, weight)` | `style.ts` | Fill/stroke for one part. Spread it: `<rect {...shell} />`. `weight` scales the outline with the part. |
| `capsulePath(a, b, radius)` | `style.ts` | A limb: rectangle between two joints, half-circle caps. Every limb in the set. |
| `linkRole(index)` | `style.ts` | Alternates `shell`/`metal` down a chain so segments read as separate parts. |
| `robotCamera(view)`, `extrudedPath`, `roundedFootprint` | `style.ts` | The four camera angles. Required on anything with a body in space — `references/views.md`. |
| `mountTransform(mount, w, h, floor)` / `labelTransform(mount)` | `style.ts` | Floor/ceiling/wall mounting. The drawing group works in robot coordinates (y up); labels get counter-transformed. |
| `clamp`, `toRadians`, `add2`/`sub2`/`scale2`, `normalize2`, `perpendicular2`, `convexHull2` | `kinematics.ts` | Plain vector math on `{x, y}`. |

Roles carry meaning: `shell` is the painted body people read as "its colour", `metal` is bare
machined parts, `dark` is cast joints and shadow, `accent` is the live status colour. Paint a
joint `dark` and a bolt `metal` — not whichever looks right today.

## `data-*` hooks

One stable attribute per mechanism, named after the mechanism, not the shape:
`data-frame`, `data-head`, `data-dome`, `data-arm="left"`, `data-leg="right"`,
`data-joint="left-knee"`, `data-tool="gripper"`, `data-panel`, `data-diagnostic`,
`data-alert`, `data-wiring`. Tests assert that a prop change moved the `transform` on one of
these, which is how a behaviour test survives an artwork rewrite.

List them in the design note when shipping a family — they are API.

## When a solver earns its own lib file

Put the maths in `src/lib/robocn/<name>.ts` — and its own registry item — when it is real
kinematics someone could reuse: a chain that has to be solved (`kinematics.ts`, `duck.ts`,
`quadruped.ts`, `stewart.ts`). Pure functions over plain objects, no React, no three.js, no
dependencies, tested directly in `src/lib/robocn/__tests__/`.

Keep it inline in the component when it is a pose table, an eased gesture, or a lookup — most
droids need nothing more. A solved linkage plus an illustrated shell is fine and honest;
`reachy-mini` solves the six rods and illustrates the head, and its docs say so.
