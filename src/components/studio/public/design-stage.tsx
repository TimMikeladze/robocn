"use client"

/**
 * A published machine on the ground its author chose. The pages that use this
 * are server components; the machine is a lazy client module, so this is the
 * one boundary between them.
 */

import * as React from "react"

import { MachineView, type MachineViewProps } from "@/components/studio/machine-view"
import { Stage } from "@/components/workbench/stage"
import { cn } from "@/lib/utils"

import type { StageView } from "./stage-view"

export interface DesignStageProps extends Pick<MachineViewProps, "componentId" | "pose" | "size"> {
  stage: StageView
  /** No ground at all: an embed that wants the host page to show through. */
  bare?: boolean
  /**
   * Size the machine to the box when the author chose no size: an embed is
   * whatever shape its host page made the iframe.
   */
  fit?: boolean
  label: string
  className?: string
}

/** The side of the largest square that fits the element, less the stage's own padding. */
function useFittedSize(enabled: boolean) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [side, setSide] = React.useState<number>()
  React.useEffect(() => {
    const node = ref.current
    if (!node || !enabled || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSide(Math.round(Math.min(1024, Math.max(96, Math.min(width, height) - 48))))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled])
  return [ref, side] as const
}

function DesignStage({ componentId, pose, size, stage, bare, fit, label, className }: DesignStageProps) {
  const fitting = !!fit && size === undefined && pose.size === undefined
  const [ref, fitted] = useFittedSize(fitting)
  const machine = (
    <MachineView componentId={componentId} pose={pose} size={fitting ? fitted : size} />
  )
  if (bare) {
    return (
      <div
        ref={ref}
        role="group"
        aria-label={label}
        className={cn("flex items-center justify-center overflow-hidden", className)}
      >
        <div style={{ transform: `scale(${stage.zoom})` }}>{machine}</div>
      </div>
    )
  }
  return (
    <Stage
      ref={ref}
      role="group"
      aria-label={label}
      background={stage.background}
      zoom={stage.zoom}
      outline={false}
      // A page is not a workbench: a machine larger than its box is clipped, not scrolled.
      className={cn("flex-none overflow-hidden", className)}
    >
      {machine}
    </Stage>
  )
}

export { DesignStage }
