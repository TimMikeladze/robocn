import { readFile } from "node:fs/promises"
import path from "node:path"

import { workbenchComponent } from "@/lib/workbench/controls"

/**
 * A component's source, as it stands on disk right now.
 *
 * The path comes from the generated manifest and never from the request, so
 * `?component=` can only ever name a component that ships. Reading from disk
 * rather than from a bundle is deliberate: the workbench is a local tool, and
 * the panel should show the file the agent is editing, not a build artefact.
 */
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("component")
  const component = workbenchComponent(id)
  if (!component) {
    return Response.json({ error: "Unknown component." }, { status: 404 })
  }
  try {
    // Turbopack cannot trace a path it does not know at build time, and there
    // is nothing here to trace: the workbench reads the working directory of a
    // dev server, and says so plainly when there is not one.
    const source = await readFile(
      path.join(/* turbopackIgnore: true */ process.cwd(), component.file),
      "utf8",
    )
    return Response.json(
      { file: component.file, source },
      { headers: { "cache-control": "no-store" } },
    )
  } catch {
    return Response.json(
      { error: `Could not read ${component.file}. The workbench reads sources from the working directory, so this needs a local server.` },
      { status: 404 },
    )
  }
}
