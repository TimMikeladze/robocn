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

import { RubiksCube } from "@/components/ui/rubiks-cube"
import { RobotArm3D } from "@/components/ui/robot-arm-3d"
import { RobotStage } from "@/components/ui/robot-stage"

/** Half-way up the arm, not its foot. */
const AIM: [number, number, number] = [0, 1.05, 0]
const REACH = 2

export interface CardStageProps {
  floor?: "grid" | "shadow" | "none"
  /** Reduced motion: hold one pose instead of running the cycle. */
  calm?: boolean
  machine?: "arm" | "cube"
}

/** The cube sits on the origin, so it needs no look-at correction. */
const CUBE_AIM: [number, number, number] = [0, 0, 0]

function CardStage({ floor = "shadow", calm = false, machine = "arm" }: CardStageProps) {
  const cube = machine === "cube"
  const aim = cube ? CUBE_AIM : AIM

  return (
    <RobotStage
      className="h-full w-full"
      camera={cube ? [3.1, 2.7, 3.8] : [3.2, 2.9, 4.4]}
      fov={38}
      controls={false}
      floor={cube ? "none" : floor}
      canvasProps={{ onCreated: ({ camera }) => camera.lookAt(...aim) }}
    >
      {cube ? (
        <RubiksCube
          size={2.2}
          behavior={calm ? "static" : "cycle"}
          interactive={false}
          animate={!calm}
          scrambleOnMount={calm ? 9 : false}
        />
      ) : (
        <RobotArm3D
          links={[1, 0.82, 0.34]}
          reach={REACH}
          tool="gripper"
          behavior={calm ? "static" : "idle"}
          animate={!calm}
        />
      )}
    </RobotStage>
  )
}

export { CardStage }
