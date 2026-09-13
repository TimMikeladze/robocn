"use client"

/**
 * arm-controls — a teach pendant.
 *
 * One slider per joint, driving an arm in forward kinematics: pass the same
 * `angles` array to `RobotArm` and the arm is posed joint by joint instead of
 * chasing a target. Also carries the tool selector and live readouts, because
 * that is what sits next to the sliders on a real pendant.
 *
 * A pendant also runs programs, so this one does: play, and it drives the same
 * `onAnglesChange` a slider does, frame by frame. Touch a slider and playback
 * stops — whoever has their hand on the machine has control of it.
 */

import * as React from "react"
import { Pause, Play, RotateCcw } from "lucide-react"

import { useRobotClock } from "@/hooks/use-robot-motion"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import type { RobotTool } from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

const ALL_TOOLS: RobotTool[] = [
  "gripper",
  "welder",
  "painter",
  "cutter",
  "scanner",
  "vacuum",
  "magnet",
  "none",
]

export interface ArmControlsProps
  extends Omit<React.ComponentProps<"div">, "onChange"> {
  /** One angle per joint, in degrees, relative to the previous segment. */
  angles: number[]
  onAnglesChange: (angles: number[]) => void
  /** One range for every joint, or a range each. */
  limits?: [number, number] | [number, number][]
  /** Joint names. Defaults to J1, J2, … */
  labels?: string[]
  title?: string
  description?: string
  tool?: RobotTool
  onToolChange?: (tool: RobotTool) => void
  /** Which tools to offer. Defaults to all of them. */
  tools?: RobotTool[]
  /** Extra values to show under the sliders, e.g. the tip position. */
  readouts?: { label: string; value: React.ReactNode }[]
  /** Shown as a reset button when provided. */
  onReset?: () => void
  /**
   * Offer a play button that runs `program` into `onAnglesChange`. Moving a
   * slider stops it.
   */
  playable?: boolean
  /** Joint angles at `clock` seconds. Defaults to a sweep of every joint. */
  program?: (clock: number, limits: [number, number][]) => number[]
  /** Program cycles per second. */
  speed?: number
  playing?: boolean
  onPlayingChange?: (playing: boolean) => void
}

function ArmControls({
  angles,
  onAnglesChange,
  limits = [-180, 180],
  labels,
  title = "Teach pendant",
  description,
  tool,
  onToolChange,
  tools = ALL_TOOLS,
  readouts,
  onReset,
  playable = false,
  program = jointSweep,
  speed = 0.2,
  playing: playingProp,
  onPlayingChange,
  className,
  ...props
}: ArmControlsProps) {
  const rangeFor = (index: number): [number, number] =>
    Array.isArray(limits[0])
      ? ((limits as [number, number][])[index] ?? [-180, 180])
      : (limits as [number, number])
  const ranges = angles.map((_, index) => rangeFor(index))

  const [playingState, setPlayingState] = React.useState(false)
  const playing = playingProp ?? playingState
  const setPlaying = React.useCallback((next: boolean) => {
    setPlayingState(next)
    onPlayingChange?.(next)
  }, [onPlayingChange, setPlayingState])

  const clock = useRobotClock({ speed, animate: playable && playing })
  // The program drives the same callback the sliders do, so nothing downstream
  // has to know whether a person or the pendant is moving the arm.
  const posed = React.useRef<number[] | null>(null)
  React.useEffect(() => {
    if (!playable || !playing) return
    const next = program(clock, ranges)
    if (posed.current && next.every((angle, i) => angle === posed.current![i])) return
    posed.current = next
    onAnglesChange(next)
  })

  return (
    <Card className={cn("w-full max-w-xs", className)} {...props}>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {description ? (
          <CardDescription>{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        {angles.map((angle, index) => {
          const [min, max] = rangeFor(index)
          const name = labels?.[index] ?? `J${index + 1}`
          return (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`joint-${index}`} className="text-xs">
                  {name}
                </Label>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {angle.toFixed(0)}°
                </span>
              </div>
              <Slider
                id={`joint-${index}`}
                min={min}
                max={max}
                step={1}
                value={[angle]}
                onValueChange={(next) => {
                  // A hand on a slider outranks the program.
                  if (playing) setPlaying(false)
                  const updated = [...angles]
                  updated[index] = Array.isArray(next) ? next[0] : next
                  onAnglesChange(updated)
                }}
                aria-label={`${name} angle in degrees`}
              />
            </div>
          )
        })}

        {onToolChange ? (
          <div className="space-y-2">
            <Label htmlFor="tool" className="text-xs">
              End effector
            </Label>
            <Select
              value={tool}
              onValueChange={(next) => onToolChange(next as RobotTool)}
            >
              <SelectTrigger id="tool" className="w-full" size="sm">
                <SelectValue placeholder="Tool" />
              </SelectTrigger>
              <SelectContent>
                {tools.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {readouts?.length ? (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t pt-3 text-xs">
            {readouts.map((readout) => (
              <React.Fragment key={readout.label}>
                <dt className="text-muted-foreground">{readout.label}</dt>
                <dd className="text-right font-mono tabular-nums">
                  {readout.value}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        ) : null}

        {playable || onReset ? (
          <div className="flex gap-2">
            {playable ? (
              <Button
                variant={playing ? "secondary" : "outline"}
                size="sm"
                className="flex-1"
                aria-pressed={playing}
                onClick={() => setPlaying(!playing)}
              >
                {playing ? <Pause /> : <Play />}
                {playing ? "Stop" : "Run"}
              </Button>
            ) : null}
            {onReset ? (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  if (playing) setPlaying(false)
                  onReset()
                }}
              >
                <RotateCcw />
                Home
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

/**
 * The default program: every joint sweeps its own range, each a little out of
 * step with the last, which is what a pendant's demo cycle looks like.
 */
function jointSweep(clock: number, limits: [number, number][]) {
  return limits.map(([min, max], index) => {
    const middle = (min + max) / 2
    const swing = (max - min) * 0.36
    return middle + Math.sin((clock + index * 0.17) * Math.PI * 2) * swing
  })
}

export { ArmControls, jointSweep }
