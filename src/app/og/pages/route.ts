/**
 * The card list `pnpm og` captures, served off the site it is capturing.
 *
 * The slugs live in `docs.ts`, which is TypeScript the capture script cannot
 * import — and re-deriving them from `registry.json` would miss the pages that
 * install nothing. So the script asks the server it is already driving.
 *
 * A static segment, so it wins over `/og/[slug]` rather than being one.
 */

import { ogPages } from "@/lib/og-pages"

export const dynamic = "force-dynamic"

export function GET() {
  return Response.json({ slugs: ogPages.map((page) => page.slug) })
}
