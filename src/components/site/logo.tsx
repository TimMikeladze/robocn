"use client"

/**
 * The mark is a machine in its cell.
 *
 * Not a drawing of an arm — an arm: a three-link chain solved every frame by
 * the same `useRobotArm` core that drives `robot-arm` and `robot-arm-3d`. It
 * aims at the cursor anywhere on the page, drifts when left alone, and fires
 * its welder when the thing it sits in is pressed or focused.
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
/** Extra reach per pixel of cursor distance: the arm stretches for a far cursor. */
const PER_PIXEL = 0.022
/** The goal stays this far inside the box, so no elbow leaves the cell. */
const INSET = 3.6
/** Radians above each horizon the arm refuses to drop below — it sits on a plinth. */
const HORIZON = 0.06
/** How long a cursor position is worth holding before the arm goes back to drifting. */
const HOLD = 2400

export type LogoBehavior = "pointer" | "idle" | "static"

export interface LogoProps extends Omit<React.ComponentProps<"svg">, "children"> {
  /**
   * `pointer` aims at the cursor and drifts when it goes quiet, `idle` only
   * drifts, `static` parks at the mark pose and runs no loop — which is what
   * the social card captures.
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

/** Where the cursor puts the tool tip, in world units. */
function aimAt(event: PointerEvent, rect: DOMRect): Vec2 {
  const shoulder = {
    x: rect.left + (SHOULDER.x / VIEW) * rect.width,
    y: rect.top + (SHOULDER.y / VIEW) * rect.height,
  }
  const away = { x: event.clientX - shoulder.x, y: event.clientY - shoulder.y }
  // The arm stands on a base: it works the half-plane above its own shoulder,
  // and a cursor below that is served by the nearer horizon rather than ignored.
  const raw = Math.atan2(away.y, away.x)
  const angle =
    raw >= 0
      ? raw < Math.PI / 2
        ? -HORIZON
        : -Math.PI + HORIZON
      : clamp(raw, -Math.PI + HORIZON, -HORIZON)
  const stretch = clamp(MIN_REACH + Math.hypot(away.x, away.y) * PER_PIXEL, MIN_REACH, MAX_REACH)
  return clampGoal({
    x: SHOULDER.x + Math.cos(angle) * stretch,
    y: SHOULDER.y + Math.sin(angle) * stretch,
  })
}

function Logo({ behavior = "pointer", cell = true, className, ...props }: LogoProps) {
  const ref = React.useRef<SVGSVGElement>(null)
  /** Written by the pointer listener and read by the loop, so tracking the
   *  cursor across the whole page costs the header no React renders. */
  const aim = React.useRef<Vec2 | null>(null)
  const aimedAt = React.useRef(0)
  const [firing, setFiring] = React.useState(false)

  const live = behavior !== "static"

  React.useEffect(() => {
    const svg = ref.current
    if (behavior !== "pointer" || !svg) return
    // The mark is 28 px across; the thing worth pressing is whatever it sits
    // in — the home link in the header.
    const zone = svg.closest("a") ?? svg

    const move = (event: PointerEvent) => {
      const rect = svg.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      aim.current = aimAt(event, rect)
      aimedAt.current = performance.now()
    }
    const fire = () => setFiring(true)
    const stop = () => setFiring(false)

    window.addEventListener("pointermove", move, { passive: true })
    window.addEventListener("pointerup", stop)
    zone.addEventListener("pointerdown", fire)
    zone.addEventListener("pointerleave", stop)
    zone.addEventListener("focusin", fire)
    zone.addEventListener("focusout", stop)
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", stop)
      zone.removeEventListener("pointerdown", fire)
      zone.removeEventListener("pointerleave", stop)
      zone.removeEventListener("focusin", fire)
      zone.removeEventListener("focusout", stop)
      setFiring(false)
    }
  }, [behavior])

  /**
   * A path rather than a point, so the loop re-reads the cursor every frame and
   * a fresh aim never rebuilds the effect. A clock of zero is the parked pose,
   * which is what the server renders.
   */
  const path = React.useCallback((clock: number) => {
    const held = aim.current
    if (held && performance.now() - aimedAt.current < HOLD) return held
    return {
      x: REST.x + Math.sin(clock * 0.62) * 1.2,
      y: REST.y + Math.sin(clock * 0.94) * 0.8,
    }
  }, [])

  const pose = useRobotArm({
    links: LINKS,
    root: SHOULDER,
    target: live ? path : REST,
    // Elbow up and over rather than curled: the silhouette of a machine that
    // stands on a plinth, and the one that survives being 28 px tall.
    bend: "down",
    speed: 32,
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
