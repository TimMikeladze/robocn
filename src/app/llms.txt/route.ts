/**
 * `/llms.txt` — the whole site as one file, for an agent deciding what to read.
 * Built from `docs`, so an item that ships this morning is in it this morning.
 */

import type { NextRequest } from "next/server"

import { llmsTxt } from "@/lib/markdown"

export async function GET(request: NextRequest) {
  return new Response(llmsTxt(request.nextUrl.origin), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
