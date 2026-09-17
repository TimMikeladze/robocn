"use client"

import { Panel } from "@/components/site/panel"
import { DemoTheming } from "@/components/site/demo-theming"
import { demoBySlug } from "@/components/demos/demos"
import { RobotExport } from "@/components/ui/robot-export"

/**
 * Mounts the live demo for a doc slug inside a drawing frame. `demoFor` falls
 * back to the machine's own default bench, so a component that shipped without
 * a written demo still has one. A written bench ignores the `slug` it is
 * handed; the generated one needs it to know what to draw.
 *
 * The bench is wrapped in `RobotExport`, which is how every item in the
 * registry has a record button on its own page without a per-item edit:
 * `docs/export.md`. It is wrapped again in `DemoTheming`, which is how every
 * item has its whole palette on a knob: `docs/component-page-theming.md`.
 */
function DemoPanel({ slug }: { slug: string }) {
  const Demo = demoBySlug[slug]
  if (!Demo) return null
  return (
    <Panel className="overflow-hidden">
      <DemoTheming>
        <RobotExport name={slug}>
          <Demo slug={slug} />
        </RobotExport>
      </DemoTheming>
    </Panel>
  )
}

export { DemoPanel }
