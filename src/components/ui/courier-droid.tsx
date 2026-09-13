import * as React from "react"

import { clamp } from "@/lib/robocn/kinematics"
import {
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotSurface,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type CourierDroidCargo = "none" | "pod" | "crate" | "tools"

export interface CourierDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  heading?: number
  steering?: number
  travel?: number
  cargo?: CourierDroidCargo
  antenna?: "whip" | "dish" | "none"
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

function CourierDroid({
  size = "md",
  variant = "solid",
  heading = 0,
  steering = 0,
  travel = 0,
  cargo = "none",
  antenna = "whip",
  signal = "ready",
  showGround = true,
  label,
  color,
  accent,
  metal,
  dark,
  glow,
  grid,
  palette: paletteOverride,
  className,
  style,
  ...props
}: CourierDroidProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const turn = finite(heading)
  const steer = finiteClamp(steering, -45, 45)
  const tread = wrap(travel)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor = signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal
  const clipId = `courier-${React.useId().replace(/:/g, "")}`

  return (
    <svg
      role="img"
      aria-label={`Courier droid, heading ${Math.round(((turn % 360) + 360) % 360)} degrees`}
      viewBox="0 0 210 170"
      width={width}
      height={px(width * 0.81)}
      className={cn("max-w-full select-none", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      <defs><clipPath id={clipId}><rect x={-10} y={-17} width={20} height={34} rx={5} /></clipPath></defs>
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d="M 16 145 H 194 M 105 12 V 151" strokeDasharray="2 3" />
          <circle cx={105} cy={87} r={70} strokeDasharray="2 3" />
        </g>
      )}
      {showGround && <ellipse cx={105} cy={138} rx={70} ry={7} fill={palette.dark} opacity={0.14} />}
      <g data-chassis transform={`translate(105 91) rotate(${px(turn)})`}>
        {[-1, 1].flatMap((side) => [-1, 1].map((axle) => {
          const front = axle < 0
          const x = side * 48
          const y = axle * 28
          const wheelTurn = front ? steer : 0
          return (
            <g
              key={`${side}-${axle}`}
              data-wheel={front && side > 0 ? "front" : `${front ? "front" : "rear"}-${side < 0 ? "left" : "right"}`}
              transform={`translate(${x} ${y}) rotate(${px(wheelTurn)})`}
            >
              <rect x={-10} y={-17} width={20} height={34} rx={5} {...cast} />
              <g clipPath={`url(#${clipId})`} transform={`translate(0 ${px(tread * 7)})`} stroke={palette.metal} strokeWidth={1.3}>
                {[-21, -14, -7, 0, 7, 14, 21].map((offset) => <path key={offset} d={`M -8 ${offset} H 8`} />)}
              </g>
            </g>
          )
        }))}
        <path d="M -47 -36 L -34 -48 H 34 L 47 -36 V 36 L 34 48 H -34 L -47 36 Z" {...shell} />
        <path d="M -38 -27 L -27 -37 H 27 L 38 -27 V 15 H -38 Z" {...machined} />
        <rect x={-29} y={-18} width={58} height={22} rx={5} {...cast} />
        <path d="M -21 -11 H 21 M -21 -4 H 21" stroke={palette.metal} strokeWidth={2} />
        <circle cx={-31} cy={26} r={5} fill={signalColor} className={signal === "ready" ? "robocn-pulse" : undefined} />
        <rect x={-19} y={21} width={38} height={9} rx={3} {...cast} />
        <path d="M -8 -42 L 0 -50 L 8 -42" fill="none" stroke={palette.accent} strokeWidth={2} />

        {cargo !== "none" && (
          <g data-cargo={cargo} transform="translate(0 9)">
            {cargo === "pod" && <path d="M -24 -13 Q -20 -30 0 -32 Q 20 -30 24 -13 V 7 H -24 Z" {...shell} />}
            {cargo === "crate" && <g><rect x={-24} y={-28} width={48} height={35} rx={3} {...shell} /><path d="M -20 -24 L 20 3 M 20 -24 L -20 3" stroke={palette.dark} strokeWidth={2} /></g>}
            {cargo === "tools" && <g><rect x={-25} y={-20} width={50} height={27} rx={5} {...cast} />{[-15, 0, 15].map((x) => <circle key={x} cx={x} cy={-7} r={6} {...machined} />)}</g>}
          </g>
        )}

        {antenna !== "none" && (
          <g data-antenna={antenna}>
            {antenna === "whip" ? (
              <g><path d="M 30 -35 Q 38 -56 32 -72" fill="none" stroke={palette.dark} strokeWidth={1.8} /><circle cx={32} cy={-74} r={2.5} fill={signalColor} /></g>
            ) : (
              <g transform="translate(31 -40)"><path d="M 0 0 V -19" stroke={palette.dark} strokeWidth={2} /><path d="M -11 -19 Q 0 -8 11 -19 Q 0 -28 -11 -19 Z" {...machined} /></g>
            )}
          </g>
        )}
      </g>
      {label && <text x={105} y={164} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

const finite = (value: number) => Number.isFinite(value) ? value : 0
const finiteClamp = (value: number, min: number, max: number) => clamp(finite(value), min, max)
const wrap = (value: number) => ((finite(value) % 1) + 1) % 1

export { CourierDroid }
