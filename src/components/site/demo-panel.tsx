"use client"

import { Panel } from "@/components/site/panel"
import { demos } from "@/components/demos/demos"

/** Mounts the live demo for a doc slug inside a drawing frame. */
function DemoPanel({ slug }: { slug: string }) {
  const Demo = demos[slug]
  if (!Demo) return null
  return (
    <Panel className="overflow-hidden">
      <Demo />
    </Panel>
  )
}

export { DemoPanel }
