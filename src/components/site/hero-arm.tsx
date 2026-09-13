"use client"

import { RobotArm } from "@/components/ui/robot-arm"

/** The one moving thing on the page that answers to the visitor. */
function HeroArm() {
  return (
    <div className="flex w-full justify-center">
      <RobotArm
        behavior="pointer"
        tool="welder"
        size={420}
        links={[1, 0.82, 0.34]}
        showEnvelope
        label="RC-01"
        className="max-w-full"
      />
    </div>
  )
}

export { HeroArm }
