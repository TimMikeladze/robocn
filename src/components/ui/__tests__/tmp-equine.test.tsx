import { renderToStaticMarkup } from "react-dom/server"
import { writeFileSync } from "node:fs"
import { it } from "vitest"
import { RobotPegasus } from "@/components/ui/robot-pegasus"
const OUT = process.env.DUMP_OUT!
it("dumps", () => {
  let html = `<style>body{background:#f6f6f4;font:11px ui-monospace;display:flex;flex-wrap:wrap;gap:6px;margin:6px;--robot-shell:oklch(0.55 0.10 55);--robot-metal:oklch(0.74 0.012 250);--robot-dark:oklch(0.32 0.02 250);--robot-accent:oklch(0.75 0.18 130);--robot-grid:oklch(0.62 0.02 250)}figure{margin:0;background:#fff;padding:2px;border:1px solid #ddd}svg{display:block}</style>`
  const fig = (c: string, n: React.ReactElement) => (html += `<figure><figcaption>${c}</figcaption>${renderToStaticMarkup(n)}</figure>`)
  for (const view of ["profile", "front", "plan", "iso"] as const)
    fig(view, <RobotPegasus size={330} lift={1} spread={1} beat={0.15} interactive={false} view={view} />)
  for (const variant of ["solid", "outline", "blueprint", "wire"] as const)
    fig(variant, <RobotPegasus size={330} lift={1} spread={1} beat={0.15} interactive={false} variant={variant} label="PEGASUS / 02" />)
  for (const l of [0, 0.25, 0.5, 0.75, 1])
    fig(`lift ${l}`, <RobotPegasus size={300} lift={l} beat={0.15} gait="canter" phase={0.3} interactive={false} showContacts />)
  for (const b of [0, 0.15, 0.25, 0.4, 0.5, 0.65, 0.75, 0.9])
    fig(`beat ${b}`, <RobotPegasus size={280} lift={1} spread={1} beat={b} interactive={false} />)
  fig("furled", <RobotPegasus size={300} lift={0} spread={0} beat={0.2} gait="halt" interactive={false} />)
  fig("card 150", <RobotPegasus size={150} lift={1} spread={1} beat={0.15} interactive={false} />)
  writeFileSync(OUT, html)
})
