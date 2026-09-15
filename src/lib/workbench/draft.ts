/**
 * The skeleton `New` writes.
 *
 * Until now the new-machine dialog produced a *brief* and waited for an agent
 * to turn it into a file. With a checkout the workbench can write the file
 * itself — and the useful thing to write is not an empty module but a machine
 * that already draws: props destructured with defaults, the palette resolved,
 * the camera applied, a clock running. Every one of those is a control the
 * generator will find, so the draft arrives on the stage with knobs on.
 *
 * What it draws is deliberately a placeholder — a plinth, a mast and a head
 * that sweeps. The agent replaces the body. It does not have to work out the
 * house idiom first, which is the part that costs an hour.
 */

import { exportName } from "@/lib/workbench/controls"

export interface DraftOptions {
  /** Kebab-case file name, e.g. `harbour-crane`. */
  slug: string
  /** One or two sentences describing the machine, for the file's own comment. */
  subject?: string
  /** The machine this one was started from, named in the comment. */
  reference?: string
}

/** `harbour-crane` → `Harbour crane`, for the file's own header. */
const titleFrom = (slug: string) => {
  const words = slug.replace(/-/g, " ")
  return words ? words[0].toUpperCase() + words.slice(1) : words
}

/** Where a draft's file goes. The one place that spelling is decided. */
export const draftFile = (slug: string) => `src/components/ui/${slug}.tsx`

/**
 * A compiling, drawing, controllable robocn component.
 *
 * Kept deliberately close to the smallest real machine in the set: the same
 * imports, the same prop order, the same `robotSurface` roles. A diff between
 * this and a finished component should be about the drawing and nothing else.
 */
export function draftSource({ slug, subject, reference }: DraftOptions): string {
  const name = exportName(slug)
  const title = titleFrom(slug)
  const description = (subject ?? "").trim() || `${title}: a machine in progress.`
  const wrapped = wrap(description, 76, " * ")
  const from = reference
    ? `\n *\n * Started from \`${reference}\`. Follow its shape: one solver, one drawing, one\n * self-running behaviour.`
    : ""

  return `"use client"

/**
${wrapped}
 *
 * A draft. It draws, it takes a pose and it runs on its own, but no registry
 * item claims it yet — so it does not install, and it has no docs page, demo or
 * tests. The \`build-robot\` skill knows the rest of the way.${from}
 */

import * as React from "react"

import { useRobotClock } from "@/hooks/use-robot-motion"
import {
  aboutPoint,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

/** What the machine is doing with itself when nobody is driving it. */
export type ${name}Behavior = "sweep" | "hold" | "static"

export interface ${name}Props
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  behavior?: ${name}Behavior
  /** How far the head swings from centre, in degrees. */
  reach?: number
  speed?: number
  phase?: number
  paused?: boolean
  animate?: boolean
  label?: string
  view?: RobotView
  size?: RobotSize | number
  variant?: RobotVariant
}

const names: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

function ${name}({
  behavior = "sweep",
  reach = 34,
  speed = 1,
  phase = 0,
  paused = false,
  animate = true,
  label,
  view = "front",
  size = "md",
  variant = "solid",
  color,
  accent,
  metal,
  dark,
  glow,
  grid,
  palette: paletteOverride,
  className,
  style,
  "aria-label": ariaLabel,
  ...props
}: ${name}Props) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const clock = useRobotClock({ speed, phase, paused, animate: animate && behavior === "sweep" })
  // One angle drives the whole drawing, which is what makes the draft posable
  // before it is finished: the solver replaces this line, not the markup.
  const swing = behavior === "static" ? 0 : Math.sin(clock * Math.PI * 2) * (behavior === "hold" ? 0 : reach)

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const face = aboutPoint(robotCamera(view).wall(), 110, 110, view === "profile" ? 0.92 : 1)

  return (
    <svg
      role="img"
      aria-label={ariaLabel ?? \`${title}, \${names[view]}\`}
      viewBox="0 0 220 200"
      width={width}
      height={px((width * 200) / 220)}
      className={cn("max-w-full select-none", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && (
        <path d="M 12 170 H 208 M 110 18 V 182" stroke={palette.grid} strokeWidth={0.6} strokeDasharray="3 4" />
      )}
      <g data-view={view} transform={face || undefined}>
        <rect x={62} y={154} width={96} height={24} rx={5} {...cast} />
        <rect x={86} y={74} width={48} height={84} rx={7} {...shell} />
        <g data-head transform={\`rotate(\${px(swing)} 110 78)\`}>
          <rect x={74} y={40} width={72} height={38} rx={9} {...machined} />
          <circle cx={110} cy={59} r={9} fill={palette.accent} />
          <path d="M 110 40 V 26" stroke={palette.metal} strokeWidth={3} strokeLinecap="round" />
          <circle cx={110} cy={23} r={4} fill={palette.glow} />
        </g>
        <path d="M 96 100 H 124 M 96 116 H 124 M 96 132 H 124" stroke={palette.dark} strokeWidth={2} />
      </g>
      {label && (
        <text x={110} y={196} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

export { ${name} }
`
}

/** Hard-wrap a sentence into a JSDoc block, so the header never runs long. */
function wrap(text: string, width: number, prefix: string) {
  const lines: string[] = []
  let line = ""
  for (const word of text.split(/\s+/)) {
    if (line && line.length + word.length + 1 > width) {
      lines.push(line)
      line = word
    } else {
      line = line ? `${line} ${word}` : word
    }
  }
  if (line) lines.push(line)
  return lines.map((entry) => `${prefix}${entry}`.trimEnd()).join("\n")
}
