"use client"

/**
 * use-robot-motion — the clock every machine runs on, and the handle you grab
 * it by.
 *
 * `useRobotArm` and `useEasedPoint` solve chains. These are for machines with
 * no chain to solve: a stroke, an angle, a belt phase. The pair exists so all
 * of them park under the same reduced-motion preference, stop rendering when
 * they are still, and hand a person the same grab-and-release feel.
 */

import * as React from "react"

import { clamp, type Vec2 } from "@/lib/robocn/kinematics"
import { prefersReducedMotion } from "@/lib/robocn/style"

function subscribeReducedMotion(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}
  const media = window.matchMedia("(prefers-reduced-motion: reduce)")
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

/** True while the visitor has asked the OS for less animation. */
export function useReducedMotion() {
  return React.useSyncExternalStore(
    subscribeReducedMotion,
    prefersReducedMotion,
    () => false,
  )
}

export interface RobotMotionOptions {
  /** Cycles per second. Zero or non-finite parks the machine. */
  speed?: number
  /** Off renders the parked pose once. */
  animate?: boolean
  /** Freeze where it stands, without resetting. */
  paused?: boolean
  /** Seconds of offset, so a row of machines breaks step. */
  phase?: number
}

/**
 * Seconds since mount multiplied by `speed`, offset by `phase`. Parks at
 * `phase` when animation is off or the visitor prefers reduced motion, and
 * holds where it stands while paused.
 */
export function useRobotClock({
  speed = 1,
  animate = true,
  paused = false,
  phase = 0,
}: RobotMotionOptions = {}): number {
  const reduced = useReducedMotion()
  const enabled = animate && !reduced && Number.isFinite(speed) && speed !== 0
  const [clock, setClock] = React.useState(phase)

  // Disabled is deterministic: the same drawing every render, at `phase`.
  React.useEffect(() => {
    if (enabled) return
    setClock(phase)
  }, [enabled, phase])

  React.useEffect(() => {
    if (!enabled || paused) return
    let last = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      // A frame already queued when the loop starts carries a timestamp from
      // before it, so the first delta can be negative: clamp both ends or the
      // machine takes one step backwards at mount.
      const delta = clamp((now - last) / 1000, 0, 0.05)
      last = now
      setClock((current) => current + delta * speed)
      frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [enabled, paused, speed])

  return clock
}

/** A fixed value, or where the value should be at `clock`. */
export type RobotGoal = number | ((clock: number) => number)

const sample = (goal: RobotGoal, clock: number) =>
  typeof goal === "function" ? goal(clock) : goal

export interface RobotScalarOptions extends RobotMotionOptions {
  /**
   * Value units per second while easing toward the goal. `Infinity` snaps,
   * which is what a controlled machine wants.
   */
  rate?: number
  /**
   * Pin the value here and leave the clock running underneath: a controlled
   * prop, or the pointer during a drag. Releasing it eases back into whatever
   * the behavior has moved on to, rather than snapping to it.
   */
  hold?: number | null
}

export interface RobotScalar {
  value: number
  /** Seconds × speed, for anything else the drawing derives from the cycle. */
  clock: number
}

/**
 * One animation frame loop that advances the clock and rate-limits a scalar
 * toward its goal. The rate limit is the whole point: it is what makes a
 * released machine return like a servo instead of teleporting.
 */
export function useRobotScalar(
  goal: RobotGoal,
  {
    rate = 1,
    hold = null,
    speed = 1,
    animate = true,
    paused = false,
    phase = 0,
  }: RobotScalarOptions = {},
): RobotScalar {
  const reduced = useReducedMotion()
  const enabled = animate && !reduced && Number.isFinite(speed) && speed !== 0

  // The loop reads the latest goal and hold without being torn down for each
  // one; both are written after render, so it never sees a value the render
  // did not produce.
  const goalRef = React.useRef(goal)
  const holdRef = React.useRef(hold)
  React.useEffect(() => {
    goalRef.current = goal
    holdRef.current = hold
  })

  const [state, setState] = React.useState<RobotScalar>(() => ({
    value: hold ?? sample(goal, phase),
    clock: phase,
  }))
  const valueRef = React.useRef(state.value)
  const clockRef = React.useRef(state.clock)

  // Parked: sample the goal where it stands, so a changed goal, hold or phase
  // still redraws even with no loop running to pick it up.
  React.useEffect(() => {
    if (enabled) return
    const value = hold ?? sample(goal, phase)
    valueRef.current = value
    clockRef.current = phase
    setState((current) =>
      current.value === value && current.clock === phase
        ? current
        : { value, clock: phase },
    )
  }, [enabled, goal, hold, phase])

  // A grab is answered on the same frame it happens, loop running or not.
  React.useEffect(() => {
    if (hold === null || !enabled) return
    valueRef.current = hold
    setState((current) =>
      current.value === hold ? current : { ...current, value: hold },
    )
  }, [hold, enabled])

  React.useEffect(() => {
    if (!enabled || paused) return
    let clock = clockRef.current
    let value = valueRef.current
    let last = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      // A frame already queued when the loop starts carries a timestamp from
      // before it, so the first delta can be negative: clamp both ends or the
      // machine takes one step backwards at mount.
      const delta = clamp((now - last) / 1000, 0, 0.05)
      last = now
      clock += delta * speed
      const held = holdRef.current
      value =
        held ?? approach(value, sample(goalRef.current, clock), rate * delta)
      if (value !== valueRef.current || clock !== clockRef.current) {
        valueRef.current = value
        clockRef.current = clock
        setState({ value, clock })
      }
      frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [enabled, paused, speed, rate])

  return state
}

/**
 * Move `value` toward `goal` by at most `step`. The rate limiter behind
 * {@link useRobotScalar}, pure so a component can use it on its own.
 */
export function approach(value: number, goal: number, step: number) {
  if (!Number.isFinite(goal)) return value
  if (!(step > 0)) return value
  const gap = goal - value
  return Math.abs(gap) <= step ? goal : value + Math.sign(gap) * step
}

export interface RobotDragOptions {
  enabled?: boolean
  /**
   * Where the pointer is inside the element's box, 0..1 on both axes, on
   * press and on every move until release. Wrap it in `useCallback`, or the
   * listeners rebind on every render.
   */
  onDrag: (unit: Vec2, rect: DOMRect) => void
  onDragEnd?: () => void
}

/**
 * Press-and-drag control for a drawing. Pointer capture means the drag
 * survives leaving the element, and pressing rather than hovering is what
 * gives a touch device the same control a mouse has.
 */
export function useRobotDrag<T extends Element>(
  ref: React.RefObject<T | null>,
  { enabled = true, onDrag, onDragEnd }: RobotDragOptions,
): boolean {
  const [dragging, setDragging] = React.useState(false)

  React.useEffect(() => {
    const element = ref.current
    if (!enabled || !element) return
    let active: number | null = null

    const report = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      onDrag(
        {
          x: (event.clientX - rect.left) / rect.width,
          y: (event.clientY - rect.top) / rect.height,
        },
        rect,
      )
    }
    const onDown = (event: Event) => {
      const pointer = event as PointerEvent
      if (pointer.button > 0) return
      active = pointer.pointerId
      // Keeps the press from starting a text selection or a page scroll.
      pointer.preventDefault()
      element.setPointerCapture?.(pointer.pointerId)
      setDragging(true)
      report(pointer)
    }
    const onMove = (event: Event) => {
      const pointer = event as PointerEvent
      if (active === pointer.pointerId) report(pointer)
    }
    const onRelease = (event: Event) => {
      const pointer = event as PointerEvent
      if (active !== pointer.pointerId) return
      if (element.hasPointerCapture?.(pointer.pointerId)) {
        element.releasePointerCapture?.(pointer.pointerId)
      }
      active = null
      setDragging(false)
      onDragEnd?.()
    }

    element.addEventListener("pointerdown", onDown)
    element.addEventListener("pointermove", onMove)
    element.addEventListener("pointerup", onRelease)
    element.addEventListener("pointercancel", onRelease)
    return () => {
      element.removeEventListener("pointerdown", onDown)
      element.removeEventListener("pointermove", onMove)
      element.removeEventListener("pointerup", onRelease)
      element.removeEventListener("pointercancel", onRelease)
      setDragging(false)
    }
  }, [ref, enabled, onDrag, onDragEnd])

  return dragging
}

/**
 * Arrow and page keys as a signed delta in value units; zero for a key that
 * is not ours, so a component can fall through to its own handling.
 */
export function arrowStep(key: string, step: number, large = step * 3) {
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return step
    case "ArrowLeft":
    case "ArrowDown":
      return -step
    case "PageUp":
      return large
    case "PageDown":
      return -large
    default:
      return 0
  }
}
