import { cleanup, render } from "@testing-library/react"
import { afterEach, it } from "vitest"
import { mkdirSync, writeFileSync } from "node:fs"

import { KeySwitch } from "@/components/ui/key-switch"

afterEach(cleanup)
const OUT = process.env.SHOT_DIR ?? ""
const CSS = `--robot-shell:#5b7cc4;--robot-metal:#c8ccd8;--robot-dark:#242a3d;--robot-accent:#ffb340;--robot-glow:#ffb340;--robot-grid:#93a0b4;--robot-foreground:#334`

it.skipIf(!OUT)("dumps the input devices", () => {
  mkdirSync(OUT, { recursive: true })
  const cases: [string, React.ReactElement][] = [
    ["switch rest", <KeySwitch animate={false} behavior="static" press={0} />],
    ["switch trip", <KeySwitch animate={false} behavior="static" press={0.55} />],
    ["switch bottom", <KeySwitch animate={false} behavior="static" press={1} />],
    ["switch linear", <KeySwitch animate={false} behavior="static" press={0.5} action="linear" />],
    ["switch clicky", <KeySwitch animate={false} behavior="static" press={0.7} action="clicky" />],
    ["switch travel 6", <KeySwitch animate={false} behavior="static" press={1} travel={6} />],
    ["switch outline", <KeySwitch animate={false} behavior="static" press={0.5} variant="outline" />],
    ["switch blueprint", <KeySwitch animate={false} behavior="static" press={0.5} variant="blueprint" />],
    ["switch wire", <KeySwitch animate={false} behavior="static" press={0.5} variant="wire" />],
    ["switch iso", <KeySwitch animate={false} behavior="static" press={0.5} view="iso" />],
    ["switch front", <KeySwitch animate={false} behavior="static" press={0.5} view="front" />],
    ["switch plan", <KeySwitch animate={false} behavior="static" press={0.5} view="plan" />],
    ["switch card", <KeySwitch animate={false} behavior="static" press={0.6} size={150} />],
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
      body{background:#f3f1ee;font:12px ui-monospace,monospace;margin:0;padding:16px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
      figure{margin:0;background:#fff;border:1px solid #ddd;padding:6px}
      figcaption{color:#666;margin-bottom:4px}
      svg{width:100%;height:auto}
    </style>${cards.join("")}`,
  )
})
