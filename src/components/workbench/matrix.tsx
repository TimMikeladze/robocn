"use client"

/**
 * Matrix mode: one machine drawn across the cross product of two of its props.
 *
 * Every variant against every camera view, every gait against every tool. It
 * is the view that catches the pose which is only wrong from the back, and the
 * reason the workbench derives controls at all — the axes are just the props
 * that happen to have a finite set of values.
 *
 * The grid sizes itself to the pane it is given rather than to a fixed cell, so
 * a 4x4 of an animal and a 2x8 of a droid both arrive whole. Zoom multiplies
 * that fit: 100% is "show me everything", and past it the grid scrolls.
 *
 * Every cell is a live machine, not a picture of one, so the pointer belongs to
 * the machine: drag it, aim it, watch all sixteen react at once. Sending one to
 * the stage is the button in its corner.
 */

import * as React from "react"
import { Frame } from "lucide-react"

import { RobotRender, axisControls } from "@/components/workbench/stage"
import type { Control, Pose, PropValue, WorkbenchComponent } from "@/lib/workbench/controls"
import { cn } from "@/lib/utils"

export const axisValues = (control: Control): PropValue[] =>
  control.kind === "boolean" ? [false, true] : (control.options ?? [])

/** What a cell costs beyond the drawing: the button's box, and the td's padding. */
const CELL_BOX = 24
const TD_PADDING = 8
/** Each row draws one; a column does not. */
const ROW_BORDER = 1
/** The pane's own `p-4`. */
const PANE_PADDING = 32
/** Below this a machine is a smudge; past it one cell is a poster. */
const MIN_CELL = 48
const MAX_CELL = 240
/** What a cell is worth before the pane has been measured — server, and jsdom. */
const DEFAULT_CELL = 140

export interface FitCell {
  /** The pane's content box. Zero before the first measurement. */
  width: number
  height: number
  columns: number
  rows: number
  /** The label column and the label row, measured rather than guessed: both are
   *  text, so neither moves when the cell does. */
  label: number
  header: number
  zoom: number
}

/**
 * The cell size that makes the whole cross product fit.
 *
 * Both axes are solved and the tighter one wins, because a grid that fits
 * across but not down is still a grid you have to scroll. Zoom is applied
 * afterwards: it is a multiplier on the fit, not a size of its own.
 */
export function fitCell({
  width,
  height,
  columns,
  rows,
  label,
  header,
  zoom,
}: FitCell): number {
  if (!width || !height || !columns || !rows) return Math.round(DEFAULT_CELL * zoom)
  const across = (width - PANE_PADDING - label) / columns - CELL_BOX - TD_PADDING
  const down = (height - PANE_PADDING - header) / rows - CELL_BOX - TD_PADDING - ROW_BORDER
  // Floored, not rounded: half a pixel per cell is four pixels of scrollbar
  // across eight rows, and the whole point is that nothing is cut off.
  const fitted = Math.floor(Math.min(across, down, MAX_CELL))
  return Math.round(Math.max(fitted, MIN_CELL) * zoom)
}

/**
 * The pane, and the chrome inside it that the cells do not get.
 *
 * Measured on every resize — the window, the source panel opening, the index
 * collapsing. The label column and header row are text, so measuring them is
 * not circular: they are the same width whatever size the cells end up.
 */
function useGridBox() {
  const pane = React.useRef<HTMLDivElement>(null)
  const label = React.useRef<HTMLTableCellElement>(null)
  const header = React.useRef<HTMLTableRowElement>(null)
  const [box, setBox] = React.useState({ width: 0, height: 0, label: 0, header: 0 })

  React.useLayoutEffect(() => {
    const node = pane.current
    // jsdom, and any browser without the observer: the default cell stands and
    // the grid scrolls, which is what it did before it could fit.
    if (!node || typeof ResizeObserver === "undefined") return
    const measure = () =>
      setBox((current) => {
        const next = {
          width: node.clientWidth,
          height: node.clientHeight,
          label: label.current?.getBoundingClientRect().width ?? 0,
          header: header.current?.getBoundingClientRect().height ?? 0,
        }
        return current.width === next.width &&
          current.height === next.height &&
          current.label === next.label &&
          current.header === next.header
          ? current
          : next
      })
    measure()
    // The pane for the room, the label column for the gutter: an axis with
    // longer names widens it, and the cells have to give that width back.
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    if (label.current) observer.observe(label.current)
    return () => observer.disconnect()
  }, [])

  return [box, { pane, label, header }] as const
}

export interface MatrixProps {
  component: WorkbenchComponent
  pose: Pose
  x: string
  y: string
  /** A multiplier on the fitted cell, from the toolbar. 1 is the whole grid. */
  zoom: number
  /** The corner button, not the cell: clicking a machine drives the machine. */
  onCellClick?: (pose: Pose) => void
}

function Matrix({ component, pose, x, y, zoom, onCellClick }: MatrixProps) {
  const [box, { pane: paneRef, label: labelRef, header: headerRef }] = useGridBox()
  const available = axisControls(component)
  const columnControl = available.find((control) => control.name === x) ?? null
  const rowControl = available.find((control) => control.name === y) ?? null
  const columns = columnControl ? axisValues(columnControl) : [null]
  const rows = rowControl ? axisValues(rowControl) : [null]
  const sizeable = component.controls.some(
    (control) => control.kind === "size" && control.name !== x && control.name !== y,
  )
  const cell = fitCell({
    ...box,
    columns: columns.length,
    rows: rows.length,
    zoom,
  })

  const poseFor = (column: PropValue | null, row: PropValue | null): Pose => ({
    ...pose,
    ...(sizeable ? { size: cell } : null),
    ...(columnControl && column !== null ? { [columnControl.name]: column } : null),
    ...(rowControl && row !== null ? { [rowControl.name]: row } : null),
  })

  /**
   * The cell's pose, minus the grid's own doing.
   *
   * `size` here is whatever made sixteen of them fit; the stage is one machine
   * on a whole pane, so it keeps the size the workbench was already showing.
   */
  const stagePose = (cellPose: Pose): Pose => {
    const next = { ...cellPose }
    if (pose.size === undefined) delete next.size
    else next.size = pose.size
    return next
  }

  return (
    // `m-auto` rather than `justify-center`: auto margins collapse to zero once
    // the grid is wider than the pane, so a big matrix still scrolls from its
    // first column instead of having it cut off.
    <div ref={paneRef} className="flex min-h-0 flex-1 overflow-auto p-4">
      <table className="m-auto border-separate border-spacing-0">
        <thead>
          <tr ref={headerRef}>
            <th
              ref={labelRef}
              className="sticky left-0 z-20 bg-panel px-2 py-1 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
            >
              {rowControl ? `${rowControl.name} \\ ` : ""}
              {columnControl?.name ?? ""}
            </th>
            {columns.map((column, index) => (
              <th
                key={index}
                className="whitespace-nowrap border-b border-border px-2 py-1 font-mono text-[11px] font-normal text-muted-foreground"
              >
                {column === null ? "" : String(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              <th
                scope="row"
                className="sticky left-0 z-10 whitespace-nowrap border-r border-border bg-panel px-2 text-right align-middle font-mono text-[11px] font-normal text-muted-foreground"
              >
                {row === null ? "" : String(row)}
              </th>
              {columns.map((column, columnIndex) => {
                const cellPose = poseFor(column, row)
                const label = [column, row]
                  .filter((value) => value !== null)
                  .map((value) => String(value))
                  .join(" · ")
                return (
                  <td key={columnIndex} className="border-b border-border/60 p-1 align-middle">
                    {/* Not a button. Every machine here is the real module and
                        most of them take the pointer — drag the arm, aim the
                        gaze — so a wrapper that swallowed the click made the
                        grid the one place the library could not be touched.
                        Going to the stage is the corner button instead. */}
                    <div
                      className={cn(
                        "group relative flex items-center justify-center overflow-hidden rounded-sm border border-transparent bg-background/40 p-1 transition-colors hover:border-border",
                      )}
                      style={{ width: cell + 24, height: cell + 24 }}
                    >
                      <RobotRender component={component} pose={cellPose} />
                      <button
                        type="button"
                        onClick={() => onCellClick?.(stagePose(cellPose))}
                        title="Send this cell to the stage"
                        aria-label={`Send ${label || component.id} to the stage`}
                        className="absolute right-1 top-1 rounded-sm border border-border bg-background/90 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Frame className="size-3" />
                      </button>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export { Matrix }
