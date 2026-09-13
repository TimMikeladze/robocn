"use client"

import * as React from "react"
import { Check, Copy, Dices, RotateCcw, SwatchBook } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import {
  applyTheme,
  defaultThemeChoice,
  formatThemeCss,
  oklchToHex,
  presetSwatch,
  randomTune,
  readThemeChoice,
  roleSpec,
  roleSwatch,
  roleSwatchParts,
  themeCss,
  themeData,
  themePresets,
  themeRadii,
  themeRoles,
  themeStorageKey,
  tuneFromHex,
  type ThemeChoice,
  type ThemeRole,
  type ThemeTune,
} from "@/lib/site-theme"
import { cn } from "@/lib/utils"

const modes = [
  { value: "light", label: "light" },
  { value: "dark", label: "dark" },
  { value: "system", label: "system" },
] as const

/** What each role actually paints, said in four words for the panel. */
const roleCaption: Record<ThemeRole, string> = {
  base: "ground, panels, text",
  signal: "accents and status",
  shell: "the machines' paint",
}

/** One machine-panel button: the site's own control idiom, not a menu item. */
function Chip({
  active,
  className,
  ...props
}: React.ComponentProps<"button"> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active && "border-foreground bg-foreground text-background hover:text-background",
        className,
      )}
      {...props}
    />
  )
}

function Row({
  label,
  action,
  children,
}: {
  label: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
          {label}
        </span>
        {action}
      </div>
      {children}
    </div>
  )
}

/** A labelled readout above a slider — the value is the point, so it is never hidden. */
function Dial({
  label,
  value,
  ariaLabel,
  min,
  max,
  step,
  onChange,
  track,
}: {
  label: string
  value: string
  ariaLabel: string
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  track?: string
}) {
  const raw = Number.parseFloat(value)
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 font-mono text-[9px] text-muted-foreground">{label}</span>
      <Slider
        aria-label={ariaLabel}
        className="flex-1"
        min={min}
        max={max}
        step={step}
        value={Number.isNaN(raw) ? min : raw}
        onValueChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
        style={
          track
            ? ({
                "--slider-track": track,
                // The filled range would cover the wheel it is pointing at.
                "--slider-indicator": "transparent",
              } as React.CSSProperties)
            : undefined
        }
      />
      <span className="w-9 shrink-0 text-right font-mono text-[9px] tabular-nums text-muted-foreground">
        {value}
      </span>
    </div>
  )
}

/**
 * One role, fully adjustable: a colour picker for "I want *this* colour", a hue
 * dial for walking the wheel, and a chroma dial for how loud the role is.
 */
function RoleControl({
  role,
  spec,
  tuned,
  mode,
  onChange,
  onReset,
}: {
  role: ThemeRole
  spec: { hue: number; chroma: number }
  tuned: boolean
  mode: "light" | "dark"
  onChange: (tune: ThemeTune) => void
  onReset: () => void
}) {
  const parts = roleSwatchParts(spec, role, mode)
  const hex = oklchToHex(parts.l, parts.c, parts.h)
  // The hue slider's own track shows the wheel at this role's lightness, so the
  // control is a preview rather than a number you have to guess against.
  const wheel = `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360]
    .map((h) => `oklch(${parts.l} ${Math.max(parts.c, 0.08)} ${h})`)
    .join(",")})`

  return (
    <div className="space-y-1.5 border border-border p-2">
      <div className="flex items-center gap-2">
        <span
          className="relative size-5 shrink-0 border border-border"
          style={{ background: roleSwatch(spec, role, mode) }}
        >
          <input
            type="color"
            aria-label={`${role} colour`}
            value={hex}
            onChange={(event) => onChange(tuneFromHex(event.target.value, role))}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </span>
        <span className="font-mono text-[11px] text-foreground">{role}</span>
        <span className="truncate font-mono text-[9px] text-muted-foreground">
          {roleCaption[role]}
        </span>
        {tuned ? (
          <button
            type="button"
            onClick={onReset}
            aria-label={`Reset ${role}`}
            className="ml-auto font-mono text-[9px] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <RotateCcw className="size-3" />
          </button>
        ) : null}
      </div>
      <Dial
        label="hue"
        ariaLabel={`${role} hue`}
        min={0}
        max={360}
        step={1}
        value={`${Math.round(spec.hue)}°`}
        track={wheel}
        onChange={(hue) => onChange({ hue, chroma: spec.chroma })}
      />
      <Dial
        label="chroma"
        ariaLabel={`${role} chroma`}
        min={0}
        max={3}
        step={0.05}
        value={spec.chroma.toFixed(2)}
        onChange={(chroma) => onChange({ hue: spec.hue, chroma })}
      />
    </div>
  )
}

/**
 * The global themer. Repaints the chrome and every robot on the page at once —
 * which is the registry's whole claim, made checkable in one click.
 */
function ThemeCustomizer() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [choice, setChoice] = React.useState<ThemeChoice>(defaultThemeChoice)
  const [copied, setCopied] = React.useState(false)

  const mode: "light" | "dark" = resolvedTheme === "dark" ? "dark" : "light"
  const preset =
    themePresets.filter((p) => p.id === choice.preset)[0] ?? themePresets[0]

  const update = (next: ThemeChoice) => {
    setChoice(next)
    applyTheme(themeCss, themeData, next)
    try {
      window.localStorage.setItem(themeStorageKey, JSON.stringify(next))
    } catch {
      /* A blocked store costs persistence, not the theme. */
    }
  }

  // A tune is stored per role, so dropping one role back to the preset is a
  // delete rather than a copy of the preset's numbers — which would then stop
  // following the preset when a different palette is picked.
  const tuneRole = (role: ThemeRole, tune: ThemeTune | null) => {
    const next = { ...choice.tune }
    if (tune) next[role] = tune
    else delete next[role]
    update({
      ...choice,
      tune: themeRoles.filter((r) => next[r]).length > 0 ? next : undefined,
    })
  }

  // Read on open rather than on mount: the boot script has already applied the
  // saved choice to the page, so the panel is the only thing that needs to
  // catch up, and it cannot be read before it is opened.
  const sync = (open: boolean) => {
    if (!open) return
    try {
      setChoice(readThemeChoice(window.localStorage.getItem(themeStorageKey), themeData))
    } catch {
      /* A blocked store just means the defaults. */
    }
  }

  return (
    <Popover onOpenChange={sync}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            aria-label="Change theme"
          >
            <SwatchBook className="size-4" />
          </Button>
        }
      />
      <PopoverContent
        align="end"
        className="max-h-[min(34rem,calc(100vh-5rem))] w-[286px] space-y-3.5 overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <PopoverTitle className="font-mono text-[11px] tracking-[0.08em] uppercase">
            Theme
          </PopoverTitle>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => update({ ...choice, tune: randomTune() })}
              className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Dices className="size-3" />
              random
            </button>
            <button
              type="button"
              onClick={() => update(defaultThemeChoice)}
              className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <RotateCcw className="size-3" />
              reset
            </button>
          </div>
        </div>

        <Row label="Palette">
          <div className="grid grid-cols-4 gap-1.5">
            {themePresets.map((item) => {
              const active = item.id === choice.preset
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  aria-label={item.label}
                  // Picking a palette drops the tune: otherwise the swatch you
                  // clicked is not the palette you get.
                  onClick={() => update({ ...choice, preset: item.id, tune: undefined })}
                  className="group flex flex-col items-center gap-1 focus-visible:outline-none"
                >
                  {/* Shell against signal: the two hues a preset actually moves. */}
                  <span
                    className={cn(
                      "h-7 w-full border border-border transition-colors group-hover:border-foreground/40 group-focus-visible:ring-2 group-focus-visible:ring-ring",
                      active && "border-foreground group-hover:border-foreground",
                    )}
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${presetSwatch(item, "shell", mode)} 0 50%, ${presetSwatch(item, "signal", mode)} 50% 100%)`,
                    }}
                  />
                  <span
                    className={cn(
                      "font-mono text-[9px] text-muted-foreground transition-colors group-hover:text-foreground",
                      active && "text-foreground",
                    )}
                  >
                    {item.label.toLowerCase()}
                  </span>
                </button>
              )
            })}
          </div>
        </Row>

        <Row
          label={choice.tune ? "Colour · custom" : "Colour"}
          action={
            choice.tune ? (
              <button
                type="button"
                onClick={() => update({ ...choice, tune: undefined })}
                className="font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                clear
              </button>
            ) : null
          }
        >
          <div className="space-y-1.5">
            {themeRoles.map((role) => (
              <RoleControl
                key={role}
                role={role}
                mode={mode}
                spec={roleSpec(preset, role, choice.tune)}
                tuned={Boolean(choice.tune?.[role])}
                onChange={(tune) => tuneRole(role, tune)}
                onReset={() => tuneRole(role, null)}
              />
            ))}
          </div>
        </Row>

        <Row label="Radius">
          <div className="space-y-2">
            <div className="flex gap-1">
              {themeRadii.map((radius) => (
                <Chip
                  key={radius}
                  active={radius === choice.radius}
                  onClick={() => update({ ...choice, radius })}
                  className="flex-1"
                >
                  {radius}
                </Chip>
              ))}
            </div>
            <Dial
              label="rem"
              ariaLabel="Corner radius"
              min={0}
              max={2}
              step={0.025}
              value={choice.radius.toFixed(3)}
              onChange={(radius) => update({ ...choice, radius })}
            />
          </div>
        </Row>

        <Row label="Mode">
          <div className="flex gap-1">
            {modes.map((item) => (
              <Chip
                key={item.value}
                active={theme === item.value}
                onClick={() => setTheme(item.value)}
                className="flex-1"
              >
                {item.label}
              </Chip>
            ))}
          </div>
        </Row>

        <Button
          variant="outline"
          size="sm"
          className="w-full font-mono text-[11px]"
          onClick={async () => {
            await navigator.clipboard.writeText(
              formatThemeCss(themeCss(themeData, choice.preset, choice.radius, choice.tune)),
            )
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1600)
          }}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "copied" : "copy css"}
        </Button>
      </PopoverContent>
    </Popover>
  )
}

export { ThemeCustomizer }
