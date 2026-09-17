/**
 * Crawl everything. The API routes are excluded because they are machinery —
 * `/llms.txt` and the `.md` mirrors are the agent-facing surface, and both are
 * reachable without them. Studio is a private workspace, share links are
 * credentials and embeds are fragments of other people's pages; what Studio
 * publishes lives at `/d/`, `/o/` and `/explore`, which are open.
 */

import type { MetadataRoute } from "next"

import { siteUrl } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/studio/", "/s/", "/embed/"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
