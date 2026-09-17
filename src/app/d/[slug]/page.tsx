/**
 * A published design: one frozen version of a machine, shown on the ground its
 * author chose, with everything a visitor needs to take it away — the install
 * line, the JSX, an embed, the JSON, or a fork into their own workspace.
 *
 * The pose and the stage are user data and are sanitized before anything is
 * drawn. Unlike `/studio`, this page is meant to be indexed.
 */

import type { Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"
import { notFound } from "next/navigation"

import { CodeBlock } from "@/components/site/code-block"
import { InstallCommand } from "@/components/site/install-command"
import { rail } from "@/components/site/rail"
import { DesignStage } from "@/components/studio/public/design-stage"
import { ForkButton } from "@/components/studio/public/fork-button"
import { loadPublished, type PublishedDesign } from "@/components/studio/public/load"
import { publishedOn, safeStage } from "@/components/studio/public/stage-view"
import { eyebrow } from "@/components/studio/styles"
import { docBySlug } from "@/lib/docs"
import { ogImage } from "@/lib/og"
import { site } from "@/lib/site"
import { can } from "@/lib/studio/permissions"
import { sanitizePose } from "@/lib/studio/pose"
import { getSession, listMemberships } from "@/lib/studio/session"
import { parseSettings } from "@/lib/studio/settings"
import { jsxSnippet } from "@/lib/workbench/controls"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

const summary = (found: PublishedDesign) =>
  found.row.description.trim() ||
  `${found.component.title}, posed by ${found.row.orgName} in ${site.name} Studio.`

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const found = await loadPublished(slug)
  if (!found) return { title: "Design not found", robots: { index: false } }
  const { row, component } = found
  const description = summary(found)
  const alt = `${row.name} — ${component.title} design by ${row.orgName}`
  // The version's own snapshot when it has one; the machine's card when it does not.
  const images = row.thumbnailKey
    ? [{ url: `/api/studio/thumbnails/${row.versionId}`, alt }]
    : [...ogImage(component.id, alt)]
  return {
    title: row.name,
    description,
    alternates: { canonical: `/d/${slug}` },
    openGraph: {
      title: `${row.name} — ${site.name}`,
      description,
      url: `${site.url}/d/${slug}`,
      type: "article",
      images,
    },
    twitter: { card: "summary_large_image", images },
  }
}

/** Where this request actually arrived, so the embed line is right on any port. */
async function requestOrigin() {
  const list = await headers()
  const host = list.get("host")
  if (!host) return site.url
  const proto =
    list.get("x-forwarded-proto")?.split(",")[0].trim() ??
    (/^(localhost|127\.|\[::1\])/.test(host) ? "http" : "https")
  return `${proto}://${host}`
}

const attribute = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;")

const heading = "text-[14px] font-medium"

export default async function PublishedDesignPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const found = await loadPublished(slug)
  if (!found) notFound()
  const { row, component } = found

  const pose = sanitizePose(component, row.pose)
  const stage = safeStage(row.stageView)
  const listed = parseSettings(row.orgSettings).profile.listed
  const published = publishedOn(row.publishedAt)
  // A draft machine can be posed and published before it has a docs page.
  const documented = !!docBySlug(component.id)

  const session = await getSession()
  const targets = session
    ? (await listMemberships(session.user.id))
        .filter((membership) => can(membership.role, "design:create"))
        .map(({ slug: orgSlug, name }) => ({ slug: orgSlug, name }))
    : []

  const origin = await requestOrigin()
  const embed = `<iframe src="${origin}/embed/${slug}" width="480" height="360" style="border:0" loading="lazy" title="${attribute(row.name)}"></iframe>`
  const setProps = component.controls.filter((control) => pose[control.name] !== undefined)

  return (
    <div className={cn(rail, "py-8 sm:py-10")}>
      <header className="space-y-2">
        <p className={eyebrow}>
          <Link href="/explore" className="hover:text-foreground">
            Explore
          </Link>{" "}
          / Published design
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{row.name}</h1>
        {row.description ? (
          <p className="max-w-[64ch] text-[15px] leading-relaxed whitespace-pre-line text-muted-foreground">
            {row.description}
          </p>
        ) : null}
        {/* The dot belongs to the item after it, so a wrapped line never ends on one. */}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-[13px] text-muted-foreground [&>*+*]:before:mr-2 [&>*+*]:before:text-muted-foreground [&>*+*]:before:content-['·']">
          <span>
            by{" "}
            {listed ? (
              <Link
                href={`/o/${row.orgSlug}`}
                className="text-foreground underline-offset-2 hover:underline"
              >
                {row.orgName}
              </Link>
            ) : (
              <span className="text-foreground">{row.orgName}</span>
            )}
          </span>
          <span>
            {documented ? (
              <Link
                href={`/docs/${component.id}`}
                className="text-foreground underline-offset-2 hover:underline"
              >
                {component.title}
              </Link>
            ) : (
              <span className="text-foreground">{component.title}</span>
            )}
          </span>
          <span className="font-mono text-[12px]">v{row.versionNumber}</span>
          {published ? (
            <span>
              published{" "}
              <time dateTime={new Date(row.publishedAt!).toISOString()}>{published}</time>
            </span>
          ) : null}
        </p>
      </header>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-8">
          <DesignStage
            componentId={component.id}
            pose={pose}
            // The author's size when they chose one; otherwise large, because this is the hero.
            size={pose.size === undefined ? "lg" : undefined}
            stage={stage}
            label={`${row.name}: a live ${component.title}`}
            className="h-[22rem] border border-border sm:h-[30rem]"
          />

          <section className="space-y-3">
            <h2 className={heading}>Props</h2>
            {setProps.length ? (
              <div className="overflow-x-auto border border-border">
                <table className="w-full border-collapse text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-[11px] text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Prop</th>
                      <th className="px-3 py-2 font-medium">Value</th>
                      <th className="px-3 py-2 font-medium">Default</th>
                      <th className="px-3 py-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {setProps.map((control) => (
                      <tr
                        key={control.name}
                        className="border-b border-border/70 align-top last:border-0"
                      >
                        <td className="px-3 py-2.5 font-mono text-[12px] whitespace-nowrap">
                          {control.name}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[12px] whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            {control.kind === "color" ? (
                              <span
                                aria-hidden
                                className="size-3 shrink-0 border border-border"
                                style={{ background: String(pose[control.name]) }}
                              />
                            ) : null}
                            {String(pose[control.name])}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11.5px] whitespace-nowrap text-muted-foreground">
                          {control.default === undefined ? "—" : String(control.default)}
                        </td>
                        <td className="min-w-48 px-3 py-2.5 text-muted-foreground">{control.doc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">
                Nothing is set: this is {component.title} exactly as it installs.
              </p>
            )}
            {documented ? (
              <p className="text-[13px] text-muted-foreground">
                Every prop the machine takes is on{" "}
                <Link
                  href={`/docs/${component.id}`}
                  className="text-foreground underline-offset-2 hover:underline"
                >
                  its docs page
                </Link>
                .
              </p>
            ) : null}
          </section>
        </div>

        <aside className="min-w-0 space-y-8">
          <section className="space-y-3 border border-border bg-panel p-4">
            <h2 className={heading}>Fork to Studio</h2>
            <p className="text-[13px] text-muted-foreground">
              Copy this design into your own workspace and keep changing it.
            </p>
            <ForkButton slug={slug} signedIn={!!session} targets={targets} />
          </section>

          <section className="space-y-3">
            <h2 className={heading}>Use this design</h2>
            {component.draft ? null : <InstallCommand item={component.id} />}
            <CodeBlock code={jsxSnippet(component, pose)} caption="tsx" />
          </section>

          <section className="space-y-3">
            <h2 className={heading}>Embed</h2>
            <CodeBlock code={embed} caption="iframe" className="[&_pre]:whitespace-pre-wrap [&_pre]:break-all" />
            <p className="text-[12.5px] text-muted-foreground">
              Add <code className="font-mono text-[12px]">?bg=transparent</code> to drop the ground,{" "}
              <code className="font-mono text-[12px]">?controls=0</code> to hide the credit.
            </p>
          </section>

          <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-4 font-mono text-[11.5px] text-muted-foreground">
            <a href={`/api/studio/published/${slug}`} className="hover:text-foreground">
              JSON ↗
            </a>
            <Link href={`/embed/${slug}`} className="hover:text-foreground">
              Embed view ↗
            </Link>
            <Link href="/explore" className="hover:text-foreground">
              More designs
            </Link>
          </p>
        </aside>
      </div>
    </div>
  )
}
