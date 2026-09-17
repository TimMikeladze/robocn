"use client"

/** The two ways out of the organization: a public page anyone can find, and a link only its holder can open. */

import * as React from "react"
import { useRouter } from "next/navigation"
import { ExternalLink, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { EditorDesign } from "@/components/studio/editor/editor"
import type { VersionRow } from "@/components/studio/editor/versions-panel"
import { CopyButton, Field, Modal, TimeAgo, eyebrow, fieldClass, useAction } from "@/components/studio/kit"
import {
  createShareLink,
  publishDesign,
  revokeShareLink,
  unpublishDesign,
} from "@/lib/studio/actions/designs"

const origin = () => (typeof window === "undefined" ? "" : window.location.origin)

function PublishModal({
  open,
  onClose,
  orgSlug,
  design,
  versions,
  dirty,
}: {
  open: boolean
  onClose: () => void
  orgSlug: string
  design: EditorDesign
  versions: VersionRow[]
  dirty: boolean
}) {
  const router = useRouter()
  const { pending, call } = useAction()
  const live = versions.find((version) => version.id === design.publishedVersionId)
  const current = versions.find((version) => version.id === design.currentVersionId)
  const url = design.publicSlug ? `${origin()}/d/${design.publicSlug}` : ""
  const embed = design.publicSlug
    ? `<iframe src="${origin()}/embed/${design.publicSlug}" width="480" height="360" style="border:0" loading="lazy" title="${design.name.replace(/"/g, "&quot;")}"></iframe>`
    : ""

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Publish"
      title={live ? `v${live.number} is live` : "Publish this design"}
      footer={
        <>
          {live ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={async () => {
                const ok = await call(() => unpublishDesign(orgSlug, design.id), { success: "Unpublished" })
                if (ok !== null) router.refresh()
              }}
            >
              Unpublish
            </Button>
          ) : null}
          {current && current.id !== live?.id ? (
            <Button
              size="sm"
              disabled={pending}
              onClick={async () => {
                const ok = await call(() => publishDesign(orgSlug, design.id), {
                  success: `v${current.number} is live`,
                })
                if (ok) router.refresh()
              }}
            >
              {live ? `Update to v${current.number}` : `Publish v${current.number}`}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-4 text-[13px]">
        <p className="text-muted-foreground">
          Publishing freezes one version at a public URL: a page with the live machine, its props and the
          code to reproduce it, an embeddable frame, and a JSON endpoint. Anyone can fork it into their own
          organization. Later versions stay private until you update.
        </p>
        {dirty ? (
          <p className="border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px]">
            The stage has unsaved changes. Publishing uses the last saved version, v{current?.number}.
          </p>
        ) : null}
        {live && design.publicSlug ? (
          <>
            <Field label="Public page">
              <div className="flex gap-1.5">
                <input readOnly value={url} className={fieldClass} onFocus={(event) => event.target.select()} />
                <CopyButton value={url} />
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open public page"
                  className="inline-flex h-7 items-center rounded-md border border-border px-2 hover:bg-accent"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </Field>
            <Field label="Embed">
              <div className="flex gap-1.5">
                <input readOnly value={embed} className={fieldClass} onFocus={(event) => event.target.select()} />
                <CopyButton value={embed} />
              </div>
            </Field>
            <p className={eyebrow}>
              JSON · /api/studio/published/{design.publicSlug}
            </p>
          </>
        ) : null}
      </div>
    </Modal>
  )
}

export interface ShareLinkRow {
  id: string
  token: string
  versionId: string | null
  expiresAt: Date | string | null
  createdAt: Date | string
}

function ShareModal({
  open,
  onClose,
  orgSlug,
  designId,
  currentVersion,
  links,
}: {
  open: boolean
  onClose: () => void
  orgSlug: string
  designId: string
  currentVersion: { id: string; number: number } | null
  links: ShareLinkRow[]
}) {
  const router = useRouter()
  const { pending, call } = useAction()
  const [expires, setExpires] = React.useState("7")
  const [pin, setPin] = React.useState(false)

  return (
    <Modal open={open} onClose={onClose} eyebrow="Share" title="Private review links">
      <div className="space-y-4 text-[13px]">
        <p className="text-muted-foreground">
          A link shows the design to anyone who holds it, without an account and without listing it
          anywhere. View only. Revoke it and it stops working.
        </p>
        <div className="flex flex-wrap items-end gap-2 border border-border bg-background p-3">
          <Field label="Expires" htmlFor="share-expires" className="w-32">
            <select
              id="share-expires"
              value={expires}
              onChange={(event) => setExpires(event.target.value)}
              className={fieldClass}
            >
              <option value="1">In a day</option>
              <option value="7">In a week</option>
              <option value="30">In 30 days</option>
              <option value="">Never</option>
            </select>
          </Field>
          <label className="flex h-8 items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={pin}
              disabled={!currentVersion}
              onChange={(event) => setPin(event.target.checked)}
              className="accent-foreground"
            />
            Pin to v{currentVersion?.number ?? 1}
          </label>
          <Button
            size="sm"
            className="ml-auto"
            disabled={pending}
            onClick={async () => {
              const created = await call(() =>
                createShareLink(orgSlug, designId, {
                  expiresInDays: expires ? Number(expires) : null,
                  versionId: pin ? (currentVersion?.id ?? null) : null,
                }),
              )
              if (!created) return
              try {
                await navigator.clipboard.writeText(`${origin()}/s/${created.token}`)
              } catch {
                /* The link is in the list below either way. */
              }
              router.refresh()
            }}
          >
            Create link
          </Button>
        </div>
        {links.length ? (
          <ul className="divide-y divide-border border border-border">
            {links.map((link) => (
              <li key={link.id} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[11px]">/s/{link.token.slice(0, 10)}…</p>
                  <p className="text-[11px] text-muted-foreground">
                    {link.versionId ? "Pinned version" : "Follows latest"} ·{" "}
                    {link.expiresAt ? (
                      <>
                        expires <TimeAgo date={link.expiresAt} />
                      </>
                    ) : (
                      "never expires"
                    )}
                  </p>
                </div>
                <CopyButton value={() => `${origin()}/s/${link.token}`} />
                <button
                  type="button"
                  aria-label="Revoke link"
                  disabled={pending}
                  onClick={async () => {
                    const ok = await call(() => revokeShareLink(orgSlug, link.id), { success: "Revoked" })
                    if (ok !== null) router.refresh()
                  }}
                  className="rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Modal>
  )
}

export { PublishModal, ShareModal }
