"use client"

import * as React from "react"

import type { Vec2 } from "@/lib/robocn/kinematics"

export interface UsePointerTargetOptions {
  /**
   * Map a pointer position inside the element's box (0..1 on both axes) into
   * the component's own world units. Each machine supplies its own mapping.
   * Wrap it in `useCallback`, or the listener rebinds on every render.
   */
  toWorld: (unit: Vec2, rect: DOMRect) => Vec2
  /** Track the pointer anywhere on the page rather than only over the element. */
  within?: "element" | "window"
  /** Hold the last position after the pointer leaves instead of releasing. */
  persist?: boolean
  enabled?: boolean
}

export interface PointerTarget {
  /** Null while the pointer is away, so the machine can fall back to a behaviour. */
  target: Vec2 | null
  active: boolean
}

/**
 * Pointer position expressed in a component's world units. Returns null when
 * the pointer is not engaged, which lets a component fall back to its idle
 * behaviour instead of freezing mid-reach.
 */
export function usePointerTarget<T extends Element>(
  ref: React.RefObject<T | null>,
  { toWorld, within = "element", persist = false, enabled = true }: UsePointerTargetOptions,
): PointerTarget {
  const [target, setTarget] = React.useState<Vec2 | null>(null)
  const [active, setActive] = React.useState(false)

  React.useEffect(() => {
    const element = ref.current
    if (!enabled || !element) return
    const source: Element | Window = within === "window" ? window : element

    const onMove = (event: Event) => {
      const pointer = event as PointerEvent
      const rect = element.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const unit = {
        x: (pointer.clientX - rect.left) / rect.width,
        y: (pointer.clientY - rect.top) / rect.height,
      }
      setTarget(toWorld(unit, rect))
      setActive(true)
    }
    const onLeave = () => {
      setActive(false)
      if (!persist) setTarget(null)
    }

    source.addEventListener("pointermove", onMove, { passive: true })
    element.addEventListener("pointerleave", onLeave)
    return () => {
      source.removeEventListener("pointermove", onMove)
      element.removeEventListener("pointerleave", onLeave)
      setTarget(null)
      setActive(false)
    }
  }, [ref, enabled, within, persist, toWorld])

  return { target, active }
}
