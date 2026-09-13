"use client"

/**
 * The one moving thing on the page that answers to the visitor — and the page's
 * central claim, shown rather than stated: the same pointer target, solved and
 * drawn twice. The wipe between the two renderers is specified in
 * `docs/hero-2d-3d-transition.md`.
 */

import * as React from "react"
import dynamic from "next/dynamic"

import { RobotArm } from "@/components/ui/robot-arm"
import type { Vec3 } from "@/lib/robocn/kinematics"
import { prefersReducedMotion } from "@/lib/robocn/style"
import {
  clamp01,
  easeInOutCubic,
  flatMask,
  pointerToWorld3D,
  seamOpacity,
  seamPercent,
  solidMask,
  WIREFRAME_UNTIL,
} from "@/lib/transition"
import { cn } from "@/lib/utils"

const loadStage = () => import("@/components/site/hero-stage")

const HeroStage = dynamic(() => loadStage().then((module) => module.HeroStage), {
  ssr: false,
})

const REACH_3D = 2.4
/** Seconds the wipe takes to cross the stage. */
const DURATION = 1

type Dimension = "2d" | "3d"

function HeroArm() {
  const [dimension, setDimension] = React.useState<Dimension>("2d")
  /** The canvas is only built once someone asks for it. */
  const [solidMounted, setSolidMounted] = React.useState(false)
  const [wireframe, setWireframe] = React.useState(true)
  const [awake, setAwake] = React.useState(false)
  /** The canvas has a context and has painted at least one frame. */
  const [stageReady, setStageReady] = React.useState(false)

  const flatRef = React.useRef<HTMLDivElement>(null)
  const solidRef = React.useRef<HTMLDivElement>(null)
  const seamRef = React.useRef<HTMLDivElement>(null)
  const progress = React.useRef(0)
  const target = React.useRef<Vec3 | null>(null)
  const pointer = React.useRef({ x: 0, y: 0 })

  /** Paint one frame of the wipe. Deliberately outside React. */
  const paint = React.useCallback((raw: number) => {
    const t = easeInOutCubic(raw)
    const seam = seamPercent(t)
    const flat = flatRef.current
    if (flat) {
      flat.style.maskImage = flatMask(seam)
      flat.style.setProperty("-webkit-mask-image", flatMask(seam))
      flat.style.transform = `scale(${(1 + t * 0.06).toFixed(4)})`
      flat.style.filter = t > 0.001 ? `blur(${(t * 2.4).toFixed(2)}px)` : "none"
    }
    const solid = solidRef.current
    if (solid) {
      solid.style.maskImage = solidMask(seam)
      solid.style.setProperty("-webkit-mask-image", solidMask(seam))
    }
    const line = seamRef.current
    if (line) {
      line.style.top = `${seam.toFixed(2)}%`
      line.style.opacity = seamOpacity(t).toFixed(3)
    }
    setWireframe(t < WIREFRAME_UNTIL)
  }, [])

  React.useEffect(() => {
    const goal = dimension === "3d" ? 1 : 0
    // Wait for the rig before wiping to it, or the seam uncovers nothing.
    if (goal === 1 && !stageReady) return
    let frame = 0

    if (prefersReducedMotion()) {
      frame = requestAnimationFrame(() => {
        progress.current = goal
        paint(goal)
        setAwake(goal === 1)
      })
      return () => cancelAnimationFrame(frame)
    }

    let previous = performance.now()
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - previous) / 1000)
      previous = now
      const direction = goal - progress.current
      const next = clamp01(progress.current + Math.sign(direction) * (dt / DURATION))
      progress.current = Math.sign(direction) > 0 ? Math.min(next, goal) : Math.max(next, goal)
      paint(progress.current)
      if (progress.current !== goal) {
        frame = requestAnimationFrame(step)
      } else if (goal === 0) {
        // Flat again: park the canvas so a hidden context costs nothing.
        setAwake(false)
      }
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [dimension, stageReady, paint])

  const track = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    // A pointer over the hero is enough intent to warm the canvas chunk, so the
    // first click on 3D does not wait on a network round trip.
    void loadStage()
    const rect = event.currentTarget.getBoundingClientRect()
    const unit = {
      x: clamp01((event.clientX - rect.left) / rect.width),
      y: clamp01((event.clientY - rect.top) / rect.height),
    }
    pointer.current.x = unit.x * 2 - 1
    pointer.current.y = unit.y * 2 - 1
    target.current = pointerToWorld3D(unit, REACH_3D)
  }, [])

  /** The canvas is built, and woken, by the click that asks for it. */
  const switchTo = (next: Dimension) => {
    if (next === "3d") {
      setSolidMounted(true)
      setAwake(true)
    }
    setDimension(next)
  }

  const ready = React.useCallback(() => setStageReady(true), [])

  const release = React.useCallback(() => {
    target.current = null
    pointer.current.x = 0
    pointer.current.y = 0
  }, [])

  return (
    <div className="w-full">
      <div
        className="relative h-[320px] w-full overflow-hidden sm:h-[400px]"
        onPointerMove={track}
        onPointerLeave={release}
      >
        <div
          ref={flatRef}
          className="absolute inset-0 flex items-center justify-center will-change-transform"
        >
          <RobotArm
            behavior="pointer"
            tool="welder"
            size={420}
            links={[1, 0.82, 0.34]}
            showEnvelope
            label="RC-01"
            className="h-full max-h-full w-auto max-w-full"
          />
        </div>

        {/* The canvas sets its own `pointer-events`, and would otherwise swallow
            the moves the flat drawing listens for. */}
        {solidMounted ? (
          <div
            ref={solidRef}
            className="pointer-events-none absolute inset-0 [&_canvas]:pointer-events-none"
          >
            <HeroStage
              progress={progress}
              target={target}
              pointer={pointer}
              wireframe={wireframe}
              awake={awake}
              onReady={ready}
              reach={REACH_3D}
            />
          </div>
        ) : null}

        {/* The scan line rides the seam, so the swap has an edge to read. */}
        <div
          ref={seamRef}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 h-px opacity-0"
          style={{
            top: "-10%",
            background:
              "linear-gradient(to right, transparent, var(--signal) 12%, var(--signal) 88%, transparent)",
            boxShadow: "0 0 12px 1px var(--signal)",
          }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] text-muted-foreground">
          {dimension === "2d" ? "move your pointer" : "same target, solved in 3D"}
        </p>
        <DimensionSwitch value={dimension} onChange={switchTo} />
      </div>
    </div>
  )
}

/** Two buttons, one claim: the renderer changes, the machine does not. */
function DimensionSwitch({
  value,
  onChange,
}: {
  value: Dimension
  onChange: (next: Dimension) => void
}) {
  return (
    <div
      role="group"
      aria-label="Renderer"
      className="flex gap-1"
      onPointerEnter={() => {
        void loadStage()
      }}
    >
      {(["2d", "3d"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={option === value}
          className={cn(
            "border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground",
            option === value &&
              "border-foreground bg-foreground text-background hover:text-background",
          )}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

export { HeroArm }
