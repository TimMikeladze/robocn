import { BuilderWorkspace } from "@/components/builder/builder-workspace"
import { libraryComponents, loadLibraryComponent } from "@/lib/builder/library"

export const metadata = {
  title: "Robot Builder",
  description: "Design robotic React components with an AI agent. Edit the code, preview your robot live, and export it for your own project.",
  alternates: { canonical: "/builder" },
}

export const dynamic = "force-dynamic"

export default async function BuilderPage({ searchParams }: { searchParams: Promise<{ component?: string }> }) {
  const { component } = await searchParams
  const selected = typeof component === "string" ? loadLibraryComponent(component) : null
  return <BuilderWorkspace key={selected?.name ?? "saved"} restoreDraft={!selected} initialVersion={selected ?? loadLibraryComponent("robot-arm")!} library={libraryComponents} serverAgent={Boolean(process.env.OPENAI_API_KEY) && (process.env.NODE_ENV !== "production" || Boolean(process.env.BUILDER_ACCESS_TOKEN))} tokenRequired={Boolean(process.env.BUILDER_ACCESS_TOKEN)} />
}
