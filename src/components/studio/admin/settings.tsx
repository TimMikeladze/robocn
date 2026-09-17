"use client"

/**
 * An organization's settings, one section at a time. Each section keeps its own
 * draft and saves on its own, so a half-edited workflow never rides along with
 * a changed tagline. `updateSettings` takes the whole object, so every save
 * spreads the latest settings and replaces only its own part — "latest" being
 * what this page last saved, held here, not what the server last rendered: a
 * second save can be clicked before the first one's refresh has landed, and
 * spreading stale props would quietly undo the first.
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ExternalLink, ImageIcon, Lock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuthCall } from "@/components/studio/admin/auth-call"
import { ColorField } from "@/components/studio/admin/color-field"
import { LabelSettings, type LabelRow } from "@/components/studio/admin/settings-labels"
import { WorkflowSettings } from "@/components/studio/admin/settings-workflow"
import { AssetPicker } from "@/components/studio/assets/asset-picker"
import { Field, Modal, PageBody, PageHeader, Section, fieldClass, useAction } from "@/components/studio/kit"
import { authClient } from "@/lib/auth-client"
import { updateSettings } from "@/lib/studio/actions/workspace"
import { isValidSlug } from "@/lib/studio/ids"
import { can, isOwner } from "@/lib/studio/permissions"
import { stageBackgroundIds, type OrgSettings } from "@/lib/studio/settings"

interface SettingsProps {
  org: { id: string; name: string; slug: string; settings: OrgSettings }
  role: string
  labels: LabelRow[]
  palettes: { id: string; name: string }[]
  /** The saved logo, looked up so the page can say whether the public can see it. */
  logo: { id: string; name: string; isPublic: boolean } | null
}

const backgroundLabels: Record<(typeof stageBackgroundIds)[number], string> = {
  panel: "Panel",
  grid: "Grid",
  blueprint: "Blueprint",
  checker: "Checker",
  dark: "Dark",
}

function GeneralSettings({ org, readOnly }: { org: SettingsProps["org"]; readOnly: boolean }) {
  const router = useRouter()
  const { pending, call } = useAuthCall()
  const [name, setName] = React.useState(org.name)
  const [slug, setSlug] = React.useState(org.slug)
  const dirty = name.trim() !== org.name || slug !== org.slug
  const slugError =
    slug !== org.slug && !isValidSlug(slug)
      ? "Lowercase letters, numbers and dashes, and not a word Studio uses itself."
      : null

  return (
    <Section title="General" description="What the organization is called and where it lives.">
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault()
          if (slugError) return
          const updated = await call(
            () =>
              authClient.organization.update({
                organizationId: org.id,
                data: { name: name.trim(), slug },
              }),
            { success: "Organization saved." },
          )
          if (!updated) return
          // Every URL under the old slug is gone, this page's included.
          if (slug !== org.slug) router.push(`/studio/${slug}/settings`)
          router.refresh()
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="org-name">
            <input
              id="org-name"
              required
              minLength={2}
              maxLength={60}
              disabled={readOnly}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={fieldClass}
            />
          </Field>
          <Field
            label="URL"
            htmlFor="org-slug"
            error={slugError}
            hint="Changing this breaks links to the workspace and to its public page."
          >
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[12px] text-muted-foreground">/studio/</span>
              <input
                id="org-slug"
                required
                maxLength={48}
                disabled={readOnly}
                value={slug}
                spellCheck={false}
                onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/\s+/g, "-"))}
                aria-invalid={!!slugError}
                className={`${fieldClass} font-mono text-[12px]`}
              />
            </div>
          </Field>
        </div>
        {readOnly ? null : (
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={!dirty || !!slugError || pending}>
              Save
            </Button>
          </div>
        )}
      </form>
    </Section>
  )
}

function DefaultSettings({
  org,
  settings,
  palettes,
  readOnly,
  onSaved,
}: {
  org: SettingsProps["org"]
  settings: OrgSettings
  palettes: SettingsProps["palettes"]
  readOnly: boolean
  onSaved: (next: OrgSettings) => void
}) {
  const { pending, call } = useAction()
  const saved = settings.defaults
  const [background, setBackground] = React.useState(saved.background)
  // A palette deleted since it was chosen reads as none.
  const [paletteId, setPaletteId] = React.useState(
    palettes.some((palette) => palette.id === saved.paletteId) ? saved.paletteId : null,
  )
  const dirty = background !== saved.background || paletteId !== saved.paletteId

  return (
    <Section title="Defaults" description="What a new design starts with. Either can be changed on the design.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Stage background" htmlFor="default-background">
          <select
            id="default-background"
            disabled={readOnly}
            value={background}
            onChange={(event) => setBackground(event.target.value as typeof background)}
            className={fieldClass}
          >
            {stageBackgroundIds.map((id) => (
              <option key={id} value={id}>
                {backgroundLabels[id]}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Palette"
          htmlFor="default-palette"
          hint={
            palettes.length ? undefined : (
              <>
                There are none yet.{" "}
                <Link href={`/studio/${org.slug}/palettes`} className="underline underline-offset-4">
                  Make one
                </Link>
                .
              </>
            )
          }
        >
          <select
            id="default-palette"
            disabled={readOnly || palettes.length === 0}
            value={paletteId ?? ""}
            onChange={(event) => setPaletteId(event.target.value || null)}
            className={fieldClass}
          >
            <option value="">None — the machine&apos;s own colours</option>
            {palettes.map((palette) => (
              <option key={palette.id} value={palette.id}>
                {palette.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {readOnly ? null : (
        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            disabled={!dirty || pending}
            onClick={async () => {
              const next = { ...settings, defaults: { background, paletteId } }
              const done = await call(() => updateSettings(org.slug, next), { success: "Defaults saved." })
              if (done !== null) onSaved(next)
            }}
          >
            Save defaults
          </Button>
        </div>
      )}
    </Section>
  )
}

function ProfileSettings({
  org,
  settings,
  logo,
  readOnly,
  canUpload,
  onSaved,
}: {
  org: SettingsProps["org"]
  settings: OrgSettings
  logo: SettingsProps["logo"]
  readOnly: boolean
  canUpload: boolean
  onSaved: (next: OrgSettings) => void
}) {
  const { pending, call } = useAction()
  const saved = settings.profile
  const [profile, setProfile] = React.useState(saved)
  const [picked, setPicked] = React.useState<{ id: string; name: string } | null>(logo)
  const [picking, setPicking] = React.useState(false)
  const dirty = JSON.stringify(profile) !== JSON.stringify(saved)
  const websiteError =
    profile.website && !/^https?:\/\/\S+\.\S+/.test(profile.website) ? "Start with https://" : null
  const hidden = !!logo && logo.id === profile.logoAssetId && !logo.isPublic

  return (
    <Section
      title="Public profile"
      description="How the organization looks on its public gallery, where its published designs are collected."
      aside={
        saved.listed ? (
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/o/${org.slug}`} />}>
            <ExternalLink /> /o/{org.slug}
          </Button>
        ) : null
      }
    >
      <div className="space-y-4">
        <label className="flex items-start gap-2.5 text-[13px]">
          <input
            type="checkbox"
            checked={profile.listed}
            disabled={readOnly}
            onChange={(event) => setProfile({ ...profile, listed: event.target.checked })}
            className="mt-0.5 size-3.5 accent-foreground"
          />
          <span>
            <span className="font-medium">List this organization publicly</span>
            <span className="block text-[12px] text-muted-foreground">
              Off, /o/{org.slug} does not exist. Published designs keep their own links either way.
            </span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tagline" htmlFor="profile-tagline" hint={`${profile.tagline.length}/140`}>
            <input
              id="profile-tagline"
              maxLength={140}
              disabled={readOnly}
              value={profile.tagline}
              onChange={(event) => setProfile({ ...profile, tagline: event.target.value })}
              placeholder="Arms, grippers and the odd walking thing."
              className={fieldClass}
            />
          </Field>
          <Field label="Website" htmlFor="profile-website" error={websiteError}>
            <input
              id="profile-website"
              type="url"
              inputMode="url"
              disabled={readOnly}
              value={profile.website}
              onChange={(event) => setProfile({ ...profile, website: event.target.value.trim() })}
              placeholder="https://example.com"
              className={fieldClass}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Accent colour" hint="Links and highlights on the public page.">
            <ColorField
              label="Accent"
              value={profile.accent}
              disabled={readOnly}
              onChange={(accent) => setProfile({ ...profile, accent })}
            />
          </Field>
          <Field
            label="Logo"
            hint="An image from the asset library. It only shows on the public page once it is made public there."
          >
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden border border-border bg-background">
                {profile.logoAssetId ? (
                  // Served by a route handler behind auth; the optimizer has nothing to add.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/studio/assets/${profile.logoAssetId}/file?thumb=1`}
                    alt={picked?.name ?? "Logo"}
                    className="size-full object-contain"
                  />
                ) : (
                  <ImageIcon aria-hidden className="size-4 text-muted-foreground" />
                )}
              </span>
              {readOnly ? null : (
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
                    {profile.logoAssetId ? "Change" : "Choose image"}
                  </Button>
                  {profile.logoAssetId ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPicked(null)
                        setProfile({ ...profile, logoAssetId: null })
                      }}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          </Field>
        </div>

        {hidden ? (
          <p role="status" className="text-[12px] text-amber-600 dark:text-amber-500">
            {logo.name} is private, so visitors to the public page will not see it.{" "}
            <Link href={`/studio/${org.slug}/assets`} className="underline underline-offset-4">
              Make it public in the asset library
            </Link>
            .
          </p>
        ) : null}

        {readOnly ? null : (
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!dirty || !!websiteError || pending}
              onClick={async () => {
                const next = { ...settings, profile }
                const done = await call(() => updateSettings(org.slug, next), {
                  success: "Public profile saved.",
                })
                if (done !== null) onSaved(next)
              }}
            >
              Save profile
            </Button>
          </div>
        )}
      </div>

      <AssetPicker
        orgSlug={org.slug}
        open={picking}
        onClose={() => setPicking(false)}
        kind="image"
        canUpload={canUpload}
        onPick={(assets) => {
          const [asset] = assets
          if (asset) {
            setPicked({ id: asset.id, name: asset.name })
            setProfile({ ...profile, logoAssetId: asset.id })
          }
          setPicking(false)
        }}
      />
    </Section>
  )
}

function DangerZone({ org }: { org: SettingsProps["org"] }) {
  const router = useRouter()
  const { pending, call } = useAuthCall()
  const [open, setOpen] = React.useState(false)
  const [typed, setTyped] = React.useState("")
  const close = () => {
    setOpen(false)
    setTyped("")
  }

  return (
    <Section
      title="Danger zone"
      description="Owners only."
      className="border-destructive/40"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium">Delete this organization</p>
          <p className="text-[12px] text-muted-foreground">
            Every design, version, file, palette and membership goes with it. Published pages stop working.
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
          Delete organization
        </Button>
      </div>

      <Modal
        open={open}
        onClose={close}
        title={`Delete ${org.name}?`}
        eyebrow="This cannot be undone"
        size="sm"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={typed !== org.name || pending}
              onClick={async () => {
                const done = await call(() => authClient.organization.delete({ organizationId: org.id }), {
                  success: `${org.name} was deleted.`,
                })
                if (!done) return
                router.push("/studio")
                router.refresh()
              }}
            >
              Delete forever
            </Button>
          </>
        }
      >
        <Field label={`Type "${org.name}" to confirm`} htmlFor="confirm-delete">
          <input
            id="confirm-delete"
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            className={fieldClass}
          />
        </Field>
      </Modal>
    </Section>
  )
}

function SettingsAdmin({ org, role, labels, palettes, logo }: SettingsProps) {
  const router = useRouter()
  const readOnly = !can(role, "settings:update")
  const [settings, setSettings] = React.useState(org.settings)
  const refresh = () => router.refresh()
  const saved = (next: OrgSettings) => {
    setSettings(next)
    router.refresh()
  }

  return (
    <>
      <PageHeader
        eyebrow={org.name}
        title="Settings"
        description="How this organization works and how it looks from outside."
      />
      <PageBody className="max-w-4xl space-y-6">
        {readOnly ? (
          <p role="note" className="flex items-center gap-2 border border-border bg-panel px-4 py-3 text-[13px] text-muted-foreground">
            <Lock aria-hidden className="size-3.5 shrink-0" />
            Only owners and admins can change settings. You are seeing them as they are.
          </p>
        ) : null}
        <GeneralSettings org={org} readOnly={readOnly} />
        <WorkflowSettings orgSlug={org.slug} settings={settings} readOnly={readOnly} onSaved={saved} />
        <LabelSettings orgSlug={org.slug} labels={labels} readOnly={readOnly} onChanged={refresh} />
        <DefaultSettings org={org} settings={settings} palettes={palettes} readOnly={readOnly} onSaved={saved} />
        <ProfileSettings
          org={org}
          settings={settings}
          logo={logo}
          readOnly={readOnly}
          canUpload={can(role, "asset:create")}
          onSaved={saved}
        />
        {isOwner(role) ? <DangerZone org={org} /> : null}
      </PageBody>
    </>
  )
}

export { SettingsAdmin }
