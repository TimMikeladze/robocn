"use client"

/**
 * The record button: any machine, any pose, out of the page as a file.
 *
 * Two shapes of the same control. `RobotExport` wraps a machine and floats the
 * button over its corner, so a component gets an export path by being wrapped.
 * `ExportMenu` is that menu on its own, for a toolbar that already knows what
 * it is pointing at — hand it a ref.
 *
 * Every number is typed, not picked: the chips are shortcuts to values the
 * field beside them will take anyway, so a 7.5-second, 24 fps, 1.75× recording
 * is as available as a two-second one. Seconds, rate and frame count are three
 * views of the same recording and stay consistent with each other.
 *
 * Everything happens in the page: `@/lib/robocn/capture` snapshots the DOM,
 * `gif.ts` and `webp.ts` write the container, and the file is an anchor click.
 * Nothing is uploaded. Notes: `docs/export.md`.
 */

import * as React from "react"
import { Check, Download, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  backgroundBehind,
  exportNode,
  frameCount,
  supportsWebp,
  type CaptureTarget,
  type ExportFormat,
} from "@/lib/robocn/capture"
import { cn } from "@/lib/utils"

/** What the menu is pointed at: a ref, a getter, or nothing — meaning the wrapper. */
export type ExportTarget =
  | React.RefObject<HTMLElement | null>
  | React.RefObject<SVGElement | null>
  | React.RefObject<CaptureTarget | null>
  | (() => CaptureTarget | null)

/**
 * Somewhere a finished recording can go.
 *
 * The browser's downloads folder is the default and the only one most pages
 * offer. A page that is holding a directory handle can offer a second — the
 * repository the picture was destined for — without this component knowing
 * anything about how that folder was granted.
 */
export interface ExportDestination {
  id: string
  label: string
  /** Omitted for the browser's own download. Returns where the file landed. */
  write?: (blob: Blob, filename: string) => Promise<string> | string
}

const DOWNLOAD: ExportDestination = { id: "download", label: "Download" }

/** Where the recording's ground comes from. */
export type ExportGround = "page" | "none" | "custom"

export interface ExportSettings {
  format: ExportFormat
  /** Seconds of motion. Zero is a still, and so is any length in PNG. */
  seconds: number
  /** Frames a second to aim for. What lands in the file is what was measured. */
  fps: number
  /** Device pixels per CSS pixel. Fractional is fine. */
  scale: number
  /** WebP quality, 0–1. */
  quality: number
  /** Repeat count for the animated formats; 0 is forever. */
  loop: number
  /** The page's own background, no background at all, or a colour you name. */
  ground: ExportGround
  /** Used when `ground` is `custom`. Any CSS colour. */
  groundColor: string
}

/**
 * What the fields will accept.
 *
 * Wide on purpose — the ceiling is there to stop a typo asking for a hundred
 * thousand frames, not to have an opinion about what a recording should be.
 */
export interface ExportLimits {
  seconds: [number, number]
  fps: [number, number]
  scale: [number, number]
  /** The most frames one recording may hold, whatever seconds × rate asks for. */
  frames: number
}

export const exportLimits: ExportLimits = {
  seconds: [0, 120],
  fps: [1, 60],
  scale: [0.1, 8],
  frames: 900,
}

/** The chips above each field: shortcuts, not the range. */
export interface ExportPresets {
  seconds?: number[]
  fps?: number[]
  scale?: number[]
}

export const exportPresets: Required<ExportPresets> = {
  seconds: [0, 1, 2, 4, 8],
  fps: [10, 15, 24, 30],
  scale: [1, 2, 3],
}

const defaultSettings: ExportSettings = {
  format: "webp",
  seconds: 2,
  fps: 15,
  scale: 2,
  quality: 0.92,
  loop: 0,
  ground: "page",
  groundColor: "#ffffff",
}

const formatLabel: Record<ExportFormat, string> = {
  webp: "WebP",
  gif: "GIF",
  png: "PNG",
}

let webpSupport: boolean | null = null

/** Whether this browser's canvas can write WebP at all, memoized per page. */
const canWriteWebp = () => {
  if (typeof document === "undefined") return true
  if (webpSupport === null) webpSupport = supportsWebp()
  return webpSupport
}

const kilobytes = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

const clamp = (value: number, [low, high]: [number, number]) =>
  Math.min(high, Math.max(low, value))

/** `2` not `2.00`, `2.5` not `2.500`: the number as someone would say it. */
const trim = (value: number, places = 2) =>
  String(Number(value.toFixed(places)))

const chipClass = (selected: boolean) =>
  cn(
    "h-6 rounded-sm px-1.5 font-mono text-[11px] transition-colors hover:bg-muted",
    "disabled:pointer-events-none",
    selected ? "bg-foreground text-background hover:bg-foreground" : "text-muted-foreground",
  )

const fieldClass =
  "h-6 w-16 rounded-sm border border-border bg-background px-1.5 text-right font-mono " +
  "text-[11px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [appearance:textfield]"

interface RowProps<T> {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  disabled?: boolean
}

/** One line of the menu: a label and a row of pressed-state buttons. */
function Row<T extends string | number | boolean>({
  label,
  value,
  options,
  onChange,
  disabled,
}: RowProps<T>) {
  return (
    <div className={cn("flex items-center justify-between gap-3", disabled && "opacity-40")}>
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-0.5" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            disabled={disabled}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className={chipClass(option.value === value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

interface NumberFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  range: [number, number]
  step?: number
  /** Shortcuts. The field still takes anything inside `range`. */
  presets?: number[]
  presetLabel?: (value: number) => string
  suffix?: string
  disabled?: boolean
  /** Shown under the row: what this number means for the file. */
  hint?: string
}

/**
 * A typed number with chips beside it.
 *
 * A text input rather than `type="number"`: a number input sanitizes its own
 * value, so a half-typed `0.` or `-` reads back as the empty string and a
 * decimal cannot be entered at all. The draft is the text as typed; every
 * value parsed out of it is clamped into the field's range, and letting go of
 * the field snaps it to what was actually taken.
 */
function NumberField({
  label,
  value,
  onChange,
  range,
  step = 1,
  presets,
  presetLabel,
  suffix,
  disabled,
  hint,
}: NumberFieldProps) {
  const [draft, setDraft] = React.useState<string | null>(null)

  const commit = (text: string) => {
    setDraft(text)
    if (text.trim() === "") return
    const parsed = Number(text)
    if (Number.isFinite(parsed)) onChange(clamp(parsed, range))
  }

  return (
    <div className={cn("flex flex-col gap-1", disabled && "opacity-40")}>
      {/* Label and field on one line, chips under them: five shortcuts and a
          typed number do not fit across a popover, and the field is the part
          that must never be clipped. */}
      <div className="flex items-center justify-between gap-2">
        <label className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </label>
        <span className="flex items-center gap-1">
          <input
            type="text"
            inputMode="decimal"
            aria-label={label}
            role="spinbutton"
            aria-valuenow={value}
            aria-valuemin={range[0]}
            aria-valuemax={range[1]}
            value={draft ?? trim(value, 3)}
            disabled={disabled}
            onChange={(event) => commit(event.target.value)}
            onBlur={() => setDraft(null)}
            onKeyDown={(event) => {
              // Arrows step the value the way a number input would.
              if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
              event.preventDefault()
              setDraft(null)
              onChange(clamp(value + (event.key === "ArrowUp" ? step : -step), range))
            }}
            className={fieldClass}
          />
          <span className="w-7 font-mono text-[10px] text-muted-foreground">{suffix ?? ""}</span>
        </span>
      </div>
      {presets?.length ? (
        <div
          className="flex flex-wrap items-center justify-end gap-0.5 pr-7"
          role="group"
          aria-label={`${label} presets`}
        >
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              aria-pressed={preset === value}
              onClick={() => {
                setDraft(null)
                onChange(clamp(preset, range))
              }}
              className={chipClass(preset === value)}
            >
              {presetLabel ? presetLabel(preset) : trim(preset)}
            </button>
          ))}
        </div>
      ) : null}
      {hint ? (
        <p className="pr-7 text-right font-mono text-[10px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export interface ExportMenuProps {
  /** What to record. A wrapper passes its own element; a toolbar passes a ref. */
  target: ExportTarget
  /** File stem, and what the name field opens on. The extension is the format's. */
  name?: string
  /** Which formats to offer, in order. */
  formats?: ExportFormat[]
  defaults?: Partial<ExportSettings>
  /** Raise or lower what the fields accept. */
  limits?: Partial<ExportLimits>
  /** Replace the chips beside a field. An empty array leaves it bare. */
  presets?: ExportPresets
  /** Text beside the icon. Omitted, the button is the icon alone. */
  label?: string
  className?: string
  align?: "start" | "center" | "end"
  side?: "top" | "right" | "bottom" | "left"
  /** Drive the menu from outside — a toolbar with a keyboard shortcut. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Told about every setting as it changes, for a page that wants to keep them. */
  onSettingsChange?: (settings: ExportSettings) => void
  /**
   * Where the file may go. One destination is used silently; more than one
   * becomes a row in the menu. Defaults to the browser's download.
   */
  destinations?: ExportDestination[]
}

/** The menu on its own: format, length, rate, frames, scale, ground, and Record. */
function ExportMenu({
  target,
  name = "robocn",
  formats = ["webp", "gif", "png"],
  defaults,
  limits,
  presets,
  label,
  className,
  align = "end",
  side = "bottom",
  open,
  onOpenChange,
  onSettingsChange,
  destinations,
}: ExportMenuProps) {
  const range = { ...exportLimits, ...limits }
  const chips = { ...exportPresets, ...presets }

  const [settings, setSettings] = React.useState<ExportSettings>({
    ...defaultSettings,
    ...defaults,
  })
  const [stem, setStem] = React.useState(name)
  const [progress, setProgress] = React.useState<number | null>(null)
  const [done, setDone] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [selfOpen, setSelfOpen] = React.useState(false)
  const [box, setBox] = React.useState<{ width: number; height: number } | null>(null)

  const update = (patch: Partial<ExportSettings>) =>
    setSettings((current) => {
      const next = { ...current, ...patch }
      onSettingsChange?.(next)
      return next
    })

  const places = destinations?.length ? destinations : [DOWNLOAD]
  const [placeId, setPlaceId] = React.useState(places[0].id)
  const place = places.find((entry) => entry.id === placeId) ?? places[0]

  // Asked once per page: the answer cannot change, and the check costs a canvas
  // encode. On the server it is assumed — nothing of the menu is rendered there.
  const [webp] = React.useState(canWriteWebp)
  const offered = formats.filter((format) => format !== "webp" || webp)
  const format = offered.includes(settings.format) ? settings.format : offered[0] ?? "gif"
  const still = format === "png" || settings.seconds === 0

  const node = () => (typeof target === "function" ? target() : target.current)
  const isOpen = open ?? selfOpen
  const setOpen = (value: boolean) => {
    setSelfOpen(value)
    onOpenChange?.(value)
  }

  /**
   * Measured as the menu mounts, so the readout says what the file will
   * actually be rather than what a scale factor implies. A callback ref, not an
   * effect: the menu is only in the tree while it is open, and this has to work
   * whether it was opened by the button or by a keystroke somewhere else.
   */
  const measure = (mounted: HTMLDivElement | null) => {
    if (!mounted) return
    const element = node()
    const rect = element?.getBoundingClientRect()
    // Same numbers, same object: a callback ref is a fresh function every
    // render, so re-attaching must not be able to schedule another render.
    setBox((previous) => {
      if (!rect) return previous === null ? previous : null
      if (previous && previous.width === rect.width && previous.height === rect.height) {
        return previous
      }
      return { width: rect.width, height: rect.height }
    })
  }

  const wanted = still ? 1 : frameCount(settings.seconds, settings.fps)
  const frames = Math.min(wanted, range.frames)
  const capped = wanted > frames
  // What the recording will actually run for: the length asked for, unless the
  // frame ceiling cut it short.
  const length = capped ? frames / settings.fps : settings.seconds
  const pixels = box
    ? `${Math.round(box.width * settings.scale)} × ${Math.round(box.height * settings.scale)} px`
    : null

  const ground = () => {
    const element = node()
    if (settings.ground === "none") return null
    if (settings.ground === "custom") return settings.groundColor
    return element ? backgroundBehind(element as Element) : null
  }

  const record = async () => {
    const element = node()
    if (!element) {
      setError("Nothing to record.")
      return
    }
    setError(null)
    setDone(null)
    setProgress(0)
    try {
      let landed: string | null = null
      const result = await exportNode(element as CaptureTarget, {
        format,
        name: stem,
        // Frames are the truth: a capped recording is shorter than the seconds
        // asked for, and the length handed over says so.
        duration: still ? 0 : frames / settings.fps,
        fps: settings.fps,
        scale: settings.scale,
        quality: settings.quality,
        loop: settings.loop,
        background: ground(),
        onProgress: (captured, total) => setProgress(captured / total),
        save: place.write
          ? async (blob, filename) => {
              landed = (await place.write?.(blob, filename)) ?? filename
            }
          : undefined,
      })
      setDone(
        `${landed ?? result.filename} · ${result.frames} frame${result.frames === 1 ? "" : "s"} · ` +
          `${result.width} × ${result.height} · ${kilobytes(result.blob.size)}`,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The export failed.")
    } finally {
      setProgress(null)
    }
  }

  const busy = progress !== null

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size={label ? "sm" : "icon-sm"}
            className={className}
            aria-label="Export this as a picture"
            title="Export as WebP, GIF or PNG"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {label ? <span>{busy ? `${Math.round((progress ?? 0) * 100)}%` : label}</span> : null}
          </Button>
        }
      />
      <PopoverContent align={align} side={side} className="w-72 p-3">
        <div ref={measure} className="flex max-h-[70vh] flex-col gap-2.5 overflow-y-auto">
          <Row
            label="Format"
            value={format}
            options={offered.map((entry) => ({ value: entry, label: formatLabel[entry] }))}
            onChange={(value) => update({ format: value })}
          />

          <NumberField
            label="Seconds"
            value={settings.seconds}
            onChange={(seconds) => update({ seconds })}
            range={range.seconds}
            step={0.5}
            presets={chips.seconds}
            presetLabel={(value) => (value === 0 ? "Still" : `${trim(value)}s`)}
            suffix="s"
            disabled={format === "png"}
          />

          <NumberField
            label="Rate"
            value={settings.fps}
            onChange={(fps) => update({ fps })}
            range={range.fps}
            presets={chips.fps}
            suffix="fps"
            disabled={still}
          />

          <NumberField
            label="Frames"
            value={frames}
            // Frames are seconds and rate seen from the other side: asking for
            // 90 of them at 30 fps is asking for three seconds.
            onChange={(count) => update({ seconds: clamp(count / settings.fps, range.seconds) })}
            range={[1, range.frames]}
            disabled={still}
            hint={capped ? `Capped at ${range.frames}` : undefined}
          />

          <NumberField
            label="Scale"
            value={settings.scale}
            onChange={(scale) => update({ scale })}
            range={range.scale}
            step={0.25}
            presets={chips.scale}
            presetLabel={(value) => `${trim(value)}×`}
            suffix="×"
            hint={pixels ?? undefined}
          />

          {format === "webp" ? (
            <NumberField
              label="Quality"
              value={Math.round(settings.quality * 100)}
              onChange={(quality) => update({ quality: clamp(quality, [1, 100]) / 100 })}
              range={[1, 100]}
              suffix="%"
            />
          ) : null}

          {!still ? (
            <NumberField
              label="Loop"
              value={settings.loop}
              onChange={(loop) => update({ loop })}
              range={[0, 65535]}
              hint={settings.loop === 0 ? "0 repeats forever" : undefined}
            />
          ) : null}

          <Row
            label="Ground"
            value={settings.ground}
            options={[
              { value: "page" as ExportGround, label: "Page" },
              { value: "none" as ExportGround, label: "None" },
              { value: "custom" as ExportGround, label: "Colour" },
            ]}
            onChange={(value) => update({ ground: value })}
          />
          {settings.ground === "custom" ? (
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Colour
              </span>
              <span className="flex items-center gap-1">
                <input
                  type="color"
                  aria-label="Ground colour"
                  value={/^#[0-9a-f]{6}$/i.test(settings.groundColor) ? settings.groundColor : "#ffffff"}
                  onChange={(event) => update({ groundColor: event.target.value })}
                  className="size-6 cursor-pointer rounded-sm border border-border bg-background"
                />
                <input
                  type="text"
                  aria-label="Ground colour value"
                  value={settings.groundColor}
                  onChange={(event) => update({ groundColor: event.target.value })}
                  className={cn(fieldClass, "w-24 text-left")}
                />
              </span>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <label className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Name
            </label>
            <span className="flex items-center gap-1">
              <input
                type="text"
                aria-label="File name"
                value={stem}
                onChange={(event) => setStem(event.target.value)}
                className={cn(fieldClass, "w-32 text-left")}
              />
              <span className="w-10 font-mono text-[10px] text-muted-foreground">
                .{format}
              </span>
            </span>
          </div>

          {places.length > 1 ? (
            <Row
              label="To"
              value={place.id}
              options={places.map((entry) => ({ value: entry.id, label: entry.label }))}
              onChange={setPlaceId}
            />
          ) : null}

          <Button size="sm" disabled={busy} onClick={() => void record()} className="mt-0.5 w-full">
            {busy ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Recording {Math.round((progress ?? 0) * 100)}%
              </>
            ) : (
              <>
                <Download className="size-3.5" />
                {still
                  ? `Save ${formatLabel[format]}`
                  : `Record ${trim(length)}s ${formatLabel[format]}`}
              </>
            )}
          </Button>

          <p className="font-mono text-[10px] text-muted-foreground">
            {still
              ? `One frame${pixels ? ` · ${pixels}` : ""}`
              : `${frames} frames at ${trim(settings.fps)} fps${pixels ? ` · ${pixels}` : ""}`}
          </p>

          {/* Real time is the only way to record a `requestAnimationFrame` loop,
              and a person watching a frozen button deserves to know why. */}
          {busy && !still ? (
            <p className="font-mono text-[10px] text-muted-foreground">
              Recording in real time — keep this tab in front.
            </p>
          ) : null}
          {done ? (
            <p className="flex items-start gap-1 font-mono text-[10px] text-muted-foreground">
              <Check className="mt-px size-3 shrink-0" />
              <span className="break-all">{done}</span>
            </p>
          ) : null}
          {error ? <p className="font-mono text-[10px] text-destructive">{error}</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export interface RobotExportProps extends React.ComponentProps<"div"> {
  /** File stem for whatever is saved. */
  name?: string
  /** Record something other than this wrapper — a ref to the machine itself. */
  target?: ExportTarget
  formats?: ExportFormat[]
  defaults?: Partial<ExportSettings>
  limits?: Partial<ExportLimits>
  presets?: ExportPresets
  /** Keep the button on screen rather than revealing it on hover or focus. */
  alwaysVisible?: boolean
  /** Which top corner the button sits in. */
  corner?: "start" | "end"
  /** Where the file may go. Defaults to the browser's download. */
  destinations?: ExportDestination[]
}

/**
 * Wrap a machine to give it an export path.
 *
 * The button is marked `data-robocn-hide`, which the snapshotter drops from the
 * clone — otherwise every recording would have a record button in the corner
 * of it.
 */
function RobotExport({
  name = "robocn",
  target,
  formats,
  defaults,
  limits,
  presets,
  alwaysVisible = false,
  corner = "end",
  destinations,
  className,
  children,
  ...props
}: RobotExportProps) {
  const own = React.useRef<HTMLDivElement>(null)
  return (
    <div
      ref={own}
      className={cn("group/export relative", className)}
      {...props}
    >
      {children}
      <div
        data-robocn-hide=""
        className={cn(
          "absolute top-2 z-10 transition-opacity",
          corner === "end" ? "right-2" : "left-2",
          alwaysVisible
            ? "opacity-100"
            : "opacity-0 group-hover/export:opacity-100 focus-within:opacity-100",
        )}
      >
        <ExportMenu
          target={target ?? (() => own.current)}
          name={name}
          formats={formats}
          defaults={defaults}
          limits={limits}
          presets={presets}
          destinations={destinations}
        />
      </div>
    </div>
  )
}

export { ExportMenu, NumberField, RobotExport }
