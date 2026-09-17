/** A published design as data: the machine, the props, and the JSX that reproduces it. */

import { getPublished } from "@/lib/studio/queries"
import { siteUrl } from "@/lib/site"
import { sanitizePose } from "@/lib/studio/pose"
import { jsxSnippet, workbenchComponent } from "@/lib/workbench/controls"

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const row = await getPublished(slug)
  const component = row ? workbenchComponent(row.componentId) : null
  if (!row || !component) return Response.json({ error: "Not found." }, { status: 404 })
  const pose = sanitizePose(component, row.pose)
  return Response.json(
    {
      slug: row.slug,
      name: row.name,
      description: row.description,
      organization: { name: row.orgName, slug: row.orgSlug },
      component: { id: component.id, export: component.export, file: component.file },
      version: row.versionNumber,
      publishedAt: row.publishedAt,
      props: pose,
      stage: row.stageView,
      jsx: jsxSnippet(component, pose),
      // The same line the docs pages print.
      install: `npx shadcn@latest add ${siteUrl}/r/${component.id}.json`,
    },
    { headers: { "Cache-Control": "public, max-age=60", "Access-Control-Allow-Origin": "*" } },
  )
}
