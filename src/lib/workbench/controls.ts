/**
 * The workbench's model: what a knob is, what a pose is, and how a pose
 * survives a reload.
 *
 * The manifest next door is generated from the components' own props — see
 * `scripts/build-workbench.mjs`. Everything here reads it; nothing here knows
 * about any particular robot.
 */

import generated from "./generated.json"

export type ControlKind =
  | "enum"
  | "boolean"
  | "number"
  | "color"
  | "text"
  | "size"
  | "action"
  | "unsupported"

export type ControlGroup = "frame" | "shape" | "motion" | "palette"

export interface Control {
  name: string
  /** The prop's declared type, verbatim, for the rows a panel cannot drive. */
  type: string
  /** The prop's doc comment, which is the control's help text. */
  doc: string
  group: ControlGroup
  kind: ControlKind
  /** What the component destructures the prop to. Absent means it decides. */
  default?: string | number | boolean
  options?: (string | number)[]
  /** An options list of numbers, not strings: `2 | 4`. */
  numeric?: boolean
  min?: number
  max?: number
  step?: number
}

export interface WorkbenchComponent {
  id: string
  title: string
  description: string
  categories: string[]
  /** On disk but not in `registry.json` yet: a robot being made, not shipped. */
  draft: boolean
  /** Repository path — the file an agent is asked to edit. */
  file: string
  module: string
  export: string
  webgl: boolean
  /** Mounted through a wrapper instead of bare: the export name and its module. */
  wrap: { export: string; module: string } | null
  props: string | null
  controls: Control[]
}

export const workbenchComponentList = (generated as { components: WorkbenchComponent[] })
  .components

export const workbenchComponent = (id: string | null | undefined) =>
  workbenchComponentList.find((component) => component.id === id) ?? null

/**
 * The category a component files under in the index. Nearly every item leads
 * with "robotics", which would put the whole library in one drawer, so the
 * second category wins where there is one.
 */
export const categoryOf = (component: WorkbenchComponent) =>
  component.categories[1] ?? component.categories[0] ?? "other"

/**
 * Sidebar order: category, then the component's title. Drafts come first —
 * what you are making outranks what is already made.
 */
export function componentsByCategory(components = workbenchComponentList) {
  const sections = new Map<string, WorkbenchComponent[]>()
  for (const component of components) {
    const category = categoryOf(component)
    sections.set(category, [...(sections.get(category) ?? []), component])
  }
  return [...sections.entries()]
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) =>
      a.category === "drafts" || b.category === "drafts"
        ? Number(b.category === "drafts") - Number(a.category === "drafts")
        : a.category.localeCompare(b.category),
    )
}

/** `Folding handset` → `folding-handset`, the file name and the item name. */
export const slugify = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

/**
 * A machine is anything that draws itself with robocn's own vocabulary: the
 * palette, the camera, the clock. Shadcn primitives share the `ui` folder and
 * are not machines, and this is what tells a draft robot from a button.
 *
 * The twin of `isRobotSource` in `scripts/lib/workbench.mjs`, which the
 * generator uses in node. This copy is for the browser: with a folder open the
 * workbench reads `src/components/ui` itself and has to make the same call
 * about a file the manifest has never seen. `controls.test.ts` keeps the two
 * honest.
 */
export const isRobotSource = (source: string) =>
  /from "@\/(lib\/robocn|hooks\/use-robot)/.test(source)

/** `folding-handset` → `FoldingHandset`, the export the workbench resolves by. */
export const exportName = (slug: string) =>
  slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("")

/**
 * The brief for a machine that does not exist yet.
 *
 * It does not try to restate the house rules — `.claude/skills/ship-robot` is
 * 190 lines of them and is already in the repo. It names the file, the export,
 * the subject and the nearest machine to follow, and points the agent at the
 * skill that knows the other ten touchpoints.
 */
export function newRobotPrompt({
  name,
  subject,
  reference,
}: {
  name: string
  subject?: string
  reference?: WorkbenchComponent | null
}) {
  const slug = slugify(name) || "new-robot"
  return [
    "Use the ship-robot skill.",
    "",
    `Build a new robocn machine: **${name.trim() || slug}**`,
    "",
    `- file:   \`src/components/ui/${slug}.tsx\``,
    `- export: \`${exportName(slug)}\``,
    `- item:   \`${slug}\``,
    ...(reference
      ? [`- nearest existing machine to follow: \`${reference.file}\` (\`${reference.export}\`)`]
      : []),
    "",
    subject?.trim()
      ? subject.trim()
      : "What it is: <describe the machine — what it does, what moves, what it should read as>",
    "",
    "Ship it end to end: solver if the mechanism has real kinematics, the component with the",
    "shared prop contract (size, variant, view, palette, paused, animate, behavior), a registry",
    "item, a docs entry, a demo, a catalogue card, a README row and tests.",
    "",
    "Save the component file first and tell me — it shows up in the workbench as a draft as soon",
    "as it exists, and I will pose it there while you finish the rest.",
  ].join("\n")
}

/** What a draft still needs before it is a component anyone can install. */
export function shipDraftPrompt(component: WorkbenchComponent) {
  return [
    "Use the ship-robot skill.",
    "",
    `\`${component.file}\` exists and draws, but nothing else does: it has no registry item, so`,
    "it does not install, has no docs page, no demo, no catalogue card and no tests.",
    "",
    `Ship \`${component.export}\` the rest of the way — registry item \`${component.id}\`, docs entry,`,
    "demo, catalogue card, README row, tests — and run the verification pass.",
  ].join("\n")
}

export function matchesQuery(component: WorkbenchComponent, query: string) {
  const text = query.trim().toLowerCase()
  if (!text) return true
  const haystack =
    `${component.title} ${component.id} ${component.description} ${component.categories.join(" ")}`.toLowerCase()
  return text.split(/\s+/).every((word) => haystack.includes(word))
}

export type PropValue = string | number | boolean
/** Only what has been *set*. An absent prop is the component's own default. */
export type Pose = Record<string, PropValue>

export const drivable = (control: Control) =>
  control.kind !== "unsupported" && control.kind !== "action"

/** Where a slider starts when the component names no default. */
export function fallbackValue(control: Control): PropValue {
  if (control.default !== undefined) return control.default
  switch (control.kind) {
    case "boolean":
      return false
    case "number": {
      const min = control.min ?? 0
      const max = control.max ?? 1
      return Number((min < 0 && max > 0 ? 0 : min).toFixed(3))
    }
    case "size":
      return "md"
    case "color":
      return "#f38b4a"
    case "enum":
      return control.options?.[0] ?? ""
    default:
      return ""
  }
}

function coerce(control: Control, raw: string): PropValue | null {
  switch (control.kind) {
    case "boolean":
      return raw === "true" ? true : raw === "false" ? false : null
    case "number": {
      const value = Number(raw)
      return Number.isFinite(value) ? value : null
    }
    case "size":
      return control.options?.includes(raw) ? raw : Number.isFinite(Number(raw)) ? Number(raw) : null
    case "enum": {
      if (control.numeric) {
        const value = Number(raw)
        return control.options?.includes(value) ? value : null
      }
      return control.options?.includes(raw) ? raw : null
    }
    case "color":
    case "text":
      return raw.slice(0, 120)
    default:
      return null
  }
}

/** `?p.variant=blueprint&p.speed=0.4` — a pose anyone can read and edit. */
export const POSE_PREFIX = "p."

export function readPose(params: URLSearchParams, controls: Control[]): Pose {
  const pose: Pose = {}
  for (const control of controls) {
    if (!drivable(control)) continue
    const raw = params.get(POSE_PREFIX + control.name)
    if (raw === null) continue
    const value = coerce(control, raw)
    if (value !== null) pose[control.name] = value
  }
  return pose
}

export function writePose(params: URLSearchParams, pose: Pose) {
  for (const key of [...params.keys()]) {
    if (key.startsWith(POSE_PREFIX)) params.delete(key)
  }
  for (const [name, value] of Object.entries(pose)) {
    params.set(POSE_PREFIX + name, String(value))
  }
  return params
}

/** Every prop the component is actually handed, defaults included. */
export function resolvedPose(component: WorkbenchComponent, pose: Pose): Pose {
  const resolved: Pose = {}
  for (const control of component.controls) {
    if (!drivable(control)) continue
    const value = pose[control.name] ?? control.default
    if (value !== undefined) resolved[control.name] = value
  }
  return resolved
}

/** A pose as the JSX that would produce it — paste-ready for a demo or a doc. */
export function jsxSnippet(component: WorkbenchComponent, pose: Pose) {
  const attributes = Object.entries(pose)
    .map(([name, value]) => {
      if (value === true) return name
      if (typeof value === "string") return `${name}=${JSON.stringify(value)}`
      return `${name}={${JSON.stringify(value)}}`
    })
    .sort()
  if (!attributes.length) return `<${component.export} />`
  const inline = `<${component.export} ${attributes.join(" ")} />`
  if (inline.length <= 78) return inline
  return `<${component.export}\n  ${attributes.join("\n  ")}\n/>`
}

/**
 * The handoff. The workbench never talks to an agent; it writes the brief the
 * agent needs — which file, which export, which pose — and you paste it into
 * Claude Code or Codex running in this same checkout.
 */
export function agentPrompt(
  component: WorkbenchComponent,
  pose: Pose,
  options: { url?: string; request?: string } = {},
) {
  const lines = [
    `Edit \`${component.file}\` in robocn — the \`${component.export}\` component (${component.title}).`,
    "",
    "I am looking at it in the workbench, posed like this:",
    "",
    "```tsx",
    jsxSnippet(component, pose),
    "```",
  ]
  if (options.url) lines.push("", `Workbench: ${options.url}`)
  lines.push(
    "",
    options.request?.trim()
      ? options.request.trim()
      : "What I want changed: <describe it>",
    "",
    "Keep the prop contract, the camera views and the motion hooks intact, and keep its tests and docs in step.",
  )
  return lines.join("\n")
}
