"use client"

/**
 * robot-stage — the room the 3D robots stand in.
 *
 * A configured react-three-fiber canvas: key and fill lights, a contact
 * shadow, an optional grid floor and orbit controls. Drop any robocn 3D
 * component inside it and it is lit and framed without further setup.
 */

import * as React from "react"
import { ContactShadows, Grid, OrbitControls } from "@react-three/drei"
import { Canvas, type CanvasProps } from "@react-three/fiber"

import { resolveCssColor, watchCssColors } from "@/lib/robocn/color"
import { resolveRobotPalette, type RobotPaletteProps } from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export interface RobotStageProps
  extends Omit<React.ComponentProps<"div">, "children">,
    RobotPaletteProps {
  children?: React.ReactNode
  /** Camera position in world units. The default frames a 2.5-unit machine. */
  camera?: [number, number, number]
  fov?: number
  /** Drag to orbit. Off makes the stage a static illustration. */
  controls?: boolean
  /**
   * How far round the machine the camera may go. `ground` keeps it above the
   * floor, which is what a machine that stands on one wants; `free` lets it
   * go all the way over and under, for something you hold rather than
   * something that stands — a cube you can look at every side of.
   */
  orbit?: "ground" | "free"
  autoRotate?: boolean
  /**
   * Stop the auto-rotation while the pointer is over the stage, so a machine
   * can be looked at without chasing it round.
   */
  pauseOnHover?: boolean
  /** Floor treatment under the machine. */
  floor?: "grid" | "shadow" | "none"
  /** Extra three.js props, e.g. `{ dpr: 2 }`. */
  canvasProps?: Partial<CanvasProps>
}

function RobotStage({
  children,
  camera = [3.6, 2.6, 4.6],
  fov = 40,
  controls = true,
  orbit = "ground",
  autoRotate = false,
  pauseOnHover = true,
  floor = "shadow",
  canvasProps,
  className,
  color,
  accent,
  metal,
  dark,
  glow,
  grid,
  palette: paletteOverride,
  onPointerEnter,
  onPointerLeave,
  ...props
}: RobotStageProps) {
  const [hovered, setHovered] = React.useState(false)
  const palette = resolveRobotPalette({
    color,
    accent,
    metal,
    dark,
    glow,
    grid,
    palette: paletteOverride,
  })
  // three.js parses neither CSS variables nor oklch, and a floor drawn in
  // unparsed colour comes out white.
  const gridColor = useThreeColor(palette.grid, "#8d94a1")

  return (
    <div
      className={cn("relative h-80 w-full", className)}
      onPointerEnter={(event) => {
        onPointerEnter?.(event)
        setHovered(true)
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event)
        setHovered(false)
      }}
      {...props}
    >
      <Canvas
        shadows
        camera={{ position: camera, fov }}
        // `preserveDrawingBuffer`: without it the buffer is cleared before
        // anything can read it back, and every export of a 3D machine is a
        // blank panel. See `docs/export.md`.
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        {...canvasProps}
      >
        {/* A machine that stands on a floor is never seen from under it, so
            the ground half of the sky is dark. One you can orbit all the way
            round is, and an unlit underside reads as a hole rather than a
            face — so `free` lifts the ground colour and adds a fill from
            below, with no shadow of its own to fight the key. */}
        <hemisphereLight
          intensity={orbit === "free" ? 0.7 : 0.55}
          groundColor={orbit === "free" ? "#5b626d" : "#20242b"}
        />
        <directionalLight
          position={[4, 6, 3]}
          intensity={2.1}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-normalBias={0.02}
        />
        <directionalLight position={[-5, 2, -3]} intensity={0.5} />
        {orbit === "free" ? (
          <directionalLight position={[-2.5, -5, -1.5]} intensity={0.9} />
        ) : null}
        {floor === "grid" ? (
          <Grid
            args={[20, 20]}
            cellSize={0.5}
            cellThickness={0.6}
            sectionSize={2}
            sectionThickness={1}
            fadeDistance={16}
            infiniteGrid
            sectionColor={gridColor}
            cellColor={gridColor}
            position={[0, 0.001, 0]}
          />
        ) : null}
        {floor !== "none" ? (
          <ContactShadows
            position={[0, 0.002, 0]}
            opacity={0.45}
            scale={12}
            blur={2.2}
            far={4}
          />
        ) : null}
        {children}
        {controls ? (
          <OrbitControls
            makeDefault
            autoRotate={autoRotate && !(pauseOnHover && hovered)}
            autoRotateSpeed={0.8}
            enablePan={false}
            // Straight up and straight down are singular for an orbit camera,
            // so `free` stops a hair short of each pole rather than at it.
            minPolarAngle={orbit === "free" ? 0.01 : 0.2}
            maxPolarAngle={orbit === "free" ? Math.PI - 0.01 : Math.PI / 2.05}
            minDistance={2.4}
            maxDistance={14}
          />
        ) : null}
      </Canvas>
    </div>
  )
}

/**
 * One palette role as a colour three.js can use. Re-read when the document's
 * theme changes — the mode class, or a themer rewriting the variables —
 * so the floor retints without a remount.
 */
function useThreeColor(value: string, fallback: string) {
  const [resolved, setResolved] = React.useState(fallback)

  React.useEffect(() => {
    const read = () => setResolved(resolveCssColor(value, fallback))
    read()
    return watchCssColors(read)
  }, [value, fallback])

  return resolved
}

export { RobotStage }
