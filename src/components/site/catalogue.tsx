"use client"

import Link from "next/link"

import { DeltaArm } from "@/components/ui/delta-arm"
import { GantryArm } from "@/components/ui/gantry-arm"
import { RobotArm } from "@/components/ui/robot-arm"
import { RobotFace } from "@/components/ui/robot-face"
import { RobotLoader } from "@/components/ui/robot-loader"
import { ScaraArm } from "@/components/ui/scara-arm"
import { Panel } from "@/components/site/panel"

const entries = [
  {
    slug: "robot-arm",
    title: "Robot arm",
    line: "Any number of links, eight tools, four mounts.",
    art: <RobotArm size={190} behavior="idle" tool="gripper" phase={0.2} />,
  },
  {
    slug: "scara-arm",
    title: "SCARA arm",
    line: "Plan view, Z spindle, swept area.",
    art: <ScaraArm size={190} behavior="orbit" z={0.5} phase={1.1} />,
  },
  {
    slug: "delta-arm",
    title: "Delta arm",
    line: "Three biceps, real parallel kinematics.",
    art: <DeltaArm size={190} behavior="orbit" phase={0.6} />,
  },
  {
    slug: "gantry-arm",
    title: "Gantry arm",
    line: "Independent axes, plotter trail.",
    art: <GantryArm size={190} behavior="sweep" trail phase={0.4} />,
  },
  {
    slug: "robot-face",
    title: "Robot face",
    line: "Eyes that follow the pointer. Six moods.",
    art: <RobotFace size={150} mood="curious" />,
  },
  {
    slug: "robot-loader",
    title: "Robot loader",
    line: "Pick and place as a progress indicator.",
    art: <RobotLoader size={250} />,
  },
]

function Catalogue() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => (
        <Link key={entry.slug} href={`/docs/${entry.slug}`} className="group">
          <Panel className="flex h-full flex-col transition-colors group-hover:border-foreground">
            <div className="flex h-44 items-center justify-center overflow-hidden">
              {entry.art}
            </div>
            <div className="border-t border-border px-4 py-3">
              <h3 className="text-[14px] font-medium">{entry.title}</h3>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{entry.line}</p>
            </div>
          </Panel>
        </Link>
      ))}
    </div>
  )
}

export { Catalogue }
