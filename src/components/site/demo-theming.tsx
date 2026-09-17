"use client"

/**
 * The palette strip under a docs demo.
 *
 * Every machine paints through `defaultRobotPalette`, where each role reads its
 * own CSS variable — so retinting one is a variable set, not a prop threaded
 * through a demo. That is why this works on all ~300 component pages without
 * touching any of the hand-written benches.
 *
 * The variables go on `:root` itself, as inline style on `<html>`, for two
 * reasons: it is exactly the CSS the copy button hands back, and it is the only
 * place the WebGL machines can see. They resolve a variable by probing the
 * document and re-read on a `<html>` attribute change (`watchCssColors`), so a
 * value set on a wrapper div would move the SVG machines and leave the 3D ones
 * behind. Inline style outranks the site theme's stylesheet, and clearing a
 * role hands it straight back. Notes: `docs/component-page-theming.md`.
 */

import * as React from "react"
import { Check, Copy, RotateCcw } from "lucide-react"

import { oklchToHex, resolveCssColor, watchCssColors } from "@/lib/robocn/color"
import { cn } from "@/lib/utils"

/** The roles, in the order a machine is read: body, then metal, then light. */
export const themingRoles = [
  { role: "shell", variable: "--robot-shell", hint: "body panels" },
  { role: "metal", variable: "--robot-metal", hint: "arms, shafts" },
  { role: "dark", variable: "--robot-dark", hint: "joints, base" },
  { role: "accent", variable: "--robot-accent", hint: "status, tips" },
  { role: "glow", variable: "--robot-glow", hint: "emissive halo" },
  { role: "grid", variable: "--robot-grid", hint: "blueprint lines" },
  { role: "foreground", variable: "--robot-foreground", hint: "labels" },
] as const

export type ThemingRole = (typeof themingRoles)[number]["role"]
export type ThemingOverrides = Partial<Record<ThemingRole, string>>

/** What the page is currently painting with, as hex the wells can show. */
function readTheme(): Record<string, string> {
  const current: Record<string, string> = {}
  for (const { role, variable } of themingRoles) {
    // `foreground` defaults to `currentColor`, which resolves to whatever text
    // colour the demo sits in — fine to show, and fine to override.
    current[role] = resolveCssColor(`var(${variable}, currentColor)`, "#9ca3af")
  }
  return current
}

const swatchOf = (value: string) =>
  /^#[0-9a-f]{6}$/i.test(value) ? value : (oklchToHex(value) ?? "#9ca3af")

export interface DemoThemingProps {
  /** The demo to retint. */
  children: React.ReactNode
  className?: string
}

function DemoTheming({ children, className }: DemoThemingProps) {
  const [overrides, setOverrides] = React.useState<ThemingOverrides>({})
  // Server-rendered wells would be the light theme's values in a dark page, so
  // the current palette is read after mount and re-read when the theme moves.
  const [inherited, setInherited] = React.useState<Record<string, string>>({})
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    const read = () => setInherited(readTheme())
    read()
    return watchCssColors(read)
  }, [])

  const set = (role: ThemingRole, value: string) =>
    setOverrides((current) => ({ ...current, [role]: value }))

  const clear = (role: ThemingRole) =>
    setOverrides((current) => {
      const next = { ...current }
      delete next[role]
      return next
    })

  /** Only the roles that were actually moved: the rest still inherit. */
  React.useEffect(() => {
    const root = document.documentElement
    for (const { role, variable } of themingRoles) {
      const value = overrides[role]
      if (value) root.style.setProperty(variable, value)
      else root.style.removeProperty(variable)
    }
    return () => {
      // Leaving the page puts the site theme back, whatever was tried here.
      for (const { variable } of themingRoles) root.style.removeProperty(variable)
    }
  }, [overrides])

  const css = React.useMemo(() => {
    const lines = themingRoles
      .filter(({ role }) => overrides[role])
      .map(({ role, variable }) => `  ${variable}: ${overrides[role]};`)
    return lines.length ? `:root {\n${lines.join("\n")}\n}` : ""
  }, [overrides])

  const copy = async () => {
    if (!css) return
    try {
      await navigator.clipboard.writeText(css)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      /* A blocked clipboard is not worth an error state here. */
    }
  }

  const touched = Object.keys(overrides).length

  return (
    <div className={className}>
      {children}

      <div className="border-t border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
            Theming
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void copy()}
              disabled={!touched}
              className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "copied" : "copy CSS"}
            </button>
            <button
              type="button"
              onClick={() => setOverrides({})}
              disabled={!touched}
              className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              <RotateCcw className="size-3" />
              reset
            </button>
          </div>
        </div>

        {/* One row per role on a phone, three across on a wide page. */}
        <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
          {themingRoles.map(({ role, variable, hint }) => {
            const value = overrides[role] ?? inherited[role] ?? ""
            return (
              <div key={role} className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label={role}
                  value={swatchOf(value)}
                  onChange={(event) => set(role, event.target.value)}
                  className="size-6 shrink-0 cursor-pointer rounded-sm border border-border bg-background"
                />
                <label className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="font-mono text-[11px]">{role}</span>
                  <span className="truncate font-mono text-[10px] text-muted-foreground">
                    {hint}
                  </span>
                  <span className="sr-only">{variable}</span>
                </label>
                <input
                  type="text"
                  aria-label={`${role} value`}
                  value={value}
                  onChange={(event) => set(role, event.target.value)}
                  spellCheck={false}
                  className="h-6 w-24 shrink-0 rounded-sm border border-border bg-background px-1.5 font-mono text-[10px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => clear(role)}
                  disabled={!overrides[role]}
                  aria-label={`Reset ${role}`}
                  className={cn(
                    "rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground",
                    !overrides[role] && "invisible",
                  )}
                >
                  <RotateCcw className="size-3" />
                </button>
              </div>
            )
          })}
        </div>

        {css ? (
          <pre className="mt-3 overflow-x-auto rounded-sm border border-border bg-background p-2 font-mono text-[10px] text-muted-foreground">
            {css}
          </pre>
        ) : (
          <p className="mt-3 font-mono text-[10px] text-muted-foreground">
            Set a role and the same CSS goes in your own app — every robot under it follows.
          </p>
        )}
      </div>
    </div>
  )
}

export { DemoTheming }
