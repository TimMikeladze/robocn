"use client"

/**
 * The workbench.
 *
 * A Storybook for robots, run from this repository's own source. There is no
 * agent in it and nothing is compiled: the machine on the stage is the real
 * module from `src/components/ui`, so an edit — yours, Claude's, Codex's —
 * lands through Fast Refresh without a reload and without losing the pose.
 *
 * State lives in the query string, so a pose can be reloaded, bookmarked, or
 * pasted to someone else. Notes: `docs/workbench.md`.
 *
 * It can also hold a folder. With one open the source panel becomes an editor,
 * `New` writes the file itself, a recording can land in `docs/screenshots`, and
 * a machine that exists on disk but not in the manifest is noticed without
 * anyone pressing rescan. That is `docs/checkout.md`; none of it changes what
 * is on the stage, which is still a module Fast Refresh swapped.
 */

import * as React from "react"
import {
  Columns3,
  Frame,
  Grid2X2,
  Maximize2,
  Pause,
  Play,
  HelpCircle,
  Plus,
  RefreshCw,
  Shuffle,
  SquareCode,
  SquareDashed,
  ZoomIn,
  ZoomOut,
} from "lucide-react"

import { ExportMenu, type ExportDestination } from "@/components/ui/robot-export"
import { CheckoutProvider, useCheckout } from "@/components/workbench/checkout"
import { CheckoutButton } from "@/components/workbench/checkout-button"
import { ComponentList } from "@/components/workbench/component-list"
import { ControlsPanel } from "@/components/workbench/controls-panel"
import { Matrix, axisValues } from "@/components/workbench/matrix"
import { NewRobot } from "@/components/workbench/new-robot"
import { SETUP_SEEN_KEY, SetupGuide } from "@/components/workbench/setup-guide"
import { SourcePanel } from "@/components/workbench/source-panel"
import {
  RobotRender,
  Stage,
  axisControls,
  stageBackgrounds,
  type ActionCall,
  type StageBackground,
} from "@/components/workbench/stage"
import {
  drivable,
  fallbackValue,
  isRobotSource,
  readPose,
  workbenchComponent,
  workbenchComponentList,
  writePose,
  type Pose,
  type WorkbenchComponent,
} from "@/lib/workbench/controls"
import { cn } from "@/lib/utils"

/**
 * What opens when the URL names no machine: the animatronic face, which moves
 * on its own and has a knob for every part of it — the machine that shows what
 * the bench is for. Falls back to the first in the manifest if it is ever gone.
 */
const DEFAULT_COMPONENT = "animatronic-face"
const FALLBACK =
  (workbenchComponent(DEFAULT_COMPONENT) ?? workbenchComponentList[0])?.id ?? DEFAULT_COMPONENT

const zooms = [0.25, 0.4, 0.6, 0.8, 1, 1.25, 1.5, 2, 3]

/** Browser state, read the way React wants browser state read. */
const noSubscribe = () => () => {}
const setupSeen = () => {
  try {
    return window.localStorage.getItem(SETUP_SEEN_KEY) === "1"
  } catch {
    // Private browsing: the guide is a one-off, not worth nagging about.
    return true
  }
}
const servedLocally = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)

const button =
  "inline-flex h-7 items-center gap-1.5 rounded-sm border border-transparent px-2 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground aria-pressed:border-border aria-pressed:bg-foreground aria-pressed:text-background disabled:opacity-40"

/** The first two axes worth showing: whatever the component actually varies by. */
function defaultAxes(component: WorkbenchComponent) {
  const available = axisControls(component)
  const preferred = ["variant", "view", "behavior", "tool", "size"]
  const ranked = [...available].sort(
    (a, b) =>
      (preferred.indexOf(a.name) + 1 || 99) - (preferred.indexOf(b.name) + 1 || 99),
  )
  return { x: ranked[0]?.name ?? "", y: ranked[1]?.name ?? "" }
}

export interface WorkbenchProps {
  /** The query string as the server saw it, so the first paint matches the URL. */
  initialQuery: Record<string, string | string[] | undefined>
}

function Bench({ initialQuery }: WorkbenchProps) {
  const params = React.useMemo(() => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(initialQuery)) {
      if (typeof value === "string") search.set(key, value)
      else if (Array.isArray(value) && value[0]) search.set(key, value[0])
    }
    return search
  }, [initialQuery])

  const [id, setId] = React.useState(() =>
    workbenchComponent(params.get("c")) ? params.get("c")! : FALLBACK,
  )
  const component = workbenchComponent(id) ?? workbenchComponent(FALLBACK)!
  const [pose, setPose] = React.useState<Pose>(() => readPose(params, component.controls))
  const [query, setQuery] = React.useState("")
  const [matrix, setMatrix] = React.useState(params.get("mode") === "matrix")
  const [axes, setAxes] = React.useState(() => ({
    x: params.get("x") ?? defaultAxes(component).x,
    y: params.get("y") ?? defaultAxes(component).y,
  }))
  const [background, setBackground] = React.useState<StageBackground>(
    () =>
      (stageBackgrounds.find((entry) => entry.id === params.get("bg"))?.id ??
        "grid") as StageBackground,
  )
  const [zoom, setZoom] = React.useState(() => Number(params.get("zoom")) || 1)
  const [outline, setOutline] = React.useState(params.get("outline") === "1")
  // Handoff is the point of the tool, so the panel is open unless the URL says
  // otherwise. `panel=none` is what a closed one writes; `panel=source` still
  // reads as open, because links from before the default flipped say that.
  const [sourceOpen, setSourceOpen] = React.useState(params.get("panel") !== "none")
  const [exportOpen, setExportOpen] = React.useState(false)
  const [listOpen, setListOpen] = React.useState(false)
  // The guide opens itself once, for someone who has never seen the loop. After
  // that the `?` key and the toolbar are the ways back in — and `?setup=1` or
  // `?setup=0` says it outright, which is how a link to the guide, and a
  // screenshot of the tool without it, are both possible.
  const seen = React.useSyncExternalStore(noSubscribe, setupSeen, () => true)
  const local = React.useSyncExternalStore(noSubscribe, servedLocally, () => false)
  const asked = params.get("setup")
  const [guide, setGuide] = React.useState<boolean | null>(
    asked === "1" ? true : asked === "0" ? false : null,
  )
  const guideOpen = guide ?? !seen
  const [creating, setCreating] = React.useState(params.get("new") === "1")
  const [scanning, setScanning] = React.useState(false)
  const [scanMessage, setScanMessage] = React.useState("")
  const [actions, setActions] = React.useState<ActionCall[]>([])
  /** Seconds since the machine last drew — the status bar's heartbeat. */
  const [since, setSince] = React.useState(0)
  const checkout = useCheckout()

  const searchInput = React.useRef<HTMLInputElement>(null)
  /** Calls arrive as fast as the machine moves; the panel updates four times a second. */
  const pending = React.useRef<ActionCall[]>([])
  const nextCall = React.useRef(1)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const lastRender = React.useRef(0)

  const pausedControl = component.controls.find(
    (control) => control.name === "paused" && control.kind === "boolean",
  )
  const paused = pausedControl ? pose.paused === true : false

  /** The whole workbench as a query string: the component, the pose, the stage. */
  const search = React.useMemo(() => {
    const next = new URLSearchParams()
    next.set("c", component.id)
    if (matrix) next.set("mode", "matrix")
    if (matrix && axes.x) next.set("x", axes.x)
    if (matrix && axes.y) next.set("y", axes.y)
    if (background !== "grid") next.set("bg", background)
    if (zoom !== 1) next.set("zoom", String(zoom))
    if (outline) next.set("outline", "1")
    if (!sourceOpen) next.set("panel", "none")
    return writePose(next, pose).toString()
  }, [component.id, pose, matrix, axes, background, zoom, outline, sourceOpen])

  // The URL is the pose. Written with `replaceState` rather than the router so
  // dragging a slider does not push a hundred history entries or re-render the
  // tree from the top.
  React.useEffect(() => {
    window.history.replaceState(null, "", `?${search}`)
  }, [search])

  // The "rendered Ns ago" readout. `RobotRender` stamps the ref on every render
  // it does, including the ones Fast Refresh causes, and the interval reads it —
  // so a save by an agent shows up here within a second of landing on the stage.
  React.useEffect(() => {
    const timer = window.setInterval(
      // Zero means nothing has reported a render yet — matrix cells do not —
      // so the readout stays at "just now" rather than counting from the epoch.
      () => setSince(lastRender.current ? Math.round((Date.now() - lastRender.current) / 1000) : 0),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [])

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      if (!pending.current.length) return
      const batch = pending.current
      pending.current = []
      setActions((current) => [...batch, ...current].slice(0, 50))
    }, 250)
    return () => window.clearInterval(timer)
  }, [])

  const select = React.useCallback((next: string) => {
    setId(next)
    setPose({})
    pending.current = []
    setActions([])
    const chosen = workbenchComponent(next)
    if (chosen) setAxes(defaultAxes(chosen))
  }, [])

  const shuffle = () => {
    const next: Pose = { ...pose }
    for (const control of component.controls) {
      if (!drivable(control) || control.kind === "color" || control.kind === "text") continue
      if (control.kind === "enum" || control.kind === "size") {
        const options = control.options ?? []
        next[control.name] = options[Math.floor(Math.random() * options.length)] ?? fallbackValue(control)
      } else if (control.kind === "boolean") {
        next[control.name] = Math.random() > 0.5
      } else if (control.kind === "number") {
        const min = control.min ?? 0
        const max = control.max ?? 1
        const raw = min + Math.random() * (max - min)
        next[control.name] = Number(raw.toFixed(control.step && control.step >= 1 ? 0 : 2))
      }
    }
    setPose(next)
  }

  const step = React.useCallback(
    (direction: 1 | -1) => {
      const index = workbenchComponentList.findIndex((entry) => entry.id === id)
      const next =
        workbenchComponentList[
          (index + direction + workbenchComponentList.length) % workbenchComponentList.length
        ]
      if (next) select(next.id)
    },
    [id, select],
  )

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === "/" && !typing) {
        event.preventDefault()
        searchInput.current?.focus()
        return
      }
      if (typing) return
      if (event.key === "?") setGuide(true)
      if (event.key === "n") setCreating(true)
      if (event.key === "]") step(1)
      if (event.key === "[") step(-1)
      if (event.key === "m") setMatrix((value) => !value)
      if (event.key === "s") setSourceOpen((value) => !value)
      if (event.key === "o") setOutline((value) => !value)
      if (event.key === "e") setExportOpen((value) => !value)
      if (event.key === "g") {
        setBackground((current) => {
          const index = stageBackgrounds.findIndex((entry) => entry.id === current)
          return stageBackgrounds[(index + 1) % stageBackgrounds.length].id
        })
      }
      if (event.key === "p") {
        setPose((current) =>
          component.controls.some((control) => control.name === "paused")
            ? { ...current, paused: !(current.paused === true) }
            : current,
        )
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [component.controls, step])

  /**
   * Re-read the library from disk. The control manifest is a build step, so a
   * component created a minute ago is not in it — this runs the generator, and
   * writing into `src/` brings the new draft in through Fast Refresh.
   */
  const scan = async () => {
    setScanning(true)
    setScanMessage("Reading src/components/ui…")
    try {
      const response = await fetch("/api/workbench/scan", { method: "POST" })
      const body = (await response.json()) as { message?: string; error?: string }
      if (!response.ok) throw new Error(body.error ?? "The scan failed.")
      setScanMessage(body.message ?? "Scanned.")
    } catch (cause) {
      setScanMessage(cause instanceof Error ? cause.message : "The scan failed.")
    } finally {
      setScanning(false)
    }
  }

  /**
   * Machines on disk that the control manifest has never seen.
   *
   * The manifest is a build artefact, so a component written a minute ago is
   * not in it. With a folder open the workbench can see the file directly —
   * and where the generator can be run, run it rather than making someone
   * press a button to be told what the page already knows.
   */
  const strangers = React.useMemo(() => {
    if (!checkout.root) return []
    const known = new Set(workbenchComponentList.map((entry) => entry.file))
    return [...checkout.files]
      .filter(
        ([path, source]) =>
          path.startsWith("src/components/ui/") &&
          path.endsWith(".tsx") &&
          !known.has(path) &&
          isRobotSource(source),
      )
      .map(([path]) => path)
      .sort()
  }, [checkout.files, checkout.root])

  const scanned = React.useRef("")
  React.useEffect(() => {
    if (!local || scanning || strangers.length === 0) return
    const signature = strangers.join("|")
    if (scanned.current === signature) return
    scanned.current = signature
    // `scan` is re-created every render and rescanning is idempotent; the
    // signature ref is what stops this from looping, not the dependency list.
    void scan()
  }, [local, scanning, strangers])

  const svgOf = () => stageRef.current?.querySelector("svg")

  const copySvg = async () => {
    const svg = svgOf()
    if (!svg) return
    await navigator.clipboard.writeText(new XMLSerializer().serializeToString(svg))
  }

  /**
   * Where a recording can go. A held folder adds `docs/screenshots`, which is
   * where a screenshot of a machine was headed anyway.
   */
  const destinations = React.useMemo<ExportDestination[]>(() => {
    const places: ExportDestination[] = [{ id: "download", label: "Download" }]
    if (checkout.root) {
      places.push({
        id: "checkout",
        label: "Folder",
        write: async (blob, filename) => {
          const path = `docs/screenshots/${filename}`
          await checkout.write(path, blob)
          return path
        },
      })
    }
    return places
  }, [checkout])

  const zoomBy = (direction: 1 | -1) => {
    const index = zooms.indexOf(zoom)
    const from = index === -1 ? zooms.findIndex((value) => value >= zoom) : index
    setZoom(zooms[Math.min(zooms.length - 1, Math.max(0, from + direction))] ?? 1)
  }

  const available = axisControls(component)
  const knobs = component.controls.filter((control) => control.kind !== "unsupported").length

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden border-b border-border">
      {/* One row, scrolled rather than wrapped: the stage keeps its height on a
          phone, and nothing pushes the page sideways. */}
      <div className="flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-2">
        <button
          type="button"
          className={cn(button, "lg:hidden")}
          onClick={() => setListOpen((value) => !value)}
          aria-pressed={listOpen}
        >
          <Columns3 className="size-3.5" /> Index
        </button>
        <span className="mr-2 hidden items-baseline gap-2 lg:flex">
          <span className="text-[13px] font-medium">{component.title}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{component.id}</span>
        </span>

        <span className="mx-1 h-4 w-px bg-border" />
        <button
          type="button"
          className={button}
          aria-pressed={creating}
          onClick={() => setCreating(true)}
          title="New component (n)"
        >
          <Plus className="size-3.5" /> New
        </button>
        <button
          type="button"
          className={button}
          aria-pressed={!matrix}
          onClick={() => setMatrix(false)}
          title="Stage (m)"
        >
          <Frame className="size-3.5" /> Stage
        </button>
        <button
          type="button"
          className={button}
          aria-pressed={matrix}
          onClick={() => setMatrix(true)}
          title="Matrix (m)"
          disabled={available.length === 0}
        >
          <Grid2X2 className="size-3.5" /> Matrix
        </button>
        <button
          type="button"
          className={button}
          aria-pressed={sourceOpen}
          onClick={() => setSourceOpen((value) => !value)}
          title="Source and handoff (s)"
        >
          <SquareCode className="size-3.5" /> Handoff
        </button>
        <span className="mx-1 h-4 w-px bg-border" />
        <label className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <span className="sr-only">Stage background</span>
          <select
            value={background}
            onChange={(event) => setBackground(event.target.value as StageBackground)}
            aria-label="Stage background"
            className="h-7 rounded-sm border border-border bg-background px-1.5 font-mono text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {stageBackgrounds.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={button} onClick={() => zoomBy(-1)} title="Zoom out">
          <ZoomOut className="size-3.5" />
        </button>
        <span className="w-10 text-center font-mono text-[11px] text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <button type="button" className={button} onClick={() => zoomBy(1)} title="Zoom in">
          <ZoomIn className="size-3.5" />
        </button>
        <button
          type="button"
          className={button}
          aria-pressed={outline}
          onClick={() => setOutline((value) => !value)}
          title="Draw the bounding box (o)"
        >
          <SquareDashed className="size-3.5" /> Box
        </button>

        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className={button}
            onClick={shuffle}
            title="Shuffle every prop"
          >
            <Shuffle className="size-3.5" /> Shuffle
          </button>
          {pausedControl ? (
            <button
              type="button"
              className={button}
              aria-pressed={paused}
              onClick={() => setPose({ ...pose, paused: !paused })}
              title="Pause motion (p)"
            >
              {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
              {paused ? "Play" : "Pause"}
            </button>
          ) : null}
          <button type="button" className={button} onClick={() => void copySvg()} title="Copy the rendered SVG">
            SVG
          </button>
          {/* The stage, not the SVG: what comes out is the machine, the
              background, the zoom and — in matrix mode — the whole grid. */}
          <ExportMenu
            target={stageRef}
            name={matrix ? `${component.id}-matrix` : component.id}
            label="Export"
            open={exportOpen}
            onOpenChange={setExportOpen}
            destinations={destinations}
          />
          <CheckoutButton className={button} />
          <button
            type="button"
            className={button}
            aria-pressed={guideOpen}
            onClick={() => setGuide(!guideOpen)}
            title="Getting started: run this and connect your agent (?)"
          >
            <HelpCircle className="size-3.5" /> Setup
          </button>
          <button
            type="button"
            className={button}
            title="Fullscreen the stage"
            onClick={() => void stageRef.current?.requestFullscreen?.().catch(() => undefined)}
          >
            <Maximize2 className="size-3.5" />
          </button>
        </span>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        {creating ? (
          <NewRobot
            current={component}
            onClose={() => setCreating(false)}
            onScan={local ? () => void scan() : null}
            scanning={scanning}
            scanMessage={scanMessage}
          />
        ) : null}
        {guideOpen ? (
          <SetupGuide
            local={local}
            onClose={() => {
              setGuide(false)
              try {
                window.localStorage.setItem(SETUP_SEEN_KEY, "1")
              } catch {
                /* Optional; the guide simply opens again next time. */
              }
            }}
          />
        ) : null}
        <aside
          className={cn(
            "w-60 shrink-0 border-r border-border bg-background",
            listOpen ? "absolute inset-y-0 left-0 z-30 flex" : "hidden",
            "lg:relative lg:flex",
          )}
        >
          <div className="flex w-full min-h-0 flex-col">
            <ComponentList
              selected={component.id}
              onSelect={(next) => {
                select(next)
                setListOpen(false)
              }}
              query={query}
              onQueryChange={setQuery}
              searchRef={searchInput}
            />
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          {matrix ? (
            <>
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-1.5">
                {(["x", "y"] as const).map((axis) => (
                  <label
                    key={axis}
                    className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground"
                  >
                    {axis === "x" ? "columns" : "rows"}
                    <select
                      aria-label={axis === "x" ? "Matrix columns" : "Matrix rows"}
                      value={axes[axis]}
                      onChange={(event) => setAxes({ ...axes, [axis]: event.target.value })}
                      className="h-7 rounded-sm border border-border bg-background px-1.5 font-mono text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">none</option>
                      {available.map((control) => (
                        <option key={control.name} value={control.name}>
                          {control.name} ({axisValues(control).length})
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <span className="font-mono text-[11px] text-muted-foreground">
                  every cell is live — drive it here, or send one to the stage from its corner
                </span>
              </div>
              <Matrix
                component={component}
                pose={pose}
                x={axes.x}
                y={axes.y}
                zoom={zoom}
                onCellClick={(next) => {
                  setPose(next)
                  setMatrix(false)
                }}
              />
            </>
          ) : (
            <Stage ref={stageRef} background={background} zoom={zoom} outline={outline}>
              <RobotRender
                component={component}
                pose={pose}
                // A ref, not state: `RobotRender` reports every render it does,
                // and setting state from there would re-render it in turn.
                onRender={() => {
                  lastRender.current = Date.now()
                }}
                onAction={(call) => {
                  pending.current = [{ ...call, id: nextCall.current++ }, ...pending.current]
                  if (pending.current.length > 50) pending.current.length = 50
                }}
              />
            </Stage>
          )}

          {sourceOpen ? (
            // Capped as a fraction too: on a laptop the stage, and the whole
            // matrix, matter more than a taller paste box.
            <div className="h-80 max-h-[45%] shrink-0 overflow-hidden">
              <SourcePanel component={component} pose={pose} search={search} />
            </div>
          ) : null}

          <div className="flex h-7 shrink-0 items-center gap-3 border-t border-border px-3 font-mono text-[11px] text-muted-foreground">
            {component.draft ? (
              <span className="rounded-sm border border-border px-1.5 text-foreground">draft</span>
            ) : null}
            <span className="truncate">{component.file}</span>
            <span className="hidden sm:inline">{component.export}</span>
            <span className="hidden md:inline">{knobs} controls</span>
            {strangers.length ? (
              <span
                className="hidden rounded-sm border border-border px-1.5 text-foreground lg:inline"
                title={strangers.join("\n")}
              >
                {strangers.length} on disk, not in the manifest
              </span>
            ) : null}
            {local ? (
              <button
                type="button"
                onClick={() => void scan()}
                disabled={scanning}
                title="Re-read src/components/ui. Picks up a component created since this page loaded."
                className="ml-auto inline-flex items-center gap-1 rounded-sm px-1.5 transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw className={cn("size-3", scanning && "animate-spin")} />
                {scanning ? "scanning" : "rescan"}
              </button>
            ) : null}
            <span className={cn("flex items-center gap-1.5", local ? "" : "ml-auto")}>
              <i
                className={cn(
                  "size-1.5 rounded-full",
                  since < 3 ? "bg-emerald-500" : "bg-muted-foreground/50",
                )}
              />
              {since < 2 ? "rendered just now" : `rendered ${since}s ago`}
            </span>
          </div>
        </main>

        <aside className="flex h-64 w-full shrink-0 flex-col border-t border-border md:h-auto md:w-80 md:border-l md:border-t-0">
          <ControlsPanel
            component={component}
            pose={pose}
            onChange={setPose}
            actions={actions}
            onClearActions={() => setActions([])}
          />
        </aside>
      </div>
    </div>
  )
}

/**
 * One checkout for the page. The provider is here rather than in the route so
 * the whole feature — the button, the editor, the writer — lives in one folder.
 */
function Workbench(props: WorkbenchProps) {
  return (
    <CheckoutProvider>
      <Bench {...props} />
    </CheckoutProvider>
  )
}

export { Workbench }
