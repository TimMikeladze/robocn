"use client"

import * as React from "react"

import {
  chainAngles2,
  chainReach,
  distance2,
  lerp2,
  solveChain2,
  type Bend,
  type Vec2,
} from "@/lib/robocn/kinematics"
import { prefersReducedMotion, type RobotBehavior } from "@/lib/robocn/style"

function subscribeReducedMotion(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}
  const media = window.matchMedia("(prefers-reduced-motion: reduce)")
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

function useReducedMotion() {
  return React.useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false)
}

/**
 * A fixed point, or a path: given seconds since the loop started, where the
 * tool tip should be now. A function target keeps the clock running while animation is enabled, so it
 * can script a cycle without owning an animation loop. Disabled animation
 * samples the path once at phase.
 */
export type RobotTarget = Vec2 | ((clock: number) => Vec2) | null

export interface UseRobotArmOptions {
  /** Link lengths in world units, shoulder outward. */
  links: number[]
  /** Shoulder position in world units. Defaults to the origin. */
  root?: Vec2
  /** Controlled tool-tip goal. Wins over `behavior` whenever it is set. */
  target?: RobotTarget
  /** What drives the tip when no `target` is given. */
  behavior?: RobotBehavior
  bend?: Bend
  /** Tip travel speed, world units per second. */
  speed?: number
  /** Off snaps straight to the goal and renders once. */
  animate?: boolean
  /** Freeze the arm where it stands. */
  paused?: boolean
  /** Seconds of phase offset, so a row of arms does not move in lockstep. */
  phase?: number
}

export interface RobotArmPose {
  /** Shoulder to tool tip, one more entry than there are links. */
  joints: Vec2[]
  tip: Vec2
  /** Joint angles in degrees, each relative to the previous segment. */
  angles: number[]
  /** True while the tip is chasing its goal — drives tool effects. */
  moving: boolean
}

/** Where an arm parks when it has nothing to chase. */
export function robotRestTarget(root: Vec2, links: number[]): Vec2 {
  const reach = chainReach(links)
  return { x: root.x + reach * 0.42, y: root.y + reach * 0.64 }
}

function behaviorGoal(
  behavior: RobotBehavior,
  clock: number,
  root: Vec2,
  links: number[],
): Vec2 {
  const reach = chainReach(links)
  const rest = robotRestTarget(root, links)
  switch (behavior) {
    case "orbit": {
      const center = { x: root.x, y: root.y + reach * 0.6 }
      const radius = reach * 0.32
      return {
        x: center.x + Math.cos(clock * 0.9) * radius,
        y: center.y + Math.sin(clock * 0.9) * radius * 0.72,
      }
    }
    case "sweep":
      return {
        x: root.x + Math.sin(clock * 0.55) * reach * 0.66,
        y: root.y + reach * (0.46 + Math.cos(clock * 1.1) * 0.07),
      }
    case "idle":
      return {
        x: rest.x + Math.sin(clock * 0.7) * reach * 0.035,
        y: rest.y + Math.sin(clock * 0.45) * reach * 0.05,
      }
    default:
      return rest
  }
}

/** True once any joint has moved enough to be worth a re-render. */
function poseChanged(a: Vec2[], b: Vec2[]) {
  if (a.length !== b.length) return true
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i].x - b[i].x) > 0.008 || Math.abs(a[i].y - b[i].y) > 0.008) {
      return true
    }
  }
  return false
}

/**
 * Animated pose for a link chain. Eases the tool tip toward its goal on every
 * animation frame, solves the chain seeded with the previous frame, and stops
 * the loop entirely once a fixed target settles. Scripted behaviors keep running.
 */
export function useRobotArm({
  links,
  root = { x: 0, y: 0 },
  target = null,
  behavior = "idle",
  bend = "up",
  speed,
  animate = true,
  paused = false,
  phase = 0,
}: UseRobotArmOptions): RobotArmPose {
  const reduced = useReducedMotion()
  const linksKey = links.join(",")
  const rootKey = `${root.x},${root.y}`
  // A function target is re-read every frame, so it must not key the effect.
  // Active paths use a stable key to preserve their clock. Parked paths are
  // sampled at phase so changed captured inputs still update the stopped pose.
  const keyedTarget = typeof target === "function" && (!animate || reduced) ? target(phase) : target
  const targetKey =
    typeof keyedTarget === "function"
      ? "path"
      : keyedTarget
        ? `${keyedTarget.x},${keyedTarget.y}`
        : ""

  // The animation loop reads the latest links, root and target without being
  // torn down and rebuilt for each one; refs are written after render so the
  // loop never sees a value the render did not produce.
  const linksRef = React.useRef(links)
  const rootRef = React.useRef(root)
  const targetRef = React.useRef(target)
  React.useEffect(() => {
    linksRef.current = links
    rootRef.current = root
    targetRef.current = target
  })

  const [joints, setJoints] = React.useState<Vec2[]>(() =>
    solveChain2(
      root,
      typeof target === "function"
        ? target(phase)
        : (target ?? robotRestTarget(root, links)),
      links,
      { bend },
    ),
  )
  const jointsRef = React.useRef(joints)
  const tipRef = React.useRef<Vec2>(joints[joints.length - 1])
  const [moving, setMoving] = React.useState(false)

  React.useEffect(() => {
    if (paused) return
    const travel = speed ?? chainReach(linksRef.current) * 1.6
    const enabled = animate && !reduced
    const running = enabled && Number.isFinite(travel) && travel > 0
    let clock = phase
    let last = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (running) clock += dt

      const held = targetRef.current
      const goal =
        typeof held === "function"
          ? held(clock)
          : (held ??
            behaviorGoal(behavior, clock, rootRef.current, linksRef.current))
      const distance = distance2(tipRef.current, goal)
      // Advance at the configured feed rate, keeping the solver seed close
      // enough to the next pose to preserve continuity.
      const tip =
        !enabled || distance < 0.05
          ? goal
          : running
            ? lerp2(tipRef.current, goal, Math.min(1, (travel * dt) / distance))
            : tipRef.current
      tipRef.current = tip

      const next = solveChain2(rootRef.current, tip, linksRef.current, {
        bend,
        seed: jointsRef.current,
      })
      if (poseChanged(next, jointsRef.current)) {
        jointsRef.current = next
        setJoints(next)
      }

      const driven = typeof held === "function" ||
        (!held && (behavior === "idle" || behavior === "orbit" || behavior === "sweep"))
      const chasing = running && distance2(tip, goal) > 0.05
      setMoving(chasing || (running && driven && distance > 0.008))
      if (running && (driven || chasing)) {
        frame = requestAnimationFrame(step)
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [behavior, bend, speed, animate, paused, phase, linksKey, rootKey, targetKey, reduced])

  // `links` can change between renders, and the loop only catches up on the
  // next frame. Re-solve inline for that one render rather than handing back a
  // pose with the wrong number of joints.
  const resolved = React.useMemo(
    () =>
      joints.length === links.length + 1
        ? joints
        : solveChain2(
            root,
            joints[joints.length - 1] ?? robotRestTarget(root, links),
            links,
            { bend },
          ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [joints, linksKey, rootKey, bend],
  )
  const angles = React.useMemo(() => chainAngles2(resolved), [resolved])

  return { joints: resolved, tip: resolved[resolved.length - 1], angles, moving: !paused && animate && !reduced ? moving : false }
}

export interface UseEasedPointOptions {
  /** Travel speed in world units per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of phase offset. */
  phase?: number
  /**
   * Ease each axis independently, at the same rate. Cartesian machines move
   * this way — the dog-leg path is the tell — where an arm sweeps an arc.
   */
  perAxis?: boolean
}

export interface EasedPoint {
  point: Vec2
  /** Seconds since the loop started, offset by `phase`. */
  clock: number
  moving: boolean
}

/**
 * The easing half of {@link useRobotArm} on its own, for machines that have no
 * chain to solve: gantries, spindles, anything positioned directly.
 */
export function useEasedPoint(
  target: RobotTarget,
  start: Vec2,
  { speed = 60, animate = true, paused = false, phase = 0, perAxis = false }: UseEasedPointOptions = {},
): EasedPoint {
  const reduced = useReducedMotion()
  const targetRef = React.useRef(target)
  React.useEffect(() => {
    targetRef.current = target
  })
  const [state, setState] = React.useState<EasedPoint>(() => ({
    point: typeof target === "function" ? target(phase) : (target ?? start),
    clock: phase,
    moving: false,
  }))
  const pointRef = React.useRef(state.point)
  // Active paths use a stable key to preserve their clock. Parked paths are
  // sampled at phase so changed captured inputs still update the stopped pose.
  const keyedTarget = typeof target === "function" && (!animate || reduced) ? target(phase) : target
  const targetKey =
    typeof keyedTarget === "function"
      ? "path"
      : keyedTarget
        ? `${keyedTarget.x},${keyedTarget.y}`
        : ""

  React.useEffect(() => {
    if (paused) return
    const enabled = animate && !reduced
    const running = enabled && Number.isFinite(speed) && speed > 0
    let clock = phase
    let last = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (running) clock += dt
      const held = targetRef.current
      const goal =
        typeof held === "function" ? held(clock) : (held ?? pointRef.current)
      const gap = distance2(pointRef.current, goal)
      const stepSize = running ? speed * dt : 0
      const advance = (value: number, goal: number) => value + Math.sign(goal - value) * Math.min(Math.abs(goal - value), stepSize)
      const next = !enabled || gap < 0.05
        ? goal
        : perAxis
          ? { x: advance(pointRef.current.x, goal.x), y: advance(pointRef.current.y, goal.y) }
          : lerp2(pointRef.current, goal, Math.min(1, stepSize / gap))
      const moved = distance2(next, pointRef.current) > 0.008
      const driven = typeof held === "function"
      const chasing = running && distance2(next, goal) > 0.05
      const moving = chasing || (running && driven && moved)
      pointRef.current = next
      // Scripted paths can animate another dimension from clock, even if x/y
      // remain fixed. Fixed points publish their final settled state as well.
      setState(current =>
        current.point.x === next.x && current.point.y === next.y &&
        current.moving === moving && (!driven || current.clock === clock)
          ? current
          : { point: next, clock, moving },
      )
      if (running && (driven || chasing)) {
        frame = requestAnimationFrame(step)
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [speed, animate, paused, phase, targetKey, perAxis, reduced])

  return paused || !animate || reduced ? { ...state, moving: false } : state
}
