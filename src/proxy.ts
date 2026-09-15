/**
 * Markdown mirrors of the docs, routed.
 *
 * `/docs/[slug]/page.tsx` already owns `/docs/robot-arm`, so a route handler
 * cannot sit at `/docs/robot-arm.md` beside it. This rewrites those URLs — and
 * any docs URL requested with `Accept: text/markdown` — onto the handler at
 * `/api/md/...`, which is the only thing that serves them.
 *
 * Proxy is Next 16's name for middleware; the file convention is unchanged.
 * See `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/** `/docs.md` and `/docs/<slug>.md`, and nothing else. */
const MD_URL = /^\/docs(\/[^/]+)?\.md$/
/** The HTML docs routes, which can also be *asked* for as Markdown. */
const DOCS_URL = /^\/docs(\/[^/]+)?\/?$/

function wantsMarkdown(request: NextRequest) {
  const accept = request.headers.get("accept") ?? ""
  // Only when it is asked for by name: `*/*` from a browser is not a request
  // for Markdown, and neither is an `Accept` that merely tolerates it.
  return /\btext\/markdown\b/.test(accept)
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (MD_URL.test(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = `/api/md${pathname.replace(/\.md$/, "")}`
    return NextResponse.rewrite(url)
  }

  if (DOCS_URL.test(pathname) && wantsMarkdown(request)) {
    const url = request.nextUrl.clone()
    url.pathname = `/api/md${pathname.replace(/\/$/, "")}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/docs", "/docs/:path*", "/docs.md"],
}
