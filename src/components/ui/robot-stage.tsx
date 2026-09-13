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
        gl={{ antialias: true, alpha: true }}
        {...canvasProps}
      >
        <hemisphereLight intensity={0.55} groundColor="#20242b" />
        <directionalLight
          position={[4, 6, 3]}
          intensity={2.1}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-normalBias={0.02}
        />
        <directionalLight position={[-5, 2, -3]} intensity={0.5} />
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
            minPolarAngle={0.2}
            maxPolarAngle={Math.PI / 2.05}
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
