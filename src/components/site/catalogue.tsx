"use client"

import Link from "next/link"

import { RobotQuadruped } from "@/components/ui/robot-quadruped"
import { LinearActuator } from "@/components/ui/linear-actuator"
import { ServoMotor } from "@/components/ui/servo-motor"
import { RotaryTable } from "@/components/ui/rotary-table"
import { RobotRover } from "@/components/ui/robot-rover"
import { RobotDrone } from "@/components/ui/robot-drone"
import { LidarScan } from "@/components/ui/lidar-scan"

import { RobotGripper } from "@/components/ui/robot-gripper"
import { ConveyorBelt } from "@/components/ui/conveyor-belt"

import { DeltaArm } from "@/components/ui/delta-arm"
import { GantryArm } from "@/components/ui/gantry-arm"
import { RobotArm } from "@/components/ui/robot-arm"
import { RobotFace } from "@/components/ui/robot-face"
import { RobotLoader } from "@/components/ui/robot-loader"
import { ScaraArm } from "@/components/ui/scara-arm"
import { Panel } from "@/components/site/panel"

const entries = [
  { slug: "robot-quadruped", title: "Robot quadruped", line: "Four solved legs, standing, walking, and trotting.", art: <RobotQuadruped size={240} gait="trot" phase={0.65} /> },
  { slug: "linear-actuator", title: "Linear actuator", line: "Controlled stroke and a piston cutaway.", art: <LinearActuator size={240} cutaway /> },
  { slug: "servo-motor", title: "Servo motor", line: "Positional shaft with three horn styles.", art: <ServoMotor size={150} angle={30} /> },
  { slug: "rotary-table", title: "Rotary table", line: "Indexing platter, fixtures, and workpieces.", art: <RotaryTable size={170} angle={30} /> },
  { slug: "robot-rover", title: "Robot rover", line: "Four or six wheels, heading, and steering.", art: <RobotRover size={170} wheels={6} heading={25} steering={15} active /> },
  { slug: "robot-drone", title: "Robot drone", line: "Four or six rotors, guards, and blade angles.", art: <RobotDrone size={170} rotorAngle={25} active /> },
  { slug: "lidar-scan", title: "Lidar scan", line: "Your range data, plotted in polar coordinates.", art: <LidarScan size={160} scanAngle={60} samples={Array.from({ length: 36 }, (_, i) => ({ angle: i * 10, distance: 5 + 2 * Math.sin(i * 0.7) }))} /> },
  { slug: "robot-gripper", title: "Robot gripper", line: "Parallel or angular fingers, controlled opening.", art: <RobotGripper size={170} opening={0.6} active /> },
  { slug: "conveyor-belt", title: "Conveyor belt", line: "Wrapping travel, rollers, and workpieces.", art: <ConveyorBelt size={250} position={0.15} /> },
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
