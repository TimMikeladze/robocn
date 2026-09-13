"use client"

/**
 * The solid half of the hero. Loaded on demand, so `three` never ships with the
 * flat drawing. Everything animated in here reads from refs the hero owns —
 * the transition must not cost a React render per frame.
 */

import * as React from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { RobotArm3D } from "@/components/ui/robot-arm-3d"
import { RobotStage } from "@/components/ui/robot-stage"
import type { Vec3 } from "@/lib/robocn/kinematics"
import { FLAT_CAMERA, lerpCamera } from "@/lib/transition"

export interface HeroStageProps {
  /** 3D-ness, 0..1. Drives the camera dolly. */
  progress: React.RefObject<number>
  /** The shared pointer goal, already in 3D world units. */
  target: React.RefObject<Vec3 | null>
  /** Pointer position over the stage, -1..1, for the parallax sway. */
  pointer: React.RefObject<{ x: number; y: number }>
  wireframe: boolean
  /** False parks the canvas on `demand`, so a hidden context costs no frames. */
  awake: boolean
  /** Fired once the context exists, so the wipe never reveals an empty canvas. */
  onReady?: () => void
  reach?: number
}

function HeroStage({
  progress,
  target,
  pointer,
  wireframe,
  awake,
  onReady,
  reach = 2.4,
}: HeroStageProps) {
  // Read through the ref, so a pointer move never re-renders the rig.
  const goal = () => target.current ?? rest(reach)

  return (
    <RobotStage
      className="absolute inset-0 h-full w-full"
      camera={FLAT_CAMERA.position}
      fov={FLAT_CAMERA.fov}
      controls={false}
      floor="grid"
      canvasProps={{
        frameloop: awake ? "always" : "demand",
        onCreated: onReady,
      }}
    >
      <CameraRig progress={progress} pointer={pointer} />
      <RobotArm3D
        links={[1, 0.82, 0.34]}
        tool="welder"
        reach={reach}
        target={goal}
        wireframe={wireframe}
        speed={reach * 2.2}
      />
    </RobotStage>
  )
}

/**
 * Dollies from the near-orthographic front view to the three-quarter one as the
 * wipe runs. This is the beat that reads as depth arriving; the crossfade on its
 * own only reads as a swap.
 */
function CameraRig({
  progress,
  pointer,
}: Pick<HeroStageProps, "progress" | "pointer">) {
  useFrame((state) => {
    const camera = state.camera as THREE.PerspectiveCamera
    const t = progress.current
    const view = lerpCamera(t)
    const sway = t * 0.5
    camera.position.set(
      view.position[0] + pointer.current.x * sway,
      view.position[1] - pointer.current.y * sway * 0.35,
      view.position[2],
    )
    if (Math.abs(camera.fov - view.fov) > 1e-3) {
      camera.fov = view.fov
      camera.updateProjectionMatrix()
    }
    camera.lookAt(look.set(...view.target))
  })

  return null
}

/** Scratch vector: the rig runs every frame and should allocate nothing. */
const look = new THREE.Vector3()

const rest = (reach: number): Vec3 => ({
  x: reach * 0.42,
  y: reach * 0.16 + reach * 0.52,
  z: 0,
})

export { HeroStage }
