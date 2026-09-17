"use client"

/**
 * The four moving things on the page that answer to the visitor.
 *
 * An arm, a face, a duck and a cat — the real registry components at their own
 * default behaviours, spanning the set rather than matching each other. Notes:
 * `docs/hero-quadrants.md`.
 *
 * No WebGL: the hero is four SVG machines and nothing else, so the landing page
 * ships no `three`. The 2D→3D wipe that used to live here is kept in
 * `hero-stage.tsx` and `docs/hero-2d-3d-transition.md`; `robot-arm-3d` and
 * `robot-stage` are where the rig is shown now.
 */

import * as React from "react"
import Link from "next/link"

import { AnimatronicFace } from "@/components/ui/animatronic-face"
import { MicroDuck } from "@/components/ui/micro-duck"
import { RobotArm } from "@/components/ui/robot-arm"
import { RobotCat } from "@/components/ui/robot-cat"
import { cn } from "@/lib/utils"

/** One machine in its own cell, named, with its name a way into its page. */
function Quadrant({
  slug,
  name,
  className,
  children,
}: {
  slug: string
  name: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden p-2", className)}>
      {children}
      {/* Top-left, where no machine has its feet or its shadow. */}
      <Link
        href={`/docs/${slug}`}
        className="absolute top-1.5 left-2 z-10 font-mono text-[10px] text-muted-foreground/70 transition-colors hover:text-foreground"
      >
        {name}
      </Link>
    </div>
  )
}

function Hero() {
  return (
    <div className="w-full">
      {/* Hairlines between the cells rather than around them: the panel already
          has its own border and datum ticks. */}
      <div className="grid h-[320px] w-full grid-cols-2 grid-rows-2 sm:h-[400px]">
        <Quadrant slug="robot-arm" name="arm" className="border-r border-b border-border">
          <RobotArm
            behavior="pointer"
            tool="welder"
            size={230}
            links={[1, 0.82, 0.34]}
            showEnvelope
            className="h-full max-h-full w-auto max-w-full"
          />
        </Quadrant>

        <Quadrant slug="animatronic-face" name="face" className="border-b border-border">
          <AnimatronicFace
            behavior="idle"
            size={170}
            interactive
            className="h-full max-h-full w-auto max-w-full"
          />
        </Quadrant>

        <Quadrant slug="micro-duck" name="duck" className="border-r border-border">
          <MicroDuck
            behavior="walk"
            size={175}
            interactive
            className="h-full max-h-full w-auto max-w-full"
          />
        </Quadrant>

        <Quadrant slug="robot-cat" name="cat">
          <RobotCat
            behavior="prowl"
            size={210}
            interactive
            className="h-full max-h-full w-auto max-w-full"
          />
        </Quadrant>
      </div>

      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
        move your pointer — all four answer to it
      </p>
    </div>
  )
}

export { Hero }
