import { readFile } from "node:fs/promises"
import path from "node:path"
import Link from "next/link"
import { notFound } from "next/navigation"

import { CodeBlock } from "@/components/site/code-block"
import { DemoPanel } from "@/components/site/demo-panel"
import { DocsPager } from "@/components/site/docs-pager"
import { DocsToc, type TocSection } from "@/components/site/docs-toc"
import { InstallCommand } from "@/components/site/install-command"
import { InstallToFolder } from "@/components/site/install-to-folder"
import { PageActions } from "@/components/site/page-actions"
import { PropsTable } from "@/components/site/props-table"
import { docBySlug, docs } from "@/lib/docs"
import { workbenchComponent } from "@/lib/workbench/controls"
import { ogImage } from "@/lib/og"
import { defaultManager, shadcnRunner, site } from "@/lib/site"

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
    alternates: {
      canonical: `/docs/${slug}`,
      // The Markdown mirror of this page: `docs/site-polish.md`.
      types: { "text/markdown": `/docs/${slug}.md` },
    },
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

  // What the page is about to draw, which is also what the TOC links to. Built
  // here rather than scraped back out of the DOM: `docs-toc.tsx`.
  const sections: TocSection[] = [
    entry.item && { id: "install", label: "Install" },
    entry.notes?.length && { id: "notes", label: entry.item ? "Notes" : "How it works" },
    entry.usage && { id: "usage", label: "Usage" },
    entry.props?.length && { id: "props", label: "Props" },
    entry.api?.length && { id: "api", label: "API" },
    sources.length && { id: "source", label: "Source" },
  ].filter((section): section is TocSection => Boolean(section))

  return (
    // The TOC is a sibling of the article, not a child of it: the page owns the
    // content/rail split because the layout above it cannot know the sections.
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_11rem] xl:gap-10">
      <article className="min-w-0 space-y-10">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{entry.title}</h1>
          <PageActions slug={entry.slug} />
        </div>
        <p className="max-w-[64ch] text-[15px] leading-relaxed text-muted-foreground">
          {entry.summary}
        </p>
        {workbenchComponent(entry.item) && (
          <Link href={`/workbench?c=${entry.item}`} className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-[13px] transition-colors hover:bg-muted">
            Open in workbench <span aria-hidden>↗</span>
          </Link>
        )}
      </header>

      {entry.item && demoExists(entry.slug) ? <DemoPanel slug={entry.slug} /> : null}

      {entry.item ? (
        <section className="space-y-3">
          <h2 id="install" className="scroll-mt-20 text-[15px] font-medium">Install</h2>
          <InstallCommand item={entry.item} />
          {/* Chrome, Edge and Opera on a desktop; it renders nothing elsewhere. */}
          <InstallToFolder item={entry.item} />
        </section>
      ) : null}

      {entry.notes?.length ? (
        <section className="space-y-3">
          <h2 id="notes" className="scroll-mt-20 text-[15px] font-medium">
            {entry.item ? "Notes" : "How it works"}
          </h2>
          {/* The column is ~960px on a wide display; prose stops at a readable
              measure rather than running the full width of it. */}
          <ul className="max-w-[78ch] space-y-2 text-[14px] leading-relaxed text-muted-foreground">
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
          <h2 id="usage" className="scroll-mt-20 text-[15px] font-medium">Usage</h2>
          <CodeBlock code={entry.usage} />
        </section>
      ) : null}

      {entry.props?.length ? (
        <section className="space-y-3">
          <h2 id="props" className="scroll-mt-20 text-[15px] font-medium">Props</h2>
          <PropsTable rows={entry.props} />
        </section>
      ) : null}

      {entry.api?.length ? (
        <section className="space-y-3">
          <h2 id="api" className="scroll-mt-20 text-[15px] font-medium">API</h2>
          <PropsTable rows={entry.api} caption="exports" />
        </section>
      ) : null}

      {sources.length ? (
        <section className="space-y-3">
          <h2 id="source" className="scroll-mt-20 text-[15px] font-medium">Source</h2>
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

      <DocsPager slug={entry.slug} />
      </article>

      <DocsToc sections={sections} />
    </div>
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
      <CodeBlock code={`${shadcnRunner(defaultManager)} shadcn@latest add @robocn/robot-arm @robocn/delta-arm`} />
    </section>
  )
}
