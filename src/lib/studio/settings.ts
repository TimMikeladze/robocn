/**
 * What an organization has decided about how it works: its review stages, its
 * defaults and its public face. Stored as one JSON string on the organization
 * row and always read through `parseSettings`, so a missing or stale blob is
 * the defaults rather than a crash.
 */

import { z } from "zod"

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex colour.")

export const stageBackgroundIds = ["panel", "grid", "blueprint", "checker", "dark"] as const

export const workflowStageSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,32}$/),
  name: z.string().trim().min(1).max(32),
  color: hexColor,
  /** A design in a `done` stage counts as finished on the dashboard. */
  done: z.boolean().default(false),
})
export type WorkflowStage = z.infer<typeof workflowStageSchema>

export const defaultWorkflow: WorkflowStage[] = [
  { id: "draft", name: "Draft", color: "#64748b", done: false },
  { id: "in-review", name: "In review", color: "#d97706", done: false },
  { id: "approved", name: "Approved", color: "#16a34a", done: true },
]

export const settingsSchema = z.object({
  workflow: z
    .array(workflowStageSchema)
    .min(1, "Keep at least one stage.")
    .max(12)
    .refine((stages) => new Set(stages.map((stage) => stage.id)).size === stages.length, {
      message: "Stage ids must be unique.",
    })
    .default(defaultWorkflow),
  defaults: z
    .object({
      background: z.enum(stageBackgroundIds).default("panel"),
      /** Applied to every new design. */
      paletteId: z.string().nullable().default(null),
    })
    .prefault({}),
  profile: z
    .object({
      /** Off means `/o/<slug>` is a 404 even with published designs. */
      listed: z.boolean().default(true),
      tagline: z.string().trim().max(140).default(""),
      website: z.union([z.literal(""), z.url({ protocol: /^https?$/ })]).default(""),
      accent: hexColor.default("#f38b4a"),
      logoAssetId: z.string().nullable().default(null),
    })
    .prefault({}),
})
export type OrgSettings = z.infer<typeof settingsSchema>

export const defaultSettings = (): OrgSettings => settingsSchema.parse({})

export function parseSettings(raw: string | null | undefined): OrgSettings {
  if (!raw) return defaultSettings()
  try {
    const parsed = settingsSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : defaultSettings()
  } catch {
    return defaultSettings()
  }
}

/** The stage a design falls back to when its own was deleted from the workflow. */
export const firstStage = (settings: OrgSettings) => settings.workflow[0]

export const stageOf = (settings: OrgSettings, id: string): WorkflowStage =>
  settings.workflow.find((stage) => stage.id === id) ?? firstStage(settings)
