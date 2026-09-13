import { DocsCatalogue } from "@/components/site/docs-catalogue"
import { docGroups, docs } from "@/lib/docs"

export const metadata = {
  title: "Components",
  description: "Browse and search robotic components for shadcn: articulated arms, production machines, mobile robots, sensor displays, and shared foundations.",
}

export default function DocsIndex() {
  const entries = docGroups.flatMap(group => docs.filter(entry => entry.group === group))
    .map(({ slug, title, summary, group, item }) => ({ slug, title, summary, group, item }))
  const count = entries.filter(entry => entry.item).length

  return (
    <div className="space-y-7">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Components</h1>
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">
          {count} installable components, libraries, and hooks for robotic interfaces.
          Find a machine, explore its controls, and install the source with its dependencies.
        </p>
      </header>
      <DocsCatalogue entries={entries} />
    </div>
  )
}
