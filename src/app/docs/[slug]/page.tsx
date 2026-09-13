import { readFile } from "node:fs/promises"
import path from "node:path"
import Link from "next/link"
import { notFound } from "next/navigation"

import { CodeBlock } from "@/components/site/code-block"
import { DemoPanel } from "@/components/site/demo-panel"
import { InstallCommand } from "@/components/site/install-command"
import { PropsTable } from "@/components/site/props-table"
import { docBySlug, docs } from "@/lib/docs"
import { libraryComponents } from "@/lib/builder/library"
import { ogImage } from "@/lib/og"
import { site } from "@/lib/site"

export function generateStaticParams() {
  return docs.map((entry) => ({ slug: entry.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const entry = docBySlug(slug)
  if (!entry) return {}
  // The page's own card — the machine itself, not the site contact sheet.
  // `ogImage` falls back for an item that has shipped but not been captured
  // yet: `docs/per-page-og-images.md`.
  const images = ogImage(slug, `${entry.title} — ${entry.summary}`)

  return {
    title: entry.title,
    description: entry.summary,
    // Without this the page would inherit the root layout's canonical, which
    // points every route at `/`.
    alternates: { canonical: `/docs/${slug}` },
    openGraph: {
      title: `${entry.title} — ${site.name}`,
      description: entry.summary,
      url: `${site.url}/docs/${slug}`,
      type: "article",
      images,
    },
    twitter: { card: "summary_large_image", images },
  }
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const entry = docBySlug(slug)
  if (!entry) notFound()

  // Scoped to `src` on purpose: a bare process.cwd() join makes the bundler
  // trace the whole project into the server output.
  const sources = await Promise.all(
    entry.files.map(async (file) => ({
      file: `src/${file}`,
      code: await readFile(path.join(process.cwd(), "src", file), "utf8"),
    })),
  )

  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{entry.title}</h1>
        <p className="max-w-[64ch] text-[15px] leading-relaxed text-muted-foreground">
          {entry.summary}
        </p>
        {libraryComponents.some(component => component.id === entry.item) && (
          <Link href={`/builder?component=${entry.item}`} className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-[13px] transition-colors hover:bg-muted">
            Open in builder <span aria-hidden>↗</span>
          </Link>
        )}
      </header>

      {entry.item && demoExists(entry.slug) ? <DemoPanel slug={entry.slug} /> : null}

      {entry.item ? (
        <section className="space-y-3">
          <h2 className="text-[15px] font-medium">Install</h2>
          <InstallCommand item={entry.item} />
        </section>
      ) : null}

      {entry.notes?.length ? (
        <section className="space-y-3">
          <h2 className="text-[15px] font-medium">
            {entry.item ? "Notes" : "How it works"}
          </h2>
          <ul className="space-y-2 text-[14px] leading-relaxed text-muted-foreground">
            {entry.notes.map((note) => (
              <li key={note} className="border-l border-border pl-3">
                {note}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {entry.slug === "installation" ? <InstallationExtras /> : null}

      {entry.usage ? (
        <section className="space-y-3">
          <h2 className="text-[15px] font-medium">Usage</h2>
          <CodeBlock code={entry.usage} />
        </section>
      ) : null}

      {entry.props?.length ? (
        <section className="space-y-3">
          <h2 className="text-[15px] font-medium">Props</h2>
          <PropsTable rows={entry.props} />
        </section>
      ) : null}

      {entry.api?.length ? (
        <section className="space-y-3">
          <h2 className="text-[15px] font-medium">API</h2>
          <PropsTable rows={entry.api} caption="exports" />
        </section>
      ) : null}

      {sources.length ? (
        <section className="space-y-3">
          <h2 className="text-[15px] font-medium">Source</h2>
          {sources.map((source) => (
            <CodeBlock
              key={source.file}
              caption={source.file}
              code={source.code}
              scroll
            />
          ))}
        </section>
      ) : null}
    </article>
  )
}

/** Slugs that have a live demo. Kept here so the page stays a server component. */
function demoExists(slug: string) {
  return ![""].includes(slug) && slug !== "installation"
}

function InstallationExtras() {
  return (
    <section className="space-y-3">
      <h2 className="text-[15px] font-medium">Add the namespace</h2>
      <p className="max-w-[64ch] text-[14px] leading-relaxed text-muted-foreground">
        Register robocn in <code className="font-mono text-[13px]">components.json</code>{" "}
        and every item installs by short name.
      </p>
      <CodeBlock
        caption="components.json"
        code={`{
  "registries": {
    "@robocn": "${process.env.NEXT_PUBLIC_REGISTRY_URL ?? "https://robocn.vercel.app"}/r/{name}.json"
  }
}`}
      />
      <CodeBlock code={`pnpm dlx shadcn@latest add @robocn/robot-arm @robocn/delta-arm`} />
    </section>
  )
}
