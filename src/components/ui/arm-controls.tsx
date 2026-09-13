"use client"

/**
 * arm-controls — a teach pendant.
 *
 * One slider per joint, driving an arm in forward kinematics: pass the same
 * `angles` array to `RobotArm` and the arm is posed joint by joint instead of
 * chasing a target. Also carries the tool selector and live readouts, because
 * that is what sits next to the sliders on a real pendant.
 */

import * as React from "react"
import { RotateCcw } from "lucide-react"

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
  className,
  ...props
}: ArmControlsProps) {
  const rangeFor = (index: number): [number, number] =>
    Array.isArray(limits[0])
      ? ((limits as [number, number][])[index] ?? [-180, 180])
      : (limits as [number, number])

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

        {onReset ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onReset}
          >
            <RotateCcw />
            Home
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

export { ArmControls }
