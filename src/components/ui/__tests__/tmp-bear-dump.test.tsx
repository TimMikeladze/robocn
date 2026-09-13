import { cleanup, render } from "@testing-library/react"
import { afterEach, it } from "vitest"
import { mkdirSync, writeFileSync } from "node:fs"

import { RobotBear } from "@/components/ui/robot-bear"
import { RobotPolarBear } from "@/components/ui/robot-polar-bear"

afterEach(cleanup)
const OUT = process.env.SHOT_DIR ?? ""
const CSS = `--robot-shell:#a99483;--robot-metal:#cbbdaf;--robot-dark:#332b25;--robot-accent:#3fd0c9;--robot-glow:#3fd0c9;--robot-grid:#93a0b4;--robot-foreground:#334`

it.skipIf(!OUT)("dumps the bears", () => {
  mkdirSync(OUT, { recursive: true })
  const cases: [string, React.ReactElement][] = [
    ["p-stand", <RobotPolarBear animate={false} behavior="static" swim={0} interactive={false} showContacts />],
    ["p-plod", <RobotPolarBear animate={false} behavior="plod" phase={0.3} swim={0} interactive={false} />],
    ["p-stalk", <RobotPolarBear animate={false} behavior="stalk" phase={0.3} swim={0} interactive={false} />],
    ["p-swim-40", <RobotPolarBear animate={false} behavior="swim" phase={0.15} swim={0.4} interactive={false} />],
    ["p-swim-100", <RobotPolarBear animate={false} behavior="swim" phase={0.15} swim={1} interactive={false} />],
    ["p-swim-60pct", <RobotPolarBear animate={false} behavior="swim" phase={0.6} swim={1} interactive={false} />],
    ["p-rear", <RobotPolarBear animate={false} behavior="static" rear={1} swim={0} balance={1} interactive={false} showSupport />],
    ["p-iso", <RobotPolarBear animate={false} behavior="static" swim={0} view="iso" interactive={false} />],
    ["p-blueprint", <RobotPolarBear animate={false} behavior="swim" swim={1} phase={0.3} variant="blueprint" interactive={false} />],
    ["stand", <RobotBear animate={false} behavior="static" rear={0} interactive={false} showSupport showContacts />],
    ["amble-0", <RobotBear animate={false} behavior="amble" phase={0} interactive={false} showContacts />],
    ["amble-30", <RobotBear animate={false} behavior="amble" phase={0.3} interactive={false} showContacts />],
    ["amble-65", <RobotBear animate={false} behavior="amble" phase={0.65} interactive={false} showContacts />],
    ["rear-50", <RobotBear animate={false} behavior="static" rear={0.5} balance={1} interactive={false} showSupport />],
    ["rear-100", <RobotBear animate={false} behavior="static" rear={1} balance={1} interactive={false} showSupport />],
    ["topple", <RobotBear animate={false} behavior="static" rear={1} balance={0} interactive={false} showSupport />],
    ["forage", <RobotBear animate={false} behavior="forage" phase={0.25} interactive={false} />],
    ["blueprint", <RobotBear animate={false} behavior="static" rear={0.6} variant="blueprint" interactive={false} showSupport />],
    ["outline", <RobotBear animate={false} behavior="static" variant="outline" interactive={false} />],
    ["wire", <RobotBear animate={false} behavior="static" variant="wire" interactive={false} />],
    ["iso", <RobotBear animate={false} behavior="static" view="iso" interactive={false} />],
    ["plan", <RobotBear animate={false} behavior="static" view="plan" interactive={false} />],
    ["front", <RobotBear animate={false} behavior="static" view="front" interactive={false} />],
    ["card", <RobotBear animate={false} behavior="static" rear={0.85} balance={1} size={150} interactive={false} />],
  ]
  const cards: string[] = []
  for (const [name, node] of cases) {
    const { container } = render(node)
    const svg = container.querySelector("svg")!
    svg.setAttribute("style", `${CSS};color:#334`)
    cards.push(`<figure><figcaption>${name}</figcaption>${svg.outerHTML}</figure>`)
    cleanup()
  }
  writeFileSync(
    `${OUT}/sheet.html`,
    `<!doctype html><meta charset="utf-8"><style>
      body{background:#f3f1ee;font:12px ui-monospace,monospace;margin:0;padding:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
      figure{margin:0;background:#fff;border:1px solid #ddd;padding:6px}
      figcaption{color:#666;margin-bottom:4px}
      svg{width:100%;height:auto}
    </style>${cards.join("")}`,
  )
})
