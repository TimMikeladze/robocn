# Motion and interaction

Full contract and the per-machine table: `docs/motion-and-interaction.md`. This is how to
wire a new one.

## The three rules

1. **Controlled wins.** A supplied value prop (`angle`, `extension`, `opening`, `heading`, …)
   renders exactly as given and no loop runs.
2. **Uncontrolled runs.** Leave it out and the machine animates itself. What it does is
   `behavior`, a per-component union that **always includes `"static"`**, scaled by `speed`
   (cycles per second), offset by `phase` (seconds), frozen by `paused`, parked by
   `animate={false}` or a reduced-motion preference.
3. **Interaction yields, then resumes.** `interactive` makes it a control. While held it
   tracks the pointer exactly; on release it eases back into whatever the behaviour has moved
   on to, rate-limited. `on…Change` fires throughout, so interaction works in controlled mode
   too — the component reports, the caller decides.

Never gate interaction on hover: every draggable is a pointerdown target, or touch cannot
reach it.

## `@/hooks/use-robot-motion`

| Export | Signature | Use |
|---|---|---|
| `useReducedMotion()` | `() => boolean` | Live subscription to `(prefers-reduced-motion: reduce)`. |
| `useRobotClock(options)` | `({speed, animate, paused, phase}) => number` | Seconds × `speed`, offset by `phase`. Parks at `phase` when disabled, holds when paused. For machines whose whole pose is a function of the cycle (duck, quadruped, face, lidar). |
| `useRobotScalar(goal, options)` | `(RobotGoal, {rate, hold, speed, animate, paused, phase}) => {value, clock}` | One rAF loop that advances the clock *and* eases one scalar toward `goal(clock)` at `rate` units/second. |
| `useRobotDrag(ref, options)` | `(ref, {enabled, onDrag, onDragEnd}) => dragging` | Pointer capture on press; `onDrag(unit, rect)` gets 0..1 coordinates inside the box. |
| `approach(value, goal, step)` | pure | The rate limiter itself. |
| `arrowStep(key, step, large?)` | pure | Arrow/Page keys as a signed delta; `0` for keys that are not ours, so you can fall through. |

`hold` is the hinge: it pins the value (a controlled prop, or the pointer during a drag)
while the clock keeps running underneath. That is what makes release read as a servo
returning rather than a jump. `rate: Infinity` snaps.

Chains are different: `useRobotArm` / `useEasedPoint` solve link chains and already own their
loop. Don't stack `useRobotScalar` on top of an arm.

## Wiring a self-running, grabbable machine

From `servo-motor.tsx`, which is the canonical one:

```tsx
const controlled = angle !== undefined
const svgRef = React.useRef<SVGSVGElement>(null)
const [held, setHeld] = React.useState<number | null>(null)

// Controlled prop and drag both pin the same way.
const hold = controlled ? (Number.isFinite(angle) ? clamp(angle, -180, 180) : 0) : held

const goal = React.useCallback((clock: number) => servoGoal(behavior, clock), [behavior])
const motion = useRobotScalar(goal, {
  rate: SLEW_RATE,                                     // degrees per second
  hold,
  speed, paused, phase,
  animate: animate && !controlled && behavior !== "static",
})
const rotation = clamp(motion.value, -180, 180)

const apply = React.useCallback((next: number) => {
  const bounded = clamp(next, -180, 180)
  setHeld(bounded)
  onAngleChange?.(bounded)
}, [onAngleChange])

const dragging = useRobotDrag(svgRef, {
  enabled: interactive,
  onDrag: React.useCallback((unit) => { /* unit → value, in view units */ }, [apply]),
  onDragEnd: React.useCallback(() => setHeld(null), []),   // release: ease back in
})
```

`onDrag` must be wrapped in `useCallback` or the listeners rebind every render.

Then the accessible surface on the `<svg>`:

```tsx
role={role ?? (interactive ? "slider" : "img")}
aria-label={`Servo motor, ${readout} degrees, ${horn} horn`}
aria-valuemin={interactive ? -180 : undefined}
aria-valuemax={interactive ? 180 : undefined}
aria-valuenow={interactive ? readout : undefined}
aria-valuetext={interactive ? `${readout} degrees` : undefined}
tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
onKeyDown={(event) => {
  onKeyDown?.(event)
  if (!interactive || event.defaultPrevented) return
  const delta = arrowStep(event.key, event.shiftKey ? 15 : 5, 45)
  if (delta !== 0) apply(rotation + delta)
  else if (event.key === "Home") apply(0)
  else if (event.key === "End") apply(180)
  else return
  event.preventDefault()
}}
onBlur={(event) => { onBlur?.(event); if (!dragging) setHeld(null) }}
className={cn("max-w-full select-none",
  interactive && "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]",
  dragging && "cursor-grabbing", className)}
```

`touch-none` is required or the browser scrolls instead of dragging.

## Behaviours are exported pure functions

Every behaviour is a pure function of the clock, exported from the component file:

```tsx
export function servoGoal(behavior: ServoBehavior, clock: number): number {
  if (!Number.isFinite(clock)) return 0
  switch (behavior) {
    case "sweep": return Math.sin(clock * Math.PI * 2) * 90
    case "step":  return STEPS[Math.floor(((clock % 1) + 1) % 1 * STEPS.length)]
    case "hunt":  return Math.sin(clock * 14) * 2.2
    default:      return 0
  }
}
```

This is what makes motion testable without faking rAF: `src/components/ui/__tests__/motion.test.tsx`
samples `strokeGoal`, `servoGoal`, `gripperGoal`, `roverGoal`, `duckBehaviorPose`,
`reachyBehaviorPose`, `faceGaze`, `returnFreshness` at fixed phases and asserts the shape of
the cycle, that whole cycles repeat in both directions, and that `NaN` gives the neutral
value. Give a new machine the same treatment and the test is three lines.

Name the behaviour after what the mechanism actually does on a bench — `cycle`, `breathe`,
`sweep`, `step`, `hunt`, `index`, `spin`, `patrol`, `wander`, `hover`, `orbit`, `walk`,
`trot`, `peck`, `scan`, `nod`, `pointer` — plus `static`.
