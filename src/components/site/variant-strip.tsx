"use client"

import { RobotArm } from "@/components/ui/robot-arm"
import type { RobotVariant } from "@/lib/robocn/style"

const strip: { variant: RobotVariant; note: string }[] = [
  { variant: "solid", note: "Painted machine." },
  { variant: "outline", note: "Line art." },
  { variant: "blueprint", note: "Grid, dimensions, joint angles." },
  { variant: "wire", note: "Skeleton." },
]

/** One machine, four ways of painting it. The geometry never changes. */
function VariantStrip() {
  return (
    <div className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
      {strip.map((item) => (
        <div key={item.variant} className="bg-panel p-4">
          <RobotArm
            variant={item.variant}
            size={170}
            behavior="static"
            showEnvelope={item.variant !== "solid"}
            className="mx-auto"
          />
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            {item.variant}
          </p>
          <p className="text-[13px] text-muted-foreground">{item.note}</p>
        </div>
      ))}
    </div>
  )
}

export { VariantStrip }
