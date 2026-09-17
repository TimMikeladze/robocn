import { PalettesAdmin } from "@/components/studio/admin/palettes"
import { listPalettes } from "@/lib/studio/queries"
import { requireMember } from "@/lib/studio/session"

export const metadata = { title: "Palettes" }

export default async function PalettesPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const { org, member } = await requireMember(slug)
  const palettes = await listPalettes(org.id)

  return (
    <PalettesAdmin
      org={{ name: org.name, slug: org.slug }}
      role={member.role}
      palettes={palettes.map(({ id, name, colors }) => ({ id, name, colors }))}
      defaultPaletteId={org.settings.defaults.paletteId}
    />
  )
}
