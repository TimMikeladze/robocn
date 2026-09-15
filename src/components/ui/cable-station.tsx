"use client"

/**
 * cable-station — a selectorised weight stack, and the rope that stands between
 * it and the handle.
 *
 * Nothing on this machine reports the weight on the pin. What a person holds is
 * the selected weight divided by the number of falling lines under the load,
 * and the stack comes up by the handle's travel divided by the same number —
 * so `lines` is the only control that sets the mechanical advantage, and the
 * advantage is never a prop. Move the pin and the stack splits: the pinned plate
 * and everything above it ride the riser, everything below stays on the floor.
 *
 * The mechanism is solved in `src/lib/robocn/gym.ts` — pure, no React, tested on
 * its own — over the block-and-tackle travel constraint in `linkage.ts`. The
 * drawing only reads the pose it produces.
 *
 * Illustrated: the rope is inextensible and the sheaves are frictionless, so
 * the advantage is the ideal one. Nothing here models rope stretch, sheave
 * efficiency or the weight of the riser itself.
 *
 * Drawn once in the profile elevation and pushed through `robotCamera`, so all
 * four views are the same geometry rather than four drawings that drift apart.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, type Vec2 } from "@/lib/robocn/kinematics"
import { tackleReeving } from "@/lib/robocn/linkage"
import { reeveStack, type StackGeometry } from "@/lib/robocn/gym"
import {
  boxCorners,
  elevationDraft,
  fitTransform,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

/** What the machine does with nobody driving it. Always includes `static`. */
export type CableStationBehavior = "press" | "pyramid" | "hold" | "static"

const VIEW_WIDTH = 210
const VIEW_HEIGHT = 260
const NATIVE_VIEW: RobotView = "profile"

/** World units. x along the drawing, y up from the ground, z out of the plane. */
const ENVELOPE = boxCorners({ x: -34, y: 0, z: -82 }, { x: 34, y: 206, z: 76 })

const STACK_X = -56
const POST_X = 56
const CROWN_Y = 186
/** Top of the base pad: where the stack rests. */
const BASE_Y = 12
/** Half the width of a plate, and half its depth out of the drawing. */
const PLATE_HALF = 16
const PLATE_DEPTH = 13
/** Where the fast line turns at the crown, and where the reeving hangs from. */
const TURN_Y = CROWN_Y - 9
const CROWN_Y_SHEAVE = CROWN_Y - 20
/** The handle's own travel: down the post from just under the turn to the base. */
const HANDLE_TOP = TURN_Y - 14
const HANDLE_FLOOR = 18
const FRAME_TRAVEL = HANDLE_TOP - HANDLE_FLOOR

const PLATE_HEIGHT = 7
const PLATE_GAP = 1.2
const HEADROOM = 42

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/**
 * Handle travel at `clock`, 0 racked to 1 at the bottom of the pull. Every
 * behaviour is a pure function of the clock, exported so motion can be tested
 * by sampling it rather than by faking animation frames.
 */
export function cableStationDraw(behavior: CableStationBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0.35
  const t = ((clock % 1) + 1) % 1
  switch (behavior) {
    // A set that shortens and lengthens again: the reps stay honest, the range
    // is what gives out.
    case "pyramid": {
      const depth = 0.45 + 0.55 * Math.sin(Math.PI * t)
      return depth * (1 - Math.cos(t * Math.PI * 12)) * 0.5
    }
    // Pulled down and held, with the tremor of something being held.
    case "hold":
      return clamp(0.82 + Math.sin(t * Math.PI * 16) * 0.025, 0, 1)
    default:
      return (1 - Math.cos(t * Math.PI * 2)) / 2
  }
}

export interface CableStationProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled handle travel, 0 racked to 1 pulled out. Supplying it stops the loop. */
  draw?: number
  onDrawChange?: (draw: number) => void
  behavior?: CableStationBehavior
  /**
   * Which plate the selector pin is in, counted from the top: 0 pins the top
   * plate alone. That plate and everything above it ride the riser.
   */
  pin?: number
  /** Plates in the stack. */
  plates?: number
  /** Falling lines under the load. This — and only this — sets the advantage. */
  lines?: number
  /** What one plate weighs, for the readout. */
  plateWeight?: number
  showGround?: boolean
  /** Where the camera stands. Defaults to the view the machine was drawn in. */
  view?: RobotView
  speed?: number
  phase?: number
  paused?: boolean
  animate?: boolean
  interactive?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function CableStation({
  draw,
  onDrawChange,
  behavior = "press",
  pin = 5,
  plates = 10,
  lines = 2,
  plateWeight = 5,
  showGround = true,
  view = NATIVE_VIEW,
  speed = 0.35,
  phase = 0,
  paused = false,
  animate = true,
  interactive = false,
  label,
  size = "md",
  variant = "solid",
  color,
  accent,
  metal,
  dark,
  glow,
  grid,
  palette: paletteOverride,
  className,
  style,
  role,
  tabIndex,
  onKeyDown,
  onBlur,
  "aria-label": ariaLabel,
  ...props
}: CableStationProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = draw !== undefined

  // Controlled wins and pins the value; the clock keeps running underneath, so
  // release reads as the stack settling rather than a jump.
  const hold = controlled ? (Number.isFinite(draw) ? clamp(draw as number, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => cableStationDraw(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: 1.6,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const pulled = clamp(motion.value, 0, 1)

  const stack: StackGeometry = React.useMemo(
    () => ({
      plates: Math.max(1, Math.round(Number.isFinite(plates) ? plates : 10)),
      plateHeight: PLATE_HEIGHT,
      plateGap: PLATE_GAP,
      lines: clamp(Math.round(Number.isFinite(lines) ? lines : 2), 1, 6),
      plateWeight: Number.isFinite(plateWeight) ? plateWeight : 5,
      pin: Math.round(Number.isFinite(pin) ? pin : 0),
      headroom: HEADROOM,
    }),
    [plates, lines, plateWeight, pin],
  )

  // The handle has to travel `headroom × lines` to bring the stack up by its
  // headroom — which is the whole mechanism, so it is measured, not assumed.
  // Past four lines that is more rope than there is post, so the pull runs out
  // of floor before the stack runs out of headroom, and the frame is the limit.
  const maxDraw = Math.min(HEADROOM * stack.lines, FRAME_TRAVEL)
  const lift = reeveStack(pulled * maxDraw, stack)

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const { point: to, path: line, solid, box, bar, disc } = elevationDraft(camera, "profile")

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 100) / 100
      setHeld(bounded)
      onDrawChange?.(bounded)
    },
    [onDrawChange],
  )
  const dragging = useRobotDrag(svgRef, {
    // `onDrag` must stay in a `useCallback` or the listeners rebind every render.
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(unit.y), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const plate = robotSurface("shell", variant, palette, 0.8)

  /* ----------------------------------------------------------- the reeving */

  const pitch = PLATE_HEIGHT + PLATE_GAP
  const topPlate = BASE_Y + (stack.plates - 1) * pitch + lift.rise
  const blockY = topPlate + PLATE_HEIGHT + 13
  const crownAt: Vec2 = { x: STACK_X, y: CROWN_Y_SHEAVE }
  const blockAt: Vec2 = { x: STACK_X, y: blockY }
  const reeving = tackleReeving(crownAt, blockAt, stack.lines, 9)
  const fast = reeving[reeving.length - 1]
  const handleY = HANDLE_TOP - pulled * maxDraw
  // Dead line down from the crown, the falls, then over the two turning
  // sheaves and down the post to the handle. One polyline, one rope.
  const cable: Vec2[] = [
    ...reeving,
    { x: fast.x, y: TURN_Y },
    { x: POST_X, y: TURN_Y },
    { x: POST_X, y: handleY },
  ]

  const percent = Math.round(pulled * 100)
  const weight = Math.round(lift.weight * 10) / 10
  const atHandle = Math.round(lift.handleForce * 10) / 10

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Cable station, ${lift.selected} of ${stack.plates} plates selected at ${weight}, reeved on ${lift.advantage} lines for a mechanical advantage of ${lift.advantage}, so the handle holds ${atHandle}, ${viewNames[view] ?? viewNames.profile}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(pulled) : undefined}
      aria-valuetext={interactive ? `${percent} percent drawn, handle holding ${atHandle}` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.2)
        if (delta !== 0) apply(pulled + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      width={width}
      height={px((width * VIEW_HEIGHT) / VIEW_WIDTH)}
      className={cn(
        "max-w-full select-none",
        interactive &&
          "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]",
        dragging && "cursor-grabbing",
        className,
      )}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && (
        <path
          d={`M 10 ${VIEW_HEIGHT - 26} H ${VIEW_WIDTH - 10}`}
          fill="none"
          stroke={palette.grid}
          strokeWidth={0.5}
          strokeDasharray="3 4"
          opacity={0.4}
        />
      )}

      <g data-view={view} transform={frame || undefined}>
        {showGround && (
          <>
            <path
              data-ground
              d={solid([{ x: -80, y: 0 }, { x: 74, y: 0 }], 34)}
              fill={palette.dark}
              opacity={0.12}
            />
            <path
              d={line([{ x: -80, y: 0 }, { x: 74, y: 0 }])}
              fill="none"
              stroke={palette.dark}
              strokeWidth={1}
              opacity={0.5}
            />
          </>
        )}

        <g data-frame>
          <path d={box(-78, 0, 72, BASE_Y, 30)} {...cast} />
          {/* Guide rods the stack slides on, and the post the handle runs down. */}
          {[-1, 1].map((side) => (
            <path
              key={side}
              data-guide
              d={bar(
                { x: STACK_X + side * (PLATE_HALF + 3), y: BASE_Y },
                { x: STACK_X + side * (PLATE_HALF + 3), y: CROWN_Y },
                1.7,
                1.7,
              )}
              {...machined}
            />
          ))}
          <path d={bar({ x: POST_X, y: BASE_Y }, { x: POST_X, y: CROWN_Y }, 6, 7)} {...shell} />
          <path d={bar({ x: STACK_X, y: CROWN_Y }, { x: POST_X, y: CROWN_Y }, 5, 6)} {...shell} />
          {/* The tie that makes the two columns one frame. */}
          <path
            d={bar({ x: STACK_X + PLATE_HALF + 3, y: 46 }, { x: POST_X, y: 46 }, 3, 4)}
            {...machined}
          />
        </g>

        {/* The stack. Above the pin it rides; below it, it never moves. */}
        <g data-stack data-rise={px(lift.rise)}>
          {lift.plates.map((entry) => (
            <g key={entry.index} data-plate data-rising={entry.rising ? "" : undefined}>
              <path
                d={box(
                  STACK_X - PLATE_HALF,
                  BASE_Y + entry.y,
                  STACK_X + PLATE_HALF,
                  BASE_Y + entry.y + PLATE_HEIGHT,
                  PLATE_DEPTH,
                )}
                {...(entry.rising ? plate : cast)}
              />
              <path
                d={disc(
                  { x: STACK_X + 8, y: BASE_Y + entry.y + PLATE_HEIGHT / 2 },
                  1.5,
                  1.5,
                  PLATE_DEPTH,
                )}
                fill={palette.dark}
                stroke="none"
                opacity={0.7}
              />
            </g>
          ))}

          {/* The pin: the only thing deciding how much of the stack is weight. */}
          <g data-pin>
            <path
              d={bar(
                { x: STACK_X + 4, y: BASE_Y + lift.plates[lift.pin].y + PLATE_HEIGHT / 2 },
                { x: STACK_X + 13, y: BASE_Y + lift.plates[lift.pin].y + PLATE_HEIGHT / 2 },
                1.5,
                1.5,
                PLATE_DEPTH + 3,
              )}
              {...machined}
            />
            <path
              d={disc(
                { x: STACK_X + 14, y: BASE_Y + lift.plates[lift.pin].y + PLATE_HEIGHT / 2 },
                3,
                2.2,
                PLATE_DEPTH + 4,
              )}
              fill={palette.accent}
              stroke="none"
            />
          </g>

          {/* Riser rod and the travelling block the falls hang off. */}
          <g data-riser>
            <path
              d={bar({ x: STACK_X, y: BASE_Y + 4 }, { x: STACK_X, y: blockY }, 2.2, 2.2)}
              {...machined}
            />
            <path d={box(STACK_X - 11, blockY - 5, STACK_X + 11, blockY + 4, 5)} {...cast} />
          </g>
        </g>

        {/* Sheaves: one per vertex the rope actually turns at. */}
        <g data-sheaves>
          {reeving.map((point, index) => (
            <path
              key={`${index}:${px(point.x)}`}
              d={disc(point, 4.4, 2.6)}
              {...machined}
            />
          ))}
          <path d={disc({ x: fast.x, y: TURN_Y }, 5, 2.8)} {...machined} />
          <path d={disc({ x: POST_X, y: TURN_Y }, 5, 2.8)} {...machined} />
        </g>

        {/* One rope, from the dead-line anchor to the handle. */}
        <path
          data-cable
          data-lines={lift.advantage}
          d={line(cable)}
          fill="none"
          stroke={palette.accent}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <g data-handle data-draw={px(pulled)}>
          <path d={bar({ x: POST_X, y: handleY + 3 }, { x: POST_X, y: handleY - 3 }, 1.4, 1.4)} {...machined} />
          <path d={bar({ x: POST_X - 13, y: handleY - 5 }, { x: POST_X + 13, y: handleY - 5 }, 2.6, 2.6)} {...shell} />
          <path d={disc({ x: POST_X, y: handleY - 5 }, 3, 3.4)} fill={palette.accent} stroke="none" />
        </g>

        {variant === "blueprint" && (
          <text
            x={px(to({ x: -2, y: 118 }).x)}
            y={px(to({ x: -2, y: 118 }).y)}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize={7}
            fill={palette.foreground}
          >
            {`${lift.advantage}:1 · ${atHandle}`}
          </text>
        )}
      </g>

      {label && (
        <text
          x={VIEW_WIDTH / 2}
          y={VIEW_HEIGHT - 7}
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fontSize={6}
          fill={palette.foreground}
        >
          {label}
        </text>
      )}
    </svg>
  )
}

export { CableStation }
