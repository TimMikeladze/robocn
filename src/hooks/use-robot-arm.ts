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

/**
 * A fixed point, or a path: given seconds since the loop started, where the
 * tool tip should be now. A function target never settles, so it is the way to
 * script a cycle without owning an animation loop.
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
 * the loop entirely once a pose settles — an idle arm costs no renders.
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
  const linksKey = links.join(",")
  const rootKey = `${root.x},${root.y}`
  // A function target is re-read every frame, so it must not key the effect.
  const targetKey =
    typeof target === "function"
      ? "path"
      : target
        ? `${target.x.toFixed(3)},${target.y.toFixed(3)}`
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
    const reduced = prefersReducedMotion()
    const travel = speed ?? chainReach(linksRef.current) * 1.6
    let clock = phase
    let last = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      clock += dt

      const held = targetRef.current
      const goal =
        typeof held === "function"
          ? held(clock)
          : (held ??
            behaviorGoal(behavior, clock, rootRef.current, linksRef.current))
      const distance = distance2(tipRef.current, goal)
      // Ease rather than jump: a critically-damped approach reads as a machine
      // accelerating, and keeps the seed close enough to stay coherent.
      const tip =
        !animate || reduced || distance < 0.05
          ? goal
          : lerp2(tipRef.current, goal, Math.min(1, (travel * dt) / distance))
      tipRef.current = tip

      const next = solveChain2(rootRef.current, tip, linksRef.current, {
        bend,
        seed: jointsRef.current,
      })
      if (poseChanged(next, jointsRef.current)) {
        jointsRef.current = next
        setJoints(next)
      }

      const chasing = distance > 0.05
      setMoving(chasing)
      // A behaviour moves its own goal every frame, so it never settles; a
      // fixed target does, and the loop then stops until the target changes.
      const driven =
        typeof targetRef.current === "function" ||
        (behavior !== "static" && !targetRef.current)
      if ((driven && animate && !reduced) || chasing) {
        frame = requestAnimationFrame(step)
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [behavior, bend, speed, animate, paused, phase, linksKey, rootKey, targetKey])

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

  return { joints: resolved, tip: resolved[resolved.length - 1], angles, moving }
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
  { speed = 60, animate = true, paused = false, phase = 0 }: UseEasedPointOptions = {},
): EasedPoint {
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
  const targetKey =
    typeof target === "function"
      ? "path"
      : target
        ? `${target.x.toFixed(3)},${target.y.toFixed(3)}`
        : ""

  React.useEffect(() => {
    if (paused) return
    const reduced = prefersReducedMotion()
    let clock = phase
    let last = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      clock += dt
      const held = targetRef.current
      const goal =
        typeof held === "function" ? held(clock) : (held ?? pointRef.current)
      const gap = distance2(pointRef.current, goal)
      const next =
        !animate || reduced || gap < 0.05
          ? goal
          : lerp2(pointRef.current, goal, Math.min(1, (speed * dt) / gap))
      const moved =
        Math.abs(next.x - pointRef.current.x) > 0.008 ||
        Math.abs(next.y - pointRef.current.y) > 0.008
      pointRef.current = next
      if (moved) setState({ point: next, clock, moving: gap > 0.05 })
      if (typeof targetRef.current === "function" || gap > 0.05) {
        frame = requestAnimationFrame(step)
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [speed, animate, paused, phase, targetKey])

  return state
}
