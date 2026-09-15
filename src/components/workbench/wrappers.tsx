"use client"

/**
 * Components the stage cannot mount bare, minus the WebGL pair.
 *
 * `robot-export` is a control, not a machine: on its own it is a button with
 * nothing under it. Here it gets an arm to record, so the stage shows the thing
 * actually doing its job. `scripts/build-workbench.mjs` records the pairing.
 */

import { RobotArm } from "@/components/ui/robot-arm"
import { RobotExport, type RobotExportProps } from "@/components/ui/robot-export"

/** The record button over a sweeping arm, with the button always on show. */
function ExportedArm(props: RobotExportProps) {
  return (
    <RobotExport alwaysVisible name="robot-arm" {...props}>
      <RobotArm behavior="sweep" size="md" />
    </RobotExport>
  )
}

export { ExportedArm }
