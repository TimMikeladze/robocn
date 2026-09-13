import { loadLibraryComponent } from "@/lib/builder/library"

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("component") ?? ""
  const component = loadLibraryComponent(id)
  return component ? Response.json(component) : Response.json({ error: "Component not found in the robocn library." }, { status: 404 })
}
