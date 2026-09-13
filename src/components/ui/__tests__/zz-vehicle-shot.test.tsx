/** Scratch: renders the vehicle family to an HTML sheet for eyeballing. */
import { render } from "@testing-library/react"
import { it } from "vitest"
import { writeFileSync, mkdirSync } from "node:fs"
import type * as React from "react"

import { RobotCar } from "@/components/ui/robot-car"

const OUT = process.env.SHOT_OUT ?? "/tmp/vehicles.html"

const views = ["profile", "front", "plan", "iso"] as const
const variants = ["solid", "outline", "blueprint", "wire"] as const

const sheet: string[] = []
const shot = (title: string, node: React.ReactElement) => {
  const { container } = render(node)
  sheet.push(`<figure><figcaption>${title}</figcaption>${container.innerHTML}</figure>`)
}

it("dumps", () => {
  for (const view of views) shot(`car ${view}`, <RobotCar size={320} view={view} steer={26} animate={false} label="CAR / 01" />)
  for (const variant of variants) shot(`car ${variant}`, <RobotCar size={320} variant={variant} steer={0} animate={false} />)
  shot("car lock", <RobotCar size={320} view="plan" steer={55} animate={false} />)
  shot("car rough", <RobotCar size={320} roughness={1} animate={false} phase={0.7} />)
  shot("car card", <RobotCar size={150} steer={18} animate={false} />)
  mkdirSync(OUT.replace(/\/[^/]+$/, ""), { recursive: true })
  writeFileSync(OUT, `<!doctype html><meta charset="utf8"><style>body{background:#0b0e14;color:#cbd5e1;font:12px ui-monospace,monospace;display:flex;flex-wrap:wrap;gap:18px;padding:18px}figure{margin:0;background:#111827;padding:10px;border-radius:8px}figcaption{margin-bottom:6px;opacity:.7}svg{display:block}</style>${sheet.join("")}`)
})
