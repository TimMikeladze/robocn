"use client"

import { Panel } from "@/components/site/panel"
import { demoBySlug } from "@/components/demos/demos"

/**
 * Mounts the live demo for a doc slug inside a drawing frame. `demoFor` falls
 * back to the machine's own default bench, so a component that shipped without
 * a written demo still has one. A written bench ignores the `slug` it is
 * handed; the generated one needs it to know what to draw.
 */
function DemoPanel({ slug }: { slug: string }) {
  const Demo = demoBySlug[slug]
  if (!Demo) return null
  return (
    <Panel className="overflow-hidden">
      <Demo slug={slug} />
    </Panel>
  )
}

export { DemoPanel }
