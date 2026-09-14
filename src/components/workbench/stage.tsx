"use client"

/**
 * The stage: the ground a machine is drawn on, and the boundary that keeps a
 * half-finished edit from taking the whole tool down with it.
 *
 * Components are the real modules from `src/components/ui`, mounted behind a
 * lazy boundary. When Claude, Codex or you save that file, Fast Refresh swaps
 * the module and the machine redraws in place — that is the loop this whole
 * page exists for, so the error boundary resets on every new module rather than
 * latching, and an error is reported as *the file as it stands*, not a crash.
 */

import * as React from "react"

import { workbenchComponents } from "@/components/workbench/registry.generated"
import {
  drivable,
  resolvedPose,
  type Pose,
  type WorkbenchComponent,
} from "@/lib/workbench/controls"
import { cn } from "@/lib/utils"

export type StageBackground = "panel" | "grid" | "blueprint" | "dark" | "checker"

export const stageBackgrounds: { id: StageBackground; label: string }[] = [
  { id: "panel", label: "Panel" },
  { id: "grid", label: "Grid" },
  { id: "blueprint", label: "Blueprint" },
  { id: "checker", label: "Checker" },
  { id: "dark", label: "Dark" },
]

const backgroundStyle: Record<StageBackground, React.CSSProperties> = {
  panel: {},
  grid: {
    backgroundImage:
      "radial-gradient(color-mix(in oklab, var(--muted-foreground) 45%, transparent) 1px, transparent 1px)",
    backgroundSize: "16px 16px",
  },
  blueprint: {
    background: "oklch(0.31 0.07 250)",
    backgroundImage:
      "linear-gradient(color-mix(in oklab, white 16%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, white 16%, transparent) 1px, transparent 1px)",
    backgroundSize: "24px 24px",
    color: "white",
  },
  checker: {
    backgroundImage:
      "conic-gradient(color-mix(in oklab, var(--muted-foreground) 22%, transparent) 0 25%, transparent 0 50%, color-mix(in oklab, var(--muted-foreground) 22%, transparent) 0 75%, transparent 0)",
    backgroundSize: "20px 20px",
  },
  dark: {},
}

export interface ActionCall {
  id: number
  name: string
  detail: string
  at: number
}

const describe = (argument: unknown): string => {
  if (argument === null || argument === undefined) return String(argument)
  if (typeof argument === "number") return String(Math.round(argument * 1000) / 1000)
  if (typeof argument === "object") {
    try {
      return JSON.stringify(argument, (_key, value) =>
        typeof value === "number" ? Math.round(value * 1000) / 1000 : value,
      ).slice(0, 120)
    } catch {
      return "[object]"
    }
  }
  return String(argument)
}

class RenderBoundary extends React.Component<
  { resetKey: string; children: React.ReactNode },
  { message: string | null }
> {
  state = { message: null as string | null }

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) }
  }

  componentDidUpdate(previous: { resetKey: string }) {
    // A new module, or a new pose, deserves a fresh attempt: the usual reason
    // this boundary caught anything is that the file was mid-edit.
    if (previous.resetKey !== this.props.resetKey && this.state.message) {
      this.setState({ message: null })
    }
  }

  render() {
    if (this.state.message === null) return this.props.children
    return (
      <div className="max-w-md p-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-destructive">
          Render failed
        </p>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-left font-mono text-[11px] text-muted-foreground">
          {this.state.message}
        </pre>
        <p className="mt-3 text-[12px] text-muted-foreground">
          Save the file again and this redraws itself.
        </p>
      </div>
    )
  }
}

export interface RobotRenderProps {
  component: WorkbenchComponent
  pose: Pose
  /** Called after every render, including the ones Fast Refresh causes. */
  onRender?: () => void
  onAction?: (call: Omit<ActionCall, "id">) => void
}

/** One machine, handed the pose on the panel. */
function RobotRender({ component, pose, onRender, onAction }: RobotRenderProps) {
  const Component = workbenchComponents[component.id]
  const report = React.useRef(onAction)
  React.useEffect(() => {
    report.current = onAction
  })
  // The handlers have to keep their identity between renders. A component that
  // reports from an effect — `onPose`, `onTargetChange` — depends on the
  // callback it was given, so a fresh closure every render is a re-render loop.
  const handlers = React.useMemo(() => {
    const map: Record<string, (...args: unknown[]) => void> = {}
    for (const control of component.controls) {
      if (control.kind !== "action") continue
      map[control.name] = (...args: unknown[]) =>
        report.current?.({
          name: control.name,
          detail: args.map(describe).join(", "),
          at: Date.now(),
        })
    }
    return map
  }, [component.controls])
  const props = { ...(resolvedPose(component, pose) as Record<string, unknown>), ...handlers }
  // No dependency list on purpose: this fires for a Fast Refresh re-render too,
  // which is what the "updated just now" readout in the status bar is counting.
  React.useEffect(() => {
    onRender?.()
  })
  if (!Component) {
    return <p className="font-mono text-[12px] text-muted-foreground">No component for {component.id}.</p>
  }
  return (
    <RenderBoundary resetKey={`${component.id}:${JSON.stringify(pose)}`}>
      <React.Suspense
        fallback={
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Loading {component.id}…
          </p>
        }
      >
        <Component {...props} />
      </React.Suspense>
    </RenderBoundary>
  )
}

export interface StageProps extends React.ComponentProps<"div"> {
  background: StageBackground
  zoom: number
  /** Draw each SVG's own box, the way a drawing carries its frame. */
  outline: boolean
}

/** The ground, the zoom and the frame marks. The machine is `children`. */
function Stage({ background, zoom, outline, className, children, ...props }: StageProps) {
  return (
    <div
      data-background={background}
      className={cn(
        "relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-panel",
        background === "dark" && "dark bg-background",
        outline && "[&_svg]:outline [&_svg]:outline-dashed [&_svg]:outline-current/25",
        className,
      )}
      style={backgroundStyle[background]}
      {...props}
    >
      <div
        className="flex items-center justify-center p-6 transition-transform duration-150"
        style={{ transform: `scale(${zoom})` }}
      >
        {children}
      </div>
    </div>
  )
}

/** Controls that can define an axis of the matrix: a finite set of values. */
export const axisControls = (component: WorkbenchComponent) =>
  component.controls.filter(
    (control) =>
      drivable(control) &&
      (control.kind === "enum" || control.kind === "size" || control.kind === "boolean"),
  )

export { RobotRender, Stage }
