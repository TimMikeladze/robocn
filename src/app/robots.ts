/**
 * Crawl everything. The API routes are excluded because they are machinery —
 * `/llms.txt` and the `.md` mirrors are the agent-facing surface, and both are
 * reachable without them.
 */

import type { MetadataRoute } from "next"

import { siteUrl } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
