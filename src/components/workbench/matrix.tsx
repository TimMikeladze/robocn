"use client"

/**
 * Matrix mode: one machine drawn across the cross product of two of its props.
 *
 * Every variant against every camera view, every gait against every tool. It
 * is the view that catches the pose which is only wrong from the back, and the
 * reason the workbench derives controls at all — the axes are just the props
 * that happen to have a finite set of values.
 */

import * as React from "react"

import { RobotRender, axisControls } from "@/components/workbench/stage"
import type { Control, Pose, PropValue, WorkbenchComponent } from "@/lib/workbench/controls"
import { cn } from "@/lib/utils"

export const axisValues = (control: Control): PropValue[] =>
  control.kind === "boolean" ? [false, true] : (control.options ?? [])

export interface MatrixProps {
  component: WorkbenchComponent
  pose: Pose
  x: string
  y: string
  /** Cell width in pixels, passed to the component's own `size` prop. */
  cell: number
  onCellClick?: (pose: Pose) => void
}

function Matrix({ component, pose, x, y, cell, onCellClick }: MatrixProps) {
  const available = axisControls(component)
  const columnControl = available.find((control) => control.name === x) ?? null
  const rowControl = available.find((control) => control.name === y) ?? null
  const columns = columnControl ? axisValues(columnControl) : [null]
  const rows = rowControl ? axisValues(rowControl) : [null]
  const sizeable = component.controls.some(
    (control) => control.kind === "size" && control.name !== x && control.name !== y,
  )

  const poseFor = (column: PropValue | null, row: PropValue | null): Pose => ({
    ...pose,
    ...(sizeable ? { size: cell } : null),
    ...(columnControl && column !== null ? { [columnControl.name]: column } : null),
    ...(rowControl && row !== null ? { [rowControl.name]: row } : null),
  })

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      <table className="border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 bg-panel px-2 py-1 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {rowControl ? `${rowControl.name} \\ ` : ""}
              {columnControl?.name ?? ""}
            </th>
            {columns.map((column, index) => (
              <th
                key={index}
                className="border-b border-border px-2 py-1 font-mono text-[11px] font-normal text-muted-foreground"
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
                className="sticky left-0 z-10 border-r border-border bg-panel px-2 text-right align-middle font-mono text-[11px] font-normal text-muted-foreground"
              >
                {row === null ? "" : String(row)}
              </th>
              {columns.map((column, columnIndex) => {
                const cellPose = poseFor(column, row)
                return (
                  <td key={columnIndex} className="border-b border-border/60 p-1 align-middle">
                    <button
                      type="button"
                      onClick={() => onCellClick?.(cellPose)}
                      title="Send this cell to the stage"
                      className={cn(
                        "flex items-center justify-center overflow-hidden rounded-sm border border-transparent bg-background/40 p-1 transition-colors hover:border-border",
                      )}
                      style={{ width: cell + 24, height: cell + 24 }}
                    >
                      <RobotRender component={component} pose={cellPose} />
                    </button>
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
