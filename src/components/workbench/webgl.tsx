"use client"

/**
 * The components that cannot mount bare on the stage.
 *
 * `robot-arm-3d` needs a WebGL canvas around it and `robot-stage` *is* that
 * canvas, so it needs a machine to hold. The generated registry points both at
 * the wrappers here; everything else in the library draws an SVG and mounts as
 * itself. `scripts/build-workbench.mjs` records the pairing.
 */

import { PuzzleCube, type PuzzleCubeProps } from "@/components/ui/puzzle-cube"
import { RobotArm3D, type RobotArm3DProps } from "@/components/ui/robot-arm-3d"
import { RobotStage, type RobotStageProps } from "@/components/ui/robot-stage"

const fill = { width: "100%", height: "100%", minHeight: 320 }

/** The 3D arm, lit and framed. Stage props stay at their defaults. */
function StagedArm3D(props: RobotArm3DProps) {
  return (
    <RobotStage style={fill}>
      <RobotArm3D {...props} />
    </RobotStage>
  )
}

/** The stage itself, driven by its own props, with an arm standing in it. */
function StageWithArm({ children, ...props }: RobotStageProps) {
  return (
    <RobotStage {...props} style={{ ...fill, ...props.style }}>
      {children ?? <RobotArm3D behavior="orbit" />}
    </RobotStage>
  )
}

/** The cube, lit and framed, with the camera off one corner. */
function StagedPuzzleCube(props: PuzzleCubeProps) {
  return (
    <RobotStage style={fill} camera={[3.4, 2.9, 4.2]} floor="shadow">
      <PuzzleCube {...props} />
    </RobotStage>
  )
}

export { StagedArm3D, StagedPuzzleCube, StageWithArm }
