"use client"

/**
 * robot-arm-3d — the same articulated arm as `robot-arm`, as a real rig.
 *
 * Procedural: no model to load. Limbs, joints and the tool head are built from
 * primitives and repositioned every frame from the shared kinematics core, so
 * an arm with seven links needs no new assets. Drop it inside `robot-stage`.
 */

import * as React from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import {
  distance3,
  lerp3,
  solveChain3,
  type Vec3,
} from "@/lib/robocn/kinematics"
import { resolveCssColor } from "@/lib/robocn/color"
import {
  defaultRobotPalette,
  prefersReducedMotion,
  resolveRobotPalette,
  type RobotBehavior,
  type RobotPalette,
  type RobotPaletteProps,
  type RobotTool,
} from "@/lib/robocn/style"

/** A fixed point, or where the tip should be at `clock` seconds. */
export type RobotTarget3D = Vec3 | ((clock: number) => Vec3) | null

export interface RobotArm3DProps extends RobotPaletteProps {
  /** Relative link lengths, shoulder outward. Scaled to fill `reach`. */
  links?: number[]
  /** Total stretch in world units. */
  reach?: number
  target?: RobotTarget3D
  behavior?: RobotBehavior
  tool?: RobotTool
  /** Tool running. Defaults to "while the tip is moving". */
  active?: boolean
  /** Tip travel in world units per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of phase offset, so a cell of arms breaks step. */
  phase?: number
  showBase?: boolean
  wireframe?: boolean
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  /** Every solved frame, for readouts. Called outside React state. */
  onPose?: (joints: Vec3[]) => void
}

const UP = new THREE.Vector3(0, 1, 0)

function RobotArm3D({
  links = [1, 0.82, 0.34],
  reach = 2.4,
  target = null,
  behavior = "idle",
  tool = "gripper",
  active,
  speed,
  animate = true,
  paused = false,
  phase = 0,
  showBase = true,
  wireframe = false,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  onPose,
  color,
  accent,
  metal,
  dark,
  glow,
  grid,
  palette: paletteOverride,
}: RobotArm3DProps) {
  const cssPalette = resolveRobotPalette({
    color,
    accent,
    metal,
    dark,
    glow,
    grid,
    palette: paletteOverride,
  })
  const colors = useThreeColors(cssPalette)

  const scaled = React.useMemo(() => {
    const total = links.reduce((sum, link) => sum + Math.max(link, 0.01), 0)
    return links.map((link) => (Math.max(link, 0.01) / total) * reach)
  }, [links, reach])

  const baseHeight = reach * 0.16
  const root = React.useMemo<Vec3>(
    () => ({ x: 0, y: baseHeight, z: 0 }),
    [baseHeight],
  )
  const limbRadius = React.useMemo(
    () =>
      scaled.map(
        (_, index) =>
          reach *
          (0.055 - (0.02 * index) / Math.max(1, scaled.length - 1)),
      ),
    [scaled, reach],
  )

  const limbs = React.useRef<(THREE.Mesh | null)[]>([])
  const joints = React.useRef<(THREE.Mesh | null)[]>([])
  const toolHead = React.useRef<THREE.Group>(null)
  const tipLight = React.useRef<THREE.Mesh>(null)
  const pose = React.useRef<Vec3[]>(
    solveChain3(root, restTarget(root, reach), scaled),
  )
  const tip = React.useRef<Vec3>(restTarget(root, reach))
  const clock = React.useRef(phase)
  const targetRef = React.useRef(target)
  React.useEffect(() => {
    targetRef.current = target
  })

  useFrame((state, delta) => {
    if (paused) return
    const dt = Math.min(0.05, delta)
    clock.current += dt
    const reduced = prefersReducedMotion()
    const held = targetRef.current
    const goal =
      typeof held === "function"
        ? held(clock.current)
        : (held ??
          behaviorGoal(behavior, clock.current, root, reach, state.pointer))

    const travel = speed ?? reach * 1.6
    const gap = distance3(tip.current, goal)
    tip.current =
      !animate || reduced || gap < 0.002
        ? goal
        : lerp3(tip.current, goal, Math.min(1, (travel * dt) / gap))

    const solved = solveChain3(root, tip.current, scaled, {
      seed: pose.current,
      up: UP,
    })
    pose.current = solved
    onPose?.(solved)

    for (let i = 0; i < limbs.current.length; i++) {
      placeRod(limbs.current[i], solved[i], solved[i + 1], limbRadius[i])
    }
    for (let i = 0; i < joints.current.length; i++) {
      const joint = joints.current[i]
      if (joint) joint.position.set(solved[i].x, solved[i].y, solved[i].z)
    }
    if (toolHead.current) {
      const last = solved[solved.length - 1]
      const previous = solved[Math.max(0, solved.length - 2)]
      toolHead.current.position.set(last.x, last.y, last.z)
      const direction = new THREE.Vector3(
        last.x - previous.x,
        last.y - previous.y,
        last.z - previous.z,
      )
      if (direction.lengthSq() > 1e-8) {
        toolHead.current.quaternion.setFromUnitVectors(
          UP,
          direction.normalize(),
        )
      }
    }
    const engaged = active ?? gap > 0.01
    if (tipLight.current) {
      const pulse = engaged ? 1.3 + Math.sin(clock.current * 14) * 0.3 : 1
      tipLight.current.scale.setScalar(pulse)
    }
  })

  const shell = colors.shell
  const engagedDefault = active ?? false

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {showBase ? (
        <group>
          <mesh position={[0, baseHeight * 0.14, 0]} castShadow receiveShadow>
            <cylinderGeometry
              args={[reach * 0.17, reach * 0.2, baseHeight * 0.28, 40]}
            />
            <meshStandardMaterial
              color={colors.dark}
              roughness={0.4}
              metalness={0.5}
              wireframe={wireframe}
            />
          </mesh>
          <mesh position={[0, baseHeight * 0.6, 0]} castShadow receiveShadow>
            <cylinderGeometry
              args={[reach * 0.11, reach * 0.14, baseHeight * 0.7, 32]}
            />
            <meshStandardMaterial
              color={shell}
              roughness={0.35}
              metalness={0.25}
              wireframe={wireframe}
            />
          </mesh>
          <mesh position={[0, baseHeight * 0.95, 0]}>
            <torusGeometry args={[reach * 0.115, reach * 0.008, 8, 40]} />
            <meshBasicMaterial color={colors.accent} wireframe={wireframe} />
          </mesh>
        </group>
      ) : null}

      {scaled.map((_, index) => (
        <mesh
          key={index}
          ref={(element) => {
            limbs.current[index] = element
          }}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[1, 1, 1, 20]} />
          <meshStandardMaterial
            color={index % 2 === 0 ? shell : colors.metal}
            roughness={index % 2 === 0 ? 0.35 : 0.24}
            metalness={index % 2 === 0 ? 0.3 : 0.75}
            wireframe={wireframe}
          />
        </mesh>
      ))}

      {scaled.map((_, index) => (
        <mesh
          key={index}
          ref={(element) => {
            joints.current[index] = element
          }}
          castShadow
        >
          <sphereGeometry
            args={[limbRadius[index] * (index === 0 ? 1.7 : 1.35), 20, 14]}
          />
          <meshStandardMaterial
            color={colors.dark}
            roughness={0.3}
            metalness={0.6}
            wireframe={wireframe}
          />
        </mesh>
      ))}

      <group ref={toolHead}>
        <ToolHead3D
          tool={tool}
          colors={colors}
          reach={reach}
          wireframe={wireframe}
          engaged={engagedDefault}
        />
        <mesh ref={tipLight} position={[0, reach * 0.035, 0]}>
          <sphereGeometry args={[reach * 0.022, 12, 10]} />
          <meshBasicMaterial color={colors.glow} />
        </mesh>
      </group>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* parts                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * End effectors, built along +y so the wrist can point them by rotating the
 * whole group onto the last link's direction.
 */
function ToolHead3D({
  tool,
  colors,
  reach,
  wireframe,
  engaged,
}: {
  tool: RobotTool
  colors: RobotPalette
  reach: number
  wireframe: boolean
  engaged: boolean
}) {
  const unit = reach * 0.04
  const metal = (
    <meshStandardMaterial
      color={colors.metal}
      roughness={0.25}
      metalness={0.8}
      wireframe={wireframe}
    />
  )
  return (
    <group>
      <mesh position={[0, unit * 0.6, 0]} castShadow>
        <cylinderGeometry args={[unit * 1.1, unit * 1.2, unit * 2.2, 20]} />
        <meshStandardMaterial
          color={colors.dark}
          roughness={0.35}
          metalness={0.6}
          wireframe={wireframe}
        />
      </mesh>

      {tool === "gripper"
        ? [-1, 1].map((side) => (
            <mesh
              key={side}
              position={[side * unit * 0.7, unit * 2.4, 0]}
              rotation={[0, 0, side * -0.12]}
              castShadow
            >
              <boxGeometry args={[unit * 0.34, unit * 2, unit * 0.9]} />
              {metal}
            </mesh>
          ))
        : null}

      {tool === "welder" || tool === "painter" ? (
        <mesh position={[0, unit * 2.6, 0]} castShadow>
          <coneGeometry args={[unit * 0.55, unit * 1.8, 16]} />
          {metal}
        </mesh>
      ) : null}

      {tool === "cutter" ? (
        <mesh position={[0, unit * 2.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[unit * 1.5, unit * 1.5, unit * 0.12, 28]} />
          {metal}
        </mesh>
      ) : null}

      {tool === "scanner" ? (
        <mesh position={[0, unit * 2.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[unit * 1.1, unit * 0.14, 10, 28]} />
          <meshBasicMaterial color={colors.accent} wireframe={wireframe} />
        </mesh>
      ) : null}

      {tool === "vacuum" ? (
        <mesh position={[0, unit * 2.4, 0]} castShadow>
          <cylinderGeometry args={[unit * 1.3, unit * 0.5, unit * 1.4, 20]} />
          <meshStandardMaterial
            color={colors.dark}
            roughness={0.8}
            wireframe={wireframe}
          />
        </mesh>
      ) : null}

      {tool === "magnet" ? (
        <mesh position={[0, unit * 2.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[unit, unit * 0.4, 10, 20, Math.PI]} />
          {metal}
        </mesh>
      ) : null}

      {engaged && (tool === "welder" || tool === "painter") ? (
        <pointLight
          position={[0, unit * 4, 0]}
          color={colors.glow}
          intensity={reach * 0.6}
          distance={reach}
        />
      ) : null}
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

const rodA = new THREE.Vector3()
const rodB = new THREE.Vector3()
const rodDelta = new THREE.Vector3()

/** Stretch a unit cylinder between two joints. */
function placeRod(
  mesh: THREE.Mesh | null,
  a: Vec3,
  b: Vec3,
  radius: number,
) {
  if (!mesh) return
  rodA.set(a.x, a.y, a.z)
  rodB.set(b.x, b.y, b.z)
  rodDelta.subVectors(rodB, rodA)
  const length = Math.max(rodDelta.length(), 1e-4)
  mesh.position.copy(rodA).add(rodB).multiplyScalar(0.5)
  mesh.scale.set(radius, length, radius)
  mesh.quaternion.setFromUnitVectors(UP, rodDelta.divideScalar(length))
}

const restTarget = (root: Vec3, reach: number): Vec3 => ({
  x: reach * 0.42,
  y: root.y + reach * 0.52,
  z: 0,
})

function behaviorGoal(
  behavior: RobotBehavior,
  clock: number,
  root: Vec3,
  reach: number,
  pointer: THREE.Vector2,
): Vec3 {
  const rest = restTarget(root, reach)
  switch (behavior) {
    case "orbit":
      return {
        x: Math.cos(clock * 0.8) * reach * 0.5,
        y: root.y + reach * 0.45,
        z: Math.sin(clock * 0.8) * reach * 0.5,
      }
    case "sweep":
      return {
        x: Math.sin(clock * 0.6) * reach * 0.62,
        y: root.y + reach * (0.32 + Math.cos(clock * 1.1) * 0.1),
        z: Math.cos(clock * 0.45) * reach * 0.3,
      }
    case "pointer":
      return {
        x: pointer.x * reach * 0.95,
        y: root.y + reach * (0.3 + pointer.y * 0.5),
        z: reach * 0.3,
      }
    case "idle":
      return {
        x: rest.x + Math.sin(clock * 0.7) * reach * 0.03,
        y: rest.y + Math.sin(clock * 0.45) * reach * 0.05,
        z: rest.z + Math.cos(clock * 0.5) * reach * 0.03,
      }
    default:
      return rest
  }
}

/**
 * Palette values three.js can use. Resolved on the client, and re-resolved
 * when the document's theme class changes, so a dark-mode toggle retints the
 * rig without a remount.
 */
function useThreeColors(palette: RobotPalette): RobotPalette {
  const fallback = React.useMemo(
    () => ({
      shell: "#f87d38",
      metal: "#a8b0bb",
      dark: "#39404b",
      accent: "#00c2a1",
      glow: "#25dab8",
      grid: "#8d94a1",
      foreground: "#8d94a1",
    }),
    [],
  )
  const key = JSON.stringify(palette)
  const [resolved, setResolved] = React.useState<RobotPalette>(fallback)

  React.useEffect(() => {
    const read = () =>
      setResolved({
        shell: resolveCssColor(palette.shell, fallback.shell),
        metal: resolveCssColor(palette.metal, fallback.metal),
        dark: resolveCssColor(palette.dark, fallback.dark),
        accent: resolveCssColor(palette.accent, fallback.accent),
        glow: resolveCssColor(palette.glow, fallback.glow),
        grid: resolveCssColor(palette.grid, fallback.grid),
        foreground: resolveCssColor(
          palette.foreground === defaultRobotPalette.foreground
            ? palette.grid
            : palette.foreground,
          fallback.foreground,
        ),
      })
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    })
    return () => observer.disconnect()
    // `key` stands in for the palette's contents, which is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fallback])

  return resolved
}

export { RobotArm3D }
