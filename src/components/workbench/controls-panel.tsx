"use client"

/**
 * The knobs.
 *
 * Nothing here is written per component: every row is a `Control` the build
 * step read out of the component's own props interface, so a prop added to a
 * robot appears as a widget the next time `pnpm generate` runs, with its doc
 * comment as the help text and its destructuring default as the starting
 * value. Notes: `docs/workbench.md`.
 */

import * as React from "react"
import { RotateCcw, Zap } from "lucide-react"

import type { ActionCall } from "@/components/workbench/stage"
import {
  drivable,
  fallbackValue,
  type Control,
  type ControlGroup,
  type Pose,
  type PropValue,
  type WorkbenchComponent,
} from "@/lib/workbench/controls"
import { cn } from "@/lib/utils"

const groupOrder: { id: ControlGroup; label: string }[] = [
  { id: "frame", label: "Frame" },
  { id: "shape", label: "Shape" },
  { id: "motion", label: "Motion" },
  { id: "palette", label: "Palette" },
]

const field =
  "h-7 w-full rounded-sm border border-border bg-background px-2 font-mono text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring"

const chip =
  "h-7 flex-1 min-w-9 rounded-sm border border-border px-1.5 font-mono text-[11px] leading-none transition-colors hover:bg-accent data-[on=true]:border-foreground data-[on=true]:bg-foreground data-[on=true]:text-background"

function Row({
  control,
  set,
  clear,
  children,
}: {
  control: Control
  set: boolean
  clear: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-border/60 px-3 py-2 last:border-b-0">
      <div className="flex items-baseline justify-between gap-2">
        <label
          className="font-mono text-[11px] text-foreground"
          title={`${control.name}?: ${control.type}`}
          htmlFor={`control-${control.name}`}
        >
          {control.name}
          {set ? <span className="ml-1 text-[10px] text-muted-foreground">set</span> : null}
        </label>
        {set ? (
          <button
            type="button"
            onClick={clear}
            aria-label={`Reset ${control.name}`}
            className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="size-3" />
          </button>
        ) : null}
      </div>
      <div className="mt-1.5">{children}</div>
      {control.doc ? (
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{control.doc}</p>
      ) : null}
    </div>
  )
}

function Widget({
  control,
  value,
  onChange,
}: {
  control: Control
  value: PropValue
  onChange: (value: PropValue) => void
}) {
  const id = `control-${control.name}`
  switch (control.kind) {
    case "boolean":
      return (
        <button
          type="button"
          id={id}
          role="switch"
          aria-checked={value === true}
          aria-label={control.name}
          onClick={() => onChange(!(value === true))}
          className={cn(
            "flex h-6 w-11 items-center rounded-full border border-border p-0.5 transition-colors",
            value === true ? "bg-foreground" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "size-4 rounded-full bg-background transition-transform",
              value === true && "translate-x-5",
            )}
          />
        </button>
      )
    case "enum":
    case "size": {
      const options = control.options ?? []
      if (options.length <= 5) {
        return (
          <div className="flex flex-wrap gap-1" role="group" aria-label={control.name} id={id}>
            {options.map((option) => (
              <button
                key={String(option)}
                type="button"
                data-on={value === option}
                className={chip}
                onClick={() => onChange(option)}
              >
                {String(option)}
              </button>
            ))}
          </div>
        )
      }
      return (
        <select
          id={id}
          aria-label={control.name}
          className={field}
          value={String(value)}
          onChange={(event) =>
            onChange(control.numeric ? Number(event.target.value) : event.target.value)
          }
        >
          {options.map((option) => (
            <option key={String(option)} value={String(option)}>
              {String(option)}
            </option>
          ))}
        </select>
      )
    }
    case "number": {
      const numeric = typeof value === "number" ? value : Number(value) || 0
      return (
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="range"
            aria-label={control.name}
            className="h-5 flex-1 accent-foreground"
            min={control.min}
            max={control.max}
            step={control.step}
            value={numeric}
            onChange={(event) => onChange(Number(event.target.value))}
          />
          <input
            type="number"
            aria-label={`${control.name} value`}
            className={cn(field, "w-18 shrink-0")}
            step={control.step}
            value={numeric}
            onChange={(event) => onChange(Number(event.target.value))}
          />
        </div>
      )
    }
    case "color":
      return (
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="color"
            aria-label={control.name}
            className="size-7 shrink-0 cursor-pointer rounded-sm border border-border bg-background"
            value={/^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : "#f38b4a"}
            onChange={(event) => onChange(event.target.value)}
          />
          <input
            type="text"
            aria-label={`${control.name} value`}
            className={field}
            value={String(value)}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      )
    default:
      return (
        <input
          id={id}
          type="text"
          aria-label={control.name}
          className={field}
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
        />
      )
  }
}

export interface ControlsPanelProps {
  component: WorkbenchComponent
  pose: Pose
  onChange: (pose: Pose) => void
  actions: ActionCall[]
  onClearActions: () => void
}

function ControlsPanel({
  component,
  pose,
  onChange,
  actions,
  onClearActions,
}: ControlsPanelProps) {
  const set = (name: string, value: PropValue) => onChange({ ...pose, [name]: value })
  const clear = (name: string) => {
    const next = { ...pose }
    delete next[name]
    onChange(next)
  }
  const sections = groupOrder
    .map((group) => ({
      ...group,
      controls: component.controls.filter(
        (control) => control.group === group.id && drivable(control),
      ),
    }))
    .filter((group) => group.controls.length > 0)
  const fixed = component.controls.filter((control) => control.kind === "unsupported")
  const actionControls = component.controls.filter((control) => control.kind === "action")

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {component.props ?? "Props"}
        </span>
        <button
          type="button"
          onClick={() => onChange({})}
          disabled={Object.keys(pose).length === 0}
          className="rounded-sm px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          Reset all
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {sections.map((section) => (
          <section key={section.id}>
            <h3 className="sticky top-0 z-10 border-b border-border bg-muted/70 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur">
              {section.label}
            </h3>
            {section.controls.map((control) => (
              <Row
                key={control.name}
                control={control}
                set={pose[control.name] !== undefined}
                clear={() => clear(control.name)}
              >
                <Widget
                  control={control}
                  value={pose[control.name] ?? fallbackValue(control)}
                  onChange={(value) => set(control.name, value)}
                />
              </Row>
            ))}
          </section>
        ))}

        {actionControls.length > 0 ? (
          <section>
            <h3 className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-muted/70 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur">
              <span>Callbacks</span>
              {actions.length > 0 ? (
                <button type="button" onClick={onClearActions} className="hover:text-foreground">
                  clear
                </button>
              ) : null}
            </h3>
            <div className="px-3 py-2">
              <p className="text-[11px] leading-snug text-muted-foreground">
                {actionControls.map((control) => control.name).join(", ")} — calls are logged
                here as the machine makes them.
              </p>
              <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto font-mono text-[11px]">
                {actions.length === 0 ? (
                  <li className="text-muted-foreground">No calls yet.</li>
                ) : (
                  actions.map((call) => (
                    <li key={call.id} className="flex gap-2">
                      <Zap className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        <span className="text-foreground">{call.name}</span>
                        <span className="text-muted-foreground">({call.detail})</span>
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </section>
        ) : null}

        {fixed.length > 0 ? (
          <section>
            <h3 className="sticky top-0 z-10 border-b border-border bg-muted/70 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur">
              Not adjustable here
            </h3>
            <ul className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
              {fixed.map((control) => (
                <li key={control.name} className="truncate" title={control.type}>
                  {control.name}: {control.type}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}

export { ControlsPanel }
