import { SettingsAdmin } from "@/components/studio/admin/settings"
import { getAsset, listLabels, listPalettes } from "@/lib/studio/queries"
import { requireMember } from "@/lib/studio/session"

export const metadata = { title: "Settings" }

export default async function SettingsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const { org, member } = await requireMember(slug)
  const logoId = org.settings.profile.logoAssetId
  const [labels, palettes, logo] = await Promise.all([
    listLabels(org.id),
    listPalettes(org.id),
    logoId ? getAsset(org.id, logoId) : null,
  ])

  return (
    <SettingsAdmin
      // A rename or a new slug is a different organization as far as the drafts are concerned.
      key={`${org.slug}:${org.name}`}
      org={{ id: org.id, name: org.name, slug: org.slug, settings: org.settings }}
      role={member.role}
      labels={labels.map(({ id, name, color }) => ({ id, name, color }))}
      palettes={palettes.map(({ id, name }) => ({ id, name }))}
      logo={logo && !logo.deletedAt ? { id: logo.id, name: logo.name, isPublic: logo.isPublic } : null}
    />
  )
}
