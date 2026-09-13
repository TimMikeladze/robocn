"use client"

/**
 * The canvas half of `catalogue-stage`. Split out so `three` sits behind the
 * dynamic import and never lands in the landing page's first load.
 *
 * A card is a link, so the stage runs without orbit controls — dragging inside
 * it would fight the click. That also means nothing aims the camera at the
 * machine: r3f points the default camera at the origin, which is the arm's
 * *base*, and a card 176px tall then crops the reach off the top. `AIM` lifts
 * the look-at to the middle of the arm instead.
 *
 * Reduced motion parks the *arm*, not the canvas. `frameloop="demand"` looks
 * like the thriftier answer and is the wrong one here: the one frame it draws
 * happens before the rig has run a `useFrame`, so the card stays empty and the
 * reader gets a blank panel instead of a machine. A fixed pose re-rendered
 * every frame shows nothing moving, which is what was actually asked for.
 */

import { RobotArm3D } from "@/components/ui/robot-arm-3d"
import { RobotStage } from "@/components/ui/robot-stage"

/** Half-way up the arm, not its foot. */
const AIM: [number, number, number] = [0, 1.05, 0]
const REACH = 2

export interface CardStageProps {
  floor?: "grid" | "shadow" | "none"
  /** Reduced motion: hold one pose instead of running the cycle. */
  calm?: boolean
}

function CardStage({ floor = "shadow", calm = false }: CardStageProps) {
  return (
    <RobotStage
      className="h-full w-full"
      camera={[3.2, 2.9, 4.4]}
      fov={38}
      controls={false}
      floor={floor}
      canvasProps={{ onCreated: ({ camera }) => camera.lookAt(...AIM) }}
    >
      <RobotArm3D
        links={[1, 0.82, 0.34]}
        reach={REACH}
        tool="gripper"
        behavior={calm ? "static" : "idle"}
        animate={!calm}
      />
    </RobotStage>
  )
}

export { CardStage }
