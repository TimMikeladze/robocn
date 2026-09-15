/**
 * The Markdown mirror of a docs page.
 *
 * Nothing links here directly: `src/proxy.ts` rewrites `/docs/robot-arm.md`,
 * `/docs.md` and any docs URL asked for with `Accept: text/markdown` onto this
 * handler, because a route handler cannot share `/docs/[slug]` with the page
 * that already owns it. Reasoning: `docs/site-polish.md`.
 */

import type { NextRequest } from "next/server"

import { docBySlug } from "@/lib/docs"
import { entryMarkdown, indexMarkdown } from "@/lib/markdown"

/** The origin the request came in on, so a preview prints its own install line. */
const originOf = (request: NextRequest) => request.nextUrl.origin

const markdown = (body: string) =>
  new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      // Same freshness as the pages it mirrors, and cheap to regenerate.
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  })

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await params
  const [section, slug, ...rest] = path

  if (section !== "docs" || rest.length) {
    return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain" } })
  }

  if (!slug) return markdown(indexMarkdown(originOf(request)))

  const entry = docBySlug(slug)
  if (!entry) {
    return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain" } })
  }

  return markdown(entryMarkdown(entry, originOf(request)))
}
