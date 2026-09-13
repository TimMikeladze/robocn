import Link from "next/link"

import { Panel } from "@/components/site/panel"
import { docGroups, docs } from "@/lib/docs"

export const metadata = {
  title: "Components",
  description:
    "Every machine in the robocn registry: arms in SVG and WebGL, SCARA, delta and gantry, plus the kinematics they share.",
}

export default function DocsIndex() {
  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Components</h1>
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">
          Fourteen items: four machines, two robots, a pendant, a 3D rig and the
          stage it stands on, and the kinematics, styling and hooks underneath
          them. Install one and its dependencies come with it.
        </p>
      </header>

      {docGroups.map((group) => (
        <section key={group} className="space-y-3">
          <h2 className="text-[13px] font-medium text-muted-foreground">{group}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {docs
              .filter((entry) => entry.group === group)
              .map((entry) => (
                <Link key={entry.slug} href={`/docs/${entry.slug}`} className="group">
                  <Panel className="h-full p-4 transition-colors group-hover:border-foreground">
                    <h3 className="text-[15px] font-medium">{entry.title}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                      {entry.summary}
                    </p>
                    {entry.item ? (
                      <code className="mt-3 block font-mono text-[11px] text-muted-foreground">
                        {entry.item}
                      </code>
                    ) : null}
                  </Panel>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}
