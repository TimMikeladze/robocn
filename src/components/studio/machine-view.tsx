"use client"

/**
 * A design, drawn: the real machine from the registry, handed the saved props.
 * Cards prefer the stored snapshot and fall back to this, so a grid of forty
 * designs does not mount forty animation loops.
 */

import * as React from "react"

import { RobotRender } from "@/components/workbench/stage"
import { workbenchComponent, type Pose } from "@/lib/workbench/controls"
import { cn } from "@/lib/utils"

export interface MachineViewProps {
  componentId: string
  pose: Pose
  /** Replaces the saved `size`, so a card and a hero can show the same design. */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number
  /** Hold the machine still: grids and print. */
  still?: boolean
  className?: string
}

function MachineView({ componentId, pose, size, still, className }: MachineViewProps) {
  const component = workbenchComponent(componentId)
  const shown = React.useMemo(() => {
    const next: Pose = { ...pose }
    if (size !== undefined) next.size = size
    if (still && component?.controls.some((control) => control.name === "paused")) next.paused = true
    return next
  }, [pose, size, still, component])

  if (!component) {
    return (
      <p className="font-mono text-[11px] text-muted-foreground">
        {componentId} is no longer in the registry.
      </p>
    )
  }
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <RobotRender component={component} pose={shown} />
    </div>
  )
}

/** The snapshot when there is one, the machine when there is not. */
function DesignPreview({
  versionId,
  hasThumbnail,
  token,
  alt,
  ...machine
}: MachineViewProps & {
  versionId: string | null
  hasThumbnail: boolean
  /** A share token, when the viewer is not a member. */
  token?: string
  alt: string
}) {
  const [failed, setFailed] = React.useState(false)
  if (versionId && hasThumbnail && !failed) {
    return (
      // A route handler behind auth, already sized and encoded: nothing for the optimizer to add.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/studio/thumbnails/${versionId}${token ? `?t=${token}` : ""}`}
        alt={alt}
        loading="lazy"
        // An image that failed before hydration never fires `onError`; ask it directly.
        ref={(node) => {
          if (node?.complete && node.naturalWidth === 0) setFailed(true)
        }}
        onError={() => setFailed(true)}
        className={cn("size-full object-contain", machine.className)}
      />
    )
  }
  return <MachineView {...machine} still />
}

export { DesignPreview, MachineView }
