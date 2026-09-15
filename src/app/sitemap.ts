/**
 * Every page the site has, built from `docs` — so an item that ships today is
 * in the sitemap today rather than the next time someone remembers to add it.
 */

import type { MetadataRoute } from "next"

import { docs } from "@/lib/docs"
import { siteUrl } from "@/lib/site"

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date()

  return [
    { url: siteUrl, lastModified: updated, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/docs`, lastModified: updated, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/workbench`, lastModified: updated, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/about`, lastModified: updated, changeFrequency: "monthly", priority: 0.6 },
    ...docs.map((entry) => ({
      url: `${siteUrl}/docs/${entry.slug}`,
      lastModified: updated,
      changeFrequency: "monthly" as const,
      // A written page outranks one generated from its registry entry.
      priority: entry.notes?.length ? 0.7 : 0.5,
    })),
  ]
}
