"use client"

/**
 * The mark is a machine in its cell.
 *
 * Not a drawing of an arm — an arm: a three-link chain solved by the same
 * `useRobotArm` core that drives `robot-arm` and `robot-arm-3d`. It takes its
 * pose from where the page was last clicked, keeps it — across routes and
 * across reloads — until the next click, and fires its welder while the thing
 * it sits in is pressed or focused.
 *
 * It is drawn inside a rounded square — a work cell — because a bare stick
 * figure has no silhouette at 16 px and nothing for a wordmark to align to. The
 * cell gives the mark a footprint, an edge, and a reason for the orange to read
 * as a machine under light rather than as a scribble on the header.
 *
 * It is painted in the machines' orange rather than in ink: the mark is a robot,
 * and the orange is what the rest of the set is painted in.
 *
 * Written up in `docs/logo.md` and `docs/header-lockup.md`, including why it is
 * drawn here rather than being `<RobotArm size={28} />`.
 */

import * as React from "react"

import { useRobotArm } from "@/hooks/use-robot-arm"
import { clamp, toDegrees, type Vec2 } from "@/lib/robocn/kinematics"
import { px } from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

/* Geometry, in the 24 x 24 box. Heavy enough to survive a 28 px raster. */
const VIEW = 24
/** The cell: a rounded square the arm stands inside. */
const CELL = { x: 1, y: 1, size: 22, radius: 6.2 } as const
const SHOULDER: Vec2 = { x: 9.2, y: 14.2 }
const LINKS = [6, 4, 2.9]
/** Where the arm parks: 0.85 of reach, up and right, sweeping into the cell. */
const REST: Vec2 = { x: 17.2, y: 6.8 }
/** Stroke weight per link, shoulder outward — the limb tapers. */
const WEIGHTS = [2.1, 1.7, 1.15]
/**
 * Joint radius per joint, shoulder outward. Each is wider than the link it caps,
 * so a joint reads as a collar; none is wide enough to swallow the pedestal.
 */
const HUBS = [2.4, 1.95, 1.35]
/**
 * Bore radius per joint. The wrist is solid: at 28 px a ring around a 1.35 hub
 * is under a pixel, and reads as dirt rather than as a bearing.
 */
const BORES = [1.15, 0.85, 0]
/** The tool. Sized so it clears the wrist hub rather than fusing with it. */
const TOOL = 1.5

/** Reach the goal is held between, so the pose never folds or over-extends. */
const MIN_REACH = 6.5
const MAX_REACH = 12
/**
 * Click distance, in pixels, that buys the whole of that reach — a fraction of
 * the viewport rather than a fixed number, so a click halfway across the page
 * puts the arm at full stretch on any screen.
 */
function reachSpan() {
  return Math.max(320, Math.min(window.innerWidth, window.innerHeight) * 0.5)
}
/** The goal stays this far inside the box, so no elbow leaves the cell. */
const INSET = 3.6
/**
 * Radians above each horizon the arm refuses to drop below — it works the half
 * plane above its own shoulder, because anything lower folds the chain over its
 * own pedestal and the mark turns to mush at 36 px.
 */
const HORIZON = 0.06
/**
 * How much of a click's vertical distance survives into the aim angle, once
 * that distance has been turned into elevation. The page is almost entirely
 * below a header-height shoulder, so taking the bearing literally would flatten
 * nearly every click to the same horizontal pose; at a third, a click far down
 * the page raises the arm a little, one just under the header barely at all,
 * and left-to-right still gets the whole sweep.
 */
const DOWNWEIGHT = 0.34
/**
 * Where the aim is kept. The pose is the visitor's, not the page's: it survives
 * a route change (the header never unmounts) and a reload (this).
 */
const STORE = "robocn:logo-aim"

export type LogoBehavior = "pointer" | "idle" | "static"

export interface LogoProps extends Omit<React.ComponentProps<"svg">, "children"> {
  /**
   * `pointer` re-aims on every click and holds that pose, `idle` drifts around
   * the parked pose, `static` parks at the mark pose and runs no loop — which
   * is what the social card captures.
   */
  behavior?: LogoBehavior
  /** Off draws the bare machine, for a ground that already supplies the frame. */
  cell?: boolean
}

/** Hold a goal above the plinth and inside the cell. */
function clampGoal(goal: Vec2): Vec2 {
  return {
    x: clamp(goal.x, INSET, VIEW - INSET),
    y: clamp(goal.y, INSET, SHOULDER.y - 1.4),
  }
}

/**
 * Where a click puts the tool tip, in world units.
 *
 * Bearing gives the side, distance gives the reach, and vertical distance is
 * folded into elevation rather than taken literally: the arm works the half
 * plane above its shoulder, so a click below it is answered by raising the arm
 * on that side rather than by driving the chain through its own plinth. Two
 * clicks a little apart give two poses a little apart, everywhere on the page.
 */
function aimAt(event: { clientX: number; clientY: number }, rect: DOMRect): Vec2 {
  const shoulder = {
    x: rect.left + (SHOULDER.x / VIEW) * rect.width,
    y: rect.top + (SHOULDER.y / VIEW) * rect.height,
  }
  const away = { x: event.clientX - shoulder.x, y: event.clientY - shoulder.y }
  // Above the shoulder the arm points straight at the click; below it, the drop
  // is weighted and turned into lift on the same side.
  const rise = away.y > 0 ? -away.y * DOWNWEIGHT : away.y
  const angle = clamp(Math.atan2(rise, away.x), -Math.PI + HORIZON, -HORIZON)
  const reach = MIN_REACH + (MAX_REACH - MIN_REACH) * clamp(Math.hypot(away.x, away.y) / reachSpan(), 0, 1)
  return clampGoal({
    x: SHOULDER.x + Math.cos(angle) * reach,
    y: SHOULDER.y + Math.sin(angle) * reach,
  })
}

/**
 * The aim is kept in `localStorage` and read as an external store, so the pose
 * is shared state rather than component state: every mark on the page agrees,
 * a second tab picks up a re-aim through the `storage` event, and React does
 * the hydration dance itself — the server renders the parked pose, the client
 * swaps in the stored one on its own first pass.
 */
const watchers = new Set<() => void>()

function subscribeAim(onChange: () => void) {
  watchers.add(onChange)
  window.addEventListener("storage", onChange)
  return () => {
    watchers.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}

/** The raw stored string: a value React can compare between renders. */
function readAim(): string | null {
  try {
    return window.localStorage.getItem(STORE)
  } catch {
    // Private windows and blocked storage both throw on read; the mark parks.
    return null
  }
}

function writeAim(goal: Vec2) {
  try {
    window.localStorage.setItem(STORE, JSON.stringify(goal))
  } catch {
    // Storage full or blocked: the arm still moves, it just forgets on reload.
  }
  // `storage` only fires in *other* tabs, so this one is told directly.
  for (const watcher of watchers) watcher()
}

/** A stored aim, if there is one and it is still a point in the cell. */
function parseAim(raw: string | null): Vec2 | null {
  if (!raw) return null
  try {
    const held = JSON.parse(raw) as Partial<Vec2>
    if (typeof held?.x !== "number" || typeof held?.y !== "number") return null
    return clampGoal({ x: held.x, y: held.y })
  } catch {
    return null
  }
}

function Logo({ behavior = "pointer", cell = true, className, ...props }: LogoProps) {
  const ref = React.useRef<SVGSVGElement>(null)
  const [firing, setFiring] = React.useState(false)

  const live = behavior !== "static"

  /** The last place the page was clicked, in world units. */
  const stored = React.useSyncExternalStore(subscribeAim, readAim, () => null)
  const aim = React.useMemo(
    () => (behavior === "pointer" ? parseAim(stored) : null),
    [behavior, stored],
  )

  React.useEffect(() => {
    const svg = ref.current
    if (behavior !== "pointer" || !svg) return
    // The mark is a 36 px square in the header; the thing worth pressing is
    // whatever it sits in — the home link.
    const zone = svg.closest("a") ?? svg

    const take = (event: PointerEvent) => {
      const rect = svg.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      writeAim(aimAt(event, rect))
    }
    const fire = () => setFiring(true)
    const stop = () => setFiring(false)

    // Capture, so a click on something that stops propagation still re-aims.
    window.addEventListener("pointerdown", take, { capture: true, passive: true })
    window.addEventListener("pointerup", stop)
    zone.addEventListener("pointerdown", fire)
    zone.addEventListener("pointerleave", stop)
    zone.addEventListener("focusin", fire)
    zone.addEventListener("focusout", stop)
    return () => {
      window.removeEventListener("pointerdown", take, { capture: true })
      window.removeEventListener("pointerup", stop)
      zone.removeEventListener("pointerdown", fire)
      zone.removeEventListener("pointerleave", stop)
      zone.removeEventListener("focusin", fire)
      zone.removeEventListener("focusout", stop)
      setFiring(false)
    }
  }, [behavior])

  /**
   * Until the page has been clicked the mark drifts around its parked pose, so
   * a first visit still shows a machine rather than a diagram. A clock of zero
   * is the parked pose exactly, which is what the server renders.
   */
  const drift = React.useCallback(
    (clock: number) => ({
      x: REST.x + Math.sin(clock * 0.62) * 1.2,
      y: REST.y + Math.sin(clock * 0.94) * 0.8,
    }),
    [],
  )

  const pose = useRobotArm({
    links: LINKS,
    root: SHOULDER,
    // A held aim is a fixed target: the arm travels to it, then the loop stops
    // and the pose stands until the next click.
    target: aim ?? (live ? drift : REST),
    // Elbow up and over rather than curled: the silhouette of a machine that
    // stands on a plinth, and the one that survives being 28 px tall.
    bend: "down",
    // Fast enough that the arm answers the click rather than creeping there:
    // the whole envelope in about a fifth of a second.
    speed: 96,
    animate: live,
  })

  const { joints } = pose
  const tip = joints[joints.length - 1]
  const wrist = joints[joints.length - 2]
  const tool = toDegrees(Math.atan2(tip.y - wrist.y, tip.x - wrist.x))

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      fill="none"
      aria-hidden
      className={cn("size-7", className)}
      {...props}
    >
      {/* The work cell. Tinted rather than filled, so the header's ground still
          shows through and the mark never reads as a button. */}
      {cell ? (
        <rect
          x={CELL.x}
          y={CELL.y}
          width={CELL.size}
          height={CELL.size}
          rx={CELL.radius}
          className="fill-shell/8 stroke-shell/38"
          strokeWidth="1.1"
        />
      ) : null}

      {/* Foot and pedestal: the only part of the machine that holds still. The
          pedestal is narrower than the shoulder hub, so it reads as a column
          the arm is bolted to rather than as more of the same blob. */}
      <path d="M5.8 19.7H12.6" className="stroke-shell" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M7.2 18.9L7.9 14.2H10.5L11.2 18.9Z" className="fill-shell" />

      {joints.slice(0, -1).map((joint, i) => (
        <path
          key={i}
          d={`M${px(joint.x)} ${px(joint.y)}L${px(joints[i + 1].x)} ${px(joints[i + 1].y)}`}
          className="stroke-shell"
          strokeWidth={WEIGHTS[i]}
          strokeLinecap="round"
        />
      ))}

      {/* Hub, then the bore through it in the page's own ground: a bearing, not
          a bead. Two passes so every hub sits over every link. */}
      {joints.slice(0, -1).map((joint, i) => (
        <circle key={i} cx={px(joint.x)} cy={px(joint.y)} r={HUBS[i]} className="fill-shell" />
      ))}
      {joints.slice(0, -1).map((joint, i) =>
        BORES[i] > 0 ? (
          <circle
            key={i}
            cx={px(joint.x)}
            cy={px(joint.y)}
            r={BORES[i]}
            className="fill-background"
          />
        ) : null,
      )}

      <g transform={`translate(${px(tip.x)} ${px(tip.y)}) rotate(${px(tool)})`}>
        <circle cx={0} cy={0} r={firing ? TOOL + 0.3 : TOOL} className="fill-shell-hot" />
        {firing
          ? [0, 1, 2, 3].map((i) => (
              <circle
                key={i}
                className="robocn-spark fill-shell-hot"
                cx={0.7}
                cy={(i - 1.5) * 0.8}
                r={0.5}
                style={{ animationDelay: `${i * -0.17}s` }}
              />
            ))
          : null}
      </g>
    </svg>
  )
}

export { Logo }
